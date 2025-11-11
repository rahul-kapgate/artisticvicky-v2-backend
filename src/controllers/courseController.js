import { supabase } from "../config/supabaseClient.js";
import multer from "multer";
import fs from "fs";

const upload = multer({ dest: "uploads/" });

const createCourse = async (req, res) => {

    try {
        const { course_name, description, price, category, level, language, duration, is_published, tags } = req.body;

        const file = req.file;

        // Validate required fields
        if (!course_name || !description || !price) {
            return res.status(400).json({ success: false, message: "All required fields must be provided" });
        }

        if (!file) {
            return res.status(400).json({ success: false, message: "Course image is required" });
        }

        // ✅ Upload image to Supabase Storage
        const filePath = `courses/${Date.now()}_${file.originalname}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("course-images")
            .upload(filePath, fs.createReadStream(file.path), {
                cacheControl: "3600",
                upsert: false,
                contentType: file.mimetype,
                duplex: "half",
            });

        fs.unlinkSync(file.path); // cleanup temp file

        if (uploadError) throw uploadError;

        // ✅ Get public URL
        const { data: publicUrlData } = supabase.storage
            .from("course-images")
            .getPublicUrl(filePath);

        const imageUrl = publicUrlData.publicUrl;

        // Insert into Supabase
        const { data, error } = await supabase
            .from("courses")
            .insert([
                {
                    course_name,
                    description,
                    price,
                    image: imageUrl,
                    category,
                    level,
                    language,
                    duration,
                    is_published,
                    created_by: req.user.id,
                    tags,
                },
            ])
            .select();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            message: "Course created successfully",
            course: data[0],
        });

    } catch (err) {
        console.error("Error creating course:", err.message);
        res.status(500).json({
            success: false,
            message: "Server error while creating course",
        });
    }
};

const getAllCourses = async (req, res) => {

    try {
        const { data: courses, error } = await supabase
            .from("courses")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: "Courses fetched successfully",
            count: courses.length,
            data: courses,
        });

    } catch (error) {
        console.error("Get all courses error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const getCourseById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: course, error } = await supabase
            .from("courses")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                // PostgREST code for "No rows found"
                return res.status(404).json({
                    success: false,
                    message: "Course not found",
                });
            }
            throw error;
        }

        res.status(200).json({
            success: true,
            message: "Course fetched successfully",
            data: course,
        });
    } catch (error) {
        console.error("Get course by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const getEnrolledCourses = async (req, res) => {

    try {
      const { userId } = req.params;
  
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User not found",
        });
      }
  
      // 1️⃣ Fetch enrolled courses
      const { data: courses, error: courseError } = await supabase
        .from("courses")
        .select("id, course_name, description, price, image, category, level, language, duration, is_published, created_by, students_enrolled, rating, tags, created_at, updated_at")
        .contains("students_enrolled", [Number(userId)])
        .order("created_at", { ascending: false });
  
      if (courseError) throw courseError;
  
      if (!courses || courses.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No enrolled courses found",
          count: 0,
          data: [],
        });
      }
  
      // 2️⃣ Get all course IDs
      const courseIds = courses.map((c) => c.id);
  
      // 3️⃣ Fetch sections for those courses
      const { data: sectionsData, error: sectionError } = await supabase
        .from("course_sections")
        .select("course_id, section_type")
        .in("course_id", courseIds);
  
      if (sectionError) throw sectionError;
  
      // 4️⃣ Map sections to corresponding courses
      const sectionsMap = sectionsData.reduce((acc, row) => {
        if (!acc[row.course_id]) acc[row.course_id] = [];
        acc[row.course_id].push(row.section_type);
        return acc;
      }, {});
  
      // 5️⃣ Attach sections to each course
      const coursesWithSections = courses.map((course) => ({
        ...course,
        sections: sectionsMap[course.id] || [],
      }));
  
      // 6️⃣ Respond with final data
      res.status(200).json({
        success: true,
        message: "Enrolled courses fetched successfully",
        count: coursesWithSections.length,
        data: coursesWithSections,
      });
    } catch (error) {
      console.error("❌ Get enrolled courses error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
  

export const updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            course_name,
            description,
            price,
            category,
            level,
            language,
            duration,
            is_published,
            tags,
        } = req.body;

        const { data: existingCourse, error: fetchError } = await supabase
            .from("courses")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchError || !existingCourse)
            return res
                .status(404)
                .json({ success: false, message: "Course not found" });

        let imageUrl = existingCourse.image;

        // ✅ Upload new image if provided
        if (req.file) {
            // Optional: Delete old image
            if (existingCourse.image) {
                const oldPath = existingCourse.image.split("course-images/")[1];
                if (oldPath)
                    await supabase.storage.from("course-images").remove([oldPath]);
            }

            const filePath = `courses/${Date.now()}_${req.file.originalname}`;
            const { error: uploadError } = await supabase.storage
                .from("course-images")
                .upload(filePath, fs.createReadStream(req.file.path), {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: req.file.mimetype,
                    duplex: "half",
                });

            fs.unlinkSync(req.file.path);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from("course-images")
                .getPublicUrl(filePath);
            imageUrl = publicUrlData.publicUrl;
        }

        const { data, error } = await supabase
            .from("courses")
            .update({
                course_name,
                description,
                price,
                category,
                level,
                language,
                duration,
                is_published,
                tags,
                image: imageUrl,
                updated_at: new Date(),
            })
            .eq("id", id)
            .select();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: "Course updated successfully",
            course: data[0],
        });
    } catch (error) {
        console.error("Update course error:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error while updating course",
        });
    }
};


export const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: course, error: fetchError } = await supabase
            .from("courses")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchError || !course)
            return res
                .status(404)
                .json({ success: false, message: "Course not found" });

        // ✅ Remove image from storage
        if (course.image) {
            const imagePath = course.image.split("course-images/")[1];
            if (imagePath)
                await supabase.storage.from("course-images").remove([imagePath]);
        }

        const { error } = await supabase.from("courses").delete().eq("id", id);
        if (error) throw error;

        res.status(200).json({
            success: true,
            message: "Course deleted successfully",
        });
    } catch (error) {
        console.error("Delete course error:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error while deleting course",
        });
    }
};


export { upload, createCourse, getAllCourses, getCourseById, getEnrolledCourses }