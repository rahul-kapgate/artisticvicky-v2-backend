import { Router } from "express";

import courseAdminRoutes from "../modules/course/admin/course-admin.routes.js";

const router = Router();

router.use("/courses", courseAdminRoutes);

export default router;
