import { supabase } from "../../config/supabaseClient.js";

export const getAllFaqs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("faqs")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getFaqById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("faqs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "FAQ not found" });

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createFaq = async (req, res) => {
  try {
    const { question, answer, is_active } = req.body;

    if (!question || !question.trim())
      return res.status(400).json({ success: false, message: "Question is required" });

    if (!answer || !answer.trim())
      return res.status(400).json({ success: false, message: "Answer is required" });

    const { data, error } = await supabase
      .from("faqs")
      .insert([
        {
          question: question.trim(),
          answer: answer.trim(),
          is_active: is_active !== undefined ? is_active : true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, message: "FAQ created successfully", data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, is_active } = req.body;

    const updates = {};
    if (question !== undefined) updates.question = question.trim();
    if (answer !== undefined) updates.answer = answer.trim();
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ success: false, message: "No fields provided to update" });

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("faqs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "FAQ not found" });

    res.status(200).json({ success: true, message: "FAQ updated successfully", data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("faqs")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "FAQ not found" });

    res.status(200).json({ success: true, message: "FAQ deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const toggleFaqStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from("faqs")
      .select("is_active")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ success: false, message: "FAQ not found" });

    const { data, error } = await supabase
      .from("faqs")
      .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: `FAQ ${data.is_active ? "activated" : "deactivated"} successfully`,
      data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};