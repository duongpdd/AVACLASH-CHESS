import { readFile } from "node:fs/promises";
import { databasePool } from "./PostgresStore.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw Error("DATABASE_URL is required for migration.");
if (new URL(connectionString).hostname.includes("-pooler"))
  throw Error(
    "Run migrations with the direct Neon connection, not a pooled URL.",
  );
const pool = databasePool(connectionString);
try {
  const sql = await readFile(
    new URL("../migrations/001-relay-games.sql", import.meta.url),
    "utf8",
  );
  await pool.query(sql);
  console.log("Relay storage migration 001 applied.");
} catch {
  console.error(
    "Relay storage migration failed. Check the database connection and permissions.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
