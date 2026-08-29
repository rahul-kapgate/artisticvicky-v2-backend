import { Resend } from "resend";

import { env } from "../../config/env.js";
import logger from "../../config/logger.js";

import { registrationOtpTemplate } from "./templates/registrationOtp.js";
import { forgotPasswordOtpTemplate } from "./templates/forgotPasswordOtp.js";
import { passwordChangedTemplate } from "./templates/passwordChanged.js";

const resend = new Resend(env.resendApiKey);

export const sendRegistrationOtpEmail = async ({
  email,
  name,
  otp,
  verificationId,
}) => {
  const { subject, text, html } = registrationOtpTemplate({
    name,
    otp,
    expiryMinutes: env.otpExpiryMinutes,
  });

  const { data, error } = await resend.emails.send(
    {
      from: env.resendFromEmail,

      to: [email],

      subject,

      text,

      html,
    },
    {
      idempotencyKey: `registration-otp/${verificationId}`,
    },
  );

  if (error) {
    logger.error(
      {
        resendError: error,
        verificationId,
      },
      "Resend failed to send registration OTP",
    );

    const emailError = new Error("Resend failed to send registration OTP");

    emailError.cause = error;

    throw emailError;
  }

  logger.info(
    {
      emailId: data?.id,
      verificationId,
    },
    "Registration OTP email sent",
  );

  return data;
};

export const sendForgotPasswordOtpEmail =
  async ({
    email,
    name,
    otp,
    otpId,
  }) => {
    const {
      subject,
      text,
      html,
    } =
      forgotPasswordOtpTemplate({
        name,
        otp,

        expiryMinutes:
          env.otpExpiryMinutes,
      });


    const {
      data,
      error,
    } =
      await resend.emails.send(
        {
          from:
            env.resendFromEmail,

          to: [
            email,
          ],

          subject,
          text,
          html,
        },

        {
          idempotencyKey:
            `forgot-password-otp/${otpId}`,
        }
      );


    if (error) {
      const emailError =
        new Error(
          "Failed to send password reset OTP"
        );

      emailError.cause =
        error;

      throw emailError;
    }


    return data;
  };


export const sendPasswordChangedEmail =
  async ({
    email,
    name,
    resetSessionId,
  }) => {
    const {
      subject,
      text,
      html,
    } =
      passwordChangedTemplate({
        name,
      });


    const {
      data,
      error,
    } =
      await resend.emails.send(
        {
          from:
            env.resendFromEmail,

          to: [
            email,
          ],

          subject,
          text,
          html,
        },

        {
          idempotencyKey:
            `password-changed/${resetSessionId}`,
        }
      );


    if (error) {
      const emailError =
        new Error(
          "Failed to send password changed email"
        );

      emailError.cause =
        error;

      throw emailError;
    }


    return data;
  };
