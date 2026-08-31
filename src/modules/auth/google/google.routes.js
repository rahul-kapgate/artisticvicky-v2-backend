import { Router } from "express";

import { googleAuth } from "./google.controller.js";

import { loginRateLimit } from "../../../middlewares/authRateLimit.js";

const router = Router();

router.post("/", loginRateLimit, googleAuth);

export default router;
