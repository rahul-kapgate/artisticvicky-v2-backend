import { supabase } from "../config/supabaseClient.js";
import multer from "multer";
import { s3 } from "../config/s3Client.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
      file.mimetype,
    );
    cb(ok ? null : new Error("Only image files are allowed"), ok);
  },
});

const safeName = (name = "image") => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const buildS3Url = (key) =>
  `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

async function uploadCourseImage(file) {
  const key = `Courses-images/${Date.now()}_${safeName(file.originalname)}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3.send(command);

  return {
    key,
    url: buildS3Url(key),
  };
}

function getS3KeyFromUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const expectedHost = `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;

    if (parsed.host !== expectedHost) return null;

    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

async function deleteCourseImageFromS3(imageUrl) {
  const key = getS3KeyFromUrl(imageUrl);
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  });

  await s3.send(command);
}

/**
 * Build course_id => [section_type, ...]
 */
async function getSectionsMap(courseIds = []) {
  if (!courseIds.length) return {};

  const { data, error } = await supabase
    .from("course_sections")
    .select("course_id, section_type")
    .in("course_id", courseIds);

  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    if (!acc[row.course_id]) acc[row.course_id] = [];
    acc[row.course_id].push(row.section_type);
    return acc;
  }, {});
}

/**
 * Build course_id => masterclass_details object
 */
async function getMasterclassMap(courseIds = []) {
  if (!courseIds.length) return {};

  const { data, error } = await supabase
    .from("masterclass_details")
    .select("*")
    .in("course_id", courseIds);

  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    acc[row.course_id] = row;
    return acc;
  }, {});
}

/**
 * Enrich course response with:
 * 1. sections
 * 2. masterclass_details (only when course_type === "masterclass")
 */
async function enrichCourses(courses = []) {
  if (!courses.length) return [];

  const courseIds = courses.map((course) => course.id);

  const [sectionsMap, masterclassMap] = await Promise.all([
    getSectionsMap(courseIds),
    getMasterclassMap(courseIds),
  ]);

  return courses.map((course) => ({
    ...course,
    sections: sectionsMap[course.id] || [],
    masterclass_details:
      course.course_type === "masterclass"
        ? masterclassMap[course.id] || null
        : null,
  }));
}

const createCourse = async (req, res) => {
  try {
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
      price_without_discount,
      course_type, // ✅ added
    } = req.body;

    const file = req.file;

    if (!course_name || !description || !price || !price_without_discount) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Course image is required",
      });
    }

    // ✅ Upload image to S3
    const { url: imageUrl } = await uploadCourseImage(file);

    // ✅ Insert into Supabase
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
          price_without_discount,
          course_type: course_type || "course", // ✅ default support
        },
      ])
      .select();

    if (error) throw error;

    // ✅ Enrich response with sections + masterclass details
    const [enrichedCourse] = await enrichCourses([data[0]]);

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      course: enrichedCourse,
    });
  } catch (err) {
    console.error("Error creating course:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error while creating course",
      error: err.message,
    });
  }
};

const getAllCourses = async (req, res) => {
  try {
    const { data: courses, error } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    // ✅ Add sections + masterclass details
    const enrichedCourses = await enrichCourses(courses || []);

    res.status(200).json({
      success: true,
      message: "Courses fetched successfully",
      count: enrichedCourses.length,
      data: enrichedCourses,
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

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .single();

    if (courseError) {
      if (courseError.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }
      throw courseError;
    }

    // ✅ Add sections + masterclass details
    const [enrichedCourse] = await enrichCourses([course]);

    res.status(200).json({
      success: true,
      message: "Course fetched successfully",
      data: enrichedCourse,
    });
  } catch (error) {
    console.error("❌ Get course by ID error:", error);
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

    const { data: courses, error: courseError } = await supabase
      .from("courses")
      .select(
        "id, course_name, description, price, image, category, level, language, duration, is_published, created_by, students_enrolled, rating, tags, created_at, updated_at, price_without_discount, course_type, blocked_users",
      )
      .contains("students_enrolled", [Number(userId)])
      .order("created_at", { ascending: true });

    if (courseError) throw courseError;

    if (!courses || courses.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No enrolled courses found",
        count: 0,
        data: [],
      });
    }

    // ✅ Add sections + masterclass details
    const enrichedCourses = await enrichCourses(courses);

    res.status(200).json({
      success: true,
      message: "Enrolled courses fetched successfully",
      count: enrichedCourses.length,
      data: enrichedCourses,
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
      price_without_discount,
      course_type, // ✅ added
    } = req.body;

    const { data: existingCourse, error: fetchError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingCourse) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    let imageUrl = existingCourse.image;

    // ✅ Upload new image to S3 if provided
    if (req.file) {
      const uploaded = await uploadCourseImage(req.file);
      imageUrl = uploaded.url;

      // ✅ Delete old image only after new image upload succeeds
      if (existingCourse.image) {
        try {
          await deleteCourseImageFromS3(existingCourse.image);
        } catch (deleteErr) {
          console.error("Old image delete failed:", deleteErr.message);
        }
      }
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
        price_without_discount,
        course_type: course_type || existingCourse.course_type, // ✅ preserve or update
        image: imageUrl,
        updated_at: new Date(),
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    // ✅ Enrich response with sections + masterclass details
    const [enrichedCourse] = await enrichCourses([data[0]]);

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      course: enrichedCourse,
    });
  } catch (error) {
    console.error("Update course error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while updating course",
      error: error.message,
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

    if (fetchError || !course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // ✅ Remove image from S3
    if (course.image) {
      try {
        await deleteCourseImageFromS3(course.image);
      } catch (deleteErr) {
        console.error("Image delete failed:", deleteErr.message);
      }
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
      error: error.message,
    });
  }
};

export {
  upload,
  createCourse,
  getAllCourses,
  getCourseById,
  getEnrolledCourses,
};
