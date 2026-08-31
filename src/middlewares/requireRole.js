import AppError from "../utils/AppError.js";

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError(
        "Authentication required.",
        401,
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        "You do not have permission to perform this action.",
        403,
        {
          code: "PERMISSION_DENIED",
        }
      );
    }

    next();
  };
};