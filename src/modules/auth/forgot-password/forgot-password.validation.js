import { z } from "zod";

import AppError from "../../../utils/AppError.js";


const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .max(255)
  .transform((email) =>
    email.toLowerCase()
  );


const requestSchema = z.object({
  email: emailSchema,
});


const verifySchema = z.object({
  email: emailSchema,

  otp: z
    .string()
    .regex(
      /^\d{6}$/,
      "OTP must contain exactly 6 digits"
    ),
});


const resetSchema = z
  .object({
    resetToken: z
      .string()
      .min(
        40,
        "Invalid reset token"
      )
      .max(128),

    newPassword: z
      .string()
      .min(
        8,
        "Password must contain at least 8 characters"
      )
      .max(
        128,
        "Password cannot exceed 128 characters"
      ),

    confirmPassword: z.string(),
  })
  .refine(
    (data) =>
      data.newPassword ===
      data.confirmPassword,
    {
      message:
        "Passwords do not match",

      path: [
        "confirmPassword",
      ],
    }
  );


const parse = (
  schema,
  data
) => {
  const result =
    schema.safeParse(data);

  if (!result.success) {
    throw new AppError(
      "Validation failed",
      400,
      {
        code:
          "VALIDATION_ERROR",

        details:
          result.error.issues.map(
            (issue) => ({
              field:
                issue.path.join("."),

              message:
                issue.message,
            })
          ),
      }
    );
  }

  return result.data;
};


export const parseForgotPasswordRequest =
  (data) =>
    parse(
      requestSchema,
      data
    );


export const parseForgotPasswordVerify =
  (data) =>
    parse(
      verifySchema,
      data
    );


export const parseForgotPasswordReset =
  (data) =>
    parse(
      resetSchema,
      data
    );