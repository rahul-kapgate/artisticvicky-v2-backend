import { supabase } from "../config/supabaseClient.js";
import multer from "multer";
import { s3 } from "../config/s3Client.js";
import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
      file.mimetype
    );
    cb(ok ? null : new Error("Only image files are allowed"), ok);
  },
});

const safeName = (name = "image") => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const buildS3Url = (key) =>
  `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

async function uploadMasterclassImage(file) {
  const key = `Masterclass-images/${Date.now()}_${safeName(file.originalname)}`;

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

async function deleteMasterclassImageFromS3(imageUrl) {
  const key = getS3KeyFromUrl(imageUrl);
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  });

  await s3.send(command);
}

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
};

const parseNumber = (value, defaultValue = null) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  const num = Number(value);
  return Number.isNaN(num) ? defaultValue : num;
};

const parseTags = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallback below
  }

  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const flattenMasterclass = (courseRow) => {
  const details = Array.isArray(courseRow.masterclass_details)
    ? courseRow.masterclass_details[0]
    : courseRow.masterclass_details || null;

  return {
    ...courseRow,
    ...(details || {}),
    masterclass_details: undefined,
  };
};

const createMasterclass = async (req, res) => {
  let uploadedImageUrl = null;
  let createdCourseId = null;

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
    } = req.body;

    const file = req.file;

    if (
      !course_name ||
      !description ||
      price === undefined ||
      price === null ||
      price === "" ||
      price_without_discount === undefined ||
      price_without_discount === null ||
      price_without_discount === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          "course_name, description, price and price_without_discount are required",
      });
    }

    if (!masterclass_start_at || !masterclass_end_at) {
      return res.status(400).json({
        success: false,
        message: "masterclass_start_at and masterclass_end_at are required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Masterclass image is required",
      });
    }

    const startDate = new Date(masterclass_start_at);
    const endDate = new Date(masterclass_end_at);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid masterclass date/time",
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: "masterclass_end_at must be after masterclass_start_at",
      });
    }

    const allowedProviders = ["zoom", "google_meet", "custom"];
    if (meeting_provider && !allowedProviders.includes(meeting_provider)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meeting_provider",
      });
    }

    const allowedStatuses = ["draft", "published", "completed", "cancelled"];
    const finalStatus = masterclass_status || "draft";

    if (!allowedStatuses.includes(finalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid masterclass_status",
      });
    }

    const { url: imageUrl } = await uploadMasterclassImage(file);
    uploadedImageUrl = imageUrl;

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .insert([
        {
          course_name,
          description,
          price: parseNumber(price, 0),
          image: imageUrl,
          category: category || null,
          level: level || "Beginner",
          language: language || "English",
          duration: duration || null,
          is_published: parseBoolean(is_published, false),
          created_by: req.user.id,
          tags: parseTags(tags),
          price_without_discount: parseNumber(price_without_discount, 0),
          course_type: "masterclass",
        },
      ])
      .select()
      .single();

    if (courseError) throw courseError;

    createdCourseId = courseData.id;

    const { error: detailError } = await supabase
      .from("masterclass_details")
      .insert([
        {
          course_id: createdCourseId,
          masterclass_start_at,
          masterclass_end_at,
          meeting_provider: meeting_provider || null,
          meeting_url: meeting_url || null,
          meeting_visible_before_minutes: parseNumber(
            meeting_visible_before_minutes,
            15
          ),
          approval_required: parseBoolean(approval_required, false),
          ppt_file_url: ppt_file_url || null,
          ppt_file_name: ppt_file_name || null,
          masterclass_status: finalStatus,
        },
      ]);

    if (detailError) throw detailError;

    const { data: finalData, error: finalError } = await supabase
      .from("courses")
      .select("*, masterclass_details(*)")
      .eq("id", createdCourseId)
      .single();

    if (finalError) throw finalError;

    return res.status(201).json({
      success: true,
      message: "Masterclass created successfully",
      data: flattenMasterclass(finalData),
    });
  } catch (err) {
    console.error("Error creating masterclass:", err.message);

    if (createdCourseId) {
      try {
        await supabase.from("courses").delete().eq("id", createdCourseId);
      } catch (rollbackErr) {
        console.error("Course rollback failed:", rollbackErr.message);
      }
    }

    if (uploadedImageUrl) {
      try {
        await deleteMasterclassImageFromS3(uploadedImageUrl);
      } catch (imageErr) {
        console.error("Image rollback failed:", imageErr.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Server error while creating masterclass",
      error: err.message,
    });
  }
};

const getAllMasterclasses = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select("*, masterclass_details(*)")
      .eq("course_type", "masterclass")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const finalData = (data || []).map(flattenMasterclass);

    return res.status(200).json({
      success: true,
      message: "Masterclasses fetched successfully",
      count: finalData.length,
      data: finalData,
    });
  } catch (error) {
    console.error("Get all masterclasses error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getMasterclassById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("courses")
      .select("*, masterclass_details(*)")
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
      data: flattenMasterclass(data),
    });
  } catch (error) {
    console.error("Get masterclass by ID error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateMasterclass = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existingCourse, error: courseFetchError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .eq("course_type", "masterclass")
      .single();

    if (courseFetchError || !existingCourse) {
      return res.status(404).json({
        success: false,
        message: "Masterclass not found",
      });
    }

    const { data: existingDetails, error: detailsFetchError } = await supabase
      .from("masterclass_details")
      .select("*")
      .eq("course_id", id)
      .single();

    if (detailsFetchError || !existingDetails) {
      return res.status(404).json({
        success: false,
        message: "Masterclass details not found",
      });
    }

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
    } = req.body;

    const nextStart = masterclass_start_at || existingDetails.masterclass_start_at;
    const nextEnd = masterclass_end_at || existingDetails.masterclass_end_at;

    const startDate = new Date(nextStart);
    const endDate = new Date(nextEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid masterclass date/time",
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: "masterclass_end_at must be after masterclass_start_at",
      });
    }

    const allowedProviders = ["zoom", "google_meet", "custom"];
    if (meeting_provider && !allowedProviders.includes(meeting_provider)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meeting_provider",
      });
    }

    const allowedStatuses = ["draft", "published", "completed", "cancelled"];
    if (masterclass_status && !allowedStatuses.includes(masterclass_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid masterclass_status",
      });
    }

    let imageUrl = existingCourse.image;

    if (req.file) {
      const uploaded = await uploadMasterclassImage(req.file);
      imageUrl = uploaded.url;

      if (existingCourse.image) {
        try {
          await deleteMasterclassImageFromS3(existingCourse.image);
        } catch (deleteErr) {
          console.error("Old masterclass image delete failed:", deleteErr.message);
        }
      }
    }

    const courseUpdatePayload = {
      updated_at: new Date(),
      image: imageUrl,
    };

    if (course_name !== undefined) courseUpdatePayload.course_name = course_name;
    if (description !== undefined) courseUpdatePayload.description = description;
    if (price !== undefined) courseUpdatePayload.price = parseNumber(price, 0);
    if (category !== undefined) courseUpdatePayload.category = category || null;
    if (level !== undefined) courseUpdatePayload.level = level || "Beginner";
    if (language !== undefined) courseUpdatePayload.language = language || "English";
    if (duration !== undefined) courseUpdatePayload.duration = duration || null;
    if (is_published !== undefined) {
      courseUpdatePayload.is_published = parseBoolean(
        is_published,
        existingCourse.is_published
      );
    }
    if (tags !== undefined) courseUpdatePayload.tags = parseTags(tags);
    if (price_without_discount !== undefined) {
      courseUpdatePayload.price_without_discount = parseNumber(
        price_without_discount,
        0
      );
    }

    const detailUpdatePayload = {
      updated_at: new Date(),
    };

    if (masterclass_start_at !== undefined) {
      detailUpdatePayload.masterclass_start_at = masterclass_start_at;
    }
    if (masterclass_end_at !== undefined) {
      detailUpdatePayload.masterclass_end_at = masterclass_end_at;
    }
    if (meeting_provider !== undefined) {
      detailUpdatePayload.meeting_provider = meeting_provider || null;
    }
    if (meeting_url !== undefined) {
      detailUpdatePayload.meeting_url = meeting_url || null;
    }
    if (meeting_visible_before_minutes !== undefined) {
      detailUpdatePayload.meeting_visible_before_minutes = parseNumber(
        meeting_visible_before_minutes,
        15
      );
    }
    if (approval_required !== undefined) {
      detailUpdatePayload.approval_required = parseBoolean(
        approval_required,
        existingDetails.approval_required
      );
    }
    if (ppt_file_url !== undefined) {
      detailUpdatePayload.ppt_file_url = ppt_file_url || null;
    }
    if (ppt_file_name !== undefined) {
      detailUpdatePayload.ppt_file_name = ppt_file_name || null;
    }
    if (masterclass_status !== undefined) {
      detailUpdatePayload.masterclass_status = masterclass_status;
    }

    const { error: courseUpdateError } = await supabase
      .from("courses")
      .update(courseUpdatePayload)
      .eq("id", id)
      .eq("course_type", "masterclass");

    if (courseUpdateError) throw courseUpdateError;

    const { error: detailUpdateError } = await supabase
      .from("masterclass_details")
      .update(detailUpdatePayload)
      .eq("course_id", id);

    if (detailUpdateError) throw detailUpdateError;

    const { data: finalData, error: finalError } = await supabase
      .from("courses")
      .select("*, masterclass_details(*)")
      .eq("id", id)
      .eq("course_type", "masterclass")
      .single();

    if (finalError) throw finalError;

    return res.status(200).json({
      success: true,
      message: "Masterclass updated successfully",
      data: flattenMasterclass(finalData),
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

const deleteMasterclass = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: course, error: fetchError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .eq("course_type", "masterclass")
      .single();

    if (fetchError || !course) {
      return res.status(404).json({
        success: false,
        message: "Masterclass not found",
      });
    }

    if (course.image) {
      try {
        await deleteMasterclassImageFromS3(course.image);
      } catch (deleteErr) {
        console.error("Masterclass image delete failed:", deleteErr.message);
      }
    }

    // masterclass_details will be deleted automatically if FK has ON DELETE CASCADE
    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", id)
      .eq("course_type", "masterclass");

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Masterclass deleted successfully",
    });
  } catch (error) {
    console.error("Delete masterclass error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting masterclass",
      error: error.message,
    });
  }
};

export {
  upload,
  createMasterclass,
  getAllMasterclasses,
  getMasterclassById,
  updateMasterclass,
  deleteMasterclass,
};