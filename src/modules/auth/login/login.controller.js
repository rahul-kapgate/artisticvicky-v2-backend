import {
  env,
} from "../../../config/env.js";

import {
  parseLoginInput,
} from "./login.validation.js";

import {
  loginUser,
} from "./login.service.js";

const refreshCookieOptions = (
  expiresAt
) => ({
  httpOnly: true,

  secure:
    env.nodeEnv === "production",

  sameSite: "lax",

  path:
    "/api/v1/auth",

  expires:
    new Date(expiresAt),
});

export const login = async (
  req,
  res
) => {
  const input =
    parseLoginInput(
      req.body
    );

  const result =
    await loginUser({
      ...input,

      ipAddress:
        req.ip,

      userAgent:
        req.get(
          "user-agent"
        ) ?? null,
    });

  /*
   * WEB:
   * refresh token stays HttpOnly.
   */
  if (
    result.platform === "web"
  ) {
    res.cookie(
      env.refreshCookieName,
      result.refreshToken,
      refreshCookieOptions(
        result.sessionExpiresAt
      )
    );
  }

  return res
    .status(200)
    .json({
      success: true,

      message:
        "Login successful.",

      data: {
        user:
          result.user,

        accessToken:
          result.accessToken,

        accessTokenExpiresIn:
          result.accessTokenExpiresIn,

        sessionExpiresAt:
          result.sessionExpiresAt,

        /*
         * Android/iOS need the refresh
         * token for SecureStore.
         */
        ...(result.platform !== "web"
          ? {
              refreshToken:
                result.refreshToken,
            }
          : {}),
      },
    });
};