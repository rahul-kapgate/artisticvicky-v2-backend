import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";

export const generateOtp = () => {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
};

export const hashOtp = ({ otp, ownerId, purpose }) => {
  return createHmac("sha256", env.otpHmacSecret)
    .update(`${ownerId}:${purpose}:${otp}`)
    .digest("hex");
};

export const verifyOtp = ({ otp, ownerId, purpose, expectedHash }) => {
  const calculatedHash = hashOtp({
    otp,
    ownerId,
    purpose,
  });

  const calculatedBuffer = Buffer.from(calculatedHash, "hex");

  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (calculatedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(calculatedBuffer, expectedBuffer);
};
