import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error("Missing database connection URL. Environment variables:", Object.keys(process.env));
  throw new Error("DATABASE_URL or SUPABASE_DB_URL must be set.");
}

export const pool = new Pool({ 
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});
export const db = drizzle(pool, { schema });

export * from "./schema";
