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

export { upload, createCourse, getAllCourses, getCourseById }