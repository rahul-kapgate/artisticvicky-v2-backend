import { Router } from "express";

import courseRoute from "../modules/course/public/course.routes.js";
const router = Router();

router.use("/courses", courseRoute);

export default router;
