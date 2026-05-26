import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync, spawn } from "child_process";

// ── Resolve FFmpeg/FFprobe paths (handles Replit Nix environment) ─────────────
function resolveBinaryPath(name: string): string {
  // 1. Scan PATH entries directly — fastest, no subprocess
  for (const dir of (process.env.PATH || "").split(":").filter(Boolean)) {
    try {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  // 2. Try 'which' as a secondary lookup
  try {
    const r = execFileSync("which", [name], { encoding: "utf8", timeout: 5000 }).trim();
    if (r) return r;
  } catch {}
  // 3. Last resort — let the shell find it
  return name;
}

const FFMPEG_PATH  = resolveBinaryPath("ffmpeg");
const FFPROBE_PATH = resolveBinaryPath("ffprobe");

ffmpeg.setFfmpegPath(FFMPEG_PATH);
ffmpeg.setFfprobePath(FFPROBE_PATH);

console.log(`[VideoCompress] FFmpeg  → ${FFMPEG_PATH}`);
console.log(`[VideoCompress] FFprobe → ${FFPROBE_PATH}`);

// ── Constants ─────────────────────────────────────────────────────────────────
const CLOUDINARY_LIMIT_BYTES = 100 * 1024 * 1024;   // 100 MB hard limit
const TARGET_OUTPUT_BYTES    = 80  * 1024 * 1024;    // 80 MB target (safe buffer)
const COMPRESS_THRESHOLD     = 80  * 1024 * 1024;    // compress anything > 80 MB
const AUDIO_BITRATE_KBPS     = 128;
const MIN_VIDEO_BITRATE_KBPS = 500;
const MAX_WIDTH  = 1920;
const MAX_HEIGHT = 1920;

/**
 * Probe a video file — returns duration, width, height.
 * Uses spawn directly with the resolved ffprobe path to avoid
 * fluent-ffmpeg's static ffprobe() ignoring the setFfprobePath() setting.
 */
function probeVideo(filePath: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFPROBE_PATH, [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("error", (err) => {
      reject(new Error(`FFprobe spawn failed: ${err.message}. Path used: ${FFPROBE_PATH}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`FFprobe exited with code ${code}: ${stderr.trim() || "no details"}`));
      }
      try {
        const metadata = JSON.parse(stdout || "{}");
        const videoStream = (metadata.streams || []).find((s: any) => s.codec_type === "video");
        const duration = parseFloat(metadata.format?.duration ?? "0");
        const width    = videoStream?.width  ?? 1920;
        const height   = videoStream?.height ?? 1080;
        if (duration <= 0) return reject(new Error("Could not determine video duration"));
        resolve({ duration, width, height });
      } catch (err: any) {
        reject(new Error(`FFprobe JSON parse failed: ${err.message}`));
      }
    });
  });
}

/**
 * Return a scale filter that caps resolution at MAX_WIDTH × MAX_HEIGHT
 * while preserving aspect ratio. Returns null if no downscaling needed.
 */
function scaleFilter(width: number, height: number): string | null {
  if (width <= MAX_WIDTH && height <= MAX_HEIGHT) return null;
  return width >= height ? `scale=${MAX_WIDTH}:-2` : `scale=-2:${MAX_HEIGHT}`;
}

/**
 * Compute video bitrate (kbps) needed to hit `targetBytes` for `duration` seconds.
 */
function calcBitrateKbps(targetBytes: number, duration: number): number {
  const totalBits  = targetBytes * 8;
  const audioBits  = AUDIO_BITRATE_KBPS * 1000 * duration;
  const videoBits  = totalBits - audioBits;
  return Math.max(MIN_VIDEO_BITRATE_KBPS, Math.floor(videoBits / duration / 1000));
}

/**
 * Run one FFmpeg compression pass.
 */
function runCompress(
  inputPath: string,
  outputPath: string,
  bitrateKbps: number,
  scale: string | null,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .outputOptions([
        "-c:v",      "libx264",
        "-preset",   "fast",
        "-b:v",      `${bitrateKbps}k`,
        "-maxrate",  `${bitrateKbps}k`,
        "-bufsize",  `${bitrateKbps}k`,    // tight buffer = less overshoot
        "-c:a",      "aac",
        "-b:a",      `${AUDIO_BITRATE_KBPS}k`,
        "-movflags", "+faststart",
        "-pix_fmt",  "yuv420p",
      ])
      .output(outputPath);

    if (scale) command.videoFilter(scale);

    command
      .on("progress", (prog) => {
        if (onProgress && prog.percent != null) {
          onProgress(Math.min(99, Math.round(prog.percent)));
        }
      })
      .on("end", () => resolve())
      .on("error", (err) => {
        if (fs.existsSync(outputPath)) { try { fs.unlinkSync(outputPath); } catch {} }
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}

export interface CompressResult {
  outputPath: string;
  originalBytes: number;
  compressedBytes: number;
  skipped: boolean;
}

/**
 * Compress a video to ≤ 80 MB (safe under Cloudinary's 100 MB cap).
 *
 * • Files already ≤ 80 MB are returned as-is (skipped = true).
 * • If the first compression pass still exceeds 90 MB, a second pass
 *   runs at 70% of the original bitrate to guarantee it fits.
 */
export async function compressVideo(
  inputPath: string,
  onProgress?: (pct: number) => void,
): Promise<CompressResult> {
  const originalBytes = fs.statSync(inputPath).size;

  if (originalBytes <= COMPRESS_THRESHOLD) {
    console.log(`[VideoCompress] Skipping — ${(originalBytes / 1024 / 1024).toFixed(1)} MB is already within limit`);
    return { outputPath: inputPath, originalBytes, compressedBytes: originalBytes, skipped: true };
  }

  const info  = await probeVideo(inputPath);
  const scale = scaleFilter(info.width, info.height);

  // ── Pass 1 ─────────────────────────────────────────────────────────────────
  const pass1Bitrate = calcBitrateKbps(TARGET_OUTPUT_BYTES, info.duration);
  const pass1Path    = path.join(os.tmpdir(), `uch_c1_${Date.now()}.mp4`);

  console.log(
    `[VideoCompress] Pass 1 — ${(originalBytes / 1024 / 1024).toFixed(1)} MB → target 80 MB | ` +
    `duration=${info.duration.toFixed(1)}s | bitrate=${pass1Bitrate}k | scale=${scale ?? "none"}`,
  );

  await runCompress(inputPath, pass1Path, pass1Bitrate, scale, onProgress);

  const pass1Bytes = fs.existsSync(pass1Path) ? fs.statSync(pass1Path).size : 0;
  console.log(`[VideoCompress] Pass 1 done — ${(pass1Bytes / 1024 / 1024).toFixed(1)} MB`);

  // ── Within limit? ──────────────────────────────────────────────────────────
  if (pass1Bytes > 0 && pass1Bytes <= CLOUDINARY_LIMIT_BYTES - 5 * 1024 * 1024) {
    // 5 MB safety margin under the 100 MB cap
    return { outputPath: pass1Path, originalBytes, compressedBytes: pass1Bytes, skipped: false };
  }

  // ── Pass 2 — still too big, cut bitrate to 65% ────────────────────────────
  const pass2Bitrate = Math.max(MIN_VIDEO_BITRATE_KBPS, Math.floor(pass1Bitrate * 0.65));
  const pass2Path    = path.join(os.tmpdir(), `uch_c2_${Date.now()}.mp4`);

  console.log(
    `[VideoCompress] Pass 2 — still ${(pass1Bytes / 1024 / 1024).toFixed(1)} MB, re-encoding at ${pass2Bitrate}k`,
  );

  // Clean up pass 1
  try { if (fs.existsSync(pass1Path)) fs.unlinkSync(pass1Path); } catch {}

  await runCompress(inputPath, pass2Path, pass2Bitrate, scale, onProgress);

  const pass2Bytes = fs.existsSync(pass2Path) ? fs.statSync(pass2Path).size : 0;
  console.log(`[VideoCompress] Pass 2 done — ${(pass2Bytes / 1024 / 1024).toFixed(1)} MB`);

  if (pass2Bytes === 0) {
    throw new Error("Compression produced empty output file");
  }

  if (pass2Bytes > CLOUDINARY_LIMIT_BYTES) {
    throw new Error(
      `Compressed video is still ${(pass2Bytes / 1024 / 1024).toFixed(1)} MB after two passes. ` +
      `Please trim the video or reduce its resolution before uploading.`,
    );
  }

  return { outputPath: pass2Path, originalBytes, compressedBytes: pass2Bytes, skipped: false };
}

/**
 * Delete the temporary compressed file when you're done with it.
 * Safe to call even if skipped = true.
 */
export function cleanupCompressed(result: CompressResult, originalInputPath: string): void {
  if (!result.skipped && result.outputPath !== originalInputPath) {
    try {
      if (fs.existsSync(result.outputPath)) fs.unlinkSync(result.outputPath);
    } catch {
      // best-effort
    }
  }
}
