import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();
dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env")
});

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB
});

const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../migrations");
const migrationFiles = [
  "001_create_files.sql",
  "002_create_jobs.sql",
  "003_create_file_rows.sql"
];

export const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const migrationFile of migrationFiles) {
      const sql = await readFile(resolve(migrationDirectory, migrationFile), "utf8");
      await client.query(sql);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export { pool };
