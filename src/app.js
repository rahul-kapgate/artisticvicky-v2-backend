import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import logger from "./config/logger.js";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import SwaggerParser from "@apidevtools/swagger-parser";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import courseRoute from "./routes/course.route.js";
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openApiPath = path.join(__dirname, "../docs/openapi.yaml");

const swaggerDocument = await SwaggerParser.dereference(openApiPath);

app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,

    credentials: true,
  }),
);
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

if (env.nodeEnv !== "production") {
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: "Artistic Vicky API Docs",

      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        withCredentials: true,

        responseInterceptor: (response) => {
          if (
            response.url?.includes("/api/v1/auth/login") &&
            response.status >= 200 &&
            response.status < 300
          ) {
            const token =
              response.obj?.data?.accessToken || response.obj?.accessToken;

            if (token && window.ui) {
              window.ui.preauthorizeApiKey("bearerAuth", token);
            }
          }

          return response;
        },
      },
    }),
  );
}

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
  });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/courses", courseRoute);
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
