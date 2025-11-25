// controllers/adminBilling.controller.js
import { supabase } from "../config/supabaseClient.js";
import { generateInvoicePdfBuffer } from "../services/invoicePdf.js";
import { sendInvoiceEmail } from "../services/billingEmail.js";

/**
 * Body: { userId, courseId, amount, notes? }
 *
 * Only `amount` is admin input for the bill.
 */
export const sendInvoiceController = async (req, res) => {
  try {
    const { userId, courseId, amount, notes } = req.body;

    // --- Validate input ---
    if (!userId || !courseId || amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: "userId, courseId and amount are required",
      });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a positive number",
      });
    }

    // --- Fetch user from Supabase ---
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error("User fetch error:", userError);
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // --- Fetch course from Supabase ---
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      console.error("Course fetch error:", courseError);
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // --- Build invoice meta data ---
    const timestamp = Date.now();
    const invoiceNumber = `INV-${timestamp}`; // you can replace with a nicer sequence logic
    const issueDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const invoiceData = {
      invoiceNumber,
      issueDate,
      user: {
        name: user.user_name || user.email,
        email: user.email,
      },
      course: {
        name: course.course_name,
        listedPrice: course.price,
      },
      amount: numericAmount,
      notes,
    };

    // --- Generate PDF from data ---
    const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);

    // --- Send invoice email with PDF attachment via Resend ---
    await sendInvoiceEmail({
      toEmail: invoiceData.user.email,
      toName: invoiceData.user.name,
      pdfBuffer,
      invoiceNumber,
      courseName: invoiceData.course.name,
      amount: numericAmount,
    });

    // --- Optional: store invoice record in Supabase (invoices table) ---
    // Make sure you created the `invoices` table as discussed earlier
    const { error: invoiceError } = await supabase.from("invoices").insert([
      {
        user_id: userId,
        course_id: courseId,
        invoice_number: invoiceNumber,
        amount: numericAmount,
        notes,
      },
    ]);

    if (invoiceError) {
      console.error("Invoice insert error:", invoiceError);
      // Don't fail the response just because saving invoice failed
    }

    return res.status(200).json({
      success: true,
      message: "Invoice sent successfully",
      invoiceNumber,
    });
  } catch (err) {
    console.error("Send invoice error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send invoice",
      error: err.message,
    });
  }
};
