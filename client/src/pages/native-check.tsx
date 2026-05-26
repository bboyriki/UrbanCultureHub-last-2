import { useState, useEffect } from "react";
import {
  CheckCircle2, XCircle, AlertCircle, Loader2, Bell,
  Smartphone, Copy, ChevronDown, ChevronRight, RefreshCw, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

// ─── Helpers ──────────────────────────────────────────────────────────────
const UA = navigator.userAgent;
const isIOS     = /iPhone|iPad|iPod/i.test(UA);
const isAndroid = /Android/i.test(UA);
const hasWebKit = !!(window as any).webkit;

function detectWTN()  { try { return !!(window as any).WTN?.Firebase?.Messaging; } catch { return false; } }
function getWTNObj()  { try { return (window as any).WTN ?? null; } catch { return null; } }

type S = "idle"|"loading"|"pass"|"fail"|"warn";

function Icon({ s }: { s: S }) {
  if (s === "loading") return <Loader2 size={16} className="text-zinc-400 animate-spin shrink-0" />;
  if (s === "pass")   return <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />;
  if (s === "fail")   return <XCircle size={16} className="text-red-400 shrink-0" />;
  if (s === "warn")   return <AlertCircle size={16} className="text-yellow-400 shrink-0" />;
  return <div className="h-4 w-4 rounded-full border border-zinc-600 shrink-0" />;
}

function Pill({ s }: { s: S }) {
  const cls = s==="pass" ? "bg-emerald-500/15 text-emerald-400"
    : s==="fail"  ? "bg-red-500/15 text-red-400"
    : s==="warn"  ? "bg-yellow-500/15 text-yellow-400"
    : s==="loading" ? "bg-zinc-800 text-zinc-400"
    : "bg-zinc-800 text-zinc-500";
  const lbl = s==="pass"?"OK":s==="fail"?"Fail":s==="warn"?"Check":s==="loading"?"…":"—";
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", cls)}>{lbl}</span>;
}

interface Step { id: string; title: string; detail: string; s: S; fix?: string; }

// ─── Main component ────────────────────────────────────────────────────────
export default function NativeCheck() {
  const [steps, setSteps]       = useState<Step[]>([]);
  const [log, setLog]           = useState<string[]>([]);
  const [running, setRunning]   = useState(false);
  const [token, setToken]       = useState<string|null>(null);
  const [pushS, setPushS]       = useState<S>("idle");
  const [pushMsg, setPushMsg]   = useState("");
  const [pushErr, setPushErr]   = useState("");
  const [wtnObj, setWtnObj]     = useState<any>(null);
  const [showWtn, setShowWtn]   = useState(false);
  const [serverS, setServerS]   = useState<S>("idle");
  const [copied, setCopied]     = useState(false);
  const [serverDiag, setServerDiag] = useState<any>(null);
  const [serverDiagS, setServerDiagS] = useState<S>("idle");
  const [serverDiagErr, setServerDiagErr] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportS, setReportS] = useState<S>("idle");

  function addLog(msg: string) { setLog(l => [...l, `${new Date().toLocaleTimeString()} ${msg}`]); }

  function patch(id: string, fields: Partial<Step>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s));
  }

  function initSteps(): Step[] {
    return [
      { id:"env",     title:"iOS / WKWebView detected",   detail:"—", s:"idle" },
      { id:"wtn",     title:"WTN bridge (window.WTN)",    detail:"—", s:"idle" },
      { id:"methods", title:"getFCMToken method exists",  detail:"—", s:"idle" },
      { id:"server",  title:"Server reachable",           detail:"—", s:"idle" },
      { id:"auth",    title:"Logged-in session active",   detail:"—", s:"idle" },
    ];
  }

  useEffect(() => {
    setSteps(initSteps());
    runDiagnostics();
  }, []);

  async function runDiagnostics() {
    setRunning(true);
    setLog([]);
    setToken(null);
    setPushS("idle");
    setPushMsg("");
    setPushErr("");
    const fresh = initSteps();
    setSteps(fresh);

    // 1 — Environment
    patch("env", { s:"loading", detail:"Checking…" });
    const env: string[] = [];
    if (isIOS)     env.push("iOS");
    if (isAndroid) env.push("Android");
    if (!isIOS && !isAndroid) env.push("Desktop");
    if (hasWebKit) env.push("WKWebView");
    if (env.includes("iOS") && env.includes("WKWebView")) {
      patch("env", { s:"pass", detail:env.join(" · ") });
      addLog("✓ iOS WKWebView detected");
    } else if (isIOS) {
      patch("env", { s:"warn", detail:"iOS detected but no webkit object — may not be WKWebView", fix:"Make sure you're opening the URL inside your WTN iOS wrapper app, not Safari." });
      addLog("⚠ iOS but no webkit");
    } else {
      patch("env", { s:"warn", detail:`${env.join(" · ")} — not a WKWebView (push uses web path)` });
      addLog(`ℹ ${env.join(" · ")}`);
    }

    // 2 — WTN bridge (wait up to 2.5 s for injection)
    patch("wtn", { s:"loading", detail:"Waiting for bridge injection…" });
    const wtnDetected = await new Promise<boolean>(res => {
      if (detectWTN()) { res(true); return; }
      let elapsed = 0;
      const iv = setInterval(() => {
        elapsed += 200;
        if (detectWTN()) { clearInterval(iv); res(true); return; }
        if (elapsed >= 2500) { clearInterval(iv); res(false); }
      }, 200);
    });

    const wtnRaw = getWTNObj();
    setWtnObj(wtnRaw);

    if (wtnDetected) {
      patch("wtn", { s:"pass", detail:"window.WTN.Firebase.Messaging ✓" });
      addLog("✓ WTN bridge available");
    } else if (isIOS && hasWebKit) {
      patch("wtn", {
        s: "fail",
        detail: "WKWebView found but window.WTN is NOT injected",
        fix: "In your WebToNative project → Settings → Plugins → enable 'Firebase Cloud Messaging'. Then rebuild & reinstall the app.",
      });
      addLog("✗ WTN bridge missing — FCM plugin likely not enabled");
    } else {
      patch("wtn", { s:"warn", detail:"window.WTN not present (not a WKWebView — web push used instead)" });
      addLog("ℹ WTN not applicable on this platform");
    }

    // 3 — getFCMToken method
    patch("methods", { s:"loading", detail:"Checking…" });
    const hasFCMFn = typeof (window as any).WTN?.Firebase?.Messaging?.getFCMToken === "function";
    if (hasFCMFn) {
      patch("methods", { s:"pass", detail:"getFCMToken() is a function ✓" });
      addLog("✓ getFCMToken method present");
    } else if (wtnDetected) {
      patch("methods", {
        s: "fail",
        detail: "window.WTN.Firebase.Messaging.getFCMToken is NOT a function",
        fix: "Your WTN SDK version may be outdated. Update the WTN wrapper in the WebToNative dashboard and rebuild.",
      });
      addLog("✗ getFCMToken missing from bridge");
    } else {
      patch("methods", { s:"warn", detail:"N/A — WTN bridge not present" });
      addLog("ℹ methods check skipped");
    }

    // 4 — Server
    patch("server", { s:"loading", detail:"Pinging /health…" });
    try {
      const r = await fetch("/api/health", { cache:"no-store", signal:AbortSignal.timeout(5000) });
      patch("server", { s:"pass", detail:`Server responded ${r.status} ✓` });
      addLog(`✓ Server ${r.status}`);
    } catch(e:any) {
      patch("server", { s:"fail", detail:`Cannot reach server: ${e.message}`, fix:"Check your internet connection." });
      addLog(`✗ Server: ${e.message}`);
    }

    // 5 — Auth session
    patch("auth", { s:"loading", detail:"Checking session…" });
    try {
      const r = await apiRequest("/api/auth/me", "GET");
      if (r.ok) {
        const u = await r.json();
        patch("auth", { s:"pass", detail:`Logged in as: ${u.displayName || u.email || "user"} (id ${u.id})` });
        addLog(`✓ Auth: ${u.displayName}`);
      } else {
        patch("auth", { s:"warn", detail:"Not logged in — token registration will fail (401)", fix:"Log in first, then come back to this page." });
        addLog("⚠ Not authenticated");
      }
    } catch(e:any) {
      patch("auth", { s:"warn", detail:`Auth check error: ${e.message}` });
      addLog(`⚠ Auth error: ${e.message}`);
    }

    setRunning(false);
    addLog("Diagnostics complete — tap Enable Push below");
  }

  // ── Enable Push ──────────────────────────────────────────────────────────
  async function handleEnablePush() {
    setPushS("loading");
    setPushMsg("Step 1/4 — Checking WTN bridge…");
    setPushErr("");
    addLog("▶ Enable Push tapped");

    try {
      if (detectWTN()) {
        // ── WTN path ──
        setPushMsg("Step 2/4 — Calling WTN.Firebase.Messaging.getFCMToken…");
        addLog("Calling getFCMToken…");

        const result = await new Promise<{token?:string; error?:string}>((resolve, reject) => {
          const tm = setTimeout(() =>
            reject(new Error("Timeout (10s) — getFCMToken never called its callback.\n\nThis usually means:\n• iOS permission dialog appeared but was dismissed\n• The WTN Firebase plugin crashed\n• GoogleService-Info.plist is invalid")),
          10000);

          try {
            (window as any).WTN.Firebase.Messaging.getFCMToken({
              callback: (data: { token?: string; error?: string }) => {
                clearTimeout(tm);
                resolve(data ?? {});
              },
            });
          } catch(e:any) {
            clearTimeout(tm);
            reject(new Error(`getFCMToken threw: ${e.message}`));
          }
        });

        addLog(`Callback fired: token=${result.token ? result.token.slice(0,20)+"…" : "EMPTY"} error=${result.error || "none"}`);

        if (result.error) {
          throw new Error(
            `WTN returned error: "${result.error}"\n\n` +
            `Common causes:\n` +
            `• Push Notifications not enabled in iOS app entitlements\n` +
            `• APNs Auth Key (.p8) not uploaded to Firebase Console\n` +
            `• GoogleService-Info.plist mismatch with Firebase project`
          );
        }

        if (!result.token) {
          throw new Error(
            "WTN returned an EMPTY token (no error message).\n\n" +
            "Most likely causes:\n" +
            "1. The user tapped 'Don't Allow' on the iOS permission dialog\n" +
            "   → Go to iPhone Settings → Urban Culture Hub → Notifications → Allow\n\n" +
            "2. APNs Auth Key (.p8) not uploaded to Firebase\n" +
            "   → Firebase Console → Project Settings → Cloud Messaging → Apple app → Upload Auth Key\n\n" +
            "3. GoogleService-Info.plist bundle ID doesn't match the app"
          );
        }

        const fcmToken = result.token;
        setToken(fcmToken);
        addLog(`✓ FCM token: ${fcmToken.slice(0,30)}…`);

        setPushMsg("Step 3/4 — Registering token with server…");
        const platform = isIOS ? "ios" : isAndroid ? "android" : "web";
        const regRes = await apiRequest("/api/push/register", "POST", { token: fcmToken, platform });
        if (!regRes.ok) {
          const body = await regRes.json().catch(() => ({ message: `HTTP ${regRes.status}` }));
          throw new Error(`Server rejected token: ${body.message || regRes.status}`);
        }
        addLog("✓ Token saved on server");

        setPushMsg("Step 4/4 — Sending test notification to this device…");
        try {
          const testRes = await apiRequest("/api/push/test-user", "POST", {});
          if (testRes.ok) {
            addLog("✓ Test push sent — you should receive a notification shortly");
          } else {
            addLog("⚠ Test push failed (token saved, delivery may still work)");
          }
        } catch { addLog("⚠ Test push request failed"); }

        setPushS("pass");
        setPushMsg("✓ Push notifications enabled! Check your notification tray.");

      } else if ("Notification" in window) {
        // ── Web path ──
        setPushMsg("Step 2/4 — Requesting browser permission…");
        const perm = await Notification.requestPermission();
        if (perm !== "granted") throw new Error(`Permission ${perm} — tap Allow when the dialog appears`);
        addLog("✓ Browser permission granted");
        setPushS("pass");
        setPushMsg("✓ Permission granted — token will be registered automatically");

      } else {
        throw new Error(
          "No push API available.\n\n" +
          "• In WKWebView: WTN bridge not detected — see Step 2 above\n" +
          "• In Safari: Notification API not supported on iOS Safari\n" +
          "• Solution: Use the Urban Culture Hub app with the WTN push plugin enabled"
        );
      }
    } catch(e:any) {
      const msg = e?.message || String(e);
      setPushS("fail");
      setPushErr(msg);
      addLog(`✗ ${msg.split("\n")[0]}`);
    }
  }

  async function handleServerDiagnostic() {
    setServerDiagS("loading");
    setServerDiagErr("");
    setServerDiag(null);
    addLog("▶ Running server diagnostic + real FCM send…");
    try {
      const r = await apiRequest("/api/admin/push/diagnostic", "POST", {});
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          throw new Error("Admin only — log in as an admin first to run the server diagnostic.");
        }
        const body = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
        throw new Error(body.message || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setServerDiag(data);
      setServerDiagS("pass");
      addLog(`✓ Server diagnostic done — ${data.tokens?.length ?? 0} token(s), FCM test: ${data.fcmTest?.skipped ? "skipped" : "ran"}`);
    } catch (e: any) {
      setServerDiagS("fail");
      setServerDiagErr(e?.message || String(e));
      addLog(`✗ Server diagnostic: ${e?.message || e}`);
    }
  }

  async function handleSaveReport() {
    setReportS("loading");
    try {
      const report = {
        timestamp: new Date().toISOString(),
        userAgent: UA,
        env: { isIOS, isAndroid, hasWebKit, isWTN: detectWTN() },
        steps,
        log,
        token,
        wtn: wtnObj,
        serverDiag,
      };
      const r = await apiRequest("/api/admin/push/diagnostic-report", "POST", report);
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) throw new Error("Admin only — log in as admin to save a report.");
        throw new Error(`HTTP ${r.status}`);
      }
      const { reportId: id } = await r.json();
      setReportId(id);
      setReportS("pass");
      addLog(`✓ Report saved as ${id}`);
    } catch (e: any) {
      setReportS("fail");
      addLog(`✗ Save report: ${e?.message || e}`);
      setTimeout(() => setReportS("idle"), 4000);
    }
  }

  async function handleSendTest() {
    setServerS("loading");
    try {
      const r = await apiRequest("/api/push/test-user", "POST", {});
      setServerS(r.ok ? "pass" : "fail");
      addLog(r.ok ? "✓ Test push sent" : "✗ Test push failed");
      setTimeout(() => setServerS("idle"), 5000);
    } catch {
      setServerS("fail");
      setTimeout(() => setServerS("idle"), 5000);
    }
  }

  function copyReport() {
    const report = [
      "=== Urban Culture Hub Push Diagnostics ===",
      `Date: ${new Date().toISOString()}`,
      `UA: ${UA}`,
      "",
      "Steps:",
      ...steps.map(s => `[${s.s.toUpperCase()}] ${s.title}: ${s.detail}`),
      "",
      "Log:",
      ...log,
      "",
      `FCM Token: ${token ? token.slice(0,40)+"…" : "none"}`,
      `WTN Object: ${JSON.stringify(wtnObj, null, 2)}`,
    ].join("\n");
    navigator.clipboard.writeText(report).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  }

  const overall: S = steps.some(s=>s.s==="fail") ? "fail"
    : steps.some(s=>s.s==="loading"||s.s==="idle") ? "loading"
    : steps.some(s=>s.s==="warn") ? "warn"
    : steps.length ? "pass" : "idle";

  return (
    <div className="min-h-screen bg-zinc-950 text-white px-4 py-6 max-w-lg mx-auto pb-16">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold">Push Notification Diagnostics</h1>
          <p className="text-zinc-500 text-xs mt-0.5">Urban Culture Hub · WebToNative iOS</p>
        </div>
        <button onClick={() => { setSteps(initSteps()); runDiagnostics(); }}
          disabled={running}
          className="flex items-center gap-1.5 text-xs font-medium text-orange-400 bg-orange-500/15 px-3 py-1.5 rounded-xl hover:bg-orange-500/25 disabled:opacity-40 transition-colors">
          <RefreshCw size={12} className={running?"animate-spin":""} />
          {running ? "Running…" : "Re-run"}
        </button>
      </div>

      {/* Overall status bar */}
      <div className={cn("flex items-center gap-3 px-4 py-3 rounded-2xl mb-5 border",
        overall==="pass"?"bg-emerald-500/10 border-emerald-500/25":
        overall==="fail"?"bg-red-500/10 border-red-500/25":
        overall==="warn"?"bg-yellow-500/10 border-yellow-500/25":
        "bg-zinc-900 border-zinc-800")}>
        <Icon s={overall} />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {overall==="pass"?"All checks passed":
             overall==="fail"?"Issue found — see red step below":
             overall==="warn"?"Checks complete — review yellow steps":
             "Running checks…"}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {isIOS&&hasWebKit?"iOS WKWebView":isAndroid?"Android":"Desktop / Web"} · {detectWTN()?"WTN bridge active":"WTN bridge not detected"}
          </p>
        </div>
      </div>

      {/* Diagnostic steps */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800 mb-5">
        {steps.map((step, i) => (
          <div key={step.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-600 font-mono w-4 shrink-0">{i+1}</span>
              <Icon s={step.s} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">{step.title}</span>
                  <Pill s={step.s} />
                </div>
                {step.detail !== "—" && (
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{step.detail}</p>
                )}
              </div>
            </div>
            {step.fix && step.s === "fail" && (
              <div className="mt-2.5 ml-7 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2.5">
                <p className="text-[11px] text-orange-300 leading-relaxed font-medium">How to fix:</p>
                <p className="text-[11px] text-orange-200/80 leading-relaxed mt-0.5 whitespace-pre-line">{step.fix}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── ENABLE PUSH BUTTON ── */}
      <div className={cn("rounded-2xl border p-5 mb-5",
        pushS==="pass"?"bg-emerald-500/10 border-emerald-500/30":
        pushS==="fail"?"bg-red-500/10 border-red-500/30":
        "bg-zinc-900 border-zinc-700")}>

        <div className="flex items-center gap-3 mb-3">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            pushS==="pass"?"bg-emerald-500/20":pushS==="fail"?"bg-red-500/20":"bg-orange-500/20")}>
            {pushS==="loading"
              ? <Loader2 size={20} className="animate-spin text-orange-400" />
              : <Bell size={20} className={pushS==="pass"?"text-emerald-400":pushS==="fail"?"text-red-400":"text-orange-400"} />
            }
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">
              {pushS==="pass"?"Push Notifications Enabled ✓":pushS==="fail"?"Registration Failed":"Enable Push Notifications"}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {pushS==="idle"
                ? (detectWTN()
                    ? "Tap to trigger iOS permission dialog & register token"
                    : isIOS ? "Fix the red steps above first, then tap here"
                    : "Tap to request browser notification permission")
                : pushS==="loading" ? pushMsg
                : pushS==="pass" ? pushMsg
                : "See error details below"
              }
            </p>
          </div>
        </div>

        {/* Error details */}
        {pushS === "fail" && pushErr && (
          <div className="mb-3 bg-zinc-950 border border-red-500/20 rounded-xl p-3">
            <p className="text-[11px] font-mono text-red-300 leading-relaxed whitespace-pre-wrap">{pushErr}</p>
          </div>
        )}

        <button
          onClick={handleEnablePush}
          disabled={pushS==="loading"||pushS==="pass"}
          className={cn(
            "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95",
            pushS==="pass"?"bg-emerald-500/20 text-emerald-400 cursor-default":
            pushS==="fail"?"bg-red-500/20 text-red-300 hover:bg-red-500/30":
            pushS==="loading"?"bg-zinc-800 text-zinc-400 cursor-wait":
            "bg-orange-500 hover:bg-orange-600 text-white"
          )}>
          {pushS==="loading"
            ? <><Loader2 size={16} className="animate-spin" /> {pushMsg || "Working…"}</>
            : pushS==="pass"
              ? <><CheckCircle2 size={16} /> Enabled</>
              : pushS==="fail"
                ? <><Bell size={16} /> Try Again</>
                : <><Bell size={16} /> Enable Push Notifications</>
          }
        </button>

        {pushS==="pass" && (
          <button onClick={handleSendTest} disabled={serverS==="loading"}
            className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 flex items-center justify-center gap-2 transition-all">
            {serverS==="loading"
              ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
              : serverS==="pass"
                ? <><CheckCircle2 size={14} className="text-emerald-400" /> Test sent — check notifications!</>
                : <><Bell size={14} /> Send Another Test Push</>
            }
          </button>
        )}
      </div>

      {/* FCM Token */}
      {token && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">FCM Token (registered ✓)</p>
          <p className="text-[10px] font-mono text-zinc-400 break-all cursor-pointer hover:text-white"
            onClick={()=>navigator.clipboard.writeText(token!)}>
            {token}
          </p>
        </div>
      )}

      {/* WTN Object Inspector */}
      {wtnObj !== null && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl mb-4 overflow-hidden">
          <button onClick={()=>setShowWtn(v=>!v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800 transition-colors">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">window.WTN inspector</p>
            {showWtn ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
          </button>
          {showWtn && (
            <div className="px-4 pb-4">
              <p className="text-[10px] font-mono text-zinc-400 break-all leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(wtnObj, (k,v) => typeof v==="function" ? `[Function: ${k}]` : v, 2)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Diagnostic log */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl mb-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Log</p>
          <button onClick={copyReport}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
            <Copy size={11} /> {copied?"Copied!":"Copy report"}
          </button>
        </div>
        <div className="px-4 py-3 space-y-1 max-h-48 overflow-y-auto">
          {log.length===0
            ? <p className="text-[11px] text-zinc-600 italic">No log yet…</p>
            : log.map((l,i) => <p key={i} className="text-[11px] font-mono text-zinc-400 leading-relaxed">{l}</p>)
          }
        </div>
      </div>

      {/* ── ADMIN: Server Diagnostic ── */}
      <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-purple-400" />
          <p className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">Admin diagnostic</p>
        </div>
        <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">
          Runs a full server-side check + sends a real test push to your registered tokens, returning the exact FCM/APNs error code.
        </p>
        <button
          onClick={handleServerDiagnostic}
          disabled={serverDiagS === "loading"}
          data-testid="button-server-diagnostic"
          className={cn(
            "w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95",
            serverDiagS === "loading" ? "bg-zinc-800 text-zinc-400" :
            serverDiagS === "pass" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
            serverDiagS === "fail" ? "bg-red-500/20 text-red-300 border border-red-500/30" :
            "bg-purple-500 hover:bg-purple-600 text-white"
          )}>
          {serverDiagS === "loading" ? <><Loader2 size={14} className="animate-spin" /> Running…</>
            : serverDiagS === "pass" ? <><CheckCircle2 size={14} /> Run again</>
            : serverDiagS === "fail" ? <><XCircle size={14} /> Retry</>
            : <><Bell size={14} /> Run server diagnostic</>}
        </button>

        {serverDiagErr && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-[11px] text-red-300 font-mono whitespace-pre-wrap">{serverDiagErr}</p>
          </div>
        )}

        {serverDiag && (
          <div className="mt-3 space-y-2.5">
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase mb-1.5">Server</p>
              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex justify-between"><span className="text-zinc-500">Firebase Admin SDK:</span><span className={serverDiag.server?.firebaseAdminInitialized ? "text-emerald-400" : "text-red-400"}>{serverDiag.server?.firebaseAdminInitialized ? "✓ initialized" : "✗ NOT initialized"}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Project ID:</span><span className="text-zinc-300">{serverDiag.server?.firebaseProjectId || "—"}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Public Project ID:</span><span className="text-zinc-300">{serverDiag.server?.publicProjectId || "—"}</span></div>
              </div>
              {serverDiag.server?.firebaseProjectId && serverDiag.server?.publicProjectId &&
                serverDiag.server.firebaseProjectId !== serverDiag.server.publicProjectId && (
                <p className="mt-2 text-[10px] text-yellow-300">⚠ Server and client are using DIFFERENT Firebase projects — this will cause sender-id-mismatch errors.</p>
              )}
            </div>

            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase mb-1.5">Env vars</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                {Object.entries(serverDiag.server?.envVars || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    {v ? <CheckCircle2 size={10} className="text-emerald-400 shrink-0" /> : <XCircle size={10} className="text-red-400 shrink-0" />}
                    <span className={v ? "text-zinc-400" : "text-red-300"}>{k.replace(/^VITE_FIREBASE_/, "")}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase mb-1.5">Your registered tokens ({serverDiag.tokens?.length ?? 0})</p>
              {(!serverDiag.tokens || serverDiag.tokens.length === 0) ? (
                <p className="text-[11px] text-yellow-300">No tokens registered — open this page on the iOS app and tap "Enable Push" first.</p>
              ) : (
                <div className="space-y-1.5">
                  {serverDiag.tokens.map((t: any) => (
                    <div key={t.id} className="text-[10px] font-mono">
                      <div className="flex items-center gap-2">
                        <span className={cn("px-1.5 py-0.5 rounded font-bold text-[9px]",
                          t.platform === "ios" ? "bg-blue-500/20 text-blue-300" :
                          t.platform === "android" ? "bg-green-500/20 text-green-300" :
                          "bg-zinc-700 text-zinc-300")}>{t.platform?.toUpperCase()}</span>
                        <span className="text-zinc-400 truncate">{t.tokenPreview}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {serverDiag.fcmTest && (
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase mb-1.5">FCM send test</p>
                {serverDiag.fcmTest.skipped ? (
                  <p className="text-[11px] text-yellow-300">{serverDiag.fcmTest.message}</p>
                ) : (
                  <div className="space-y-2">
                    {serverDiag.fcmTest.results?.map((r: any, i: number) => (
                      <div key={i} className={cn("p-2 rounded border text-[11px]",
                        r.success ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30")}>
                        <div className="flex items-center gap-2 font-bold mb-1">
                          {r.success ? <CheckCircle2 size={12} className="text-emerald-400" /> : <XCircle size={12} className="text-red-400" />}
                          <span className={r.success ? "text-emerald-300" : "text-red-300"}>
                            {r.platform?.toUpperCase()} — {r.success ? "DELIVERED to FCM" : "FAILED"}
                          </span>
                        </div>
                        {r.success && r.messageId && (
                          <p className="text-[10px] font-mono text-zinc-500 break-all">msgId: {r.messageId}</p>
                        )}
                        {!r.success && (
                          <>
                            <p className="text-[10px] font-mono text-red-300/90">code: {r.errorCode}</p>
                            <p className="text-[10px] font-mono text-zinc-400 mt-1 break-words">{r.errorMessage}</p>
                            {r.diagnosis && (
                              <p className="text-[11px] text-orange-300 mt-2 leading-relaxed">→ {r.diagnosis}</p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSaveReport}
              disabled={reportS === "loading"}
              data-testid="button-save-report"
              className={cn(
                "w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95",
                reportS === "pass" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                reportS === "fail" ? "bg-red-500/20 text-red-300 border border-red-500/30" :
                "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
              )}>
              {reportS === "loading" ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : reportS === "pass" && reportId ? <><CheckCircle2 size={14} /> Report saved — share code: <span className="font-mono text-emerald-200 bg-emerald-500/20 px-1.5 py-0.5 rounded ml-1">{reportId}</span></>
                : reportS === "fail" ? <><XCircle size={14} /> Retry save</>
                : <><Copy size={14} /> Save report & get share code</>}
            </button>
            {reportId && (
              <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                Send this 6-character code to support — it lets them pull the full diagnostic data.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Setup checklist */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">WebToNative setup checklist</p>
        {[
          { check:"Firebase Cloud Messaging plugin enabled in WTN dashboard" },
          { check:"GoogleService-Info.plist uploaded to WTN project (must match Firebase project)" },
          { check:"APNs Auth Key (.p8) uploaded → Firebase Console → Project Settings → Cloud Messaging → Apple app" },
          { check:"Push Notifications capability enabled in WTN project (entitlements)" },
          { check:"App rebuilt & reinstalled after enabling plugin" },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="h-4 w-4 rounded border border-zinc-600 mt-0.5 shrink-0 flex items-center justify-center">
              <span className="text-[9px] text-zinc-600">{i+1}</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">{item.check}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
