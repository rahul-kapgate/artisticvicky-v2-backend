import { supabase } from "../config/supabaseClient.js";
import multer from "multer";
import { s3 } from "../config/s3Client.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Multer config
 * Only for masterclass image upload
 */
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

export const uploadMasterclassImage = upload.single("image");

const safeName = (name = "image") => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const buildS3Url = (key) =>
  `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

async function uploadCourseImage(file) {
  const key = `masterclass-images/${Date.now()}_${safeName(file.originalname)}`;

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

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "")
    return defaultValue;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
};

const parseNumber = (value, defaultValue = null) => {
  if (value === undefined || value === null || value === "")
    return defaultValue;
  const num = Number(value);
  return Number.isNaN(num) ? defaultValue : num;
};

const parseTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;

  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(tags)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
};

export const createMasterclass = async (req, res) => {
  let uploadedImageUrl = null;

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
      masterclass_start_at,
      masterclass_end_at,
      meeting_provider,
      meeting_url,
      meeting_visible_before_minutes,
      approval_required,
      ppt_file_url,
      ppt_file_name,
      masterclass_status,
      recording_link,
    } = req.body;

    const file = req.file;

    if (
      !course_name ||
      !description ||
      !price ||
      !price_without_discount ||
      !masterclass_start_at ||
      !masterclass_end_at
    ) {
      return res.status(400).json({
        success: false,
        message:
          "course_name, description, price, price_without_discount, masterclass_start_at and masterclass_end_at are required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Masterclass image is required",
      });
    }

    // Upload image to S3
    const { url: imageUrl } = await uploadCourseImage(file);
    uploadedImageUrl = imageUrl;

    // Insert into courses table
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .insert([
        {
          course_name,
          description,
          price: parseNumber(price, 0),
          image: imageUrl,
          category,
          level: level || "Beginner",
          language: language || "English",
          duration,
          is_published: parseBoolean(is_published, false),
          created_by: req.user?.id,
          tags: parseTags(tags),
          price_without_discount: parseNumber(price_without_discount, 0),
          course_type: "masterclass",
        },
      ])
      .select()
      .single();

    if (courseError) throw courseError;

    // Insert into masterclass_details table
    const { data: masterclassDetails, error: detailsError } = await supabase
      .from("masterclass_details")
      .insert([
        {
          course_id: courseData.id,
          masterclass_start_at,
          masterclass_end_at,
          meeting_provider: meeting_provider || null,
          meeting_url: meeting_url || null,
          meeting_visible_before_minutes: parseNumber(
            meeting_visible_before_minutes,
            15,
          ),
          approval_required: parseBoolean(approval_required, false),
          ppt_file_url: ppt_file_url || null,
          ppt_file_name: ppt_file_name || null,
          masterclass_status: masterclass_status || "draft",
          recording_link: recording_link || null,
        },
      ])
      .select()
      .single();

    if (detailsError) {
      // rollback course row
      await supabase.from("courses").delete().eq("id", courseData.id);

      // rollback uploaded image
      if (uploadedImageUrl) {
        try {
          await deleteCourseImageFromS3(uploadedImageUrl);
        } catch (err) {
          console.error("Image rollback delete failed:", err.message);
        }
      }

      throw detailsError;
    }

    return res.status(201).json({
      success: true,
      message: "Masterclass created successfully",
      data: {
        ...courseData,
        masterclass_details: masterclassDetails,
      },
    });
  } catch (error) {
    console.error("Create masterclass error:", error.message);

    if (uploadedImageUrl) {
      try {
        await deleteCourseImageFromS3(uploadedImageUrl);
      } catch (err) {
        console.error("Image cleanup failed:", err.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Server error while creating masterclass",
      error: error.message,
    });
  }
};

export const updateMasterclass = async (req, res) => {
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
      masterclass_start_at,
      masterclass_end_at,
      meeting_provider,
      meeting_url,
      meeting_visible_before_minutes,
      approval_required,
      ppt_file_url,
      ppt_file_name,
      masterclass_status,
      recording_link,
    } = req.body;

    const { data: existingCourse, error: fetchCourseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .eq("course_type", "masterclass")
      .single();

    if (fetchCourseError || !existingCourse) {
      return res.status(404).json({
        success: false,
        message: "Masterclass course not found",
      });
    }

    const { data: existingDetails, error: fetchDetailsError } = await supabase
      .from("masterclass_details")
      .select("*")
      .eq("course_id", id)
      .single();

    if (fetchDetailsError || !existingDetails) {
      return res.status(404).json({
        success: false,
        message: "Masterclass details not found",
      });
    }

    let imageUrl = existingCourse.image;

    // Upload new image if provided
    if (req.file) {
      const uploaded = await uploadCourseImage(req.file);
      imageUrl = uploaded.url;

      // delete old image after new upload success
      if (existingCourse.image) {
        try {
          await deleteCourseImageFromS3(existingCourse.image);
        } catch (deleteErr) {
          console.error("Old image delete failed:", deleteErr.message);
        }
      }
    }

    const { data: updatedCourse, error: updateCourseError } = await supabase
      .from("courses")
      .update({
        course_name: course_name ?? existingCourse.course_name,
        description: description ?? existingCourse.description,
        price:
          price !== undefined
            ? parseNumber(price, existingCourse.price)
            : existingCourse.price,
        image: imageUrl,
        category: category ?? existingCourse.category,
        level: level ?? existingCourse.level,
        language: language ?? existingCourse.language,
        duration: duration ?? existingCourse.duration,
        is_published:
          is_published !== undefined
            ? parseBoolean(is_published, existingCourse.is_published)
            : existingCourse.is_published,
        tags: tags !== undefined ? parseTags(tags) : existingCourse.tags,
        price_without_discount:
          price_without_discount !== undefined
            ? parseNumber(
                price_without_discount,
                existingCourse.price_without_discount,
              )
            : existingCourse.price_without_discount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateCourseError) throw updateCourseError;

    const { data: updatedDetails, error: updateDetailsError } = await supabase
      .from("masterclass_details")
      .update({
        masterclass_start_at:
          masterclass_start_at ?? existingDetails.masterclass_start_at,
        masterclass_end_at:
          masterclass_end_at ?? existingDetails.masterclass_end_at,
        meeting_provider: meeting_provider ?? existingDetails.meeting_provider,
        meeting_url: meeting_url ?? existingDetails.meeting_url,
        meeting_visible_before_minutes:
          meeting_visible_before_minutes !== undefined
            ? parseNumber(
                meeting_visible_before_minutes,
                existingDetails.meeting_visible_before_minutes,
              )
            : existingDetails.meeting_visible_before_minutes,
        approval_required:
          approval_required !== undefined
            ? parseBoolean(approval_required, existingDetails.approval_required)
            : existingDetails.approval_required,
        ppt_file_url:
          ppt_file_url !== undefined
            ? ppt_file_url || null
            : existingDetails.ppt_file_url,
        ppt_file_name:
          ppt_file_name !== undefined
            ? ppt_file_name || null
            : existingDetails.ppt_file_name,
        masterclass_status:
          masterclass_status ?? existingDetails.masterclass_status,
        recording_link:
          recording_link !== undefined
            ? recording_link || null
            : existingDetails.recording_link,
        updated_at: new Date().toISOString(),
      })
      .eq("course_id", id)
      .select()
      .single();

    if (updateDetailsError) throw updateDetailsError;

    return res.status(200).json({
      success: true,
      message: "Masterclass updated successfully",
      data: {
        ...updatedCourse,
        masterclass_details: updatedDetails,
      },
    });
  } catch (error) {
    console.error("Update masterclass error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while updating masterclass",
      error: error.message,
    });
  }
};

export const getAllMasterclasses = async (req, res) => {
  try {
    const { data: masterclasses, error } = await supabase
      .from("courses")
      .select(
        `
        *,
        masterclass_details (*)
      `,
      )
      .eq("course_type", "masterclass")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Masterclasses fetched successfully",
      count: masterclasses?.length || 0,
      data: masterclasses || [],
    });
  } catch (error) {
    console.error("Get all masterclasses error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching masterclasses",
      error: error.message,
    });
  }
};

export const getMasterclassById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: masterclass, error } = await supabase
      .from("courses")
      .select(
        `
        *,
        masterclass_details (*)
      `,
      )
      .eq("id", id)
      .eq("course_type", "masterclass")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          message: "Masterclass not found",
        });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Masterclass fetched successfully",
      data: masterclass,
    });
  } catch (error) {
    console.error("Get masterclass by id error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching masterclass",
      error: error.message,
    });
  }
};
