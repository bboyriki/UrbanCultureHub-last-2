import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Standard TCP pool — works with Railway Postgres, Neon, Supabase, or any
// PostgreSQL host. Unlike @neondatabase/serverless (WebSocket mode), this
// uses a plain TCP connection so Railway's internal Postgres is supported.
//
// SSL: Neon requires SSL in ALL environments (dev + prod).
// Railway Postgres also requires SSL in production.
// Skip SSL only for a true localhost DB (e.g. local Docker dev).
const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle({ client: pool, schema });
