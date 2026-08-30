import {
  Router,
} from "express";

import {
  login,
} from "./login.controller.js";

import {
  loginRateLimit,
} from "../../../middlewares/authRateLimit.js";

const router = Router();

router.post(
  "/",
  loginRateLimit,
  login
);

export default router;