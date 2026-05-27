/**
 * Control Center — real-time admin IDE backend
 *
 * Provides:
 *   • SSE log streaming  — GET  /api/admin/control-center/stream
 *   • Live metrics       — GET  /api/admin/control-center/metrics
 *   • Error aggregation  — GET  /api/admin/control-center/errors
 *                          DELETE /api/admin/control-center/errors
 *   • Log history        — GET  /api/admin/control-center/logs
 *   • File browser       — GET  /api/admin/control-center/files
 *   • File read          — GET  /api/admin/control-center/file?path=…
 *   • File write         — PUT  /api/admin/control-center/file
 *   • Status             — GET  /api/admin/control-center/status
 *
 * All endpoints require requireAdmin middleware.
 * The console interceptor is installed once on first call to
 * registerControlCenterRoutes() and pipes every console.log/warn/error
 * into the in-memory ring buffer + SSE broadcast.
 */

import { EventEmitter } from "events";
import { exec } from "child_process";
import { promisify } from "util";
import type { Express, Request, Response, RequestHandler } from "express";
import { getPerformanceReport, serverStartTime } from "./perfTracker";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

// ── Log bus ──────────────────────────────────────────────────────────────────
export const logBus = new EventEmitter();
logBus.setMaxListeners(200); // support up to ~200 simultaneous SSE clients

export interface LogEntry {
  id: string;
  ts: number;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
}

export interface ErrorEntry {
  id: string;
  ts: number;
  message: string;
  stack?: string;
  count: number;
  lastSeen: number;
  route?: string;
}

// ── Ring buffers ─────────────────────────────────────────────────────────────
const MAX_LOGS = 500;
const recentLogs: LogEntry[] = [];
const errorMap = new Map<string, ErrorEntry>(); // key = message fingerprint (first 120 chars)

// ── Console interceptor (installed once) ────────────────────────────────────
let interceptorInstalled = false;

function installConsoleInterceptor() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  const origLog   = console.log.bind(console);
  const origWarn  = console.warn.bind(console);
  const origError = console.error.bind(console);

  function capture(level: LogEntry["level"], args: unknown[]) {
    try {
      const message = args
        .map(a => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");

      // Extract [source] prefix from messages like "12:34:56 [express] GET …"
      const srcMatch = message.match(/\[(\w[\w-]*)\]/);
      const source   = srcMatch ? srcMatch[1] : "server";

      const entry: LogEntry = {
        id:      `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ts:      Date.now(),
        level,
        source,
        message: message.slice(0, 2000),
      };

      recentLogs.push(entry);
      if (recentLogs.length > MAX_LOGS) recentLogs.shift();
      logBus.emit("log", entry);
    } catch {
      // Never throw inside a console override
    }
  }

  console.log   = (...args: unknown[]) => { origLog(...args);   capture("info",  args); };
  console.warn  = (...args: unknown[]) => { origWarn(...args);  capture("warn",  args); };
  console.error = (...args: unknown[]) => { origError(...args); capture("error", args); };
}

// ── Error tracker (called from global error handler) ─────────────────────────
export function pushError(message: string, stack?: string, route?: string) {
  const key = message.slice(0, 120);
  const existing = errorMap.get(key);

  if (existing) {
    existing.count++;
    existing.lastSeen = Date.now();
    if (stack && !existing.stack) existing.stack = stack.slice(0, 2000);
    logBus.emit("error-update", existing);
  } else {
    if (errorMap.size >= 100) {
      // Evict oldest entry
      const firstKey = errorMap.keys().next().value;
      if (firstKey) errorMap.delete(firstKey);
    }
    const entry: ErrorEntry = {
      id:       `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ts:       Date.now(),
      message:  message.slice(0, 500),
      stack:    stack?.slice(0, 2000),
      count:    1,
      lastSeen: Date.now(),
      route,
    };
    errorMap.set(key, entry);
    logBus.emit("error-update", entry);
  }
}

// ── File browser helpers ─────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(process.cwd());

function isSafePath(fullPath: string): boolean {
  const resolved = path.resolve(fullPath);
  return (
    resolved.startsWith(PROJECT_ROOT) &&
    !resolved.includes("node_modules") &&
    !resolved.includes(".git") &&
    !resolved.includes(".cache")
  );
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: FileNode[];
}

function getFileTree(dir: string, depth = 0): FileNode[] {
  const MAX_DEPTH = 3;
  if (depth > MAX_DEPTH) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const result: FileNode[] = [];

  for (const e of entries) {
    // Skip hidden files, node_modules, build artifacts
    if (e.name.startsWith(".") || ["node_modules", "dist", ".git", ".cache", "attached_assets"].includes(e.name)) {
      continue;
    }

    const fullPath = path.join(dir, e.name);
    const relPath  = path.relative(PROJECT_ROOT, fullPath);

    if (e.isDirectory()) {
      result.push({
        name: e.name,
        path: relPath,
        type: "dir",
        children: getFileTree(fullPath, depth + 1),
      });
    } else if (e.isFile()) {
      let size = 0;
      try { size = fs.statSync(fullPath).size; } catch { /* ok */ }
      result.push({ name: e.name, path: relPath, type: "file", size });
    }
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Allowed extensions for writes — keep this conservative
const WRITABLE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs",
  ".json", ".css", ".md", ".txt",
  ".example", // .env.example
]);

// ── Route registration ────────────────────────────────────────────────────────
export function registerControlCenterRoutes(app: Express, requireAdmin: RequestHandler) {
  // Install console interceptor once routes are registered
  installConsoleInterceptor();

  /* ── SSE — live log + error stream ──────────────────────────────────────── */
  app.get("/api/admin/control-center/stream", requireAdmin, (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // prevent nginx output buffering
    res.flushHeaders();

    // Send the last 100 log entries as initial history
    const history = recentLogs.slice(-100);
    res.write(`data: ${JSON.stringify({ type: "history", logs: history })}\n\n`);

    // Heartbeat every 20 s to keep the connection alive through Railway's proxy
    const heartbeat = setInterval(() => {
      try { res.write(`: heartbeat\n\n`); } catch { /* client gone */ }
    }, 20_000);

    const onLog = (entry: LogEntry) => {
      try { res.write(`data: ${JSON.stringify({ type: "log", entry })}\n\n`); } catch { /* ok */ }
    };
    const onErrorUpdate = (entry: ErrorEntry) => {
      try { res.write(`data: ${JSON.stringify({ type: "error", entry })}\n\n`); } catch { /* ok */ }
    };

    logBus.on("log", onLog);
    logBus.on("error-update", onErrorUpdate);

    req.on("close", () => {
      clearInterval(heartbeat);
      logBus.off("log", onLog);
      logBus.off("error-update", onErrorUpdate);
    });
  });

  /* ── Metrics ──────────────────────────────────────────────────────────────── */
  app.get("/api/admin/control-center/metrics", requireAdmin, (_req: Request, res: Response) => {
    try {
      const report = getPerformanceReport();
      const sseClients = logBus.listenerCount("log");
      res.json({ ...report, sseClients });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /* ── Error aggregation ────────────────────────────────────────────────────── */
  app.get("/api/admin/control-center/errors", requireAdmin, (_req: Request, res: Response) => {
    const errors = Array.from(errorMap.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 50);
    res.json({ data: errors, total: errors.length });
  });

  app.delete("/api/admin/control-center/errors", requireAdmin, (_req: Request, res: Response) => {
    errorMap.clear();
    res.json({ success: true });
  });

  /* ── Log history (REST fallback) ─────────────────────────────────────────── */
  app.get("/api/admin/control-center/logs", requireAdmin, (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const level = req.query.level as string | undefined;
    const search = req.query.search as string | undefined;

    let logs = level ? recentLogs.filter(l => l.level === level) : [...recentLogs];
    if (search) logs = logs.filter(l => l.message.toLowerCase().includes(search.toLowerCase()));
    logs = logs.slice(-limit);

    res.json({ data: logs, total: logs.length });
  });

  /* ── File browser ────────────────────────────────────────────────────────── */
  app.get("/api/admin/control-center/files", requireAdmin, (_req: Request, res: Response) => {
    try {
      const tree = getFileTree(PROJECT_ROOT);
      res.json({ root: PROJECT_ROOT, tree });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /* ── File read ───────────────────────────────────────────────────────────── */
  app.get("/api/admin/control-center/file", requireAdmin, (req: Request, res: Response) => {
    const relPath = req.query.path as string;
    if (!relPath) return res.status(400).json({ error: "path query param is required" });

    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (!isSafePath(fullPath)) return res.status(403).json({ error: "Access denied" });

    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > 512 * 1024) {
        return res.status(413).json({ error: "File too large to open in editor (max 512 KB)" });
      }
      const content = fs.readFileSync(fullPath, "utf8");
      res.json({
        path:    relPath,
        content,
        size:    stat.size,
        mtime:   stat.mtimeMs,
      });
    } catch {
      res.status(404).json({ error: "File not found" });
    }
  });

  /* ── File write ──────────────────────────────────────────────────────────── */
  app.put("/api/admin/control-center/file", requireAdmin, (req: Request, res: Response) => {
    const { path: relPath, content } = req.body as { path?: string; content?: string };

    if (!relPath || content === undefined) {
      return res.status(400).json({ error: "path and content are required" });
    }

    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (!isSafePath(fullPath)) return res.status(403).json({ error: "Access denied" });

    const ext = path.extname(fullPath).toLowerCase();
    if (!WRITABLE_EXTS.has(ext)) {
      return res.status(403).json({ error: `Writing ${ext} files is not permitted` });
    }

    if (typeof content !== "string" || content.length > 512 * 1024) {
      return res.status(413).json({ error: "Content too large (max 512 KB)" });
    }

    try {
      // Safety: write to temp file then rename so partial writes never corrupt
      const tmp = fullPath + ".cc-tmp";
      fs.writeFileSync(tmp, content, "utf8");
      fs.renameSync(tmp, fullPath);
      res.json({ success: true, path: relPath });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /* ── Status snapshot ─────────────────────────────────────────────────────── */
  app.get("/api/admin/control-center/status", requireAdmin, (_req: Request, res: Response) => {
    res.json({
      sseClients:    logBus.listenerCount("log"),
      logBufferSize: recentLogs.length,
      errorCount:    errorMap.size,
      uptimeSec:     Math.round((Date.now() - serverStartTime) / 1000),
    });
  });

  /* ── Safe Quick Commands ─────────────────────────────────────────────────── */
  // STRICT whitelist — only pre-approved read-only/diagnostic commands.
  // No arbitrary shell execution is ever allowed, even for admins.
  const SAFE_COMMANDS: Record<string, { cmd: string; label: string; dangerous?: boolean }> = {
    "npm-audit":         { cmd: "npm audit --json 2>/dev/null || npm audit 2>&1 | head -80", label: "npm audit" },
    "npm-outdated":      { cmd: "npm outdated 2>&1 | head -40", label: "npm outdated" },
    "git-status":        { cmd: "git status --short", label: "git status" },
    "git-log":           { cmd: "git log --oneline --graph --decorate -20", label: "git log (last 20)" },
    "git-diff-stat":     { cmd: "git diff --stat HEAD", label: "git diff --stat" },
    "git-branch":        { cmd: "git branch -a", label: "git branch -a" },
    "disk-usage":        { cmd: "df -h . 2>&1 | head -5", label: "Disk usage" },
    "node-version":      { cmd: "node --version && npm --version", label: "Node / npm version" },
    "process-list":      { cmd: "ps aux --sort=-%cpu 2>/dev/null | head -15 || echo 'ps not available'", label: "Top processes" },
    "memory-info":       { cmd: "free -h 2>/dev/null || echo 'free not available'", label: "Memory info" },
    "env-check":         { cmd: "node -e \"const k=['DATABASE_URL','FIREBASE_SERVICE_ACCOUNT','STRIPE_SECRET_KEY','ANTHROPIC_API_KEY','CLOUDINARY_API_KEY','SESSION_SECRET'];k.forEach(n=>console.log(n+':'+(process.env[n]?'✓ set':'✗ MISSING')));\"", label: "Check required env vars" },
    "ts-errors":         { cmd: "npx tsc --noEmit --skipLibCheck 2>&1 | grep 'error TS' | wc -l | xargs -I{} echo '{} TypeScript errors'", label: "TypeScript error count" },
  };

  app.get("/api/admin/control-center/commands", requireAdmin, (_req: Request, res: Response) => {
    const list = Object.entries(SAFE_COMMANDS).map(([id, { label }]) => ({ id, label }));
    res.json({ commands: list });
  });

  app.post("/api/admin/control-center/run", requireAdmin, async (req: Request, res: Response) => {
    const { commandId } = req.body as { commandId?: string };

    if (!commandId) return res.status(400).json({ error: "commandId is required" });

    const cmd = SAFE_COMMANDS[commandId];
    if (!cmd) {
      return res.status(403).json({ error: "Unknown or disallowed command" });
    }

    try {
      const { stdout, stderr } = await execAsync(cmd.cmd, {
        cwd: PROJECT_ROOT,
        timeout: 30_000,
        maxBuffer: 256 * 1024,
        env: { ...process.env, FORCE_COLOR: "0" },
      });
      const output = (stdout + (stderr ? `\n[stderr]\n${stderr}` : "")).trim();
      res.json({ commandId, label: cmd.label, output, exitCode: 0 });
    } catch (e: any) {
      // exec rejects on non-zero exit but still has stdout (e.g. npm audit)
      const output = ((e.stdout || "") + (e.stderr ? `\n${e.stderr}` : "")).trim() || e.message;
      res.json({ commandId, label: cmd.label, output, exitCode: e.code ?? 1 });
    }
  });

  /* ── Git quick-view ──────────────────────────────────────────────────────── */
  app.get("/api/admin/control-center/git", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const [statusResult, logResult, branchResult] = await Promise.allSettled([
        execAsync("git status --short", { cwd: PROJECT_ROOT, timeout: 8_000 }),
        execAsync("git log --oneline -5", { cwd: PROJECT_ROOT, timeout: 8_000 }),
        execAsync("git rev-parse --abbrev-ref HEAD", { cwd: PROJECT_ROOT, timeout: 5_000 }),
      ]);

      res.json({
        branch: branchResult.status === "fulfilled" ? branchResult.value.stdout.trim() : "unknown",
        status: statusResult.status === "fulfilled" ? statusResult.value.stdout.trim() : null,
        recentCommits: logResult.status === "fulfilled"
          ? logResult.value.stdout.trim().split("\n").filter(Boolean).map((l: string) => ({
              hash:    l.slice(0, 7),
              message: l.slice(8),
            }))
          : [],
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
