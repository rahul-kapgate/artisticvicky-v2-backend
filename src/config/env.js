import "dotenv/config";

const requiredEnv = [
  "DATABASE_URL",
  "JWT_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "OTP_HMAC_SECRET",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT) || 5000,

  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: process.env.JWT_SECRET,

  resendApiKey: process.env.RESEND_API_KEY,

  resendFromEmail: process.env.RESEND_FROM_EMAIL,

  otpHmacSecret: process.env.OTP_HMAC_SECRET,

  otpExpiryMinutes: getPositiveInteger("OTP_EXPIRY_MINUTES", 5),

  pendingUserExpiryMinutes: getPositiveInteger(
    "PENDING_USER_EXPIRY_MINUTES",
    10,
  ),

  otpMaxAttempts: getPositiveInteger("OTP_MAX_ATTEMPTS", 5),

  otpResendCooldownSeconds: getPositiveInteger(
    "OTP_RESEND_COOLDOWN_SECONDS",
    60,
  ),
};
