import {
  parseForgotPasswordRequest,
  parseForgotPasswordVerify,
  parseForgotPasswordReset,
} from "./forgot-password.validation.js";


import {
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
} from "./forgot-password.service.js";


export const requestReset =
  async (
    req,
    res
  ) => {
    const input =
      parseForgotPasswordRequest(
        req.body
      );


    const result =
      await requestPasswordReset(
        input
      );


    return res
      .status(202)
      .json({
        success: true,

        ...result,
      });
  };


export const verifyResetOtp =
  async (
    req,
    res
  ) => {
    const input =
      parseForgotPasswordVerify(
        req.body
      );


    const result =
      await verifyPasswordResetOtp(
        input
      );


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Verification successful.",

        data:
          result,
      });
  };


export const updatePassword =
  async (
    req,
    res
  ) => {
    const input =
      parseForgotPasswordReset(
        req.body
      );


    const result =
      await resetPassword({
        resetToken:
          input.resetToken,

        newPassword:
          input.newPassword,
      });


    return res
      .status(200)
      .json({
        success: true,

        ...result,
      });
  };