import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, executeTool } from "./tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENT_SYSTEM = `You are an advanced AI coding agent for Urban Culture Connect — a full-stack TypeScript social platform for urban arts and culture.

You have FULL ACCESS to the codebase via tools. You can read, write, and edit any file, run commands, search code, and query the database.

## Project Structure
- Frontend: React 18 + TypeScript + Vite in \`client/src/\`
- Backend: Express.js + TypeScript in \`server/\`
- Shared: Drizzle ORM schema in \`shared/schema.ts\` (40+ tables)
- DB: PostgreSQL via Neon
- Auth: Firebase Admin SDK
- UI: shadcn/ui + Tailwind CSS + Radix UI

## Available Tools
- **read_file** / **write_file**: Read and write any project file
- **list_directory** / **get_project_tree**: Explore file structure
- **run_command**: Safe shell commands (ls, find, grep, git, npm, npx, etc.)
- **search_in_files** / **grep_file_content**: Code search
- **execute_sql**: Read-only SELECT queries against the live database
- **check_typescript**: Run TypeScript compiler to find ALL type errors in the project
- **check_app_health**: Full health report — deps, DB, schema, env, code quality

## Error Discovery Workflow
When asked to find or fix errors:
1. Run **check_typescript** first — it scans the entire codebase for type errors
2. Run **check_app_health** for a broader health overview
3. Use **search_in_files** to find runtime error patterns (e.g. "throw new Error", "console.error")
4. Read specific files to understand context before fixing

## How You Work
1. Always READ the relevant files BEFORE making any changes
2. Make precise, targeted edits — don't rewrite entire files unless needed
3. After writing files, summarize what you changed and why
4. If a task requires multiple steps, complete them all before finishing
5. If you're unsure about something, read more files to understand the context

## Design System Rules (CRITICAL)
- NO dark mode classes (\`dark:\`) anywhere
- NO gradients, NO neon glow
- Primary blue: \`hsl(221, 83%, 53%)\`
- Border radius: \`0.5rem\`
- Use shadcn/ui components and Tailwind utility classes

## Code Quality Rules
- TypeScript strict mode — no \`any\` unless unavoidable
- Use Drizzle ORM for all DB operations — never raw SQL in routes
- TanStack Query for all client-side data fetching
- apiRequest() from \`@/lib/queryClient\` for mutations
- Always add \`data-testid\` attributes to interactive elements

Be thorough, accurate, and complete. If a file needs to be changed, change it. Don't just explain how — do it.`;

const SUPPORTED_MODELS: Record<string, string> = {
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
};

export function registerAgentRoutes(app: Express, requireAdmin: any): void {
  app.post("/api/agent/run", requireAdmin, async (req: any, res: Response) => {
    const { message, history = [], model: modelKey = "opus" } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ message: "Message required" });
    }

    const model = SUPPORTED_MODELS[modelKey] ?? SUPPORTED_MODELS.opus;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (type: string, data: Record<string, any>) => {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: message },
    ];

    let iterationCount = 0;
    const MAX_ITERATIONS = 20;
    const startTime = Date.now();

    try {
      while (iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        sendEvent("thinking", { iteration: iterationCount });

        const response = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          system: AGENT_SYSTEM,
          tools: TOOL_DEFINITIONS as any,
          messages,
        });

        const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
        const textBlocks = response.content.filter((b) => b.type === "text");

        for (const block of textBlocks) {
          if (block.type === "text" && block.text) {
            sendEvent("text", { content: block.text });
          }
        }

        if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
          messages.push({ role: "assistant", content: response.content });
          break;
        }

        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          if (block.type !== "tool_use") continue;

          sendEvent("tool_call", {
            tool: block.name,
            input: block.input,
            id: block.id,
          });

          const result = await executeTool(block.name, block.input as Record<string, any>);

          sendEvent("tool_result", {
            tool: block.name,
            id: block.id,
            success: result.success,
            output: result.output.slice(0, 8000),
            error: result.error,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result.success
              ? result.output.slice(0, 8000)
              : `Error: ${result.error}`,
          });
        }

        messages.push({ role: "user", content: toolResults });
      }

      if (iterationCount >= MAX_ITERATIONS) {
        sendEvent("text", { content: "\n\n⚠️ Max iterations reached. Task may be incomplete." });
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      sendEvent("done", { iterations: iterationCount, elapsed });
    } catch (err: any) {
      console.error("Agent error:", err);
      sendEvent("error", { message: err.message || "Agent failed" });
    } finally {
      res.end();
    }
  });
}
