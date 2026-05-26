import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { verifyFirebaseToken } from "./firebase";

const router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

async function isAdmin(req: Request, res: Response): Promise<boolean> {
  if ((req as any).user?.role === "admin" || (req as any).user?.role === "super_admin" || (req as any).user?.role === "moderator") return true;
  const sessionRole = (req.session as any)?.userRole;
  if (sessionRole === "admin" || sessionRole === "super_admin" || sessionRole === "moderator") return true;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const decoded = await verifyFirebaseToken(auth.slice(7));
      if (decoded?.role === "admin" || decoded?.role === "super_admin" || decoded?.role === "moderator") return true;
    } catch {}
  }
  res.status(403).json({ error: "Admin access required" });
  return false;
}

async function getEventsContext() {
  const allEvents = await storage.getAllEvents();
  const pending = allEvents.filter(e => e.status === "pending" || e.status === null);
  const approved = allEvents.filter(e => e.status === "approved");
  const rejected = allEvents.filter(e => e.status === "rejected");

  const upcoming = approved
    .filter(e => e.date && new Date(e.date) > new Date())
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    .slice(0, 10);

  const recent = approved
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .slice(0, 5);

  return { allEvents, pending, approved, rejected, upcoming, recent };
}

function buildEventsHealth(ctx: Awaited<ReturnType<typeof getEventsContext>>) {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (ctx.pending.length > 0) {
    issues.push(`${ctx.pending.length} event${ctx.pending.length !== 1 ? "s" : ""} pending review`);
    score -= Math.min(30, ctx.pending.length * 5);
  }
  if (ctx.approved.length === 0) {
    issues.push("No approved events on the platform");
    score -= 20;
    suggestions.push("Approve events to make them visible to users");
  }
  const noImage = ctx.pending.filter(e => !e.image);
  if (noImage.length > 0) {
    suggestions.push(`${noImage.length} pending event${noImage.length !== 1 ? "s" : ""} without images`);
    score -= 5;
  }
  const noLocation = ctx.pending.filter(e => !e.location);
  if (noLocation.length > 0) {
    suggestions.push(`${noLocation.length} pending event${noLocation.length !== 1 ? "s" : ""} without location info`);
    score -= 5;
  }
  const noFeatured = ctx.approved.filter(e => e.isFeatured).length === 0 && ctx.approved.length > 0;
  if (noFeatured) {
    suggestions.push("No featured events set — feature your best events to boost visibility");
    score -= 5;
  }
  const past = ctx.approved.filter(e => e.date && new Date(e.date) < new Date());
  if (past.length > 5) {
    suggestions.push(`${past.length} past events still approved — consider archiving old events`);
  }

  return { score: Math.max(0, score), issues, suggestions };
}

const EVENTS_TOOLS: Anthropic.Tool[] = [
  {
    name: "approve_event",
    description: "Approve a pending event so it becomes visible to the public on the platform.",
    input_schema: {
      type: "object" as const,
      properties: {
        eventId: { type: "number", description: "The event ID to approve" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "reject_event",
    description: "Reject a pending event — it will not be shown to the public.",
    input_schema: {
      type: "object" as const,
      properties: {
        eventId: { type: "number", description: "The event ID to reject" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "bulk_approve_pending",
    description: "Approve ALL currently pending events in one action. Use when the admin wants to quickly clear the queue.",
    input_schema: {
      type: "object" as const,
      properties: {
        confirm: { type: "boolean", description: "Must be true to proceed" },
      },
      required: ["confirm"],
    },
  },
  {
    name: "feature_event",
    description: "Toggle featured status of an event. Featured events appear prominently on the platform homepage.",
    input_schema: {
      type: "object" as const,
      properties: {
        eventId: { type: "number", description: "The event ID to feature or unfeature" },
        featured: { type: "boolean", description: "True to feature, false to unfeature" },
      },
      required: ["eventId", "featured"],
    },
  },
  {
    name: "trend_event",
    description: "Toggle trending status of an event. Trending events appear in the trending section.",
    input_schema: {
      type: "object" as const,
      properties: {
        eventId: { type: "number", description: "The event ID to mark as trending or not" },
        trending: { type: "boolean", description: "True to mark trending, false to remove" },
      },
      required: ["eventId", "trending"],
    },
  },
  {
    name: "update_event",
    description: "Update event details like title, description, category, or other metadata.",
    input_schema: {
      type: "object" as const,
      properties: {
        eventId: { type: "number", description: "The event ID to update" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        category: { type: "string", description: "Event category e.g. 'Breaking', 'Music', 'Urban Culture'" },
        city: { type: "string", description: "City where the event takes place" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for discoverability" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "analyze_pending_events",
    description: "Analyze all pending events and provide quality scores and recommendations for each. Use this to help the admin decide what to approve, reject, or improve.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "summarize_platform",
    description: "Generate a summary of the events platform — total counts, upcoming events, categories breakdown, health insights.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

async function executeEventTool(toolName: string, toolInput: any): Promise<string> {
  try {
    const ctx = await getEventsContext();

    if (toolName === "approve_event") {
      const { eventId } = toolInput;
      const event = ctx.allEvents.find(e => e.id === eventId);
      if (!event) return `Event ${eventId} not found`;
      await storage.approveEvent(eventId, 0);
      return `✓ Approved event #${eventId}: "${event.title}"`;
    }

    if (toolName === "reject_event") {
      const { eventId } = toolInput;
      const event = ctx.allEvents.find(e => e.id === eventId);
      if (!event) return `Event ${eventId} not found`;
      await storage.rejectEvent(eventId, 0);
      return `✓ Rejected event #${eventId}: "${event.title}"`;
    }

    if (toolName === "bulk_approve_pending") {
      if (!toolInput.confirm) return "Confirmation required — set confirm: true to proceed";
      const pending = ctx.pending;
      if (pending.length === 0) return "No pending events to approve";
      const results = await Promise.all(pending.map(e => storage.approveEvent(e.id!, 0)));
      const approved = results.filter(Boolean);
      return `✓ Approved ${approved.length} pending events: ${pending.map(e => `"${e.title}"`).join(", ")}`;
    }

    if (toolName === "feature_event") {
      const { eventId, featured } = toolInput;
      const event = ctx.allEvents.find(e => e.id === eventId);
      if (!event) return `Event ${eventId} not found`;
      await storage.updateEvent(eventId, { isFeatured: featured });
      return `✓ Event #${eventId} "${event.title}" is now ${featured ? "featured ⭐" : "unfeatured"}`;
    }

    if (toolName === "trend_event") {
      const { eventId, trending } = toolInput;
      const event = ctx.allEvents.find(e => e.id === eventId);
      if (!event) return `Event ${eventId} not found`;
      await storage.updateEvent(eventId, { isTrending: trending });
      return `✓ Event #${eventId} "${event.title}" is now ${trending ? "trending 🔥" : "removed from trending"}`;
    }

    if (toolName === "update_event") {
      const { eventId, ...updates } = toolInput;
      const event = ctx.allEvents.find(e => e.id === eventId);
      if (!event) return `Event ${eventId} not found`;
      const validUpdates: any = {};
      if (updates.title !== undefined) validUpdates.title = updates.title;
      if (updates.description !== undefined) validUpdates.description = updates.description;
      if (updates.category !== undefined) validUpdates.category = updates.category;
      if (updates.city !== undefined) validUpdates.city = updates.city;
      if (updates.tags !== undefined) validUpdates.tags = updates.tags;
      await storage.updateEvent(eventId, validUpdates);
      return `✓ Updated event #${eventId} "${event.title}": ${Object.keys(validUpdates).join(", ")} updated`;
    }

    if (toolName === "analyze_pending_events") {
      if (ctx.pending.length === 0) return "No pending events to analyze — the queue is clear!";
      const analyses = ctx.pending.map(e => {
        const issues: string[] = [];
        let score = 100;
        if (!e.image) { issues.push("no image"); score -= 20; }
        if (!e.description || e.description.length < 50) { issues.push("description too short"); score -= 15; }
        if (!e.location) { issues.push("no location"); score -= 20; }
        if (!e.date) { issues.push("no date"); score -= 25; }
        if (!e.category) { issues.push("no category"); score -= 10; }
        return {
          id: e.id,
          title: e.title,
          score: Math.max(0, score),
          issues: issues.join(", ") || "looks good",
          recommendation: score >= 80 ? "✓ approve" : score >= 50 ? "⚠ review" : "✗ reject or request more info",
        };
      });
      return JSON.stringify(analyses, null, 2);
    }

    if (toolName === "summarize_platform") {
      const categories: Record<string, number> = {};
      ctx.approved.forEach(e => {
        const cat = e.category || "Uncategorized";
        categories[cat] = (categories[cat] || 0) + 1;
      });
      const upcoming = ctx.upcoming.slice(0, 5).map(e => `"${e.title}" on ${e.date ? new Date(e.date).toLocaleDateString() : "TBD"}`);
      return JSON.stringify({
        total: ctx.allEvents.length,
        pending: ctx.pending.length,
        approved: ctx.approved.length,
        rejected: ctx.rejected.length,
        upcomingEvents: upcoming,
        categoriesBreakdown: categories,
        featuredCount: ctx.approved.filter(e => e.isFeatured).length,
        trendingCount: ctx.approved.filter(e => e.isTrending).length,
      }, null, 2);
    }

    return `Unknown tool: ${toolName}`;
  } catch (e: any) {
    return `Error executing ${toolName}: ${e.message}`;
  }
}

router.get("/health", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const ctx = await getEventsContext();
    res.json({ ...buildEventsHealth(ctx), counts: { pending: ctx.pending.length, approved: ctx.approved.length, rejected: ctx.rejected.length, total: ctx.allEvents.length } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/chat", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message required" });

    const ctx = await getEventsContext();
    const health = buildEventsHealth(ctx);

    const systemPrompt = `You are the AI Events Assistant for Urban Culture Hub — a Dutch urban culture platform. You manage all public-facing events submitted by organizers across the Netherlands.

## Platform Overview
Urban Culture Hub is a discovery platform for urban culture events: breaking/b-boy competitions, hip-hop concerts, street art exhibitions, skateboarding events, graffiti jams, rap battles, dance workshops, block parties, and more.

## Dutch Urban Culture Context
You know the Dutch urban culture scene well:
- Strong breaking/b-boy scene in Amsterdam, Rotterdam, Utrecht, Den Haag
- Major Dutch breaking events: Red Bull BC One qualifiers, local jams, ISBI competitions
- Popular venues: Melkweg (Amsterdam), Paradiso (Amsterdam), WORM (Rotterdam), Doornroosje (Nijmegen)
- Community organizations: Breaking scene crews, hip-hop collectives, graffiti artists
- Youth culture organizations across Dutch cities

## Current Events State
**Overview:**
- Total events: ${ctx.allEvents.length}
- Pending review: ${ctx.pending.length}
- Approved (live): ${ctx.approved.length}
- Rejected: ${ctx.rejected.length}

**Pending Events (need review — ${ctx.pending.length}):**
${ctx.pending.length === 0 ? "Queue is clear!" : JSON.stringify(ctx.pending.slice(0, 20).map(e => ({
  id: e.id,
  title: e.title,
  category: e.category,
  location: e.location,
  date: e.date,
  hasImage: !!e.image,
  hasDescription: !!(e.description && e.description.length > 50),
  organizerId: e.organizerId,
})), null, 2)}

**Upcoming Approved Events (${ctx.upcoming.length}):**
${ctx.upcoming.length === 0 ? "None scheduled" : JSON.stringify(ctx.upcoming.slice(0, 8).map(e => ({
  id: e.id,
  title: e.title,
  date: e.date,
  location: e.location,
  isFeatured: e.isFeatured,
  isTrending: e.isTrending,
  category: e.category,
})), null, 2)}

**Featured Events:** ${ctx.approved.filter(e => e.isFeatured).length}
**Trending Events:** ${ctx.approved.filter(e => e.isTrending).length}

## Platform Health: ${health.score}/100
${health.issues.length > 0 ? `Issues: ${health.issues.join("; ")}` : "No critical issues."}
${health.suggestions.length > 0 ? `Suggestions: ${health.suggestions.join("; ")}` : ""}

## What you can do
- **approve_event** — approve a specific pending event (makes it public)
- **reject_event** — reject a specific pending event
- **bulk_approve_pending** — approve all pending events at once
- **feature_event** — toggle featured status (appears on homepage)
- **trend_event** — toggle trending status
- **update_event** — update event title, description, category, tags, city
- **analyze_pending_events** — analyze all pending events with quality scores and recommendations
- **summarize_platform** — generate a complete platform health summary

## Behaviour Rules
1. **Always use tools to act.** If asked to approve or change something, call the tool.
2. **Be decisive.** When asked to review pending events, use analyze_pending_events and give clear recommendations.
3. **Know the scene.** If an event is clearly Dutch urban culture (breaking, hip-hop, graffiti, street dance), note that it fits the platform well.
4. **Be proactive.** After completing an action, mention if there are other things that need attention.
5. **Use event IDs.** Always refer to events by their ID and title when taking actions.`;

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h: any) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: message },
    ];

    const { getResolvedRole } = await import("./aiRouter");
    const resolved = await getResolvedRole("events");
    const eventsModel = resolved.provider === "anthropic" ? resolved.model : "claude-sonnet-4-6";

    let response = await anthropic.messages.create({
      model: eventsModel,
      max_tokens: 2048,
      system: systemPrompt,
      tools: EVENTS_TOOLS,
      messages,
    });

    const actions: { tool: string; result: string }[] = [];

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        const result = await executeEventTool(block.name, block.input);
        actions.push({ tool: block.name, result });
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: eventsModel,
        max_tokens: 2048,
        system: systemPrompt,
        tools: EVENTS_TOOLS,
        messages,
      });
    }

    const textContent = response.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
    const reply = textContent?.text || "Done.";

    res.json({ reply, actions });
  } catch (e: any) {
    console.error("Events AI chat error:", e);
    res.status(500).json({ error: e.message });
  }
});

export function registerEventAiRoutes(app: any) {
  app.use("/api/admin/events/ai", router);
}
