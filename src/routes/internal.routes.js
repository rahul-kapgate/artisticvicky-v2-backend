import express from "express";

import { runAccountDeletionCron } from "../controllers/accountDeletion.controller.js";

const router = express.Router();

router.post("/account-deletions/process", runAccountDeletionCron);

export default router;
