import { supabase } from "../config/supabaseClient.js";
import multer from "multer";
import { s3 } from "../config/s3Client.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Multer config
 * Supports:
 * - image: png/jpg/jpeg/webp
 * - ppt_file: pdf/ppt/pptx
 */
const masterclassUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      // image
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",

      // ppt/pdf
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];

    const ok = allowedMimeTypes.includes(file.mimetype);
    cb(ok ? null : new Error("Invalid file type"), ok);
  },
});

export const uploadMasterclassFiles = masterclassUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "ppt_file", maxCount: 1 },
]);

const safeName = (name = "file") => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const buildS3Url = (key) =>
  `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

async function uploadFileToS3(file, folder = "uploads") {
  const key = `${folder}/${Date.now()}_${safeName(file.originalname)}`;

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
    fileName: file.originalname,
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

async function deleteFileFromS3(fileUrl) {
  const key = getS3KeyFromUrl(fileUrl);
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

/**
 * CREATE MASTERCLASS
 * Inserts into:
 * 1. courses
 * 2. masterclass_details
 */
export const createMasterclass = async (req, res) => {
  let uploadedImageUrl = null;
  let uploadedPptUrl = null;

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
      masterclass_status,
    } = req.body;

    const imageFile = req.files?.image?.[0];
    const pptFile = req.files?.ppt_file?.[0];

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

    if (!imageFile) {
      return res.status(400).json({
        success: false,
        message: "Masterclass image is required",
      });
    }

    // Upload image
    const uploadedImage = await uploadFileToS3(imageFile, "masterclass-images");
    uploadedImageUrl = uploadedImage.url;

    // Upload PPT/PDF if provided
    let pptData = { url: null, fileName: null };
    if (pptFile) {
      const uploadedPpt = await uploadFileToS3(pptFile, "masterclass-ppt");
      uploadedPptUrl = uploadedPpt.url;
      pptData = {
        url: uploadedPpt.url,
        fileName: uploadedPpt.fileName,
      };
    }

    // Step 1: insert into courses
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .insert([
        {
          course_name,
          description,
          price: parseNumber(price, 0),
          image: uploadedImageUrl,
          category,
          level: level || "Beginner",
          language: language || "English",
          duration,
          is_published: parseBoolean(is_published, false),
          created_by: req.user?.id || null,
          tags: parseTags(tags),
          price_without_discount: parseNumber(price_without_discount, 0),
          course_type: "masterclass",
        },
      ])
      .select()
      .single();

    if (courseError) throw courseError;

    // Step 2: insert into masterclass_details
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
          ppt_file_url: pptData.url,
          ppt_file_name: pptData.fileName,
          masterclass_status: masterclass_status || "draft",
        },
      ])
      .select()
      .single();

    if (detailsError) {
      // rollback best effort
      await supabase.from("courses").delete().eq("id", courseData.id);

      if (uploadedImageUrl) {
        try {
          await deleteFileFromS3(uploadedImageUrl);
        } catch (err) {
          console.error("Failed to delete uploaded image during rollback:", err.message);
        }
      }

      if (uploadedPptUrl) {
        try {
          await deleteFileFromS3(uploadedPptUrl);
        } catch (err) {
          console.error("Failed to delete uploaded ppt during rollback:", err.message);
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
    console.error("Create masterclass error:", error);

    // cleanup if main flow failed after upload
    if (uploadedImageUrl) {
      try {
        await deleteFileFromS3(uploadedImageUrl);
      } catch (err) {
        console.error("Image cleanup failed:", err.message);
      }
    }

    if (uploadedPptUrl) {
      try {
        await deleteFileFromS3(uploadedPptUrl);
      } catch (err) {
        console.error("PPT cleanup failed:", err.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Server error while creating masterclass",
      error: error.message,
    });
  }
};

/**
 * UPDATE MASTERCLASS
 * Updates:
 * - courses row
 * - masterclass_details row
 * - optionally replaces image / ppt file in S3
 */
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
      masterclass_status,
    } = req.body;

    const imageFile = req.files?.image?.[0];
    const pptFile = req.files?.ppt_file?.[0];

    // Fetch course
    const { data: existingCourse, error: courseFetchError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .eq("course_type", "masterclass")
      .single();

    if (courseFetchError || !existingCourse) {
      return res.status(404).json({
        success: false,
        message: "Masterclass course not found",
      });
    }

    // Fetch details
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

    let imageUrl = existingCourse.image;
    let pptFileUrl = existingDetails.ppt_file_url;
    let pptFileName = existingDetails.ppt_file_name;

    // Replace image if new one uploaded
    if (imageFile) {
      const uploadedImage = await uploadFileToS3(imageFile, "masterclass-images");
      imageUrl = uploadedImage.url;

      if (existingCourse.image) {
        try {
          await deleteFileFromS3(existingCourse.image);
        } catch (err) {
          console.error("Old image delete failed:", err.message);
        }
      }
    }

    // Replace ppt/pdf if new one uploaded
    if (pptFile) {
      const uploadedPpt = await uploadFileToS3(pptFile, "masterclass-ppt");
      pptFileUrl = uploadedPpt.url;
      pptFileName = uploadedPpt.fileName;

      if (existingDetails.ppt_file_url) {
        try {
          await deleteFileFromS3(existingDetails.ppt_file_url);
        } catch (err) {
          console.error("Old ppt delete failed:", err.message);
        }
      }
    }

    // Update course
    const { data: updatedCourse, error: updateCourseError } = await supabase
      .from("courses")
      .update({
        course_name: course_name ?? existingCourse.course_name,
        description: description ?? existingCourse.description,
        price: price !== undefined ? parseNumber(price, existingCourse.price) : existingCourse.price,
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
            ? parseNumber(price_without_discount, existingCourse.price_without_discount)
            : existingCourse.price_without_discount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateCourseError) throw updateCourseError;

    // Update masterclass_details
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
        ppt_file_url: pptFileUrl,
        ppt_file_name: pptFileName,
        masterclass_status:
          masterclass_status ?? existingDetails.masterclass_status,
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
    console.error("Update masterclass error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating masterclass",
      error: error.message,
    });
  }
};