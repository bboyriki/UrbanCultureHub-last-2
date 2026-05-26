import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { adminAiAssistant } from "../shared/schema";
import { eq, desc } from "drizzle-orm";
import type { Response } from "express";

function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
  });
}

// Default model — overridden per-request based on admin AI Control Panel selection.
const DEFAULT_MODEL = "claude-sonnet-4-6";

async function resolveAdminAssistantModel(): Promise<string> {
  try {
    const { getResolvedRole } = await import("./aiRouter");
    const { provider, model } = await getResolvedRole("admin_assistant");
    return provider === "anthropic" ? model : DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

const IGNORED_PATHS = new Set([
  "node_modules", ".git", ".vscode", "dist", "build", ".next",
  ".cache", "attached_assets", ".github", "__pycache__",
]);

const IGNORED_FILES = new Set([
  ".DS_Store", ".env", ".gitignore", "package-lock.json",
  ".replit", "replit.nix",
]);

function isAllowedPath(filePath: string): boolean {
  const segments = filePath.split(path.sep);
  if (segments.some(s => IGNORED_PATHS.has(s))) return false;
  const fileName = segments[segments.length - 1];
  if (IGNORED_FILES.has(fileName)) return false;
  return true;
}

function scanDirectory(dirPath: string, base = "", maxDepth = 4, depth = 0): any[] {
  if (depth > maxDepth) return [];
  try {
    const items = fs.readdirSync(dirPath);
    const result: any[] = [];
    for (const item of items) {
      const rel = base ? `${base}/${item}` : item;
      if (!isAllowedPath(rel)) continue;
      const full = path.join(dirPath, item);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          result.push({
            name: item, path: rel, type: "directory",
            children: scanDirectory(full, rel, maxDepth, depth + 1),
          });
        } else {
          result.push({ name: item, path: rel, type: "file", ext: path.extname(item).slice(1) });
        }
      } catch {}
    }
    return result.sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

export function getFileTree() {
  return scanDirectory(path.resolve("."));
}

const FILE_CHAR_LIMIT = 12000;

export function readProjectFile(filePath: string): string {
  const normalized = path.normalize(filePath.replace(/^\//, ""));
  if (normalized.includes("..") || !isAllowedPath(normalized)) {
    throw new Error("Access denied to that path");
  }
  const full = path.join(path.resolve("."), normalized);
  if (!fs.existsSync(full)) throw new Error("File not found");
  const stat = fs.statSync(full);
  if (stat.isDirectory()) throw new Error("That is a directory, not a file");
  if (stat.size > 500 * 1024) throw new Error("File too large to read (>500KB)");
  const content = fs.readFileSync(full, "utf-8");
  if (content.length > FILE_CHAR_LIMIT) {
    return content.slice(0, FILE_CHAR_LIMIT) + `\n\n[... file truncated at ${FILE_CHAR_LIMIT} chars — ${content.length} total. Ask to read a specific line range if you need more.]`;
  }
  return content;
}

const SYSTEM_PROMPT = `You are an expert AI assistant for Urban Culture Connect — a full-stack TypeScript web platform for the urban culture community. You have deep knowledge of the entire codebase and can read any project file on demand.

## Platform Overview
- **Stack**: Express.js backend + React/Vite frontend + PostgreSQL (Neon) + Drizzle ORM
- **Auth**: Firebase Admin SDK (email + Google)
- **Real-time**: WebSocket server for chat, notifications, presence
- **Payments**: Stripe Checkout for event tickets
- **Storage**: Cloudinary for images/video
- **Email**: Mailgun for transactional emails
- **Maps**: Leaflet + OpenStreetMap + Nominatim geocoding
- **AI**: Anthropic Claude (you!) for admin assistant + user AI agent

## Key File Paths
- \`server/routes.ts\` — all API routes (~18,000 lines)
- \`server/storage.ts\` — database access layer
- \`shared/schema.ts\` — Drizzle ORM schema (all tables)
- \`server/websocket.ts\` — WebSocket server + notification types
- \`server/index.ts\` — app entry point, middleware, rate limiting
- \`client/src/App.tsx\` — frontend routing
- \`client/src/pages/\` — all pages
- \`client/src/components/\` — all UI components
- \`client/src/contexts/AuthContext.tsx\` — auth state

## Admin Capabilities
You can help the admin:
1. **Read & analyze any project file** — use the read_file tool
2. **Browse the project structure** — use the list_files tool
3. **Debug issues** — read relevant files to understand the problem
4. **Review code quality** — security, performance, best practices
5. **Explain platform features** — how they work end-to-end
6. **Suggest improvements** — based on actual code context

Always read the relevant files before answering technical questions. Be concise, accurate, and actionable.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of any project file. Use this to analyze code, understand implementations, or answer questions about specific files.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Relative file path from project root, e.g. 'server/routes.ts' or 'client/src/App.tsx'",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories at a given path. Use to explore the project structure.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Directory path to list, e.g. 'client/src/pages' or '' for root",
        },
      },
      required: ["path"],
    },
  },
];

function processToolCall(toolName: string, toolInput: any): string {
  try {
    if (toolName === "read_file") {
      const content = readProjectFile(toolInput.path);
      const lines = content.split("\n").length;
      return `File: ${toolInput.path} (${lines} lines)\n\`\`\`\n${content}\n\`\`\``;
    }
    if (toolName === "list_files") {
      const targetPath = toolInput.path || "";
      const normalized = path.normalize(targetPath.replace(/^\//, ""));
      const full = path.join(path.resolve("."), normalized);
      if (!fs.existsSync(full)) return `Path not found: ${targetPath}`;
      const items = scanDirectory(full, normalized, 2);
      const format = (items: any[], indent = ""): string =>
        items.map(i => {
          const line = `${indent}${i.type === "directory" ? "📁" : "📄"} ${i.name}`;
          return i.children?.length ? `${line}\n${format(i.children, indent + "  ")}` : line;
        }).join("\n");
      return `Contents of ${targetPath || "project root"}:\n${format(items)}`;
    }
    return `Unknown tool: ${toolName}`;
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function streamAdminChat(
  adminId: number,
  sessionId: string,
  messages: ChatMessage[],
  res: Response
): Promise<void> {
  const start = Date.now();
  let fullResponse = "";
  const userPrompt = messages[messages.length - 1]?.content || "";

  // Keep only the last 8 messages to limit input token usage
  const recentMessages = messages.slice(-8);
  const anthropicMessages: Anthropic.MessageParam[] = recentMessages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  try {
    let continueLoop = true;
    let currentMessages = [...anthropicMessages];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    while (continueLoop) {
      const adminModel = await resolveAdminAssistantModel();
      const response = await getAnthropicClient().messages.create({
        model: adminModel,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: currentMessages,
        stream: false,
      });

      totalInputTokens += response.usage?.input_tokens ?? 0;
      totalOutputTokens += response.usage?.output_tokens ?? 0;

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];
        const textBlocks = response.content.filter(b => b.type === "text") as Anthropic.TextBlock[];

        if (textBlocks.length > 0) {
          const partialText = textBlocks.map(b => b.text).join("");
          fullResponse += partialText;
          res.write(`data: ${JSON.stringify({ type: "text", text: partialText })}\n\n`);
        }

        currentMessages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(toolUse => {
          const toolNotice = `\n\n*Reading \`${toolUse.input.path || toolUse.input.path || "files"}\`...*\n\n`;
          fullResponse += toolNotice;
          res.write(`data: ${JSON.stringify({ type: "text", text: toolNotice })}\n\n`);

          const result = processToolCall(toolUse.name, toolUse.input);
          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: result,
          };
        });

        currentMessages.push({ role: "user", content: toolResults });
      } else {
        const finalText = response.content
          .filter(b => b.type === "text")
          .map(b => (b as Anthropic.TextBlock).text)
          .join("");

        if (finalText) {
          fullResponse += finalText;
          res.write(`data: ${JSON.stringify({ type: "text", text: finalText })}\n\n`);
        }
        continueLoop = false;
      }
    }

    res.write(`data: ${JSON.stringify({ type: "usage", inputTokens: totalInputTokens, outputTokens: totalOutputTokens })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);

    await db.insert(adminAiAssistant).values({
      adminId,
      sessionId,
      prompt: userPrompt,
      response: fullResponse,
      model: DEFAULT_MODEL,
      processingTime: String(Date.now() - start),
      isComplete: true,
      metadata: {},
    });
  } catch (err: any) {
    console.error("Admin AI chat error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", text: err.message || "AI request failed" })}\n\n`);
  }
}

export async function getAdminChatHistory(adminId: number, limit = 50) {
  return await db
    .select()
    .from(adminAiAssistant)
    .where(eq(adminAiAssistant.adminId, adminId))
    .orderBy(desc(adminAiAssistant.createdAt))
    .limit(limit);
}

export async function deleteAdminChatSession(adminId: number, sessionId: string) {
  await db
    .delete(adminAiAssistant)
    .where(eq(adminAiAssistant.adminId, adminId));
  return true;
}
