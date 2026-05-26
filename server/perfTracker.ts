export interface EndpointStat {
  count: number;
  totalMs: number;
  maxMs: number;
  errors: number;
  recentMs: number[];
  recentRequests: { ts: number; ms: number; status: number }[];
}

export const perfStats = new Map<string, EndpointStat>();
export const serverStartTime = Date.now();

export function normalizePath(path: string): string {
  return path
    .replace(/\/\d+/g, "/:id")
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "/:uuid")
    .split("?")[0];
}

export function recordRequest(method: string, path: string, ms: number, status: number) {
  if (path.startsWith("/api/admin/performance")) return;
  const key = `${method} ${normalizePath(path)}`;
  const stat = perfStats.get(key) ?? {
    count: 0, totalMs: 0, maxMs: 0, errors: 0, recentMs: [], recentRequests: [],
  };
  stat.count++;
  stat.totalMs += ms;
  if (ms > stat.maxMs) stat.maxMs = ms;
  if (status >= 500) stat.errors++;
  stat.recentMs.push(ms);
  if (stat.recentMs.length > 50) stat.recentMs.shift();
  stat.recentRequests.push({ ts: Date.now(), ms, status });
  if (stat.recentRequests.length > 50) stat.recentRequests.shift();
  perfStats.set(key, stat);
}

export function getPerformanceReport() {
  const mem = process.memoryUsage();
  const uptimeSec = (Date.now() - serverStartTime) / 1000;

  const endpoints = Array.from(perfStats.entries()).map(([endpoint, s]) => {
    const avgMs = s.count > 0 ? Math.round(s.totalMs / s.count) : 0;
    const p95 = s.recentMs.length > 0
      ? Math.round([...s.recentMs].sort((a, b) => a - b)[Math.floor(s.recentMs.length * 0.95)] ?? s.maxMs)
      : 0;
    return {
      endpoint,
      count: s.count,
      avgMs,
      p95Ms: p95,
      maxMs: s.maxMs,
      errors: s.errors,
      errorRate: s.count > 0 ? +((s.errors / s.count) * 100).toFixed(1) : 0,
      recentRequests: s.recentRequests.slice(-10),
    };
  });

  endpoints.sort((a, b) => b.avgMs - a.avgMs);

  const slow = endpoints.filter(e => e.avgMs > 700);
  const critical = endpoints.filter(e => e.avgMs > 1200);
  const recommendations: string[] = [];

  // Critical response times
  if (critical.length > 0) {
    recommendations.push(
      `Critical: ${critical.map(e => e.endpoint).join(", ")} averaging over 1s — check DB queries and add caching`
    );
  }

  // City spots / Overpass
  if (slow.some(e => e.endpoint.includes("city-spots") && !e.endpoint.includes("spotlight"))) {
    recommendations.push("city-spots/locations: Overpass API call is slow — verify background cache is populated on startup");
  }

  // Proximity presence slow
  if (slow.some(e => e.endpoint.includes("proximity/presence"))) {
    recommendations.push("proximity/presence: slow — ensure upsert pattern is used (not SELECT+UPDATE) and getNearbyUsers runs fire-and-forget after response");
  }

  // Auth login slow (Firebase token verification is an external call — unavoidable, but session save can be optimized)
  if (slow.some(e => e.endpoint.includes("auth/login"))) {
    recommendations.push("auth/login: slow — Firebase token verification is an external call; ensure session.save() is not being awaited before response");
  }

  // Tracking session end (should respond immediately and update DB asynchronously)
  if (slow.some(e => e.endpoint.includes("tracking/session/end"))) {
    recommendations.push("tracking/session/end: slow — respond immediately and update session duration in the background (fire-and-forget)");
  }

  // Posts / feed slow
  if (slow.some(e => e.endpoint.includes("posts") || e.endpoint.includes("feed"))) {
    recommendations.push("posts/feed: heavy query detected — ensure in-memory cache is active and no sequential DB loops (N+1)");
  }

  // Events slow
  if (slow.some(e => e.endpoint.includes("/api/events") && e.avgMs > 700)) {
    recommendations.push("events: slow list query — ensure eventsCache is active and verbose console.log calls are removed from hot path");
  }

  // Admin stats slow (first call after cold start)
  if (slow.some(e => e.endpoint.includes("admin/stats"))) {
    recommendations.push("admin/stats: cache miss on cold start — ensure startup cache warm-up is running after registerRoutes()");
  }

  // Chat unread slow
  if (slow.some(e => e.endpoint.includes("chat") && e.endpoint.includes("unread"))) {
    recommendations.push("chat/messages/unread: N+1 query detected — fetch all conversations/senders in parallel with Promise.all");
  }

  // High error rate
  const highError = endpoints.filter(e => e.errorRate > 5 && e.count >= 5);
  if (highError.length > 0) {
    recommendations.push(`High error rate (>5%) on: ${highError.map(e => `${e.endpoint} (${e.errorRate}%)`).join(", ")}`);
  }

  // Memory pressure — use actual V8 heap_size_limit, not heapTotal
  const heapUsedMB = mem.heapUsed / 1024 / 1024;
  // v8.getHeapStatistics().heap_size_limit is the real max (set by --max-old-space-size)
  let heapCapMB = 512;
  try {
    const { getHeapStatistics } = require("v8") as typeof import("v8");
    heapCapMB = Math.round(getHeapStatistics().heap_size_limit / 1024 / 1024);
  } catch (_) {}
  if (heapUsedMB > heapCapMB * 0.85) {
    recommendations.push(`Memory pressure: ${Math.round(heapUsedMB)}MB / ${heapCapMB}MB heap limit — consider a restart if sustained`);
  }

  if (recommendations.length === 0) {
    if (slow.length === 0 && endpoints.length > 0) {
      recommendations.push("All endpoints look healthy! Keep monitoring.");
    } else if (slow.length > 0) {
      recommendations.push(
        `${slow.length} endpoint(s) averaging >700ms — monitor ${slow.map(e => e.endpoint.replace("/api/", "")).join(", ")}`
      );
    }
  }

  return {
    system: {
      uptimeSec: Math.round(uptimeSec),
      memHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      memHeapTotalMb: heapCapMB,   // real heap_size_limit, not current heapTotal
      memRssMb: Math.round(mem.rss / 1024 / 1024),
      memPct: Math.round((mem.heapUsed / 1024 / 1024 / heapCapMB) * 100),
      nodeVersion: process.version,
    },
    endpoints,
    recommendations,
    collectedAt: new Date().toISOString(),
  };
}
