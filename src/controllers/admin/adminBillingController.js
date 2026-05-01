// controllers/adminBilling.controller.js
import { supabase } from "../../config/supabaseClient.js";


/**
 * GET /admin/billing/invoices
 * Returns all rows from invoices table.
 */
export const listInvoicesController = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("sent_at", { ascending: false });

    if (error) {
      console.error("Invoices fetch error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch invoices",
      });
    }

    return res.status(200).json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    console.error("listInvoicesController error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoices",
      error: err.message,
    });
  }
};
