import { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { spawn, execFileSync } from "child_process";
import { randomUUID } from "crypto";

function resolveBinary(name: string): string {
  // 1. Scan PATH entries directly — no subprocess required
  for (const dir of (process.env.PATH || "").split(":").filter(Boolean)) {
    try {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) return full;
    } catch {}
  }
  // 2. Try which as fallback
  try { return execFileSync("which", [name], { encoding: "utf8", timeout: 5000 }).trim() || name; }
  catch { return name; }
}

const FFMPEG  = resolveBinary("ffmpeg");
const FFPROBE = resolveBinary("ffprobe");

interface VideoJob {
  id: string;
  status: "queued" | "processing" | "done" | "error";
  progress: number;
  message: string;
  outputUrl?: string;
  error?: string;
  createdAt: Date;
}

const jobs = new Map<string, VideoJob>();

function setJob(id: string, updates: Partial<VideoJob>) {
  const j = jobs.get(id);
  if (j) Object.assign(j, updates);
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFPROBE, ["-v", "quiet", "-print_format", "json", "-show_format", filePath]);
    let out = "";
    p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    p.on("close", (code: number) => {
      if (code !== 0) return reject(new Error("ffprobe failed"));
      try { resolve(parseFloat(JSON.parse(out).format?.duration ?? "0")); }
      catch { reject(new Error("ffprobe parse error")); }
    });
  });
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args);
    let stderr = "";
    p.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    p.on("error", (e: Error) => reject(new Error(`FFmpeg spawn: ${e.message}`)));
    p.on("close", (code: number) => {
      if (code !== 0) reject(new Error(`FFmpeg[${code}]: ${stderr.slice(-500)}`));
      else resolve();
    });
  });
}

interface ClipSpec { url: string; startSec: number; endSec: number; }
interface TextOverlay { text: string; startSec: number; endSec: number; position: "top" | "center" | "bottom"; color: string; fontSize: number; }
interface ProcessSpec {
  clips: ClipSpec[];
  transition: "cut" | "fade" | "dissolve";
  transitionDuration?: number;
  textOverlays?: TextOverlay[];
  subtitlesFile?: string;
}

async function processVideoJob(jobId: string, spec: ProcessSpec): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "uch-vid-"));
  try {
    setJob(jobId, { status: "processing", progress: 5, message: "Clips downloaden..." });

    const clipPaths: string[] = [];
    for (let i = 0; i < spec.clips.length; i++) {
      const dest = path.join(tmpDir, `raw_${i}.mp4`);
      await downloadFile(spec.clips[i].url, dest);
      clipPaths.push(dest);
      setJob(jobId, { progress: 5 + Math.round((i + 1) / spec.clips.length * 20), message: `Clip ${i + 1}/${spec.clips.length} gedownload` });
    }

    setJob(jobId, { progress: 28, message: "Clips normaliseren en trimmen..." });
    const normedPaths: string[] = [];
    for (let i = 0; i < clipPaths.length; i++) {
      const clip = spec.clips[i];
      const out = path.join(tmpDir, `norm_${i}.mp4`);
      const args = ["-y"];
      if (clip.startSec > 0) args.push("-ss", String(clip.startSec));
      args.push("-i", clipPaths[i]);
      if (clip.endSec > 0 && clip.endSec > clip.startSec) args.push("-t", String(clip.endSec - clip.startSec));
      args.push(
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1",
        "-r", "30",
        "-c:v", "libx264", "-preset", "fast",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        out,
      );
      await runFFmpeg(args);
      normedPaths.push(out);
      setJob(jobId, { progress: 28 + Math.round((i + 1) / clipPaths.length * 22) });
    }

    setJob(jobId, { progress: 52, message: "Clips samenvoegen..." });
    const mergedPath = path.join(tmpDir, "merged.mp4");
    if (normedPaths.length === 1) {
      fs.copyFileSync(normedPaths[0], mergedPath);
    } else if (spec.transition === "cut") {
      const listFile = path.join(tmpDir, "list.txt");
      fs.writeFileSync(listFile, normedPaths.map(p => `file '${p}'`).join("\n"));
      await runFFmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile,
        "-c:v", "libx264", "-preset", "fast", "-c:a", "aac", "-pix_fmt", "yuv420p", mergedPath]);
    } else {
      const td = spec.transitionDuration ?? 0.5;
      const durations: number[] = [];
      for (const p of normedPaths) durations.push(await getVideoDuration(p));
      const filterParts: string[] = [];
      let offsetSoFar = 0;
      for (let i = 0; i < normedPaths.length - 1; i++) {
        const inputA = i === 0 ? `[${i}:v]` : `[vx${i - 1}]`;
        const inputB = `[${i + 1}:v]`;
        const output = i === normedPaths.length - 2 ? "[vout]" : `[vx${i}]`;
        offsetSoFar += durations[i] - td;
        filterParts.push(`${inputA}${inputB}xfade=transition=${spec.transition === "fade" ? "fade" : "dissolve"}:duration=${td}:offset=${Math.max(0, offsetSoFar).toFixed(2)}${output}`);
      }
      const audioParts = normedPaths.map((_, i) => `[${i}:a]`).join("");
      filterParts.push(`${audioParts}concat=n=${normedPaths.length}:v=0:a=1[aout]`);
      const ffArgs = ["-y"];
      for (const p of normedPaths) ffArgs.push("-i", p);
      ffArgs.push("-filter_complex", filterParts.join("; "), "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "fast", "-c:a", "aac", "-pix_fmt", "yuv420p", mergedPath);
      try {
        await runFFmpeg(ffArgs);
      } catch {
        const listFile = path.join(tmpDir, "list.txt");
        fs.writeFileSync(listFile, normedPaths.map(p => `file '${p}'`).join("\n"));
        await runFFmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile,
          "-c:v", "libx264", "-preset", "fast", "-c:a", "aac", "-pix_fmt", "yuv420p", mergedPath]);
      }
    }

    setJob(jobId, { progress: 68, message: "Tekst overlays toevoegen..." });
    let overlaidPath = path.join(tmpDir, "overlaid.mp4");
    if (spec.textOverlays && spec.textOverlays.length > 0) {
      const drawFilters = spec.textOverlays.map(ov => {
        const y = ov.position === "top" ? "80" : ov.position === "center" ? "(h-text_h)/2" : "h-text_h-80";
        const safeText = ov.text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
        const enable = ov.endSec > ov.startSec
          ? `enable='between(t,${ov.startSec},${ov.endSec})'`
          : `enable='gte(t,${ov.startSec})'`;
        return `drawtext=text='${safeText}':fontsize=${ov.fontSize || 48}:fontcolor=${ov.color || "white"}:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.45:boxborderw=10:${enable}`;
      });
      try {
        await runFFmpeg(["-y", "-i", mergedPath, "-vf", drawFilters.join(","),
          "-c:v", "libx264", "-preset", "fast", "-c:a", "copy", "-pix_fmt", "yuv420p", overlaidPath]);
      } catch {
        fs.copyFileSync(mergedPath, overlaidPath);
      }
    } else {
      fs.copyFileSync(mergedPath, overlaidPath);
    }

    setJob(jobId, { progress: 78, message: "Captions inbranden..." });
    let finalPath = path.join(tmpDir, "final.mp4");
    if (spec.subtitlesFile?.trim()) {
      const srtPath = path.join(tmpDir, "subs.srt");
      fs.writeFileSync(srtPath, spec.subtitlesFile, "utf8");
      const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
      try {
        await runFFmpeg(["-y", "-i", overlaidPath,
          "-vf", `subtitles='${escapedSrt}':force_style='FontSize=22,PrimaryColour=&Hffffff&,OutlineColour=&H000000&,Outline=2,Bold=1,Alignment=2,MarginV=60'`,
          "-c:v", "libx264", "-preset", "fast", "-c:a", "copy", "-pix_fmt", "yuv420p", finalPath]);
      } catch {
        fs.copyFileSync(overlaidPath, finalPath);
      }
    } else {
      fs.copyFileSync(overlaidPath, finalPath);
    }

    setJob(jobId, { progress: 88, message: "Uploaden naar cloud..." });
    const { uploadImage } = await import("./cloudinary");
    const outputUrl = await uploadImage(finalPath, "uch_video_editor", "video");

    setJob(jobId, { status: "done", progress: 100, message: "Klaar! ✅", outputUrl });
  } catch (err: any) {
    console.error("[VideoEditor] Job failed:", err.message);
    setJob(jobId, { status: "error", progress: 0, message: err.message, error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

export function registerVideoEditorRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: Function) => void,
): void {
  app.post("/api/video/process", requireAdmin, async (req: Request, res: Response) => {
    try {
      const spec = req.body as ProcessSpec;
      if (!spec.clips?.length) return res.status(400).json({ error: "At least one clip required" });
      const jobId = randomUUID();
      jobs.set(jobId, { id: jobId, status: "queued", progress: 0, message: "In wachtrij...", createdAt: new Date() });
      processVideoJob(jobId, spec);
      res.json({ jobId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/video/jobs/:jobId", requireAdmin, (req: Request, res: Response) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  });

  app.post("/api/video/transcribe", requireAdmin, async (req: Request, res: Response) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "uch-tr-"));
    try {
      const { videoUrl } = req.body as { videoUrl: string };
      if (!videoUrl) return res.status(400).json({ error: "videoUrl required" });
      const vidPath = path.join(tmpDir, "input.mp4");
      const audioPath = path.join(tmpDir, "audio.mp3");
      await downloadFile(videoUrl, vidPath);
      await runFFmpeg(["-y", "-i", vidPath, "-vn", "-acodec", "libmp3lame", "-ab", "64k", audioPath]);
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const audioBuffer = fs.readFileSync(audioPath);
      const audioFile = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });
      const result = await client.audio.transcriptions.create({ file: audioFile, model: "whisper-1", response_format: "srt" });
      res.json({ srt: result, success: true });
    } catch (err: any) {
      console.error("[VideoEditor] Transcribe error:", err.message);
      res.status(500).json({ error: err.message });
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });
}
