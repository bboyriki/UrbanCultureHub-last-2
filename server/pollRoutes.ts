import { type Express, type Request, type Response } from "express";
import { storage } from "./storage";
import { NotificationType } from "./websocket";
import { insertEventPollSchema } from "@shared/schema";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
  }
}

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireAdmin(req: Request, res: Response, next: Function) {
  const role = req.session?.userRole;
  if (!role || !["admin", "super_admin"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

let _broadcastFn: ((type: string, payload: any, targetUserId?: number) => void) | null = null;

export function setPollBroadcast(fn: (type: string, payload: any, targetUserId?: number) => void) {
  _broadcastFn = fn;
}

function broadcast(type: string, payload: any) {
  if (_broadcastFn) _broadcastFn(type, payload, undefined);
}

export function registerPollRoutes(app: Express) {

  // ── GET polls for an event (public) ──────────────────────────────────────
  app.get("/api/events/:eventId/polls", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

      const polls = await storage.getPollsByEvent(eventId);
      const userId = req.session?.userId;

      // For each poll, attach results and user vote
      const enriched = await Promise.all(polls.map(async (poll) => {
        const results = await storage.getPollResults(poll.id);
        const userVote = userId ? await storage.getUserVote(poll.id, userId) : null;

        // If results are hidden until closed and poll is not closed, hide results unless admin/creator
        const isAdmin = ["admin", "super_admin"].includes(req.session?.userRole || "");
        const isCreator = poll.createdBy === userId;
        const showResults = poll.resultsVisibility === "live" ||
          poll.status === "closed" ||
          isAdmin || isCreator;

        return {
          ...poll,
          results: showResults ? results : null,
          userVote: userVote?.option ?? null,
          showResults,
        };
      }));

      res.json(enriched);
    } catch (err) {
      console.error("GET /api/events/:eventId/polls error:", err);
      res.status(500).json({ error: "Failed to fetch polls" });
    }
  });

  // ── GET single poll ───────────────────────────────────────────────────────
  app.get("/api/polls/:pollId", async (req: Request, res: Response) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const poll = await storage.getPollById(pollId);
      if (!poll) return res.status(404).json({ error: "Poll not found" });

      const results = await storage.getPollResults(pollId);
      const userId = req.session?.userId;
      const userVote = userId ? await storage.getUserVote(pollId, userId) : null;
      const isAdmin = ["admin", "super_admin"].includes(req.session?.userRole || "");
      const isCreator = poll.createdBy === userId;
      const showResults = poll.resultsVisibility === "live" ||
        poll.status === "closed" || isAdmin || isCreator;

      res.json({
        ...poll,
        results: showResults ? results : null,
        userVote: userVote?.option ?? null,
        showResults,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch poll" });
    }
  });

  // ── CREATE poll (admin or poll-creator) ───────────────────────────────────
  app.post("/api/events/:eventId/polls", requireAuth, async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

      const userId = req.session!.userId!;
      const role = req.session?.userRole || "";
      const isAdmin = ["admin", "super_admin"].includes(role);

      // Check if user has poll creation permission
      if (!isAdmin) {
        const user = await storage.getUser(userId);
        if (!user?.canCreatePolls) {
          return res.status(403).json({ error: "You don't have permission to create polls" });
        }
      }

      const body = req.body;
      const parsed = insertEventPollSchema.safeParse({
        ...body,
        eventId,
        createdBy: userId,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }

      const poll = await storage.createPoll(parsed.data);
      res.status(201).json(poll);
    } catch (err) {
      console.error("POST /api/events/:eventId/polls error:", err);
      res.status(500).json({ error: "Failed to create poll" });
    }
  });

  // ── UPDATE poll (admin or creator) ───────────────────────────────────────
  app.patch("/api/polls/:pollId", requireAuth, async (req: Request, res: Response) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const poll = await storage.getPollById(pollId);
      if (!poll) return res.status(404).json({ error: "Poll not found" });

      const userId = req.session!.userId!;
      const isAdmin = ["admin", "super_admin"].includes(req.session?.userRole || "");
      if (!isAdmin && poll.createdBy !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const ALLOWED_FIELDS = ["question", "description", "pollType", "options", "status", "resultsVisibility", "voterAccess", "closesAt"] as const;
      type AllowedField = typeof ALLOWED_FIELDS[number];
      const body = (req.body ?? {}) as Record<string, unknown>;
      const updates: Record<AllowedField, unknown> = {} as any;
      for (const field of ALLOWED_FIELDS) {
        const value = Object.prototype.hasOwnProperty.call(body, field) ? body[field] : undefined;
        if (value !== undefined) {
          updates[field] = value;
        }
      }

      const updated = await storage.updatePoll(pollId, updates);

      // Broadcast status change
      if (updates.status) {
        broadcast(NotificationType.POLL_STATUS_CHANGE, { poll: updated });
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to update poll" });
    }
  });

  // ── DELETE poll (admin or creator) ────────────────────────────────────────
  app.delete("/api/polls/:pollId", requireAuth, async (req: Request, res: Response) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const poll = await storage.getPollById(pollId);
      if (!poll) return res.status(404).json({ error: "Poll not found" });

      const userId = req.session!.userId!;
      const isAdmin = ["admin", "super_admin"].includes(req.session?.userRole || "");
      if (!isAdmin && poll.createdBy !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deletePoll(pollId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete poll" });
    }
  });

  // ── CAST VOTE ─────────────────────────────────────────────────────────────
  app.post("/api/polls/:pollId/vote", requireAuth, async (req: Request, res: Response) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const userId = req.session!.userId!;
      const { option } = req.body;

      if (!option || typeof option !== "string") {
        return res.status(400).json({ error: "option is required" });
      }

      const poll = await storage.getPollById(pollId);
      if (!poll) return res.status(404).json({ error: "Poll not found" });
      if (poll.status !== "active") return res.status(400).json({ error: "This poll is not active" });

      // Validate option
      if (poll.pollType === "yes_no") {
        if (!["yes", "no"].includes(option.toLowerCase())) {
          return res.status(400).json({ error: "Invalid option for yes/no poll" });
        }
      } else {
        if (!poll.options.includes(option)) {
          return res.status(400).json({ error: "Invalid option" });
        }
      }

      const result = await storage.castVote(pollId, userId, option);

      // Broadcast live results to all connected clients
      broadcast(NotificationType.POLL_UPDATE, {
        pollId,
        eventId: poll.eventId,
        results: result.results,
        totalVotes: result.poll.totalVotes,
      });

      const showResults = poll.resultsVisibility === "live";

      res.json({
        success: true,
        userVote: option,
        results: showResults ? result.results : null,
        totalVotes: result.poll.totalVotes,
        showResults,
      });
    } catch (err: any) {
      if (err.message === "ALREADY_VOTED") {
        return res.status(409).json({ error: "You have already voted" });
      }
      console.error("POST /api/polls/:pollId/vote error:", err);
      res.status(500).json({ error: "Failed to cast vote" });
    }
  });

  // ── RESET VOTES (admin only) ──────────────────────────────────────────────
  app.post("/api/polls/:pollId/reset", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const poll = await storage.getPollById(pollId);
      if (!poll) return res.status(404).json({ error: "Poll not found" });

      const updated = await storage.resetPollVotes(pollId);
      broadcast(NotificationType.POLL_UPDATE, {
        pollId,
        eventId: poll.eventId,
        results: {},
        totalVotes: 0,
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to reset votes" });
    }
  });

  // ── ADMIN: get all polls ──────────────────────────────────────────────────
  app.get("/api/admin/polls", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const polls = await storage.getAllPollsAdmin();
      res.json(polls);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch polls" });
    }
  });

  // ── ADMIN: analytics for a specific poll ─────────────────────────────────
  app.get("/api/admin/polls/:pollId/analytics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const poll = await storage.getPollById(pollId);
      if (!poll) return res.status(404).json({ error: "Poll not found" });
      const [results, timeline] = await Promise.all([
        storage.getPollResults(pollId),
        storage.getPollVoteTimeline(pollId),
      ]);
      res.json({ poll, results, timeline });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ── ADMIN: voter list for a poll ──────────────────────────────────────────
  app.get("/api/admin/polls/:pollId/voters", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const voters = await storage.getPollVoters(pollId);
      res.json(voters);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch voters" });
    }
  });

  // ── DUPLICATE poll (admin or creator) ────────────────────────────────────
  app.post("/api/polls/:pollId/duplicate", requireAuth, async (req: Request, res: Response) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const userId = req.session!.userId!;
      const poll = await storage.getPollById(pollId);
      if (!poll) return res.status(404).json({ error: "Poll not found" });
      const isAdmin = ["admin", "super_admin"].includes(req.session?.userRole || "");
      if (!isAdmin && poll.createdBy !== userId) return res.status(403).json({ error: "Forbidden" });
      const newPoll = await storage.duplicatePoll(pollId, userId);
      res.status(201).json(newPoll);
    } catch (err) {
      res.status(500).json({ error: "Failed to duplicate poll" });
    }
  });

  // ── BULK ACTION (admin only) ──────────────────────────────────────────────
  app.post("/api/admin/polls/bulk", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { pollIds, action } = req.body;
      if (!Array.isArray(pollIds) || pollIds.length === 0) {
        return res.status(400).json({ error: "pollIds required" });
      }
      if (action === "delete") {
        await storage.bulkDeletePolls(pollIds);
      } else if (["active", "paused", "closed", "draft"].includes(action)) {
        await storage.bulkUpdatePollStatus(pollIds, action);
        for (const pollId of pollIds) {
          const poll = await storage.getPollById(pollId);
          if (poll) broadcast(NotificationType.POLL_STATUS_CHANGE, { poll });
        }
      } else {
        return res.status(400).json({ error: "Invalid action" });
      }
      res.json({ success: true, affected: pollIds.length });
    } catch (err) {
      res.status(500).json({ error: "Failed to perform bulk action" });
    }
  });

  // ── EVENT SEARCH for poll creation ────────────────────────────────────────
  app.get("/api/admin/events/search", requireAdmin, async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string) || "";
      const events = await storage.searchEventsForPoll(q, 20);
      res.json(events);
    } catch (err) {
      res.status(500).json({ error: "Failed to search events" });
    }
  });

  // ── ADMIN: grant/revoke poll creator permission ────────────────────────────
  app.post("/api/admin/users/:userId/grant-poll-creator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      await storage.updateUser(userId, { canCreatePolls: true } as any);
      res.json({ success: true, userId, canCreatePolls: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to grant permission" });
    }
  });

  app.post("/api/admin/users/:userId/revoke-poll-creator", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      await storage.updateUser(userId, { canCreatePolls: false } as any);
      res.json({ success: true, userId, canCreatePolls: false });
    } catch (err) {
      res.status(500).json({ error: "Failed to revoke permission" });
    }
  });
}
