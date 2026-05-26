export interface AIUsageEvent {
  id: number;
  feature: string;
  userId?: number;
  displayName?: string;
  category?: string;
  placeTypes?: string[];
  city?: string;
  timestamp: string;
}

let log: AIUsageEvent[] = [];
let counter = 1;

export function trackAI(event: Omit<AIUsageEvent, "id" | "timestamp">) {
  log.push({ id: counter++, timestamp: new Date().toISOString(), ...event });
  if (log.length > 2000) log = log.slice(-2000);
}

export function getAIAnalytics() {
  const now = Date.now();
  const oneDayAgo   = new Date(now - 86_400_000).toISOString();
  const oneWeekAgo  = new Date(now - 7 * 86_400_000).toISOString();
  const oneMonthAgo = new Date(now - 30 * 86_400_000).toISOString();

  const featureCount: Record<string, number> = {};
  for (const e of log) featureCount[e.feature] = (featureCount[e.feature] || 0) + 1;

  const userCount: Record<string, { name: string; count: number; userId?: number; lastSeen: string }> = {};
  for (const e of log) {
    if (!e.displayName) continue;
    const k = String(e.userId || e.displayName);
    if (!userCount[k]) userCount[k] = { name: e.displayName, count: 0, userId: e.userId, lastSeen: e.timestamp };
    userCount[k].count++;
    if (e.timestamp > userCount[k].lastSeen) userCount[k].lastSeen = e.timestamp;
  }
  const topUsers = Object.values(userCount).sort((a, b) => b.count - a.count).slice(0, 20);

  const dailyCounts: Record<string, number> = {};
  for (const e of log) {
    const day = e.timestamp.slice(0, 10);
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  }

  const categoryCounts: Record<string, number> = {};
  for (const e of log.filter(e => e.feature === "spotAgent" && e.category)) {
    categoryCounts[e.category!] = (categoryCounts[e.category!] || 0) + 1;
  }

  return {
    total: log.length,
    today: log.filter(e => e.timestamp >= oneDayAgo).length,
    thisWeek: log.filter(e => e.timestamp >= oneWeekAgo).length,
    thisMonth: log.filter(e => e.timestamp >= oneMonthAgo).length,
    featureBreakdown: featureCount,
    topUsers,
    dailyCounts,
    categoryCounts,
    recentEvents: [...log].reverse().slice(0, 60),
  };
}
