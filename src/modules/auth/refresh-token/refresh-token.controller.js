import { env } from "../../../config/env.js";

import { refreshSession } from "./refresh-token.service.js";

const refreshCookieOptions = (expiresAt) => ({
  httpOnly: true,

  secure: env.nodeEnv === "production",

  sameSite: "lax",

  path: "/api/v1/auth",

  expires: new Date(expiresAt),
});

export const refresh = async (req, res) => {
  /*
   * Web → cookie
   * Mobile → request body
   */
  const refreshToken =
    req.cookies?.[env.refreshCookieName] || req.body?.refreshToken;

  const result = await refreshSession({
    refreshToken,

    ipAddress: req.ip,

    userAgent: req.get("user-agent") ?? null,
  });

  if (result.platform === "web") {
    res.cookie(
      env.refreshCookieName,

      result.refreshToken,

      refreshCookieOptions(result.sessionExpiresAt),
    );
  }

  return res.status(200).json({
    success: true,

    data: {
      accessToken: result.accessToken,

      accessTokenExpiresIn: result.accessTokenExpiresIn,

      sessionExpiresAt: result.sessionExpiresAt,

      ...(result.platform !== "web"
        ? {
            refreshToken: result.refreshToken,
          }
        : {}),
    },
  });
};
