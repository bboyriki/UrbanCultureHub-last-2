import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "../db";
import { sql } from "drizzle-orm";

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = path.resolve(process.cwd());

const ALLOWED_BINS = ["ls", "cat", "find", "grep", "echo", "pwd", "wc", "head", "tail", "git", "npm", "npx", "node", "tsx"] as const;

function safePath(filePath: string): string {
  const resolved = path.resolve(PROJECT_ROOT, filePath.replace(/^\//, ""));
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error(`Access denied: path outside project root`);
  }
  return resolved;
}

function sanitizePattern(pattern: string): string {
  return pattern.replace(/[`$(){}|;&<>]/g, "").slice(0, 200);
}

function parseCommand(command: string): { bin: string; args: string[] } | null {
  const trimmed = command.trim();
  const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  if (parts.length === 0) return null;
  const bin = parts[0].toLowerCase();
  const safeBin = ALLOWED_BINS.find(b => bin === b || bin === `./${b}` || bin === `/usr/bin/${b}`);
  if (!safeBin) return null;
  if (trimmed.match(/[;|&`$(){}](?![^[]*])/)) {
    return null;
  }
  return { bin: safeBin, args: parts.slice(1).map(a => a.replace(/^['"]|['"]$/g, "")) };
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export async function tool_read_file(filePath: string): Promise<ToolResult> {
  try {
    const abs = safePath(filePath);
    if (!fs.existsSync(abs)) {
      return { success: false, output: "", error: `File not found: ${filePath}` };
    }
    const stat = fs.statSync(abs);
    if (stat.size > 500_000) {
      return { success: false, output: "", error: `File too large (${Math.round(stat.size / 1024)}KB). Use search_in_files to find specific content.` };
    }
    const content = fs.readFileSync(abs, "utf-8");
    return { success: true, output: content };
  } catch (e: any) {
    return { success: false, output: "", error: e.message };
  }
}

export async function tool_write_file(filePath: string, content: string): Promise<ToolResult> {
  try {
    const abs = safePath(filePath);
    const dir = path.dirname(abs);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
    return { success: true, output: `Written ${content.length} chars to ${filePath}` };
  } catch (e: any) {
    return { success: false, output: "", error: e.message };
  }
}

export async function tool_list_directory(dirPath: string = "."): Promise<ToolResult> {
  try {
    const abs = safePath(dirPath);
    if (!fs.existsSync(abs)) {
      return { success: false, output: "", error: `Directory not found: ${dirPath}` };
    }
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    const lines = entries
      .filter((e) => !e.name.startsWith(".") || e.name === ".env")
      .filter((e) => !["node_modules", ".git", "dist", ".cache"].includes(e.name))
      .map((e) => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
      .join("\n");
    return { success: true, output: lines || "(empty directory)" };
  } catch (e: any) {
    return { success: false, output: "", error: e.message };
  }
}

export async function tool_run_command(command: string): Promise<ToolResult> {
  const parsed = parseCommand(command);
  if (!parsed) {
    return {
      success: false,
      output: "",
      error: `Command not allowed. Only safe read-only commands supported: ${ALLOWED_BINS.join(", ")}. Shell operators (;|&) not permitted.`,
    };
  }
  try {
    const { stdout, stderr } = await execFileAsync(parsed.bin, parsed.args, {
      cwd: PROJECT_ROOT,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    return { success: true, output: (stdout + (stderr ? `\nSTDERR: ${stderr}` : "")).trim() };
  } catch (e: any) {
    return { success: false, output: e.stdout || "", error: e.stderr || e.message };
  }
}

export async function tool_search_in_files(
  pattern: string,
  directory: string = ".",
  fileGlob: string = "*.{ts,tsx,js,jsx,json,css,md}"
): Promise<ToolResult> {
  try {
    const abs = safePath(directory);
    const safePattern = sanitizePattern(pattern);
    const safeGlob = fileGlob.replace(/[;|&`$(){}]/g, "").slice(0, 100);
    const { stdout } = await execFileAsync("grep", ["-rn", `--include=${safeGlob}`, "-l", safePattern, abs, "--", "--"], {
      cwd: PROJECT_ROOT,
      timeout: 15_000,
    }).catch(async () => {
      const { stdout: s } = await execFileAsync("grep", ["-rn", "-l", safePattern, abs], {
        cwd: PROJECT_ROOT,
        timeout: 15_000,
      });
      return { stdout: s };
    });
    if (!stdout.trim()) return { success: true, output: "No matches found." };
    const files = stdout.trim().split("\n").slice(0, 20).map((f) => f.replace(PROJECT_ROOT + "/", ""));
    return { success: true, output: `Found in ${files.length} file(s):\n${files.join("\n")}` };
  } catch (e: any) {
    return { success: false, output: "", error: e.message };
  }
}

export async function tool_grep_file_content(
  pattern: string,
  filePath: string,
  contextLines: number = 3
): Promise<ToolResult> {
  try {
    const abs = safePath(filePath);
    const safePattern = sanitizePattern(pattern);
    const safeCtx = Math.min(Math.max(0, Math.floor(contextLines)), 10).toString();
    const { stdout } = await execFileAsync("grep", ["-n", `-C${safeCtx}`, safePattern, abs], {
      cwd: PROJECT_ROOT,
      timeout: 10_000,
    });
    if (!stdout.trim()) return { success: true, output: "Pattern not found in file." };
    return { success: true, output: stdout.trim() };
  } catch (e: any) {
    return { success: false, output: "", error: e.message };
  }
}

export async function tool_execute_sql(query: string): Promise<ToolResult> {
  const lower = query.trim().toLowerCase();
  const isReadOnly = lower.startsWith("select") || lower.startsWith("with") || lower.startsWith("explain");
  if (!isReadOnly) {
    return { success: false, output: "", error: "Only SELECT queries are allowed for safety." };
  }
  try {
    const result = await db.execute(sql.raw(query));
    const rows = result.rows || [];
    if (rows.length === 0) return { success: true, output: "Query returned 0 rows." };
    const preview = rows.slice(0, 20);
    return { success: true, output: `${rows.length} row(s):\n${JSON.stringify(preview, null, 2)}` };
  } catch (e: any) {
    return { success: false, output: "", error: e.message };
  }
}

export async function tool_get_project_tree(): Promise<ToolResult> {
  try {
    const { stdout } = await execFileAsync("find", [
      ".", "-type", "f",
      "(", "-name", "*.ts", "-o", "-name", "*.tsx", "-o", "-name", "*.json", "-o", "-name", "*.css", ")",
      "!", "-path", "*/node_modules/*", "!", "-path", "*/.git/*", "!", "-path", "*/dist/*", "!", "-path", "*/.cache/*",
    ], { cwd: PROJECT_ROOT, timeout: 15_000 });
    return { success: true, output: stdout.trim() };
  } catch (e: any) {
    return { success: false, output: "", error: e.message };
  }
}

export async function tool_check_typescript(): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execFileAsync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
      cwd: PROJECT_ROOT,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    }).catch((e: any) => ({ stdout: e.stdout || "", stderr: e.stderr || e.message }));

    const combined = (stdout + "\n" + stderr).trim();
    if (!combined || combined === "") {
      return { success: true, output: "✅ No TypeScript errors found." };
    }

    const lines = combined.split("\n").filter(Boolean);
    const errorLines = lines.filter(l => l.includes("error TS") || l.includes("warning TS"));
    const errorCount = errorLines.length;

    if (errorCount === 0) {
      return { success: true, output: "✅ No TypeScript errors found.\n\n" + combined.slice(0, 3000) };
    }

    const summary = `❌ Found ${errorCount} TypeScript error(s):\n\n` + errorLines.slice(0, 50).join("\n");
    return { success: false, output: summary, error: `${errorCount} TypeScript error(s) detected` };
  } catch (e: any) {
    return { success: false, output: "", error: `TypeScript check failed: ${e.message}` };
  }
}

export async function tool_check_app_health(): Promise<ToolResult> {
  const results: string[] = [];

  try {
    const { stdout: depCheck } = await execFileAsync("npm", ["ls", "--depth=0", "--json"], {
      cwd: PROJECT_ROOT,
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
    }).catch((e: any) => ({ stdout: e.stdout || "{}" }));
    try {
      const parsed = JSON.parse(depCheck);
      if (parsed.problems && parsed.problems.length > 0) {
        results.push(`⚠️ Dependency issues (${parsed.problems.length}):\n` + parsed.problems.slice(0, 10).join("\n"));
      } else {
        results.push("✅ All npm dependencies installed correctly");
      }
    } catch {
      results.push("⚠️ Could not parse dependency check output");
    }
  } catch (e: any) {
    results.push(`⚠️ Could not check dependencies: ${e.message}`);
  }

  try {
    const commonPatterns = [
      { pattern: "TODO|FIXME|HACK|XXX", label: "TODOs/FIXMEs" },
      { pattern: "console\\.error|console\\.warn", label: "console.error/warn calls" },
      { pattern: "any\\b", label: "TypeScript 'any' usage" },
    ];
    for (const { pattern, label } of commonPatterns) {
      try {
        const { stdout } = await execFileAsync("grep", ["-rn", "--include=*.ts", "--include=*.tsx",
          "-c", pattern, "client/src", "server"], {
          cwd: PROJECT_ROOT, timeout: 8_000,
        }).catch((e: any) => ({ stdout: e.stdout || "" }));
        const total = stdout.split("\n")
          .filter(Boolean)
          .filter(l => !l.endsWith(":0"))
          .reduce((sum, l) => {
            const m = l.match(/:(\d+)$/);
            return sum + (m ? parseInt(m[1]) : 0);
          }, 0);
        if (total > 0) {
          results.push(`ℹ️ ${label}: ${total} occurrence(s)`);
        }
      } catch {}
    }
  } catch {}

  try {
    const schemaPath = path.join(PROJECT_ROOT, "shared/schema.ts");
    if (fs.existsSync(schemaPath)) {
      const schemaSize = fs.statSync(schemaPath).size;
      results.push(`✅ Schema file exists (${Math.round(schemaSize / 1024)}KB)`);
    } else {
      results.push("❌ shared/schema.ts not found");
    }

    const envPath = path.join(PROJECT_ROOT, ".env");
    const envExists = fs.existsSync(envPath);
    results.push(envExists ? "✅ .env file present" : "⚠️ No .env file found");
  } catch {}

  try {
    const dbResult = await db.execute(sql.raw("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'public'"));
    const tableCount = (dbResult.rows[0] as any)?.cnt ?? 0;
    results.push(`✅ Database reachable — ${tableCount} table(s) in public schema`);
  } catch (e: any) {
    results.push(`❌ Database unreachable: ${e.message}`);
  }

  return {
    success: true,
    output: `## App Health Report\n\n${results.join("\n\n")}`,
  };
}

export const TOOL_DEFINITIONS = [
  {
    name: "read_file",
    description: "Read the content of any file in the project. Use this to understand existing code before making changes.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path to the file relative to project root (e.g. 'server/routes.ts' or 'client/src/App.tsx')" },
      },
      required: ["file_path"],
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file with new content. Use this to implement code changes. Always read the file first before overwriting.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path to the file relative to project root" },
        content: { type: "string", description: "The complete new content of the file" },
      },
      required: ["file_path", "content"],
    },
  },
  {
    name: "list_directory",
    description: "List files and subdirectories in a directory.",
    input_schema: {
      type: "object",
      properties: {
        dir_path: { type: "string", description: "Directory path relative to project root (default: '.')" },
      },
      required: [],
    },
  },
  {
    name: "run_command",
    description: "Run a safe read-only shell command. Allowed binaries: ls, cat, find, grep, echo, head, tail, git, npm, npx. Shell operators not permitted.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run" },
      },
      required: ["command"],
    },
  },
  {
    name: "search_in_files",
    description: "Search for a text pattern across multiple files. Returns list of files containing the pattern.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Text or regex pattern to search for" },
        directory: { type: "string", description: "Directory to search in (default: '.')" },
        file_glob: { type: "string", description: "File glob pattern (default: '*.{ts,tsx,js,jsx,json,css,md}')" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "grep_file_content",
    description: "Search for a pattern within a specific file and return matching lines with context.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Text or regex pattern to search for" },
        file_path: { type: "string", description: "File path relative to project root" },
        context_lines: { type: "number", description: "Number of context lines around each match (default: 3)" },
      },
      required: ["pattern", "file_path"],
    },
  },
  {
    name: "execute_sql",
    description: "Run a read-only SQL SELECT query against the database. Useful for checking data.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL SELECT query to execute" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_project_tree",
    description: "Get a tree of all TypeScript, TSX, JSON, and CSS files in the project. Use this to understand the project structure.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "check_typescript",
    description: "Run the TypeScript compiler in check mode (noEmit) to discover all type errors across the entire codebase. Returns a list of errors with file paths and line numbers. Use this first when asked to find or fix errors.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "check_app_health",
    description: "Run a comprehensive health check of the application: npm dependency integrity, database connectivity, schema presence, .env file, and common code quality indicators (TODOs, console.error, any-types). Use this for a quick overview of project health.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
] as const;

export async function executeTool(
  name: string,
  input: Record<string, any>
): Promise<ToolResult> {
  switch (name) {
    case "read_file":
      return tool_read_file(input.file_path);
    case "write_file":
      return tool_write_file(input.file_path, input.content);
    case "list_directory":
      return tool_list_directory(input.dir_path);
    case "run_command":
      return tool_run_command(input.command);
    case "search_in_files":
      return tool_search_in_files(input.pattern, input.directory, input.file_glob);
    case "grep_file_content":
      return tool_grep_file_content(input.pattern, input.file_path, input.context_lines);
    case "execute_sql":
      return tool_execute_sql(input.query);
    case "get_project_tree":
      return tool_get_project_tree();
    case "check_typescript":
      return tool_check_typescript();
    case "check_app_health":
      return tool_check_app_health();
    default:
      return { success: false, output: "", error: `Unknown tool: ${name}` };
  }
}
