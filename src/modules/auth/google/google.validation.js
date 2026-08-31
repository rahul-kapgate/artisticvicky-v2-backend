import { z } from "zod";

import AppError from "../../../utils/AppError.js";


const googleAuthSchema = z.object({
  idToken: z
    .string()
    .trim()
    .min(20, "Google ID token is required"),

  deviceId: z
    .string()
    .uuid("Invalid device ID"),

  deviceName: z
    .string()
    .trim()
    .max(150)
    .optional()
    .nullable(),

  platform: z.enum([
    "web",
    "android",
    "ios",
  ]),
});


export const parseGoogleAuthInput = (data) => {
  const result =
    googleAuthSchema.safeParse(data);

  if (!result.success) {
    throw new AppError(
      "Validation failed",
      400,
      {
        code: "VALIDATION_ERROR",

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