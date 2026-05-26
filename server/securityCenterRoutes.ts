import type { Express, Request, Response, RequestHandler } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "./db";
import { users, adminActions, securityEvents, securitySettings } from "@shared/schema";
import { sql, eq, desc, gte, and, inArray } from "drizzle-orm";

const execAsync = promisify(exec);

/**
 * Security Center routes — addresses the two weakest scores from the most
 * recent platform audit:
 *
 *   • Authorization & Access Control (78/100) — quarterly RBAC review,
 *     stale-admin detection, principle-of-least-privilege checks.
 *   • Dependency Security (92/100)            — live `npm audit` + outdated
 *     package report so the team can patch proactively.
 *
 * The endpoints are all admin-gated and return JSON consumed by the
 * `SecurityCenter` admin component.
 */
export function registerSecurityCenterRoutes(app: Express, requireAdmin: RequestHandler) {
  /* ── RBAC AUDIT ─────────────────────────────────────────────────────── */
  app.get("/api/admin/security-center/rbac", requireAdmin, async (_req: Request, res: Response) => {
    try {
      // 1. Role distribution across all users
      const roleRows = await db
        .select({ role: users.role, count: sql<number>`count(*)::int` })
        .from(users)
        .groupBy(users.role);

      // 2. Privileged user list (admins, moderators, super_admins) — full
      //    detail so reviewers can decide who to demote.
      const privileged = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          isApproved: users.isApproved,
        })
        .from(users)
        .where(inArray(users.role, ["admin", "moderator", "super_admin"]))
        .orderBy(desc(users.createdAt));

      // 3. Recent admin activity (last 90 days). Used as a proxy for
      //    "active admin", since the schema has no last_login column.
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const recentActions = await db
        .select({
          adminId: adminActions.adminId,
          last: sql<Date>`max(${adminActions.createdAt})`,
          actions: sql<number>`count(*)::int`,
        })
        .from(adminActions)
        .where(gte(adminActions.createdAt, ninetyDaysAgo))
        .groupBy(adminActions.adminId);

      const activityMap = new Map<number, { last: Date; actions: number }>();
      for (const r of recentActions) {
        if (r.adminId !== null) activityMap.set(r.adminId, { last: r.last as any, actions: r.actions });
      }

      const enrichedPrivileged = privileged.map((u) => {
        const activity = activityMap.get(u.id);
        const lastActiveAt = activity?.last ?? null;
        const daysSinceActive = lastActiveAt
          ? Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / (24 * 60 * 60 * 1000))
          : null;
        return {
          ...u,
          lastActiveAt,
          recentActions: activity?.actions ?? 0,
          isStale: daysSinceActive === null || daysSinceActive > 90,
        };
      });

      // 4. Last attestation (quarterly RBAC review sign-off)
      const [reviewRow] = await db
        .select()
        .from(securitySettings)
        .where(eq(securitySettings.key, "rbac_last_review"));
      const lastReview = reviewRow ? JSON.parse(reviewRow.value) : null;
      const reviewDueDays = lastReview
        ? Math.max(0, 90 - Math.floor((Date.now() - new Date(lastReview.at).getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

      // 5. Principle-of-least-privilege checks (auto-evaluated)
      const totalUsers = roleRows.reduce((s, r) => s + Number(r.count), 0);
      const privilegedCount = privileged.length;
      const superAdminCount = privileged.filter((p) => p.role === "super_admin").length;
      const staleCount = enrichedPrivileged.filter((p) => p.isStale).length;
      const ratio = totalUsers > 0 ? privilegedCount / totalUsers : 0;

      const checks = [
        {
          id: "polp-1",
          label: "Privileged accounts ≤ 5% of users",
          ok: ratio <= 0.05,
          detail: `${privilegedCount} privileged / ${totalUsers} total (${(ratio * 100).toFixed(2)}%)`,
        },
        {
          id: "polp-2",
          label: "At most 2 super_admin accounts",
          ok: superAdminCount <= 2,
          detail: `${superAdminCount} super_admin account(s)`,
        },
        {
          id: "polp-3",
          label: "No stale privileged accounts (90+ days inactive)",
          ok: staleCount === 0,
          detail: staleCount === 0 ? "All admins active" : `${staleCount} stale account(s) — review or demote`,
        },
        {
          id: "polp-4",
          label: "Quarterly RBAC review attested in last 90 days",
          ok: !!lastReview && reviewDueDays > 0,
          detail: lastReview
            ? `Reviewed by ${lastReview.by} on ${new Date(lastReview.at).toLocaleDateString()}`
            : "No attestation on record",
        },
        {
          id: "polp-5",
          label: "All privileged accounts approved",
          ok: privileged.every((p) => p.isApproved),
          detail: privileged.every((p) => p.isApproved)
            ? "All approved"
            : `${privileged.filter((p) => !p.isApproved).length} unapproved admin(s)`,
        },
      ];

      // 6. Score derivation (0–100). Each failed check costs 12 points.
      const failed = checks.filter((c) => !c.ok).length;
      const score = Math.max(0, 100 - failed * 12);

      res.json({
        score,
        checks,
        roles: roleRows.map((r) => ({ role: r.role, count: Number(r.count) })),
        privileged: enrichedPrivileged,
        lastReview,
        reviewDueDays,
        totals: { users: totalUsers, privileged: privilegedCount, superAdmin: superAdminCount, stale: staleCount },
      });
    } catch (err: any) {
      console.error("[security-center/rbac]", err);
      res.status(500).json({ error: err?.message || "RBAC audit failed" });
    }
  });

  /* ── RBAC REVIEW ATTESTATION ────────────────────────────────────────── */
  app.post("/api/admin/security-center/rbac-review/sign", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const me = await db.select({ email: users.email, displayName: users.displayName })
      .from(users).where(eq(users.id, adminUserId)).limit(1);
    const reviewer = me[0]?.email || me[0]?.displayName || `user#${adminUserId}`;

    const payload = JSON.stringify({
      at: new Date().toISOString(),
      by: reviewer,
      adminId: adminUserId,
      notes: (req.body?.notes as string | undefined)?.slice(0, 500) || null,
    });

    // Upsert into security_settings
    const existing = await db.select().from(securitySettings).where(eq(securitySettings.key, "rbac_last_review"));
    if (existing.length > 0) {
      await db.update(securitySettings)
        .set({ value: payload, updatedAt: new Date() })
        .where(eq(securitySettings.key, "rbac_last_review"));
    } else {
      await db.insert(securitySettings).values({ key: "rbac_last_review", value: payload });
    }

    // Audit-log the sign-off itself
    await db.insert(adminActions).values({
      adminId: adminUserId,
      actionType: "system_change",
      targetId: null,
      targetType: "system",
      details: `RBAC quarterly review attested by ${reviewer}`,
    });

    res.json({ ok: true, signedAt: new Date().toISOString(), by: reviewer });
  });

  /* ── DEPENDENCY HEALTH ──────────────────────────────────────────────── */
  app.get("/api/admin/security-center/dependencies", requireAdmin, async (_req: Request, res: Response) => {
    const start = Date.now();

    // Run audit + outdated in parallel; both must tolerate non-zero exit codes.
    const [auditRes, outdatedRes] = await Promise.allSettled([
      execAsync("npm audit --json --audit-level=low 2>/dev/null || true", { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }),
      execAsync("npm outdated --json 2>/dev/null || true",                 { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }),
    ]);

    let vulnerabilities = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
    let advisories: Array<{ name: string; severity: string; via: string; range: string; fixAvailable: boolean | string }> = [];
    let auditError: string | null = null;
    if (auditRes.status === "fulfilled") {
      try {
        const j = JSON.parse(auditRes.value.stdout || "{}");
        const m = j.metadata?.vulnerabilities || {};
        vulnerabilities = {
          critical: m.critical || 0, high: m.high || 0,
          moderate: m.moderate || 0, low: m.low || 0, info: m.info || 0,
          total: m.total || ((m.critical||0)+(m.high||0)+(m.moderate||0)+(m.low||0)+(m.info||0)),
        };
        const vulnObj = j.vulnerabilities || {};
        advisories = Object.entries(vulnObj).slice(0, 30).map(([name, info]: [string, any]) => ({
          name,
          severity: info.severity || "unknown",
          via: Array.isArray(info.via)
            ? info.via.map((v: any) => (typeof v === "string" ? v : v.title || v.name)).filter(Boolean).join(", ")
            : (typeof info.via === "string" ? info.via : info.via?.title || ""),
          range: info.range || "*",
          fixAvailable: info.fixAvailable ?? false,
        }));
      } catch (e: any) { auditError = e?.message || "Failed to parse audit output"; }
    } else {
      auditError = auditRes.reason?.message || "npm audit failed";
    }

    let outdated: Array<{ name: string; current: string; wanted: string; latest: string; majorBehind: number }> = [];
    let outdatedError: string | null = null;
    if (outdatedRes.status === "fulfilled") {
      try {
        const raw = outdatedRes.value.stdout?.trim() || "{}";
        const j = JSON.parse(raw);
        outdated = Object.entries(j).slice(0, 60).map(([name, info]: [string, any]) => {
          const current = info.current || "—";
          const latest = info.latest || "—";
          const cur = parseInt(String(current).split(".")[0]) || 0;
          const lat = parseInt(String(latest).split(".")[0]) || 0;
          return { name, current, wanted: info.wanted || "—", latest, majorBehind: Math.max(0, lat - cur) };
        });
        // Heaviest staleness first
        outdated.sort((a, b) => b.majorBehind - a.majorBehind || a.name.localeCompare(b.name));
      } catch (e: any) { outdatedError = e?.message || "Failed to parse outdated output"; }
    } else {
      outdatedError = outdatedRes.reason?.message || "npm outdated failed";
    }

    // Score: heavy penalty for critical/high; cap dependency score at 100.
    const score = Math.max(0,
      100
      - vulnerabilities.critical * 25
      - vulnerabilities.high * 12
      - vulnerabilities.moderate * 4
      - vulnerabilities.low * 1
      - Math.min(20, outdated.filter((o) => o.majorBehind >= 2).length) * 1
    );

    // Persist last-checked timestamp
    const payload = JSON.stringify({ at: new Date().toISOString(), score, vulnerabilities });
    const existing = await db.select().from(securitySettings).where(eq(securitySettings.key, "deps_last_check"));
    if (existing.length > 0) {
      await db.update(securitySettings).set({ value: payload, updatedAt: new Date() })
        .where(eq(securitySettings.key, "deps_last_check"));
    } else {
      await db.insert(securitySettings).values({ key: "deps_last_check", value: payload });
    }

    res.json({
      score,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      vulnerabilities,
      advisories,
      outdated,
      outdatedCount: outdated.length,
      majorBehindCount: outdated.filter((o) => o.majorBehind >= 1).length,
      auditError,
      outdatedError,
    });
  });

  /* ── RECENT SECURITY EVENTS (counts, last 7d) ──────────────────────── */
  app.get("/api/admin/security-center/recent", requireAdmin, async (_req: Request, res: Response) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const rows = await db
        .select({ severity: securityEvents.severity, count: sql<number>`count(*)::int` })
        .from(securityEvents)
        .where(gte(securityEvents.createdAt, sevenDaysAgo))
        .groupBy(securityEvents.severity);
      const map: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const r of rows) map[r.severity] = Number(r.count);
      res.json({ window: "7d", counts: map });
    } catch (err: any) {
      res.json({ window: "7d", counts: { critical: 0, high: 0, medium: 0, low: 0 }, error: err?.message });
    }
  });
}
