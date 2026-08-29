import {
  Router,
} from "express";


import registrationRoutes
  from "../modules/auth/registration/registration.routes.js";


import forgotPasswordRoutes
  from "../modules/auth/forgot-password/forgot-password.routes.js";


const router =
  Router();


router.use(
  "/register",

  registrationRoutes
);


router.use(
  "/forgot-password",

  forgotPasswordRoutes
);


export default router;