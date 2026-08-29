import {
  createHash,
  randomBytes,
} from "node:crypto";

export const generateResetToken = () => {
  return randomBytes(32).toString("base64url");
};

export const hashResetToken = (token) => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};