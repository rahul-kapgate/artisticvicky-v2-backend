import { z } from "zod";

import AppError from "../../../utils/AppError.js";

const mobileSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return String(value).trim();
  },
  z
    .string()
    .regex(
      /^\+[1-9]\d{7,14}$/,
      "Mobile must be in E.164 format, for example +919876543210",
    )
    .nullable(),
);

const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(100),

  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255)
    .transform((email) => email.toLowerCase()),

  mobile: mobileSchema,

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(128),
});

const verifyRegistrationSchema = z.object({
  verificationId: z.string().uuid(),

  otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
});

const resendRegistrationSchema = z.object({
  pendingUserId: z.string().uuid(),
});

const parse = (schema, data) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new AppError("Validation failed", 400, {
      code: "VALIDATION_ERROR",

      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return result.data;
};

export const parseRegistrationInput = (data) => parse(registrationSchema, data);

export const parseVerifyRegistrationInput = (data) =>
  parse(verifyRegistrationSchema, data);

export const parseResendRegistrationInput = (data) =>
  parse(resendRegistrationSchema, data);
