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

const updateCourseSchema = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),

    shortDescription: z.string().trim().max(500).nullable().optional(),

    thumbnailUrl: z.string().url("Invalid thumbnail URL").nullable().optional(),

    visibility: z.enum(["public", "unlisted"]).optional(),

    isFree: z.boolean().optional(),

    priceAmount: z.number().int().min(0).optional(),

    salePriceAmount: z.number().int().positive().nullable().optional(),

    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .optional(),

    accessType: z.enum(["lifetime", "duration", "fixed_date"]).optional(),

    accessDurationDays: z.number().int().positive().nullable().optional(),

    accessEndAt: z
      .string()
      .datetime({
        offset: true,
      })
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const parseUpdateCourseInput = (input) => {
  const result = updateCourseSchema.safeParse(input);

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

export const validateResolvedCourseInput = (data) => {
  const errors = [];

  /*
   * PRICE VALIDATION
   */
  if (data.isFree) {
    if (data.priceAmount !== 0) {
      errors.push({
        field: "priceAmount",
        message: "Free course price must be 0",
      });
    }

    if (data.salePriceAmount != null) {
      errors.push({
        field: "salePriceAmount",
        message: "Free course cannot have a sale price",
      });
    }
  } else {
    if (!Number.isInteger(data.priceAmount) || data.priceAmount <= 0) {
      errors.push({
        field: "priceAmount",
        message: "Paid course price must be greater than 0",
      });
    }

    if (
      data.salePriceAmount != null &&
      (data.salePriceAmount <= 0 || data.salePriceAmount >= data.priceAmount)
    ) {
      errors.push({
        field: "salePriceAmount",
        message:
          "Sale price must be greater than 0 and less than regular price",
      });
    }
  }

  /*
   * ACCESS VALIDATION
   */
  if (data.accessType === "lifetime") {
    if (data.accessDurationDays != null || data.accessEndAt != null) {
      errors.push({
        field: "accessType",
        message: "Lifetime access cannot have duration days or an end date",
      });
    }
  }

  if (data.accessType === "duration") {
    if (
      !Number.isInteger(data.accessDurationDays) ||
      data.accessDurationDays <= 0
    ) {
      errors.push({
        field: "accessDurationDays",

        message: "Duration access requires valid access duration days",
      });
    }

    if (data.accessEndAt != null) {
      errors.push({
        field: "accessEndAt",

        message: "Duration access cannot have a fixed end date",
      });
    }
  }

  if (data.accessType === "fixed_date") {
    if (data.accessDurationDays != null) {
      errors.push({
        field: "accessDurationDays",

        message: "Fixed-date access cannot have duration days",
      });
    }

    if (!data.accessEndAt) {
      errors.push({
        field: "accessEndAt",

        message: "Fixed-date access requires an end date",
      });
    } else if (new Date(data.accessEndAt).getTime() <= Date.now()) {
      errors.push({
        field: "accessEndAt",

        message: "Access end date must be in the future",
      });
    }
  }

  if (errors.length > 0) {
    throw new AppError("Validation failed", 400, {
      code: "VALIDATION_ERROR",

      details: errors,
    });
  }

  return data;
};
