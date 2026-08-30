import {
  Router,
} from "express";

import {
  refresh,
} from "./refresh-token.controller.js";

import {
  refreshRateLimit,
} from "../../../middlewares/authRateLimit.js";

const router = Router();

router.post(
  "/",
  refreshRateLimit,
  refresh
);

export default router;