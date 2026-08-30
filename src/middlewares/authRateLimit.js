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

export const forgotPasswordRequestRateLimit =
  rateLimit({
    ...commonOptions,

    windowMs:
      15 * 60 * 1000,

    limit: 5,

    message: {
      success: false,

      message:
        "Too many password reset requests. Please try again later.",
    },
  });


export const forgotPasswordVerifyRateLimit =
  rateLimit({
    ...commonOptions,

    windowMs:
      15 * 60 * 1000,

    limit: 20,

    message: {
      success: false,

      message:
        "Too many verification attempts. Please try again later.",
    },
  });


export const forgotPasswordResetRateLimit =
  rateLimit({
    ...commonOptions,

    windowMs:
      15 * 60 * 1000,

    limit: 10,
  });

  export const loginRateLimit =
  rateLimit({
    ...commonOptions,

    windowMs:
      15 * 60 * 1000,

    limit: 10,

    message: {
      success: false,

      message:
        "Too many login attempts. Please try again later.",
    },
  });

export const refreshRateLimit =
  rateLimit({
    ...commonOptions,

    windowMs:
      15 * 60 * 1000,

    limit: 60,
  });