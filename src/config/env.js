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

const getPositiveInteger = (key, fallback) => {
  const value = Number(process.env[key] ?? fallback);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT) || 5000,

  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: process.env.JWT_SECRET,

  resendApiKey: process.env.RESEND_API_KEY,

  resendFromEmail: process.env.RESEND_FROM_EMAIL,

  otpHmacSecret: process.env.OTP_HMAC_SECRET,

  otpExpiryMinutes: getPositiveInteger("OTP_EXPIRY_MINUTES", 10),

  pendingUserExpiryMinutes: getPositiveInteger(
    "PENDING_USER_EXPIRY_MINUTES",
    30,
  ),

  otpMaxAttempts: getPositiveInteger("OTP_MAX_ATTEMPTS", 5),

  otpResendCooldownSeconds: getPositiveInteger(
    "OTP_RESEND_COOLDOWN_SECONDS",
    60,
  ),

  passwordResetTokenExpiryMinutes: Number(
    process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || 15,
  ),

  passwordResetMaxPerHour: Number(process.env.PASSWORD_RESET_MAX_PER_HOUR || 5),
};
