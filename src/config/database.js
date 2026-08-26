import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

export const connectDatabase = async () => {
  try {
    const client = await pool.connect();

    console.log("Supabase PostgreSQL connected successfully");

    client.release();
  } catch (error) {
    console.error("Supabase PostgreSQL connection failed:", error);
    process.exit(1);
  }
};