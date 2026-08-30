import {
  Router,
} from "express";

import {
  authenticate,
} from "../../../middlewares/authenticate.js";

import {
  logout,
  logoutAll,
} from "./logout.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  logout
);

router.post(
  "/all",
  authenticate,
  logoutAll
);

export default router;