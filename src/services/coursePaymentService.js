// coursePaymentService.js
import { issueInvoiceAndEnroll } from "./invoiceService.js";

export const verifyCoursePaymentService = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new Error("Invalid payment data");
  }

  // ✅ Verify signature FIRST — before any DB read
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return { success: false, message: "Invalid signature" };
  }

  // Now fetch payment row
  const { data: paymentRow, error: paymentFetchError } = await supabase
    .from("payments")
    .select("id, user_id, course_id, status, amount")
    .eq("razorpay_order_id", razorpay_order_id)
    .single();

  if (paymentFetchError || !paymentRow) throw new Error("Payment not found");

  // Idempotency guard
  if (paymentRow.status === "paid") {
    return { success: true, message: "Already processed" };
  }

  // Mark payment as paid
  const { error: updateError } = await supabase
    .from("payments")
    .update({ status: "paid", razorpay_payment_id, razorpay_signature })
    .eq("id", paymentRow.id);

  if (updateError) throw new Error("Error updating payment status");

  // ✅ Enroll + invoice via shared service
  const result = await issueInvoiceAndEnroll({
    userId: paymentRow.user_id,
    courseId: paymentRow.course_id,
    amount: paymentRow.amount / 100, // convert paise → rupees
    source: "payment",
    paymentId: paymentRow.id,
  });

  return { success: true, ...result };
};
