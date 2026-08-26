import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, pool } from "./config/database.js";

const startServer = async () => {
  try {
    // Connect to PostgreSQL
    await connectDatabase();

    // Start Express server
    const server = app.listen(env.port, () => {
      console.log(
        `Server running on http://localhost:${env.port}`
      );
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {
        await pool.end();

        console.log("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();