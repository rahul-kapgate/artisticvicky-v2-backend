import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./routes/authRoutes.js";
import courseRoutes from './routes/courseRoutes.js'
// import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

// 🔒 Security & Performance Middlewares
app.use(helmet());
app.use(cors({ 
    origin: true,  
    credentials: true 
  }));
app.use(compression());
app.use(express.json());
app.use(cookieParser());


// 🔗 Routes
app.use("/api/auth", authRoutes);
app.use("/api/course", courseRoutes);

// 🧱 Error Handler
// app.use(errorHandler);

export default app;
