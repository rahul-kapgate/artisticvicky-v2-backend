import {
  env,
} from "../../../config/env.js";

import {
  logoutCurrentDevice,
  logoutAllDevices,
} from "./logout.service.js";

const clearRefreshCookie = (
  res
) => {
  res.clearCookie(
    env.refreshCookieName,
    {
      httpOnly: true,

      secure:
        env.nodeEnv ===
        "production",

      sameSite: "lax",

      path:
        "/api/v1/auth",
    }
  );
};

export const logout =
  async (
    req,
    res
  ) => {
    await logoutCurrentDevice({
      userId:
        req.user.id,

      sessionId:
        req.authSession.id,
    });

    if (
      req.authSession.platform ===
      "web"
    ) {
      clearRefreshCookie(
        res
      );
    }

    return res.json({
      success: true,
      message:
        "Logged out successfully.",
    });
  };

export const logoutAll =
  async (
    req,
    res
  ) => {
    await logoutAllDevices({
      userId:
        req.user.id,
    });

    clearRefreshCookie(
      res
    );

    return res.json({
      success: true,

      message:
        "Logged out from all devices.",
    });
  };