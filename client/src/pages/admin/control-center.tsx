/**
 * Control Center — real-time admin IDE
 *
 * Features:
 *   • Monaco Editor (loaded from CDN) with file browser + save
 *   • Live log stream via SSE  (/api/admin/control-center/stream)
 *   • Live app preview iframe
 *   • Error tracker (aggregated, deduplicated)
 *   • Security scanner (quick status + link to full report)
 *   • Performance metrics bar
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Monaco is loaded dynamically from CDN — declare globals
declare global {
  interface Window {
    monaco: any;
    require: any & { config: (cfg: any) => void };
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LogEntry {
  id: string;
  ts: number;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
}

interface ErrorEntry {
  id: string;
  ts: number;
  message: string;
  stack?: string;
  count: number;
  lastSeen: number;
  route?: string;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: FileNode[];
}

interface Metrics {
  system: {
    uptimeSec: number;
    memHeapUsedMb: number;
    memHeapTotalMb: number;
    memPct: number;
    nodeVersion: string;
  };
  endpoints: Array<{
    endpoint: string;
    count: number;
    avgMs: number;
    p95Ms: number;
    maxMs: number;
    errors: number;
    errorRate: number;
  }>;
  recommendations: string[];
  sseClients: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<string, string> = {
  info:  "#60a5fa",
  warn:  "#fbbf24",
  error: "#f87171",
  debug: "#9ca3af",
};

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", css: "css",
    html: "html", env: "ini", txt: "plaintext",
    sql: "sql", sh: "shell", py: "python", cjs: "javascript",
  };
  return map[ext] || "plaintext";
}

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ── Chip component ─────────────────────────────────────────────────────────────
function Chip({ icon, label, value, warn = false }: { icon: string; label: string; value: string; warn?: boolean }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4,
      background: warn ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${warn ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`,
      fontSize: 10, color: warn ? "#fca5a5" : "#9ca3af", whiteSpace: "nowrap" as const,
    }}>
      <span>{icon}</span>
      <span style={{ color: "#6b7280" }}>{label}:</span>
      <span style={{ color: warn ? "#fca5a5" : "#e5e7eb" }}>{value}</span>
    </div>
  );
}

// ── File tree node ─────────────────────────────────────────────────────────────
function TreeNode({
  node, depth, selectedFile, expandedDirs, onSelect, onToggle,
}: {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  expandedDirs: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const isSelected = node.type === "file" && selectedFile === node.path;
  const isExpanded = expandedDirs.has(node.path);

  return (
    <>
      <div
        onClick={() => node.type === "dir" ? onToggle(node.path) : onSelect(node.path)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          paddingLeft: 8 + depth * 14, paddingTop: 2, paddingBottom: 2, paddingRight: 8,
          borderRadius: 3, cursor: "pointer",
          background: isSelected ? "rgba(139,92,246,0.25)" : "transparent",
          color: isSelected ? "#c4b5fd" : node.type === "dir" ? "#fcd34d" : "#d1d5db",
          fontSize: 11,
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <span style={{ fontSize: 8, color: "#6b7280", width: 8, flexShrink: 0 }}>
          {node.type === "dir" ? (isExpanded ? "▼" : "▶") : ""}
        </span>
        <span style={{ fontSize: 12 }}>{node.type === "dir" ? "📁" : getFileIcon(node.name)}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{node.name}</span>
        {node.type === "file" && node.size !== undefined && (
          <span style={{ color: "#4b5563", fontSize: 9 }}>{humanSize(node.size)}</span>
        )}
      </div>
      {node.type === "dir" && isExpanded && node.children && (
        node.children.map(child => (
          <TreeNode
            key={child.path} node={child} depth={depth + 1}
            selectedFile={selectedFile} expandedDirs={expandedDirs}
            onSelect={onSelect} onToggle={onToggle}
          />
        ))
      )}
    </>
  );
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "🟦", tsx: "⚛️", js: "🟨", jsx: "⚛️",
    json: "📋", md: "📝", css: "🎨", html: "🌐",
    env: "🔐", sh: "⚙️", sql: "🗄️", txt: "📄",
  };
  return map[ext] || "📄";
}

// ── Log line ───────────────────────────────────────────────────────────────────
const LogLine = React.memo(({ log }: { log: LogEntry }) => (
  <div style={{
    display: "flex", gap: 6, alignItems: "flex-start",
    padding: "1px 4px", borderRadius: 2,
    background: log.level === "error" ? "rgba(239,68,68,0.05)" : "transparent",
    fontFamily: "monospace", fontSize: 11,
  }}>
    <span style={{ color: "#4b5563", flexShrink: 0, fontSize: 10 }}>{formatTs(log.ts)}</span>
    <span style={{ color: LEVEL_COLOR[log.level] ?? "#9ca3af", flexShrink: 0, width: 44, fontSize: 10 }}>
      [{log.level.toUpperCase().slice(0, 3)}]
    </span>
    <span style={{ color: "#7c3aed", flexShrink: 0, width: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontSize: 10 }}>
      [{log.source}]
    </span>
    <span style={{
      flex: 1, wordBreak: "break-all" as const,
      color: log.level === "error" ? "#fca5a5" : log.level === "warn" ? "#fde68a" : "#d1d5db",
    }}>
      {log.message}
    </span>
  </div>
));

// ── Security section scores bar ────────────────────────────────────────────────
function ScanSection({ s }: { s: { name: string; icon: string; score: number; status: string; aiSummary?: string } }) {
  const color = s.score >= 80 ? "#34d399" : s.score >= 60 ? "#fbbf24" : "#f87171";
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", borderRadius: 6,
      border: "1px solid rgba(255,255,255,0.08)", padding: "8px 10px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "#d1d5db" }}>{s.icon} {s.name}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{s.score}</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 9999, overflow: "hidden" }}>
        <div style={{ width: `${s.score}%`, height: "100%", background: color, borderRadius: 9999, transition: "width 0.5s ease" }} />
      </div>
      {s.aiSummary && (
        <p style={{ fontSize: 9, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>{s.aiSummary}</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ControlCenterPage() {
  const qc = useQueryClient();

  // Panel state
  const [activeTab, setActiveTab] = useState<"logs" | "editor" | "preview">("logs");
  const [rightPanel, setRightPanel] = useState<"errors" | "security" | "perf">("errors");
  const [showTree, setShowTree] = useState(true);

  // Editor
  const monacoContainer = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const [monacoReady, setMonacoReady] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set(["server", "client", "client/src", "shared"])
  );

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logLevel, setLogLevel] = useState("all");
  const [logSearch, setLogSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [sseStatus, setSseStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const logsBottomRef = useRef<HTMLDivElement>(null);

  // Security
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // ── Queries ──
  const { data: metricsData } = useQuery<Metrics>({
    queryKey: ["/api/admin/control-center/metrics"],
    refetchInterval: 10_000,
  });
  const { data: errorsData, refetch: refetchErrors } = useQuery<{ data: ErrorEntry[] }>({
    queryKey: ["/api/admin/control-center/errors"],
    refetchInterval: 15_000,
  });
  const { data: filesData } = useQuery<{ tree: FileNode[] }>({
    queryKey: ["/api/admin/control-center/files"],
    staleTime: 60_000,
  });

  // ── Load Monaco from CDN ──
  useEffect(() => {
    if (window.monaco) { setMonacoReady(true); return; }
    if (document.querySelector('script[data-monaco]')) return; // already loading

    const script = document.createElement("script");
    script.src = "https://unpkg.com/monaco-editor@0.45.0/min/vs/loader.js";
    script.setAttribute("data-monaco", "1");
    script.onload = () => {
      window.require.config({
        paths: { vs: "https://unpkg.com/monaco-editor@0.45.0/min/vs" },
      });
      window.require(["vs/editor/editor.main"], () => setMonacoReady(true));
    };
    document.head.appendChild(script);
  }, []);

  // ── Init Monaco editor when tab is editor + ready ──
  useEffect(() => {
    if (activeTab !== "editor" || !monacoReady || !monacoContainer.current) return;
    if (editorRef.current) return; // already created

    editorRef.current = window.monaco.editor.create(monacoContainer.current, {
      value: fileContent,
      language: selectedFile ? getLanguage(selectedFile) : "typescript",
      theme: "vs-dark",
      fontSize: 12,
      fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
      minimap: { enabled: window.innerWidth > 1400 },
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: "off",
      folding: true,
    });

    editorRef.current.onDidChangeModelContent(() => setIsDirty(true));
  }, [activeTab, monacoReady]); // eslint-disable-line

  // ── Update Monaco content when file changes ──
  useEffect(() => {
    if (!editorRef.current || !window.monaco || !selectedFile) return;
    const lang = getLanguage(selectedFile);
    const model = window.monaco.editor.createModel(fileContent, lang);
    editorRef.current.setModel(model);
    setIsDirty(false);
  }, [fileContent, selectedFile]);

  // ── SSE connection ──
  useEffect(() => {
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      setSseStatus("connecting");
      es = new EventSource("/api/admin/control-center/stream");

      es.onopen = () => setSseStatus("connected");

      es.onerror = () => {
        setSseStatus("disconnected");
        es.close();
        reconnectTimer = setTimeout(connect, 5000);
      };

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "history") {
            setLogs(prev => {
              const merged = [...prev, ...data.logs];
              // dedup by id
              const seen = new Set<string>();
              return merged.filter(l => { const ok = !seen.has(l.id); seen.add(l.id); return ok; }).slice(-500);
            });
          } else if (data.type === "log") {
            setLogs(prev => [...prev, data.entry].slice(-500));
          } else if (data.type === "error") {
            qc.invalidateQueries({ queryKey: ["/api/admin/control-center/errors"] });
          }
        } catch { /* ignore parse errors */ }
      };
    }

    connect();
    return () => { clearTimeout(reconnectTimer); es?.close(); };
  }, [qc]);

  // ── Auto-scroll logs ──
  useEffect(() => {
    if (autoScroll && activeTab === "logs") {
      logsBottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [logs, autoScroll, activeTab]);

  // ── Ctrl+S to save ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && activeTab === "editor") {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, selectedFile]); // eslint-disable-line

  // ── Load file ──
  const loadFile = useCallback(async (filePath: string) => {
    try {
      const res = await fetch(`/api/admin/control-center/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn("[control-center] Failed to load file:", err.error || res.status);
        return;
      }
      const data = await res.json();
      setSelectedFile(filePath);
      setFileContent(data.content ?? "");
      setIsDirty(false);
      setActiveTab("editor");
    } catch (e) {
      console.error("[control-center] Load file error:", e);
    }
  }, []);

  // ── Save file ──
  const saveFile = useCallback(async () => {
    if (!selectedFile || !editorRef.current) return;
    const content = editorRef.current.getValue() as string;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/control-center/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedFile, content }),
      });
      const data = await res.json();
      if (data.success) {
        setIsDirty(false);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [selectedFile]);

  // ── Security scan ──
  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/admin/security/scan", { method: "POST" });
      const data = await res.json();
      // scan returns { scanId } — then we poll for result
      if (data.scanId) {
        // Poll until complete
        let attempts = 0;
        const poll = async (): Promise<void> => {
          attempts++;
          if (attempts > 60) { setScanError("Scan timed out"); setScanning(false); return; }
          const r = await fetch(`/api/admin/security/scans`);
          const d = await r.json();
          const latest = d.data?.[0];
          if (latest?.status === "complete") {
            setScanResult(latest);
            setScanning(false);
          } else {
            setTimeout(poll, 2000);
          }
        };
        setTimeout(poll, 2000);
      } else if (data.overallScore !== undefined) {
        setScanResult(data);
        setScanning(false);
      } else {
        setScanError(data.error || "Scan failed");
        setScanning(false);
      }
    } catch (e: any) {
      setScanError(e.message);
      setScanning(false);
    }
  };

  // ── Tree toggle ──
  const toggleDir = useCallback((p: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }, []);

  // ── Derived values ──
  const errors = errorsData?.data ?? [];
  const metrics = metricsData;

  const filteredLogs = logs.filter(l => {
    if (logLevel !== "all" && l.level !== logLevel) return false;
    if (logSearch && !l.message.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });

  const sseColor = sseStatus === "connected" ? "#34d399" : sseStatus === "connecting" ? "#fbbf24" : "#f87171";

  const BASE: React.CSSProperties = {
    display: "flex", flexDirection: "column", height: "100vh",
    background: "#0a0a0f", color: "#e5e7eb",
    fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, overflow: "hidden",
  };

  return (
    <div style={BASE}>

      {/* ── Top metrics bar ──────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
        background: "#111118", borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0, flexWrap: "wrap",
      }}>
        <span style={{ fontWeight: 700, color: "#a78bfa", fontSize: 13, marginRight: 8 }}>
          ⚡ Control Center
        </span>

        {metrics ? (
          <>
            <Chip icon="⏱" label="Uptime" value={formatUptime(metrics.system.uptimeSec)} />
            <Chip
              icon="🧠" label="RAM"
              value={`${metrics.system.memHeapUsedMb}/${metrics.system.memHeapTotalMb}MB (${metrics.system.memPct}%)`}
              warn={metrics.system.memPct > 80}
            />
            <Chip icon="🔗" label="SSE" value={`${metrics.sseClients} live`} />
            <Chip icon="🟢" label="Node" value={metrics.system.nodeVersion} />
          </>
        ) : (
          <span style={{ color: "#4b5563", fontSize: 10 }}>Loading metrics…</span>
        )}

        <Chip icon="⚠️" label="Errors" value={String(errors.length)} warn={errors.length > 0} />

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: sseColor, display: "inline-block" }} />
          <span style={{ fontSize: 10, color: "#6b7280" }}>{sseStatus}</span>
        </div>
      </div>

      {/* ── Main 3-column layout ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* File tree sidebar */}
        {showTree && (
          <div style={{
            width: 210, flexShrink: 0, background: "#0f0f19",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)",
              background: "#111118",
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase" as const }}>
                Explorer
              </span>
              <button onClick={() => setShowTree(false)} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 11 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {filesData?.tree ? (
                filesData.tree.map(node => (
                  <TreeNode
                    key={node.path} node={node} depth={0}
                    selectedFile={selectedFile} expandedDirs={expandedDirs}
                    onSelect={loadFile} onToggle={toggleDir}
                  />
                ))
              ) : (
                <div style={{ color: "#4b5563", textAlign: "center", padding: 16, fontSize: 10 }}>Loading…</div>
              )}
            </div>
          </div>
        )}

        {/* Center panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Tab bar */}
          <div style={{
            display: "flex", alignItems: "center",
            background: "#111118", borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0, minHeight: 36,
          }}>
            {!showTree && (
              <button
                onClick={() => setShowTree(true)}
                style={{ padding: "0 10px", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12 }}
              >
                📁
              </button>
            )}

            {(["logs", "editor", "preview"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "0 16px", height: 36, background: "none", border: "none",
                  borderBottom: `2px solid ${activeTab === tab ? "#7c3aed" : "transparent"}`,
                  color: activeTab === tab ? "#e5e7eb" : "#6b7280",
                  cursor: "pointer", fontSize: 11, fontWeight: activeTab === tab ? 600 : 400,
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {tab === "logs" && "📋 Live Logs"}
                {tab === "editor" && "📝 Editor"}
                {tab === "preview" && "🌐 Preview"}
                {tab === "logs" && (
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", background: sseColor,
                    display: "inline-block",
                    animation: sseStatus === "connected" ? "pulse 2s infinite" : "none",
                  }} />
                )}
                {tab === "editor" && isDirty && (
                  <span style={{ color: "#fbbf24", fontSize: 8 }}>●</span>
                )}
              </button>
            ))}

            {/* Tab-specific controls */}
            {activeTab === "logs" && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, paddingRight: 10 }}>
                <input
                  type="text"
                  placeholder="Search…"
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 4, padding: "2px 8px", color: "#e5e7eb", fontSize: 10, width: 120,
                    outline: "none",
                  }}
                />
                <select
                  value={logLevel}
                  onChange={e => setLogLevel(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 4, padding: "2px 4px", color: "#e5e7eb", fontSize: 10,
                  }}
                >
                  <option value="all">All</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                </select>
                <button
                  onClick={() => setAutoScroll(p => !p)}
                  style={{
                    background: autoScroll ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${autoScroll ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 4, padding: "2px 8px", color: autoScroll ? "#c4b5fd" : "#9ca3af",
                    cursor: "pointer", fontSize: 10,
                  }}
                >
                  {autoScroll ? "⬇ Auto" : "⏸ Paused"}
                </button>
                <button
                  onClick={() => setLogs([])}
                  style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 4, padding: "2px 8px", color: "#9ca3af", cursor: "pointer", fontSize: 10,
                  }}
                >
                  Clear
                </button>
              </div>
            )}

            {activeTab === "editor" && selectedFile && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, paddingRight: 10 }}>
                <span style={{ color: "#6b7280", fontSize: 10, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedFile}
                </span>
                <button
                  onClick={saveFile}
                  disabled={!isDirty || saveStatus === "saving"}
                  style={{
                    background: isDirty ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${isDirty ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 4, padding: "2px 10px",
                    color: isDirty ? "#c4b5fd" : "#4b5563",
                    cursor: isDirty ? "pointer" : "not-allowed", fontSize: 10,
                  }}
                >
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "✕ Error" : "Save  Ctrl+S"}
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

            {/* Log stream */}
            {activeTab === "logs" && (
              <div style={{
                position: "absolute", inset: 0, overflowY: "auto",
                background: "#080810", padding: 6,
              }}>
                {filteredLogs.length === 0 ? (
                  <div style={{ color: "#374151", textAlign: "center", padding: 32 }}>
                    {sseStatus === "connected" ? "Waiting for server logs…" : "Connecting to log stream…"}
                  </div>
                ) : (
                  filteredLogs.map(l => <LogLine key={l.id} log={l} />)
                )}
                <div ref={logsBottomRef} />
              </div>
            )}

            {/* Monaco editor */}
            <div style={{ position: "absolute", inset: 0, display: activeTab === "editor" ? "flex" : "none", flexDirection: "column" }}>
              {!monacoReady && (
                <div style={{ color: "#4b5563", textAlign: "center", padding: 32 }}>
                  Loading Monaco Editor from CDN…
                </div>
              )}
              {monacoReady && !selectedFile && (
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", color: "#374151", gap: 8,
                }}>
                  <div style={{ fontSize: 40 }}>📄</div>
                  <div style={{ fontSize: 13 }}>Select a file from the Explorer to start editing</div>
                  <div style={{ fontSize: 11, color: "#1f2937" }}>Supports .ts, .tsx, .js, .json, .css, .md</div>
                </div>
              )}
              <div ref={monacoContainer} style={{ flex: 1 }} />
            </div>

            {/* Live preview */}
            {activeTab === "preview" && (
              <iframe
                src="/"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", background: "#fff" }}
                title="Live App Preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 300, flexShrink: 0, background: "#0f0f19",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>

          {/* Right tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
            {(["errors", "security", "perf"] as const).map(p => (
              <button
                key={p}
                onClick={() => setRightPanel(p)}
                style={{
                  flex: 1, padding: "8px 4px",
                  background: rightPanel === p ? "rgba(255,255,255,0.06)" : "none",
                  border: "none",
                  borderBottom: `2px solid ${rightPanel === p ? "#7c3aed" : "transparent"}`,
                  color: rightPanel === p ? "#e5e7eb" : "#6b7280",
                  cursor: "pointer", fontSize: 10, fontWeight: rightPanel === p ? 600 : 400,
                }}
              >
                {p === "errors" && `⚠️ Errors (${errors.length})`}
                {p === "security" && "🛡️ Security"}
                {p === "perf" && "📈 Perf"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* Error tracker */}
            {rightPanel === "errors" && (
              <div>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>
                    {errors.length} unique error{errors.length !== 1 ? "s" : ""} tracked
                  </span>
                  {errors.length > 0 && (
                    <button
                      onClick={async () => {
                        await fetch("/api/admin/control-center/errors", { method: "DELETE" });
                        refetchErrors();
                      }}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 10 }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {errors.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, color: "#374151" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                    <div style={{ fontSize: 11 }}>No errors tracked</div>
                  </div>
                ) : (
                  errors.map(err => (
                    <div key={err.id} style={{
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      padding: "10px 10px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                        <div style={{ color: "#fca5a5", fontSize: 10, fontWeight: 600, lineHeight: 1.4, wordBreak: "break-all", flex: 1 }}>
                          {err.message}
                        </div>
                        {err.count > 1 && (
                          <span style={{
                            background: "rgba(239,68,68,0.2)", color: "#fca5a5",
                            border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: 99, padding: "1px 6px", fontSize: 9, flexShrink: 0,
                          }}>
                            ×{err.count}
                          </span>
                        )}
                      </div>
                      {err.route && <div style={{ color: "#4b5563", fontSize: 9, marginTop: 2 }}>Route: {err.route}</div>}
                      <div style={{ color: "#374151", fontSize: 9, marginTop: 2 }}>{formatTs(err.lastSeen)}</div>
                      {err.stack && (
                        <details style={{ marginTop: 4 }}>
                          <summary style={{ color: "#4b5563", fontSize: 9, cursor: "pointer" }}>Stack trace</summary>
                          <pre style={{
                            color: "#4b5563", fontSize: 8, marginTop: 4,
                            overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                          }}>{err.stack}</pre>
                        </details>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Security panel */}
            {rightPanel === "security" && (
              <div style={{ padding: 10 }}>
                <button
                  onClick={runScan}
                  disabled={scanning}
                  style={{
                    width: "100%", padding: "8px 0",
                    background: scanning ? "rgba(255,255,255,0.06)" : "rgba(139,92,246,0.3)",
                    border: `1px solid ${scanning ? "rgba(255,255,255,0.1)" : "rgba(139,92,246,0.5)"}`,
                    borderRadius: 6, color: scanning ? "#6b7280" : "#c4b5fd",
                    cursor: scanning ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600,
                    marginBottom: 10,
                  }}
                >
                  {scanning ? "🔍 Scanning…" : "🛡️ Run Security Scan"}
                </button>

                {scanError && (
                  <div style={{ color: "#fca5a5", fontSize: 10, marginBottom: 8, padding: 8, background: "rgba(239,68,68,0.1)", borderRadius: 4 }}>
                    {scanError}
                  </div>
                )}

                {scanResult ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{
                        fontSize: 24, fontWeight: 800,
                        color: scanResult.overallScore >= 80 ? "#34d399" : scanResult.overallScore >= 60 ? "#fbbf24" : "#f87171",
                      }}>
                        {scanResult.overallScore}<span style={{ fontSize: 14 }}>/100</span>
                        {" "}<span style={{ fontSize: 13, fontWeight: 700 }}>Grade {scanResult.grade}</span>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 9 }}>
                        {scanResult.criticalCount > 0 && <div style={{ color: "#f87171" }}>🔴 {scanResult.criticalCount} critical</div>}
                        {scanResult.highCount > 0 && <div style={{ color: "#fb923c" }}>🟠 {scanResult.highCount} high</div>}
                        <div style={{ color: "#fbbf24" }}>🟡 {scanResult.mediumCount} medium</div>
                      </div>
                    </div>

                    {scanResult.summary && (
                      <p style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.5, marginBottom: 10 }}>
                        {scanResult.summary}
                      </p>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(scanResult.sections || []).map((s: any) => (
                        <ScanSection key={s.id} s={s} />
                      ))}
                    </div>

                    <div style={{ textAlign: "center", marginTop: 10 }}>
                      <a
                        href="/admin/security-center"
                        style={{ color: "#a78bfa", fontSize: 10, textDecoration: "none" }}
                      >
                        View full Security Center →
                      </a>
                    </div>
                  </div>
                ) : !scanning && (
                  <div style={{ textAlign: "center", padding: 24, color: "#374151" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
                    <div style={{ fontSize: 10, marginBottom: 6 }}>Run a scan to check your security posture</div>
                    <a href="/admin/security-center" style={{ color: "#7c3aed", fontSize: 10, textDecoration: "none" }}>
                      Open full Security Center
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Performance panel */}
            {rightPanel === "perf" && (
              <div>
                {metrics ? (
                  <>
                    {/* System stats */}
                    <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>System</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {[
                          { label: "Uptime", value: formatUptime(metrics.system.uptimeSec) },
                          { label: "Node", value: metrics.system.nodeVersion },
                          { label: "Heap", value: `${metrics.system.memHeapUsedMb}/${metrics.system.memHeapTotalMb}MB` },
                          { label: "RSS", value: `${(metrics as any).system.memRssMb ?? "?"}MB` },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "4px 6px" }}>
                            <div style={{ fontSize: 8, color: "#6b7280" }}>{label}</div>
                            <div style={{ fontSize: 10, color: "#e5e7eb", fontWeight: 600 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Memory bar */}
                    <div style={{ padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 9, color: "#6b7280" }}>Memory</span>
                        <span style={{ fontSize: 9, color: metrics.system.memPct > 80 ? "#f87171" : "#9ca3af" }}>
                          {metrics.system.memPct}%
                        </span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 9999 }}>
                        <div style={{
                          width: `${metrics.system.memPct}%`, height: "100%", borderRadius: 9999,
                          background: metrics.system.memPct > 80 ? "#ef4444" : metrics.system.memPct > 60 ? "#fbbf24" : "#34d399",
                          transition: "width 0.5s",
                        }} />
                      </div>
                    </div>

                    {/* Recommendations */}
                    {metrics.recommendations.length > 0 && (
                      <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Recommendations</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {metrics.recommendations.map((r, i) => (
                            <div key={i} style={{
                              fontSize: 9, color: "#9ca3af", lineHeight: 1.4,
                              padding: "4px 8px", background: "rgba(251,191,36,0.06)",
                              border: "1px solid rgba(251,191,36,0.15)", borderRadius: 4,
                            }}>
                              ⚡ {r}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top endpoints */}
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                        Slowest Endpoints
                      </div>
                      {metrics.endpoints.slice(0, 8).map(ep => (
                        <div key={ep.endpoint} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                        }}>
                          <span style={{
                            fontSize: 9, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", flex: 1, maxWidth: 170,
                          }}>
                            {ep.endpoint}
                          </span>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <span style={{
                              fontSize: 9,
                              color: ep.avgMs > 1000 ? "#f87171" : ep.avgMs > 500 ? "#fbbf24" : "#34d399",
                            }}>
                              {ep.avgMs}ms
                            </span>
                            {ep.errorRate > 0 && (
                              <span style={{ fontSize: 9, color: "#f87171" }}>{ep.errorRate}%</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#374151", textAlign: "center", padding: 32, fontSize: 10 }}>Loading…</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
