import { rateLimit } from "express-rate-limit";

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
};

export const registerRateLimit = rateLimit({
  ...commonOptions,

  windowMs: 15 * 60 * 1000,

  limit: 10,
});

export const verifyOtpRateLimit = rateLimit({
  ...commonOptions,

  windowMs: 15 * 60 * 1000,

  limit: 30,
});

export const resendOtpRateLimit = rateLimit({
  ...commonOptions,

  windowMs: 15 * 60 * 1000,

  limit: 10,
});
