import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { chatStorage } from "./storage";

function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
  });
}

const SYSTEM_PROMPT = `You are an AI assistant for Urban Culture Hub — a community platform based in Amsterdam that connects people around the full spectrum of urban culture and lifestyle. You help users with:

WHAT URBAN CULTURE HUB COVERS:
- Street art, graffiti, murals (including STRAAT Museum, Amsterdam's world-class street art museum)
- Dance: breakdancing (bboys/bgirls), hip-hop, house, popping, locking, waacking
- Music: DJs, producers, rap, beatbox, open mics, live performances
- Urban sports (outdoor): Padel, basketball streetball, table tennis, skateboarding, BMX, parkour, freerunning, calisthenics, street football
- Urban sports (indoor): bouldering/climbing, fitness, martial arts, boxing
- Cultural venues: museums, galleries, cultural hubs, workshops
- Lifestyle: nightlife, DJ nights, club culture, late-night events
- Social spots: cafés (specialty coffee, community hangouts), restaurants with cultural vibe, rooftop bars
- Community: connecting artists, athletes, creators, lifestyle enthusiasts, venue owners, and visitors
- Events: battles (dance, rap, DJ), jams, cultural festivals, sports competitions, community meetups

HOW YOU HELP USERS:
- Discover spots, events, venues, and community members near them
- Understand platform features: spot discovery, events calendar, marketplace, services, profiles, AI insights
- Write authentic bios, spot descriptions, event listings, and social content
- Recommend spots based on what they're into (dancing, sports, nightlife, art, food, etc.)
- Navigate the app and get the most out of the community features
- General questions about urban culture, street culture, and Amsterdam lifestyle

TONE: Be genuine, direct, and community-focused. Use a voice that fits the culture — knowledgeable but not corporate. No marketing fluff. Helpful like a local friend who knows the scene.`;


export function registerAiChatRoutes(app: Express, requireAuth: any): void {
  app.get("/api/ai/conversations", requireAuth, async (req: any, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversationsByUser(req.user.id);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching AI conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/ai/conversations", requireAuth, async (req: any, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(req.user.id, title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating AI conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/ai/conversations/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation || conversation.userId !== req.user.id) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching AI conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.delete("/api/ai/conversations/:id", requireAuth, async (req: any, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation || conversation.userId !== req.user.id) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting AI conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  app.post("/api/ai/conversations/:id/messages", requireAuth, async (req: any, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content?.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const conversation = await chatStorage.getConversation(conversationId);
      if (!conversation || conversation.userId !== req.user.id) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      await chatStorage.createMessage(conversationId, "user", content);

      const history = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      if (history.length === 1) {
        const shortTitle = content.slice(0, 50) + (content.length > 50 ? "…" : "");
        await chatStorage.updateConversationTitle(conversationId, shortTitle);
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const stream = getAnthropicClient().messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: chatMessages,
      });

      let fullResponse = "";

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const chunk = event.delta.text;
          if (chunk) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          }
        }
      }

      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in AI chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "AI service error" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to get AI response" });
      }
    }
  });
}
