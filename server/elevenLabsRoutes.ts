import { type Express, type Request, type Response } from "express";
import multer from "multer";

const EL_BASE = "https://api.elevenlabs.io/v1";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function elHeaders(extra?: Record<string, string>) {
  return {
    "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
    "Content-Type": "application/json",
    ...extra,
  };
}

async function elFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${EL_BASE}${path}`, {
    ...options,
    headers: { ...elHeaders(), ...(options?.headers || {}) },
  });
  return res;
}

function requireAdmin(req: Request, res: Response, next: Function) {
  const role = (req.session as any)?.userRole;
  if (role !== "admin" && role !== "super_admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

export function registerElevenLabsRoutes(app: Express) {
  // ── API Status + Subscription Info ────────────────────────────────────────
  app.get("/api/admin/elevenlabs/status", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        return res.json({ ok: false, error: "No API key configured" });
      }

      // Use /voices as the primary connectivity check (requires voices_read, broadly available)
      const voicesRes = await elFetch("/voices?page_size=1");
      if (!voicesRes.ok) {
        const err = await voicesRes.json().catch(() => ({}));
        return res.json({ ok: false, error: "ElevenLabs API error", detail: err });
      }

      // Try subscription/user info — may fail if key lacks user_read permission
      const [subRes, userRes] = await Promise.all([
        elFetch("/user/subscription").catch(() => null),
        elFetch("/user").catch(() => null),
      ]);

      const subscription = subRes?.ok ? await subRes.json().catch(() => null) : null;
      const user = userRes?.ok ? await userRes.json().catch(() => null) : null;

      return res.json({ ok: true, user, subscription, keyPresent: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── All Voices ─────────────────────────────────────────────────────────────
  app.get("/api/admin/elevenlabs/voices", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const r = await elFetch("/voices");
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Voice Settings ─────────────────────────────────────────────────────────
  app.get("/api/admin/elevenlabs/voices/:voiceId/settings", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const r = await elFetch(`/voices/${req.params.voiceId}/settings`);
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Available Models ───────────────────────────────────────────────────────
  app.get("/api/admin/elevenlabs/models", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const r = await elFetch("/models");
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Text-to-Speech ─────────────────────────────────────────────────────────
  app.post("/api/admin/elevenlabs/tts", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { voiceId, text, modelId, voiceSettings, outputFormat } = req.body;
      if (!voiceId || !text) return res.status(400).json({ error: "voiceId and text required" });

      const r = await elFetch(`/text-to-speech/${voiceId}?output_format=${outputFormat || "mp3_44100_128"}`, {
        method: "POST",
        body: JSON.stringify({
          text,
          model_id: modelId || "eleven_multilingual_v2",
          voice_settings: voiceSettings || {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: "TTS failed", detail: err });
      }

      const audioBuffer = Buffer.from(await r.arrayBuffer());
      const b64 = audioBuffer.toString("base64");
      return res.json({
        audio: b64,
        mimeType: "audio/mpeg",
        characters: text.length,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── TTS Preview (voice preview) ────────────────────────────────────────────
  app.post("/api/admin/elevenlabs/preview", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { voiceId, text } = req.body;
      if (!voiceId) return res.status(400).json({ error: "voiceId required" });

      const previewText = text || "Hallo, dit is een preview van mijn stem voor Urban Culture Hub.";
      const r = await elFetch(`/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
        method: "POST",
        body: JSON.stringify({
          text: previewText,
          model_id: "eleven_flash_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: "Preview failed", detail: err });
      }

      const audioBuffer = Buffer.from(await r.arrayBuffer());
      return res.json({ audio: audioBuffer.toString("base64"), mimeType: "audio/mpeg" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Sound Effects Generator ────────────────────────────────────────────────
  app.post("/api/admin/elevenlabs/sound-effects", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { text, durationSeconds, promptInfluence } = req.body;
      if (!text) return res.status(400).json({ error: "text required" });

      const r = await elFetch("/sound-generation", {
        method: "POST",
        body: JSON.stringify({
          text,
          duration_seconds: durationSeconds || null,
          prompt_influence: promptInfluence ?? 0.3,
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: "Sound effect generation failed", detail: err });
      }

      const audioBuffer = Buffer.from(await r.arrayBuffer());
      return res.json({ audio: audioBuffer.toString("base64"), mimeType: "audio/mpeg" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Generation History ─────────────────────────────────────────────────────
  app.get("/api/admin/elevenlabs/history", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { page_size = "30", start_after_history_item_id } = req.query as any;
      let url = `/history?page_size=${page_size}`;
      if (start_after_history_item_id) url += `&start_after_history_item_id=${start_after_history_item_id}`;
      const r = await elFetch(url);
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Get History Item Audio ─────────────────────────────────────────────────
  app.get("/api/admin/elevenlabs/history/:id/audio", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const r = await elFetch(`/history/${req.params.id}/audio`);
      if (!r.ok) return res.status(r.status).json({ error: "Not found" });
      const audioBuffer = Buffer.from(await r.arrayBuffer());
      return res.json({ audio: audioBuffer.toString("base64"), mimeType: "audio/mpeg" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Delete History Item ────────────────────────────────────────────────────
  app.delete("/api/admin/elevenlabs/history/:id", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const r = await elFetch(`/history/${req.params.id}`, { method: "DELETE" });
      const data = await r.json().catch(() => ({ ok: true }));
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Voice Cloning (Instant) ────────────────────────────────────────────────
  app.post("/api/admin/elevenlabs/voices/clone", requireAdmin as any, upload.array("files"), async (req: Request, res: Response) => {
    try {
      const { name, description, labels } = req.body;
      if (!name) return res.status(400).json({ error: "name required" });

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: "At least one audio file required" });

      const formData = new FormData();
      formData.append("name", name);
      if (description) formData.append("description", description);
      if (labels) formData.append("labels", labels);
      files.forEach(f => {
        const blob = new Blob([f.buffer], { type: f.mimetype });
        formData.append("files", blob, f.originalname);
      });

      const r = await fetch(`${EL_BASE}/voices/add`, {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
        body: formData,
      });

      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Delete Voice ───────────────────────────────────────────────────────────
  app.delete("/api/admin/elevenlabs/voices/:voiceId", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const r = await elFetch(`/voices/${req.params.voiceId}`, { method: "DELETE" });
      const data = await r.json().catch(() => ({ ok: true }));
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Speech-to-Speech ────────────────────────────────────────────────────────
  app.post("/api/admin/elevenlabs/speech-to-speech", requireAdmin as any, upload.single("audio"), async (req: Request, res: Response) => {
    try {
      const { voiceId, modelId } = req.body;
      const file = req.file;
      if (!voiceId || !file) return res.status(400).json({ error: "voiceId and audio file required" });

      const formData = new FormData();
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append("audio", blob, file.originalname);
      if (modelId) formData.append("model_id", modelId);

      const r = await fetch(`${EL_BASE}/speech-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
        body: formData,
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: "Speech-to-speech failed", detail: err });
      }

      const audioBuffer = Buffer.from(await r.arrayBuffer());
      return res.json({ audio: audioBuffer.toString("base64"), mimeType: "audio/mpeg" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Voice Design ────────────────────────────────────────────────────────────
  app.post("/api/admin/elevenlabs/voice-design/generate", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { voiceDescription, text, autoGenerateText } = req.body;
      if (!voiceDescription) return res.status(400).json({ error: "voiceDescription required" });

      const r = await elFetch("/voice-generation/generate-voice", {
        method: "POST",
        body: JSON.stringify({
          voice_description: voiceDescription,
          text: text || "Hallo, dit is een preview van een AI-stem voor Urban Culture Hub.",
          auto_generate_text: autoGenerateText ?? false,
        }),
      });

      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: "Voice design failed", detail: errData });
      }

      const data = await r.json();
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Dubbing ─────────────────────────────────────────────────────────────────
  app.post("/api/admin/elevenlabs/dubbing", requireAdmin as any, upload.single("file"), async (req: Request, res: Response) => {
    try {
      const { name, targetLang, sourceUrl, numSpeakers } = req.body;
      if (!targetLang) return res.status(400).json({ error: "targetLang required" });
      if (!sourceUrl && !req.file) return res.status(400).json({ error: "sourceUrl or file required" });

      const formData = new FormData();
      formData.append("target_lang", targetLang);
      if (name) formData.append("name", name);
      if (numSpeakers) formData.append("num_speakers", numSpeakers);
      if (sourceUrl) formData.append("source_url", sourceUrl);
      if (req.file) {
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
        formData.append("file", blob, req.file.originalname);
      }

      const r = await fetch(`${EL_BASE}/dubbing`, {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
        body: formData,
      });

      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Save Voice Design to Library ─────────────────────────────────────────
  app.post("/api/admin/elevenlabs/voice-design/save", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { generated_voice_id, voice_name, voice_description } = req.body;
      if (!generated_voice_id || !voice_name) {
        return res.status(400).json({ error: "generated_voice_id and voice_name required" });
      }
      const r = await elFetch("/voice-generation/create-voice", {
        method: "POST",
        body: JSON.stringify({ generated_voice_id, voice_name, voice_description }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Edit Voice Name/Description ───────────────────────────────────────────
  app.patch("/api/admin/elevenlabs/voices/:voiceId", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const { name, description, labels } = req.body;
      const r = await elFetch(`/voices/${req.params.voiceId}/edit`, {
        method: "POST",
        body: JSON.stringify({ name, description, labels }),
      });
      const data = await r.json().catch(() => ({ ok: true }));
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Download History Item Audio ────────────────────────────────────────────
  app.get("/api/admin/elevenlabs/history/:id/download", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const r = await elFetch(`/history/${req.params.id}/audio`);
      if (!r.ok) return res.status(r.status).json({ error: "Not found" });
      const audioBuffer = Buffer.from(await r.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="elevenlabs-${req.params.id}.mp3"`);
      return res.send(audioBuffer);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Get Dubbing Status ──────────────────────────────────────────────────────
  app.get("/api/admin/elevenlabs/dubbing/:dubbingId", requireAdmin as any, async (req: Request, res: Response) => {
    try {
      const r = await elFetch(`/dubbing/${req.params.dubbingId}`);
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
