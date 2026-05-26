/**
 * useCallAudio — Web Audio API ringtones for voice & video calls
 *
 * Ring styles (like Instagram):
 *  - outgoing_online:  Classic dual-tone phone ring, loops while waiting
 *  - outgoing_offline: Three descending beeps → stops (user unavailable)
 *  - incoming:         Rapid ascending ring that loops
 *  - connected:        Short pleasant ding (call picked up)
 *  - ended:            Brief low tone (call ended)
 *  - declined:         Quick low double-beep
 */

import { useRef, useCallback } from "react";

type RingTone =
  | "outgoing_online"
  | "outgoing_offline"
  | "incoming"
  | "connected"
  | "ended"
  | "declined";

function getAudioContext(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    return new Ctx();
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  gainValue = 0.25,
  type: OscillatorType = "sine",
  freq2?: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainValue, startAt + 0.01);
  gain.gain.setValueAtTime(gainValue, startAt + duration - 0.03);
  gain.gain.linearRampToValueAtTime(0, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);

  if (freq2 !== undefined) {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = type;
    osc2.frequency.setValueAtTime(freq2, startAt);
    gain2.gain.setValueAtTime(0, startAt);
    gain2.gain.linearRampToValueAtTime(gainValue * 0.7, startAt + 0.01);
    gain2.gain.setValueAtTime(gainValue * 0.7, startAt + duration - 0.03);
    gain2.gain.linearRampToValueAtTime(0, startAt + duration);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(startAt);
    osc2.stop(startAt + duration);
  }
}

export function useCallAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = getAudioContext();
    }
    if (ctxRef.current?.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const stopAudio = useCallback(() => {
    stoppedRef.current = true;
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  /**
   * Play a one-shot or looping ring tone
   */
  const playRingTone = useCallback(
    (tone: RingTone) => {
      stopAudio();
      stoppedRef.current = false;

      const ctx = ensureCtx();
      if (!ctx) return;

      const now = ctx.currentTime;

      switch (tone) {
        case "outgoing_online": {
          // Classic phone ring: DRRRRING pause DRRRRING (loop)
          // Dual-tone like a traditional phone: 440 Hz + 480 Hz
          const ringOnce = () => {
            if (stoppedRef.current) return;
            const c = ensureCtx();
            if (!c) return;
            const t = c.currentTime;
            // Two short bursts per ring cycle
            playTone(c, 440, t, 0.5, 0.2, "sine", 480);
            playTone(c, 440, t + 0.6, 0.5, 0.2, "sine", 480);
            // Wait 2 seconds then repeat
            loopTimerRef.current = setTimeout(() => {
              if (!stoppedRef.current) ringOnce();
            }, 2200);
          };
          ringOnce();
          break;
        }

        case "outgoing_offline": {
          // Three descending beeps (not available / offline indication)
          playTone(ctx, 660, now, 0.25, 0.2, "sine");
          playTone(ctx, 550, now + 0.35, 0.25, 0.2, "sine");
          playTone(ctx, 440, now + 0.7, 0.35, 0.2, "sine");
          // No loop — stops after 3 beeps
          break;
        }

        case "incoming": {
          // Instagram-style: quick ascending ring that loops urgently
          const ringIncoming = () => {
            if (stoppedRef.current) return;
            const c = ensureCtx();
            if (!c) return;
            const t = c.currentTime;
            // Three quick ascending beeps
            playTone(c, 700, t, 0.12, 0.22, "sine");
            playTone(c, 800, t + 0.15, 0.12, 0.22, "sine");
            playTone(c, 950, t + 0.3, 0.18, 0.25, "sine");
            // Pause 0.8s then repeat
            loopTimerRef.current = setTimeout(() => {
              if (!stoppedRef.current) ringIncoming();
            }, 1100);
          };
          ringIncoming();
          break;
        }

        case "connected": {
          // Pleasant two-note ding (call picked up)
          playTone(ctx, 880, now, 0.15, 0.18, "sine");
          playTone(ctx, 1100, now + 0.18, 0.2, 0.18, "sine");
          break;
        }

        case "ended": {
          // Low brief tone (call ended)
          playTone(ctx, 360, now, 0.35, 0.18, "sine");
          break;
        }

        case "declined": {
          // Quick low double beep (call declined/busy)
          playTone(ctx, 420, now, 0.18, 0.2, "sine");
          playTone(ctx, 380, now + 0.25, 0.22, 0.2, "sine");
          break;
        }
      }
    },
    [ensureCtx, stopAudio]
  );

  return { playRingTone, stopAudio };
}
