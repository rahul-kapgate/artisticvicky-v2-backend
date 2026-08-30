import {
  revokeCurrentSession,
  revokeAllSessions,
} from "./logout.repository.js";

export const logoutCurrentDevice =
  async ({
    userId,
    sessionId,
  }) => {
    await revokeCurrentSession({
      userId,
      sessionId,
    });
  };

export const logoutAllDevices =
  async ({
    userId,
  }) => {
    await revokeAllSessions(
      userId
    );
  };