import { z } from "zod";

import AppError from "../../../utils/AppError.js";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .max(255)
    .transform((email) => email.toLowerCase()),

  password: z.string().min(1, "Password is required").max(128),

  deviceId: z.string().uuid("Invalid device ID"),

  deviceName: z.string().trim().max(150).optional().nullable(),

  platform: z.enum(["web", "android", "ios"]),
});

export const parseLoginInput = (data) => {
  const result = loginSchema.safeParse(data);

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
