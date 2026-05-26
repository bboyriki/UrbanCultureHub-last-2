/**
 * ShareSheet — WebView-safe sharing.
 * No navigator.share (causes black screen in WKWebView).
 * No blob downloads (causes OOM crash).
 * Uses direct URI deep links + clipboard only.
 */

import { useState, useEffect, useCallback } from "react";
import { X, Copy, Check, Link2, Lock } from "lucide-react";
import { SiWhatsapp, SiTelegram, SiX, SiFacebook } from "react-icons/si";
import { cn } from "@/lib/utils";
import { useCanShare } from "@/hooks/useCanShare";

interface ShareSheetProps {
  reelId: number;
  videoUrl: string;
  caption: string | null;
  thumbnailUrl: string | null;
  onClose: () => void;
  onShareCounted: () => void;
}

function haptic(ms = 8) { try { navigator.vibrate?.(ms); } catch {} }

export default function ShareSheet({
  reelId, caption, onClose, onShareCounted,
}: ShareSheetProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied]   = useState(false);
  const canShare = useCanShare();

  const reelUrl   = `${window.location.origin}/reels?id=${reelId}`;
  const shareText = caption
    ? `${caption} — Urban Culture Hub`
    : "Check this out on Urban Culture Hub";

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  // ── Copy link ─────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    haptic(4);
    try { await navigator.clipboard.writeText(reelUrl); }
    catch {
      const ta = Object.assign(document.createElement("textarea"), {
        value: reelUrl, style: "position:fixed;opacity:0",
      });
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true);
    onShareCounted();
    setTimeout(() => setCopied(false), 2500);
  }, [reelUrl, onShareCounted]);

  // ── App deep links (URI schemes → opens native apps) ─────────────────────
  const openDeepLink = useCallback((iosScheme: string, webFallback: string) => {
    haptic();
    onShareCounted();
    // Try native app first; fall back to web after short delay
    window.location.href = iosScheme;
    setTimeout(() => { window.location.href = webFallback; }, 1200);
  }, [onShareCounted]);

  const encodedText = encodeURIComponent(`${shareText}\n${reelUrl}`);
  const encodedUrl  = encodeURIComponent(reelUrl);

  const apps = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: <SiWhatsapp size={22} />,
      bg: "bg-[#25D366]",
      onTap: () => openDeepLink(
        `whatsapp://send?text=${encodedText}`,
        `https://wa.me/?text=${encodedText}`,
      ),
    },
    {
      id: "telegram",
      label: "Telegram",
      icon: <SiTelegram size={22} />,
      bg: "bg-[#229ED9]",
      onTap: () => openDeepLink(
        `tg://msg_url?url=${encodedUrl}&text=${encodeURIComponent(shareText)}`,
        `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(shareText)}`,
      ),
    },
    {
      id: "twitter",
      label: "X / Twitter",
      icon: <SiX size={19} />,
      bg: "bg-black border border-zinc-700",
      onTap: () => openDeepLink(
        `twitter://post?message=${encodedText}`,
        `https://twitter.com/intent/tweet?text=${encodedText}`,
      ),
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: <SiFacebook size={21} />,
      bg: "bg-[#1877F2]",
      onTap: () => openDeepLink(
        `fb://share?link=${encodedUrl}`,
        `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      ),
    },
  ];

  if (!canShare) {
    return (
      <div className="fixed inset-0 z-[95] flex items-end" onClick={close} data-testid="sheet-share-locked">
        <div className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )} />
        <div
          className={cn(
            "relative w-full bg-[#111] rounded-t-3xl border-t border-white/[0.07]",
            "transition-transform duration-300 ease-out",
            visible ? "translate-y-0" : "translate-y-full",
          )}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <p className="text-white font-semibold text-[15px]">Sharing locked</p>
            <button
              onClick={close}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 active:bg-white/10 transition-colors"
              data-testid="button-close-sharesheet-locked"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-5 pb-10 pt-4 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.08] flex items-center justify-center mb-4">
              <Lock size={24} className="text-white/70" />
            </div>
            <p className="text-white text-[15px] font-semibold mb-2">Sharing is admin-only</p>
            <p className="text-zinc-400 text-[13px] leading-relaxed max-w-[280px]">
              Reels sharing is currently restricted. Contact a community admin to request share access for your account.
            </p>
            <button
              onClick={close}
              className="mt-6 w-full py-3 rounded-2xl bg-white/[0.08] active:bg-white/[0.15] text-white font-semibold text-[14px] transition-colors"
              data-testid="button-dismiss-share-locked"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end" onClick={close}>

      {/* Backdrop */}
      <div className={cn(
        "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      )} />

      {/* Sheet */}
      <div
        className={cn(
          "relative w-full bg-[#111] rounded-t-3xl border-t border-white/[0.07]",
          "transition-transform duration-300 ease-out",
          visible ? "translate-y-0" : "translate-y-full",
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-5">
          <p className="text-white font-semibold text-[15px]">Share reel</p>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 active:bg-white/10 transition-colors"
            data-testid="button-close-sharesheet"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-10 space-y-5">

          {/* ── App icon row ── */}
          <div className="flex justify-between">
            {apps.map(app => (
              <button
                key={app.id}
                onClick={app.onTap}
                className="flex flex-col items-center gap-2 group"
                data-testid={`button-share-${app.id}`}
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center text-white",
                  "transition-transform active:scale-90",
                  app.bg,
                )}>
                  {app.icon}
                </div>
                <span className="text-zinc-500 text-[11px]">{app.label}</span>
              </button>
            ))}
          </div>

          {/* ── Copy link ── */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-4 bg-white/[0.08] active:bg-white/[0.15] px-5 py-4 rounded-2xl transition-colors"
            data-testid="button-copy-link"
          >
            <div className="w-11 h-11 rounded-xl bg-zinc-700 flex items-center justify-center flex-shrink-0 text-white">
              {copied
                ? <Check size={19} className="text-emerald-400" />
                : <Link2 size={18} />
              }
            </div>
            <div className="text-left">
              <p className={cn(
                "font-semibold text-[15px]",
                copied ? "text-emerald-400" : "text-white",
              )}>
                {copied ? "Copied!" : "Copy link"}
              </p>
              <p className="text-zinc-500 text-[12px] mt-0.5">
                {copied ? "Paste it anywhere" : "Share the reel link anywhere"}
              </p>
            </div>
          </button>

          {/* ── Instagram / TikTok hint ── */}
          <div className="bg-white/[0.05] rounded-2xl px-4 py-3.5">
            <p className="text-zinc-400 text-[12px] leading-relaxed text-center">
              To post on <span className="text-white font-medium">Instagram</span> or <span className="text-white font-medium">TikTok</span> — copy the link above and paste it in your story, bio, or DMs.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
