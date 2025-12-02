import {
    createCourseOrderService,
    verifyCoursePaymentService,
  } from "../services/coursePaymentService.js";
  
  export const createCourseOrder = async (req, res) => {
    try {
      const { userId, courseId } = req.body;
  
      const result = await createCourseOrderService({ userId, courseId });
  
      return res.status(200).json({
        success: true,
        message: "Course order created",
        data: result,
      });
    } catch (error) {
      console.error("createCourseOrder error:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to create course order",
      });
    }
  };
  
  export const verifyCoursePayment = async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;
  
      const result = await verifyCoursePaymentService({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });
  
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message || "Payment verification failed",
        });
      }
  
      return res.status(200).json({
        success: true,
        message: "Payment verified and user enrolled",
        data: result,
      });
    } catch (error) {
      console.error("verifyCoursePayment error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to verify payment",
      });
    }
  };
  