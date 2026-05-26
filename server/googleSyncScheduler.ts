/**
 * server/googleSyncScheduler.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every 15 minutes. For every active Google connection, syncs Gmail
 * (appointment-detection) and Google Calendar (event import).
 */

import { db } from "./db";
import { googleSyncConnections } from "@shared/schema";
import { syncConnection } from "./googleSyncRoutes";

let started = false;

async function tick() {
  try {
    const conns = await db.select({ id: googleSyncConnections.id }).from(googleSyncConnections);
    if (!conns.length) return;

    for (const conn of conns) {
      try {
        const result = await syncConnection(conn.id);
        if (result.gmailNew || result.calendarNew) {
          console.log(`[GoogleSync] conn=${conn.id} gmail+${result.gmailNew} cal+${result.calendarNew}`);
        }
        if (result.errors.length) {
          console.error(`[GoogleSync] conn=${conn.id} errors:`, result.errors.join("; "));
        }
      } catch (e: any) {
        console.error(`[GoogleSync] tick error conn=${conn.id}:`, e?.message || e);
      }
    }
  } catch (e) {
    console.error("[GoogleSync] scheduler error:", e);
  }
}

export function startGoogleSyncScheduler() {
  if (started) return;
  started = true;
  console.log("🔄 Google Sync scheduler starting — checking every 15 min");
  // First run 30 s after boot
  setTimeout(() => tick().catch(() => {}), 30_000);
  setInterval(() => tick().catch(() => {}), 15 * 60 * 1000);
}
