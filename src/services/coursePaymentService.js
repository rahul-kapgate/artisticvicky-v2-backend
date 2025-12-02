import crypto from "crypto";
import { supabase } from "../config/supabaseClient.js";
import { razorpay } from "../config/razorpayClient.js";

/**
 * 1) Create Razorpay order for a course
 * 2) Create payments row in Supabase
 */
export const createCourseOrderService = async ({ userId, courseId }) => {
  if (!userId || !courseId) {
    throw new Error("userId and courseId are required");
  }

  // ✅ Get course with price & existing students
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, course_name, price, students_enrolled")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    console.error("Course fetch error:", courseError);
    throw new Error("Course not found");
  }

  // ✅ Optional: prevent duplicate enrollment
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

  // ✅ 1. Create payment row
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

  // ✅ 2. Create Razorpay order
  const options = {
    amount: amountInPaise,
    currency,
    receipt: paymentRow.id, // internal payment id
    notes: {
      payment_id: paymentRow.id,
      user_id: userId,
      course_id: courseId,
    },
  };

  const order = await razorpay.orders.create(options);

  // ✅ 3. Save razorpay_order_id
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
 * Verify payment signature, update payment status, and auto-enroll user.
 */
export const verifyCoursePaymentService = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new Error("Invalid payment data");
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  const isValid = expectedSignature === razorpay_signature;

  // ✅ Fetch payment row to know user + course
  const { data: paymentRow, error: paymentFetchError } = await supabase
    .from("payments")
    .select("id, user_id, course_id, status")
    .eq("razorpay_order_id", razorpay_order_id)
    .single();

  if (paymentFetchError || !paymentRow) {
    console.error("Payment fetch error:", paymentFetchError);
    throw new Error("Payment not found");
  }

  if (!isValid) {
    // mark as failed
    await supabase
      .from("payments")
      .update({
        status: "failed",
        razorpay_payment_id,
        razorpay_signature,
      })
      .eq("id", paymentRow.id);

    return { success: false, message: "Invalid signature" };
  }

  // Idempotent: if already paid, don’t re-enroll
  if (paymentRow.status === "paid") {
    return { success: true, message: "Already processed" };
  }

  // ✅ Mark payment as paid
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

  // ✅ Auto-enroll user in that course (same logic as your enrollUserInCourse)
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("students_enrolled")
    .eq("id", paymentRow.course_id)
    .single();

  if (courseError) {
    console.error("Course fetch error (enroll):", courseError);
    throw new Error("Error fetching course for enrollment");
  }

  const updatedArray = Array.isArray(course.students_enrolled)
    ? [...new Set([...course.students_enrolled, paymentRow.user_id])]
    : [paymentRow.user_id];

  const { error: enrollUpdateError } = await supabase
    .from("courses")
    .update({ students_enrolled: updatedArray })
    .eq("id", paymentRow.course_id);

  if (enrollUpdateError) {
    console.error("Course enrollment update error:", enrollUpdateError);
    throw new Error("Error enrolling user in course");
  }

  return { success: true, courseId: paymentRow.course_id, userId: paymentRow.user_id };
};
