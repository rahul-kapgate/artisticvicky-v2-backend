import { Resend } from "resend";

import { env } from "../../config/env.js";

import { registrationOtpTemplate } from "./templates/registrationOtp.js";

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
    const emailError = new Error("Resend failed to send registration OTP");

    emailError.cause = error;

    throw emailError;
  }

  return data;
};
