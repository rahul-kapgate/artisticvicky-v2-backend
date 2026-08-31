import { Router } from "express";

import registrationRoutes from "../modules/auth/registration/registration.routes.js";

import forgotPasswordRoutes from "../modules/auth/forgot-password/forgot-password.routes.js";

import loginRoutes from "../modules/auth/login/login.routes.js";

import refreshTokenRoutes from "../modules/auth/refresh-token/refresh-token.routes.js";

import logoutRoutes from "../modules/auth/logout/logout.routes.js";

import googleRoutes from "../modules/auth/google/google.routes.js";

const router = Router();

router.use("/register", registrationRoutes);

router.use("/forgot-password", forgotPasswordRoutes);

router.use("/login", loginRoutes);

router.use("/refresh", refreshTokenRoutes);

router.use("/logout", logoutRoutes);

router.use("/google", googleRoutes);

export default router;
