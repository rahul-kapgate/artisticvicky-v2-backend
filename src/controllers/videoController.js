import { supabase } from "../config/supabaseClient.js";

/**
 * ➕ Add Video under a Section
 */
export const addVideo = async (req, res) => {
    try {
        const { section_id, title, description, youtube_url, thumbnail_url, duration, is_free } = req.body;

        // 🧩 Validation
        if (!section_id || isNaN(Number(section_id))) {
            return res.status(400).json({ success: false, message: "A valid section_id is required." });
        }

        if (!title || title.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: "Video title must be at least 3 characters long.",
            });
        }

        if (!youtube_url || !youtube_url.includes("youtube.com") && !youtube_url.includes("youtu.be")) {
            return res.status(400).json({
                success: false,
                message: "A valid YouTube video URL is required.",
            });
        }

        // 🧠 Check section existence
        const { data: section, error: fetchError } = await supabase
            .from("sections")
            .select("id, title")
            .eq("id", section_id)
            .single();

        if (fetchError || !section) {
            return res.status(404).json({
                success: false,
                message: `Section with ID ${section_id} not found.`,
            });
        }

        // 🪄 Insert video
        const { data, error } = await supabase
            .from("video_lectures")
            .insert([
                {
                    section_id,
                    title: title.trim(),
                    description: description?.trim() || null,
                    youtube_url: youtube_url.trim(),
                    thumbnail_url: thumbnail_url || null,
                    duration: duration || null,
                    is_free: Boolean(is_free),
                },
            ])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: `Video '${data.title}' added successfully under section '${section.title}'.`,
            data,
        });
    } catch (err) {
        console.error("Error adding video:", err);
        res.status(500).json({ success: false, message: "An unexpected error occurred while adding video." });
    }
};

/**
 * 📋 Get All Videos (or by Section)
 */
export const getVideos = async (req, res) => {
    try {
        const { section_id } = req.query;

        let query = supabase
            .from("video_lectures")
            .select("id, title, description, youtube_url, thumbnail_url, duration, is_free, section_id, created_at")
            .order("created_at", { ascending: true });

        if (section_id) query = query.eq("section_id", section_id);

        const { data, error } = await query;
        if (error) throw error;

        res.status(200).json({
            success: true,
            message: `Fetched ${data.length} video(s)${section_id ? ` from section ${section_id}` : ""} successfully.`,
            data,
        });
    } catch (err) {
        console.error("Error fetching videos:", err);
        res.status(500).json({ success: false, message: "An unexpected error occurred while fetching videos." });
    }
};

/**
 * 📺 Get Single Video
 */
export const getVideoById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ success: false, message: "A valid video ID is required." });
        }

        const { data, error } = await supabase.from("video_lectures").select("*").eq("id", id).single();

        if (error && error.code === "PGRST116") {
            return res.status(404).json({ success: false, message: `Video with ID ${id} not found.` });
        }
        if (error) throw error;

        res.status(200).json({
            success: true,
            message: `Video '${data.title}' fetched successfully.`,
            data,
        });
    } catch (err) {
        console.error("Error fetching video:", err);
        res.status(500).json({ success: false, message: "An unexpected error occurred while fetching video." });
    }
};

/**
 * ✏️ Update (Edit) Video
 */
export const updateVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, youtube_url, thumbnail_url, duration, is_free } = req.body;

        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ success: false, message: "A valid video ID is required for update." });
        }

        if (title && title.trim().length < 3) {
            return res.status(400).json({ success: false, message: "Video title must be at least 3 characters long." });
        }

        // Check existence
        const { data: existing, error: fetchError } = await supabase
            .from("video_lectures")
            .select("id, title")
            .eq("id", id)
            .single();

        if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
        if (!existing) {
            return res.status(404).json({ success: false, message: `Video with ID ${id} not found.` });
        }

        // Update
        const { data, error } = await supabase
            .from("video_lectures")
            .update({
                title: title?.trim() || existing.title,
                description: description?.trim() || existing.description,
                youtube_url: youtube_url?.trim() || existing.youtube_url,
                thumbnail_url: thumbnail_url || existing.thumbnail_url,
                duration: duration ?? existing.duration,
                is_free: is_free ?? existing.is_free,
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: `Video '${data.title}' updated successfully.`,
            data,
        });
    } catch (err) {
        console.error("Error updating video:", err);
        res.status(500).json({ success: false, message: "An unexpected error occurred while updating video." });
    }
};

/**
 * 🗑️ Delete Video
 */
export const deleteVideo = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ success: false, message: "A valid video ID is required for deletion." });
        }

        // Check existence
        const { data: existing, error: fetchError } = await supabase
            .from("video_lectures")
            .select("id, title")
            .eq("id", id)
            .single();

        if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
        if (!existing) {
            return res.status(404).json({ success: false, message: `Video with ID ${id} not found.` });
        }

        // Delete
        const { error } = await supabase.from("video_lectures").delete().eq("id", id);
        if (error) throw error;

        res.status(200).json({
            success: true,
            message: `Video '${existing.title}' deleted successfully.`,
        });
    } catch (err) {
        console.error("Error deleting video:", err);
        res.status(500).json({ success: false, message: "An unexpected error occurred while deleting video." });
    }
};
