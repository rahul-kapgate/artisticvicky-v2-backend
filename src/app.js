import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import logger from "./config/logger.js";

import authRoutes from "./modules/auth/registration/registration.routes.js";

const app = express();

// Security
app.use(helmet());

// Logging
app.use(
  pinoHttp({
    logger,

    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),

      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  }),
);

// CORS
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
  });
});

// API routes
app.use("/api/v1/auth", authRoutes);
// app.use("/api/v1/users", userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

export default app;
