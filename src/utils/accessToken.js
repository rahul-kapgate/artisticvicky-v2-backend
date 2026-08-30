import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export const generateAccessToken = ({
  userId,
  sessionId,
}) => {
  return jwt.sign(
    {
      sid: sessionId,
      type: "access",
    },
    env.jwtSecret,
    {
      subject: userId,
      expiresIn: `${env.accessTokenExpiryMinutes}m`,
      algorithm: "HS256",
    }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(
    token,
    env.jwtSecret,
    {
      algorithms: ["HS256"],
    }
  );
};