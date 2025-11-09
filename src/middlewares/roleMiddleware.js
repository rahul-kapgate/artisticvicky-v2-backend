
export const isAdmin = (req, res, next) => {
    if (req.user && req.user.is_admin === true) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied: Admins only.",
      });
    }
  };
  