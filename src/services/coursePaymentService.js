// src/services/coursePaymentService.js
import crypto from "crypto";
import { supabase } from "../config/supabaseClient.js";
import { razorpay } from "../config/razorpayClient.js";
import { issueInvoiceAndEnroll } from "./invoiceService.js";

/**
 * 1) Validate course + user
 * 2) Insert payments row (status=created)
 * 3) Create Razorpay order
 * 4) Link razorpay_order_id to the row
 *
 * If Razorpay fails, the payment row is marked "failed" so we never leave orphans.
 */
export const createCourseOrderService = async ({ userId, courseId }) => {
  if (!userId || !courseId) {
    throw new Error("userId and courseId are required");
  }

  // Fetch course
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, course_name, price, students_enrolled")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    console.error("Course fetch error:", courseError);
    throw new Error("Course not found");
  }

  // Prevent duplicate enrollment
  const alreadyEnrolled =
    Array.isArray(course.students_enrolled) &&
    course.students_enrolled.includes(userId);

  if (alreadyEnrolled) {
    throw new Error("User already enrolled in this course");
  }

  if (!course.price || Number(course.price) <= 0) {
    throw new Error("Invalid course price");
  }

  const amountInPaise = Math.round(Number(course.price) * 100);
  const currency = "INR";

  // 1. Create payment row
  const { data: paymentRow, error: paymentError } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      course_id: courseId,
      amount: amountInPaise,
      currency,
      status: "created",
      notes: { type: "course_purchase" },
    })
    .select()
    .single();

  if (paymentError) {
    console.error("Supabase payment insert error:", paymentError);
    throw new Error("Error creating payment record");
  }

  // 2. Create Razorpay order — guarded so a failure doesn't leave orphan rows
  let order;
  try {
    order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: String(paymentRow.id),
      notes: {
        payment_id: paymentRow.id,
        user_id: userId,
        course_id: courseId,
      },
    });
  } catch (err) {
    console.error("Razorpay order create failed:", err);
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("id", paymentRow.id);
    throw new Error("Failed to create Razorpay order");
  }

  // 3. Link the Razorpay order id back to our row
  const { error: updateError } = await supabase
    .from("payments")
    .update({ razorpay_order_id: order.id })
    .eq("id", paymentRow.id);

  if (updateError) {
    console.error("Supabase payment update error:", updateError);
    throw new Error("Error linking payment with order");
  }

  return {
    paymentId: paymentRow.id,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: process.env.RAZORPAY_KEY_ID,
    courseName: course.course_name,
  };
};

/**
 * Verify the Razorpay signature, mark the payment as paid, then delegate
 * enrollment + invoice to the shared invoiceService.
 *
 * Signature is verified BEFORE any DB read so invalid payloads never hit the DB.
 */
export const verifyCoursePaymentService = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new Error("Invalid payment data");
  }

  // Verify signature FIRST
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return { success: false, message: "Invalid signature" };
  }

  // Fetch payment row
  const { data: paymentRow, error: paymentFetchError } = await supabase
    .from("payments")
    .select("id, user_id, course_id, status, amount")
    .eq("razorpay_order_id", razorpay_order_id)
    .single();

  if (paymentFetchError || !paymentRow) {
    console.error("Payment fetch error:", paymentFetchError);
    throw new Error("Payment not found");
  }

  // Idempotency — already processed
  if (paymentRow.status === "paid") {
    return {
      success: true,
      message: "Already processed",
      userId: paymentRow.user_id,
      enrolledCourseId: paymentRow.course_id,
    };
  }

  // Mark payment as paid
  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "paid",
      razorpay_payment_id,
      razorpay_signature,
    })
    .eq("id", paymentRow.id);

  if (updateError) {
    console.error("Payment update error:", updateError);
    throw new Error("Error updating payment as paid");
  }

  // Enroll + invoice via shared service
  const result = await issueInvoiceAndEnroll({
    userId: paymentRow.user_id,
    courseId: paymentRow.course_id,
    amount: paymentRow.amount / 100, // paise → rupees
    source: "payment",
    paymentId: paymentRow.id,
  });

  return { success: true, ...result };
};