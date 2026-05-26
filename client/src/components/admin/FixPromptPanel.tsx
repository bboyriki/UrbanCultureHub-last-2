import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, ChevronDown, ChevronRight, Terminal } from "lucide-react";

export interface FixIssue {
  severity: "critical" | "high" | "error" | "moderate" | "warning" | "low" | "info";
  title: string;
  detail: string;
  category?: string;
  recommendation?: string;
}

interface FixPromptPanelProps {
  section: string;
  issues: FixIssue[];
  extra?: string;
}

function detectEnv(): string {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (host.endsWith(".replit.app")) return "Production (deployed on Replit)";
  return "Development (Replit dev / local)";
}

const STACK =
  "Express.js backend · React 18 frontend · Drizzle ORM · PostgreSQL (Neon) · shadcn/ui · Tailwind CSS · Firebase Auth · TypeScript · Vite";

const SEV_ORDER: Record<string, number> = {
  critical: 0, high: 1, error: 2, moderate: 3, warning: 4, low: 5, info: 6,
};

const SEV_COLOR: Record<string, string> = {
  critical: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  high:     "bg-orange-500/20 text-orange-300 border-orange-500/40",
  error:    "bg-red-500/20 text-red-300 border-red-500/40",
  moderate: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  warning:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low:      "bg-sky-500/15 text-sky-300 border-sky-500/30",
  info:     "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

function buildPrompt(section: string, issues: FixIssue[], extra?: string): string {
  const env = detectEnv();
  const date = new Date().toISOString().split("T")[0];
  const sorted = [...issues].sort(
    (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
  );

  const lines: string[] = [
    `# Fix Request — Urban Culture Connect · ${section}`,
    ``,
    `**Environment:** ${env}`,
    `**Date:** ${date}`,
    `**Stack:** ${STACK}`,
    ``,
    `## Issues Found (${issues.length} total)`,
    ``,
    ...sorted.flatMap((iss, i) => {
      const rows = [
        `### ${i + 1}. [${iss.severity.toUpperCase()}] ${iss.title}`,
      ];
      if (iss.category) rows.push(`- **Category:** ${iss.category}`);
      rows.push(`- **Detail:** ${iss.detail}`);
      if (iss.recommendation) rows.push(`- **Recommendation:** ${iss.recommendation}`);
      rows.push("");
      return rows;
    }),
  ];

  if (extra) {
    lines.push(`## Additional Context`, ``, extra, ``);
  }

  lines.push(
    `## Fix Instructions`,
    ``,
    `Please fix **all** of the issues listed above without breaking any existing functionality:`,
    ``,
    `- Do not modify unrelated files unless strictly necessary`,
    `- Maintain the existing code style, patterns, and architecture of the project`,
    `- After fixing, briefly explain what was changed for each issue`,
    `- If an issue requires a manual step (e.g. missing API key, external service config), clearly explain what the manual action is`,
    `- If fixing a deployed issue, note any migration or deployment steps needed`,
  );

  return lines.join("\n");
}

export default function FixPromptPanel({ section, issues, extra }: FixPromptPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (issues.length === 0) return null;

  const prompt = buildPrompt(section, issues, extra);
  const urgentCount = issues.filter(
    (i) => i.severity === "critical" || i.severity === "high" || i.severity === "error"
  ).length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const el = document.createElement("textarea");
      el.value = prompt;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Card className="border-violet-500/30 bg-violet-500/5 mt-4">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="flex items-center gap-2 flex-1 text-left min-w-0"
            onClick={() => setOpen((v) => !v)}
            data-testid="btn-fix-prompt-toggle"
          >
            <Terminal className="w-4 h-4 text-violet-400 shrink-0" />
            <CardTitle className="text-sm text-violet-300">Fix with Replit Agent Prompt</CardTitle>
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40 text-xs shrink-0">
              {issues.length} issue{issues.length !== 1 ? "s" : ""}
            </Badge>
            {urgentCount > 0 && (
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs shrink-0">
                {urgentCount} urgent
              </Badge>
            )}
            <span className="ml-auto shrink-0">
              {open
                ? <ChevronDown className="w-3.5 h-3.5 text-violet-400" />
                : <ChevronRight className="w-3.5 h-3.5 text-violet-400" />}
            </span>
          </button>
          <Button
            size="sm"
            className="h-7 text-xs px-3 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
            onClick={handleCopy}
            data-testid="btn-copy-fix-prompt"
          >
            {copied
              ? <><Check className="w-3.5 h-3.5 mr-1.5" />Copied!</>
              : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copy prompt</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground pl-6 mt-0.5">
          Copy this prompt · paste it to Replit Agent · it will know exactly what to fix
        </p>
      </CardHeader>

      {open && (
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="space-y-2">
            {[...issues]
              .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))
              .map((iss, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 text-xs border border-border/40 rounded-lg p-2.5 bg-background/40"
                  data-testid={`fix-issue-${i}`}
                >
                  <Badge
                    className={`${SEV_COLOR[iss.severity] ?? SEV_COLOR.info} text-[10px] shrink-0 mt-0.5 capitalize`}
                  >
                    {iss.severity}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{iss.title}</div>
                    {iss.category && (
                      <div className="text-muted-foreground text-[10px] mb-0.5">{iss.category}</div>
                    )}
                    <div className="text-muted-foreground leading-snug">{iss.detail}</div>
                    {iss.recommendation && (
                      <div className="text-violet-400 mt-1">→ {iss.recommendation}</div>
                    )}
                  </div>
                </div>
              ))}
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-muted-foreground font-medium">Generated prompt:</p>
              <Button
                size="sm"
                className="h-6 text-[11px] px-2.5 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={handleCopy}
                data-testid="btn-copy-fix-prompt-2"
              >
                {copied
                  ? <><Check className="w-3 h-3 mr-1" />Copied</>
                  : <><Copy className="w-3 h-3 mr-1" />Copy</>}
              </Button>
            </div>
            <ScrollArea className="h-52 rounded-lg border border-border/60 bg-background/60">
              <pre className="text-[11px] p-3 font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed select-all">
                {prompt}
              </pre>
            </ScrollArea>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
