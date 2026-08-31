import { env } from "../../../config/env.js";

import { parseGoogleAuthInput } from "./google.validation.js";

import { authenticateWithGoogle } from "./google.service.js";

const refreshCookieOptions = (expiresAt) => ({
  httpOnly: true,

  secure: env.nodeEnv === "production",

  sameSite: "lax",

  path: "/api/v1/auth",

  expires: new Date(expiresAt),
});

export const googleAuth = async (req, res) => {
  const input = parseGoogleAuthInput(req.body);

  const result = await authenticateWithGoogle({
    ...input,

    ipAddress: req.ip,

    userAgent: req.get("user-agent") ?? null,
  });

  /*
   * Web:
   * refresh token in HttpOnly cookie.
   */
  if (result.platform === "web") {
    res.cookie(
      env.refreshCookieName,

      result.refreshToken,

      refreshCookieOptions(result.sessionExpiresAt),
    );
  }

  res.set("Cache-Control", "no-store");

  return res.status(200).json({
    success: true,

    message: "Google authentication successful.",

    data: {
      user: result.user,

      accessToken: result.accessToken,

      accessTokenExpiresIn: result.accessTokenExpiresIn,

      sessionExpiresAt: result.sessionExpiresAt,

      /*
       * Mobile only.
       */
      ...(result.platform !== "web"
        ? {
            refreshToken: result.refreshToken,
          }
        : {}),
    },
  });
};
