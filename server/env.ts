/**
 * Environment detection for UrbanCultureHub
 *
 * TWO deployment environments:
 *
 * 1. RAILWAY  — production
 *    - Set APP_URL=https://yourapp.up.railway.app in Railway Variables
 *    - Built via Dockerfile, served as compiled Node bundle
 *    - NODE_ENV=production
 *
 * 2. REPLIT   — development / staging
 *    - REPLIT_DOMAINS is auto-set by Replit
 *    - Runs live TypeScript via tsx (hot reload)
 *    - NODE_ENV=development (or production for Replit Deployments)
 */

// ── Which environment are we in? ──────────────────────────────────────────────
export const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT ||
  (!!process.env.APP_URL && !process.env.REPL_ID);

export const IS_REPLIT = !!process.env.REPL_ID ||
  !!process.env.REPLIT_DOMAINS;

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const IS_DEVELOPMENT = !IS_PRODUCTION;

// ── Public origin of this deployment ─────────────────────────────────────────
// Railway:  set APP_URL=https://yourapp.up.railway.app in Railway Variables
// Replit:   automatically provided via REPLIT_DOMAINS
// Local:    falls back to localhost
const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];

export const APP_ORIGIN: string =
  process.env.APP_URL?.replace(/\/$/, "") ||
  (replitDomain ? `https://${replitDomain}` : "") ||
  `http://localhost:${process.env.PORT || 5000}`;

// ── Database ──────────────────────────────────────────────────────────────────
// Same Neon PostgreSQL for both environments.
// On Railway: set DATABASE_URL in Variables panel.
// On Replit:  set DATABASE_URL in Secrets panel.
export const DATABASE_URL = process.env.DATABASE_URL;

// ── Port ─────────────────────────────────────────────────────────────────────
// Railway injects PORT at runtime. Replit uses 5000 mapped to external 80.
export const PORT = parseInt(process.env.PORT || "5000", 10);

// ── Log which environment is active ──────────────────────────────────────────
export function logEnvironment() {
  const env = IS_RAILWAY ? "🚂 RAILWAY" : IS_REPLIT ? "🔁 REPLIT" : "💻 LOCAL";
  console.log(`[ENV] Running on ${env}`);
  console.log(`[ENV] Origin: ${APP_ORIGIN}`);
  console.log(`[ENV] Node:   ${process.env.NODE_ENV || "development"}`);
}
