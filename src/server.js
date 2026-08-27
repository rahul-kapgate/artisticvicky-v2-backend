import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, pool } from "./config/database.js";
import logger from "./config/logger.js";

const startServer = async () => {
  try {
    // Connect to PostgreSQL
    await connectDatabase();

    // Start Express server
    const server = app.listen(env.port, () => {
      logger.info(
        `Server running on http://localhost:${env.port}`
      );
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down...`);

      server.close(async () => {
        await pool.end();

        logger.info("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();