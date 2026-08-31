import { z } from "zod";

import AppError from "../../../utils/AppError.js";

const createCourseSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(180),

    shortDescription: z.string().trim().max(500).optional().nullable(),

    thumbnailUrl: z.string().url("Invalid thumbnail URL").optional().nullable(),

    visibility: z.enum(["public", "unlisted"]).default("public"),

    isFree: z.boolean(),

    priceAmount: z.number().int().min(0).default(0),

    salePriceAmount: z.number().int().positive().optional().nullable(),

    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default("INR"),

    accessType: z.enum(["lifetime", "duration", "fixed_date"]),

    accessDurationDays: z.number().int().positive().optional().nullable(),

    accessEndAt: z
      .string()
      .datetime({
        offset: true,
      })
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    /*
     * FREE COURSE
     */
    if (data.isFree) {
      if (data.priceAmount !== 0) {
        ctx.addIssue({
          code: "custom",
          path: ["priceAmount"],
          message: "Free course price must be 0",
        });
      }

      if (data.salePriceAmount != null) {
        ctx.addIssue({
          code: "custom",
          path: ["salePriceAmount"],
          message: "Free course cannot have a sale price",
        });
      }
    }

    /*
     * PAID COURSE
     */
    if (!data.isFree) {
      if (data.priceAmount <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["priceAmount"],
          message: "Paid course price must be greater than 0",
        });
      }

      if (
        data.salePriceAmount != null &&
        data.salePriceAmount >= data.priceAmount
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["salePriceAmount"],
          message: "Sale price must be less than regular price",
        });
      }
    }

    /*
     * LIFETIME
     */
    if (data.accessType === "lifetime") {
      if (data.accessDurationDays != null || data.accessEndAt != null) {
        ctx.addIssue({
          code: "custom",
          path: ["accessType"],
          message: "Lifetime access cannot have duration or end date",
        });
      }
    }

    /*
     * DURATION
     */
    if (data.accessType === "duration") {
      if (!data.accessDurationDays) {
        ctx.addIssue({
          code: "custom",
          path: ["accessDurationDays"],
          message: "Access duration is required",
        });
      }

      if (data.accessEndAt != null) {
        ctx.addIssue({
          code: "custom",
          path: ["accessEndAt"],
          message: "Duration access cannot have a fixed end date",
        });
      }
    }

    /*
     * FIXED DATE
     */
    if (data.accessType === "fixed_date") {
      if (!data.accessEndAt) {
        ctx.addIssue({
          code: "custom",
          path: ["accessEndAt"],
          message: "Access end date is required",
        });
      }

      if (data.accessDurationDays != null) {
        ctx.addIssue({
          code: "custom",
          path: ["accessDurationDays"],
          message: "Fixed-date access cannot have duration days",
        });
      }

      if (
        data.accessEndAt &&
        new Date(data.accessEndAt).getTime() <= Date.now()
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["accessEndAt"],
          message: "Access end date must be in the future",
        });
      }
    }
  });

const detailArraySchema = z.array(z.string().trim().min(1).max(250)).max(50);

const updateCourseDetailsSchema = z
  .object({
    subtitle: z.string().trim().max(255).nullable().optional(),

    description: z.string().trim().max(20000).nullable().optional(),

    bannerUrl: z.string().url("Invalid banner URL").nullable().optional(),

    category: z.string().trim().max(100).nullable().optional(),

    level: z.string().trim().max(50).nullable().optional(),

    language: z.string().trim().max(100).nullable().optional(),

    whatYouWillLearn: detailArraySchema.optional(),

    courseIncludes: detailArraySchema.optional(),

    courseHighlights: detailArraySchema.optional(),

    estimatedDurationMinutes: z.number().int().min(0).nullable().optional(),

    certificateAvailable: z.boolean().optional(),

    liveClassesAvailable: z.boolean().optional(),

    whatsappContact: z.string().trim().max(20).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const courseIdSchema = z.string().uuid("Invalid course ID");

export const parseCreateCourseInput = (input) => {
  const result = createCourseSchema.safeParse(input);

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

export const parseCourseId = (courseId) => {
  const result = courseIdSchema.safeParse(courseId);

  if (!result.success) {
    throw new AppError("Invalid course ID", 400, {
      code: "VALIDATION_ERROR",
    });
  }

  return result.data;
};

export const parseUpdateCourseDetailsInput = (input) => {
  const result = updateCourseDetailsSchema.safeParse(input);

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
