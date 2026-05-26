/**
 * Event Auto-Scheduler
 * - Automatically syncs new events from Ticketmaster + Eventbrite every 6 hours
 * - Automatically archives events whose date has passed (daily)
 * - Exposes scheduler status for the admin panel
 */

import { db } from "./db";
import { events } from "../shared/schema";
import { lt, and, eq, or, isNull } from "drizzle-orm";

const SYNC_INTERVAL_MS  = 6  * 60 * 60 * 1000; // 6 hours
const ARCHIVE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FIRST_SYNC_DELAY_MS = 1  * 60 * 1000;      // 1 minute after startup

// ── In-memory state ────────────────────────────────────────────────────────────
interface SyncLog { source: string; synced: number; skipped: number; errors: string[]; at: Date; }

const state = {
  running: false,
  enabled: true,
  lastSync: null as Date | null,
  nextSync: null as Date | null,
  lastArchive: null as Date | null,
  lastArchiveCount: 0,
  totalSyncedAllTime: 0,
  totalArchivedAllTime: 0,
  recentLogs: [] as SyncLog[],
  activeTimers: [] as NodeJS.Timeout[],
};

function addLog(log: SyncLog) {
  state.recentLogs.unshift(log);
  if (state.recentLogs.length > 20) state.recentLogs.pop();
}

// ── Archive expired events ─────────────────────────────────────────────────────
export async function archiveExpiredEvents(): Promise<number> {
  // Mark events whose date is > 3 days in the past
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const result = await db
    .update(events)
    .set({ status: "past" as any })
    .where(
      and(
        eq(events.status, "approved"),
        lt(events.date, cutoff),
      )
    )
    .returning({ id: events.id });

  const count = result.length;
  if (count > 0) {
    console.log(`📦 Auto-archived ${count} expired events`);
    state.lastArchive = new Date();
    state.lastArchiveCount = count;
    state.totalArchivedAllTime += count;
  }
  return count;
}

// ── Run sync from all configured sources ──────────────────────────────────────
async function runAutoSync(): Promise<void> {
  if (state.running) {
    console.log("⏳ Auto-sync already running, skipping this cycle");
    return;
  }

  state.running = true;
  console.log("🔄 Auto-sync starting...");

  try {
    // ── Ticketmaster ──────────────────────────────────────────────────────────
    try {
      const { syncTicketmasterEvents } = await import("./ticketmaster");
      const result = await syncTicketmasterEvents({ maxResults: 2000, organizerId: 4 });
      console.log(`🎫 Ticketmaster: +${result.synced} new, ${result.skipped} skipped`);
      addLog({ source: "ticketmaster", ...result, at: new Date() });
      state.totalSyncedAllTime += result.synced;

      // Flush entire events cache so new events appear immediately
      try {
        const { eventsCache } = await import("./routes");
        eventsCache?.flushAll?.();
      } catch {}
    } catch (err: any) {
      console.error("Ticketmaster auto-sync error:", err.message);
    }

    // ── Eventbrite ────────────────────────────────────────────────────────────
    try {
      const { syncEventbriteEvents } = await import("./eventbrite");
      const result = await syncEventbriteEvents({ maxResults: 100, organizerId: 4 });
      console.log(`🎟 Eventbrite: +${result.synced} new, ${result.skipped} skipped`);
      addLog({ source: "eventbrite", ...result, at: new Date() });
      state.totalSyncedAllTime += result.synced;

      try {
        const { eventsCache } = await import("./routes");
        eventsCache?.flushAll?.();
      } catch {}
    } catch (err: any) {
      console.error("Eventbrite auto-sync error:", err.message);
    }
  } finally {
    state.running = false;
    state.lastSync = new Date();
    state.nextSync = new Date(Date.now() + SYNC_INTERVAL_MS);
    console.log(`✅ Auto-sync complete. Next sync: ${state.nextSync.toISOString()}`);
  }
}

// ── Start the scheduler ────────────────────────────────────────────────────────
export function startEventScheduler(): void {
  console.log("🕒 Event scheduler starting...");

  // Archive expired events immediately on boot
  archiveExpiredEvents().catch(console.error);

  // First auto-sync after a short delay so the server has fully started
  state.nextSync = new Date(Date.now() + FIRST_SYNC_DELAY_MS);

  const firstSyncTimer = setTimeout(() => {
    runAutoSync().catch(console.error);

    // Then repeat every 6 hours
    const syncTimer = setInterval(() => {
      if (state.enabled) runAutoSync().catch(console.error);
    }, SYNC_INTERVAL_MS);
    state.activeTimers.push(syncTimer);
  }, FIRST_SYNC_DELAY_MS);

  state.activeTimers.push(firstSyncTimer);

  // Archive check every 24 hours
  const archiveTimer = setInterval(() => {
    archiveExpiredEvents().catch(console.error);
  }, ARCHIVE_INTERVAL_MS);
  state.activeTimers.push(archiveTimer);

  console.log(`✅ Scheduler active — first sync in ${Math.round(FIRST_SYNC_DELAY_MS / 60000)} min, then every 6h`);
}

export function stopEventScheduler(): void {
  state.activeTimers.forEach(t => clearTimeout(t));
  state.activeTimers.length = 0;
  state.enabled = false;
  console.log("🛑 Event scheduler stopped");
}

export function pauseEventScheduler(): void {
  state.enabled = false;
}

export function resumeEventScheduler(): void {
  state.enabled = true;
}

export function triggerManualSync(): Promise<void> {
  return runAutoSync();
}

export function triggerManualArchive(): Promise<number> {
  return archiveExpiredEvents();
}

export function getSchedulerStatus() {
  return {
    enabled: state.enabled,
    running: state.running,
    lastSync: state.lastSync?.toISOString() ?? null,
    nextSync: state.nextSync?.toISOString() ?? null,
    lastArchive: state.lastArchive?.toISOString() ?? null,
    lastArchiveCount: state.lastArchiveCount,
    totalSynced: state.totalSyncedAllTime,
    totalArchived: state.totalArchivedAllTime,
    syncIntervalHours: SYNC_INTERVAL_MS / (60 * 60 * 1000),
    recentLogs: state.recentLogs.slice(0, 10),
  };
}
