import { supabase } from "../config/supabaseClient.js";

/**
 * PUBLIC: Get active notifications for homepage (like CET cell banner)
 * GET /public/notifications?limit=5
 */
const getPublicNotifications = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit);
    const nowIso = new Date().toISOString();

    // 1️⃣ Fetch published + active notifications
    const { data, error } = await supabase
      .from("notifications")
      .select(
        `
        id,
        title, 
        short_text,
        url,
        category,
        is_important,
        starts_at,
        updated_at
      `
      )
      .eq("status", "published")
      .order("is_important", { ascending: false })
      .order("starts_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // 2️⃣ Derive last_updated_at
    let lastUpdatedAt = null;
    if (data && data.length > 0) {
      lastUpdatedAt = data.reduce((latest, item) => {
        const current = new Date(item.updated_at || item.starts_at);
        return current > latest ? current : latest;
      }, new Date(data[0].updated_at || data[0].starts_at));
    }

    return res.status(200).json({
      last_updated_at: lastUpdatedAt ? lastUpdatedAt.toISOString() : null,
      items: data.map((n) => ({
        id: n.id,
        title: n.title,
        short_text: n.short_text,
        url: n.url,
        category: n.category,
        is_important: n.is_important,
        published_at: n.starts_at,
      })),
    });
  } catch (error) {
    console.error("getPublicNotifications error:", error);
    next(error);
  }
};

/**
 * ADMIN: List notifications (with optional filters)
 * GET /admin/notifications?status=published
 */
const getAdminNotifications = async (req, res, next) => {
  try {
    const {
      status, // draft | published | archived
      category,
      limit = 50,
      page = 1,
    } = req.query;

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.status(200).json({
      items: data,
      total: count,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("getAdminNotifications error:", error);
    next(error);
  }
};

/**
 * ADMIN: Create notification
 * POST /admin/notifications
 */
const createNotification = async (req, res, next) => {
  try {
    const {
      title,
      short_text,
      full_text,
      url,
      category = "general",
      is_important = false,
      starts_at,
      expires_at,
      status = "published", // or 'draft'
    } = req.body;

    // 1️⃣ Basic validation
    if (!title || !short_text) {
      return res
        .status(400)
        .json({ message: "title and short_text are required" });
    }

    // 2️⃣ Insert into Supabase
    const { data, error } = await supabase
      .from("notifications")
      .insert([
        {
          title,
          short_text,
          full_text: full_text || null,
          url: url || null,
          category,
          is_important: Boolean(is_important),
          starts_at: starts_at || new Date().toISOString(),
          expires_at: expires_at || null,
          status,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: "Notification created successfully",
      notification: data,
    });
  } catch (error) {
    console.error("createNotification error:", error);
    next(error);
  }
};

/**
 * ADMIN: Update notification
 * PATCH /admin/notifications/:id
 */
const updateNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      short_text,
      full_text,
      url,
      category,
      is_important,
      starts_at,
      expires_at,
      status,
    } = req.body;

    // 1️⃣ Build partial payload
    const payload = {};
    if (title !== undefined) payload.title = title;
    if (short_text !== undefined) payload.short_text = short_text;
    if (full_text !== undefined) payload.full_text = full_text;
    if (url !== undefined) payload.url = url;
    if (category !== undefined) payload.category = category;
    if (is_important !== undefined)
      payload.is_important = Boolean(is_important);
    if (starts_at !== undefined) payload.starts_at = starts_at;
    if (expires_at !== undefined) payload.expires_at = expires_at;
    if (status !== undefined) payload.status = status;

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("notifications")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({
      message: "Notification updated successfully",
      notification: data,
    });
  } catch (error) {
    console.error("updateNotification error:", error);
    next(error);
  }
};

/**
 * ADMIN: Archive / soft-delete notification
 * DELETE /admin/notifications/:id
 */
const archiveNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("notifications")
      .update({ status: "archived" })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({
      message: "Notification archived successfully",
      notification: data,
    });
  } catch (error) {
    console.error("archiveNotification error:", error);
    next(error);
  }
};

export {
  getPublicNotifications,
  getAdminNotifications,
  createNotification,
  updateNotification,
  archiveNotification,
};
