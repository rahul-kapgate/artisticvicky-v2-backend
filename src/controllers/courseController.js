import { supabase } from "../config/supabaseClient.js";

const createCourse = async (req, res) => {

    try {
        const { course_name, description, price, image, category, level, language, duration, is_published, tags } = req.body;

        // Validate required fields
        if (!course_name || !description || !price || !image) {
            return res.status(400).json({ success: false, message: "All required fields must be provided" });
        }

        // Insert into Supabase
        const { data, error } = await supabase
            .from("courses")
            .insert([
                {
                    course_name,
                    description,
                    price,
                    image,
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

export { createCourse, getAllCourses, getCourseById }