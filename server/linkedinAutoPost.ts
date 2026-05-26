/**
 * LinkedIn Auto-Post Scheduler — Urban Culture Hub
 * AI-powered daily posting engine.
 * Content: Claude Opus 4.6 (Anthropic) — latest & most capable AI
 * Images: GPT Image 1 (OpenAI) — highest quality image model
 * Flow: generate post (Claude) → generate image prompt → GPT Image 1 → upload to LinkedIn → post
 */

import { db } from "./db";
import { linkedinAutoPostSettings, linkedinConnections, linkedinPosts, linkedinBrandIntel, linkedinPostExamples } from "../shared/schema";
import { eq, sql, desc } from "drizzle-orm";
import OpenAI from "openai";
import { aiChat, resolveImageParams } from "./aiRouter";
import axios from "axios";
import { uploadImage } from "./cloudinary";
import { buildFactsBlock } from "./linkedinPlatformFacts";

// LinkedIn text generation routes through the central AI router (role: "linkedin").
console.log(`[LinkedIn AI] Routing through central aiRouter (role=linkedin)`);

// GPT Image 1 — OpenAI's latest image model (direct API required, not proxy)
const openaiDirect = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "missing",
  baseURL: "https://api.openai.com/v1",
});

// (openai proxy instance removed — Claude handles all text; openaiDirect handles images)

const CHECK_INTERVAL_MS = 60 * 1000;

// ── Author & Product Context ────────────────────────────────────────────────
const AUTHOR_PROFILE = `
AUTHOR: Riki Almouti
- Founder, app developer, and entrepreneur based in the Netherlands
- Built Urban Culture Hub — a platform connecting urban sports, culture, and lifestyle
- Also founder of Dance Healthy and Stichting Coffee & Dance
- Organized large cultural events: "Back to the Street", "TurboVision"
- Moved from Syria to the Netherlands ~10 years ago; understands both the immigrant community and the Dutch landscape
- Previously a professional dancer — now a platform builder and community architect
- Works with municipalities, sports organizations, artists, venue owners, and brands
- Languages: Arabic, English, Dutch

VOICE & WRITING STYLE:
- Writes as a founder who is also selling — confident, clear, visionary
- Direct and human — no corporate jargon, no empty buzzwords
- Shows the real size of the opportunity without overhyping
- Speaks as someone who built something real and is looking for real partners
- First-person perspective ("I built...", "We launched...", "The platform now...")
- Short punchy paragraphs, clear logic, strong close
`;

const APP_PROFILE = `
THE APP — URBAN CULTURE HUB:
Website: https://urbanculturehub.nl | iOS App Store available

WHAT IT IS:
A comprehensive lifestyle and sports platform built for the urban generation.
It connects people to sports, activities, venues, events, and communities — all in one place.

SCALE & FEATURES:
- 3,000+ events in the database (sports, culture, fitness, music, lifestyle)
- 500+ venues mapped across the Netherlands (gyms, courts, dance studios, creative spaces, cafés, parks)
- Interactive map: find any spot for any activity near you
- Live booking and reservation system (free and paid)
- Built-in AI assistant for personalized recommendations and content
- Community feed: posts, videos, reels — your city's social layer
- Multi-role signup system:
  * Athletes & sports enthusiasts — find courts, clubs, and teammates
  * Artists & creatives — showcase work, find spaces, join events
  * Venue owners — manage bookings, fill schedules, reach new audiences
  * Municipalities & schools — discover talent, organize events, reach youth
  * General users — explore your city, stay active, connect locally
- Ratings, reviews, user profiles with customizable themes

ACTIVITIES COVERED (examples — platform covers all urban lifestyle):
Sports: padel, basketball, football, table tennis, tennis, bouldering, fitness, calisthenics, parkour, swimming, skateboarding, BMX, yoga, dance (hip-hop, breakdance, house, salsa), martial arts
Culture & lifestyle: music events, art exhibitions, street culture, community festivals, nightlife, specialty cafés, wellness, coworking creative spaces
All ages, all levels, all backgrounds.

BUSINESS OPPORTUNITY:
- First-mover platform in Netherlands connecting urban sports + culture + community
- Multiple monetization layers: venue subscriptions, event tickets, premium user plans, sponsored content
- Direct access to an engaged, active, culturally-rich demographic (16–45)
- Partnership model: brands, sports organizations, municipalities, media partners, sponsors
- Expansion roadmap: Belgium, Germany, and broader EU market
`;

// ── Post Types ──────────────────────────────────────────────────────────────
export const POST_TYPES = [
  {
    id: "app_pitch",
    name: "App Power Pitch",
    instruction: `Write a high-impact pitch post promoting Urban Culture Hub. Position it as the most powerful platform connecting sports, culture, and urban lifestyle in the Netherlands. Show scale (3,000+ events, 500+ venues, multiple activity types). The angle: this is not a niche app — this is the platform for an entire generation. Mention 2–3 types of activities or sports briefly to show breadth. Write as a confident founder, not a marketer. End with a strong CTA.`,
    imageStyle: "A dynamic urban sports and lifestyle collage: people playing padel, dancing, climbing walls, and exploring a vibrant city. Modern, energetic, diverse community feel. Professional photography style, golden hour lighting, Amsterdam cityscape in background.",
  },
  {
    id: "sponsor_pitch",
    name: "Sponsor & Partner Pitch",
    instruction: `Write a LinkedIn post specifically designed to attract brand sponsors and commercial partners. Position Urban Culture Hub as a direct channel to an engaged, active, urban demographic (16–45). Mention the combination of sports, culture, lifestyle, and community. Talk about what a partnership looks like: featured placements, sponsored events, co-branded activations. Be direct about the business opportunity. End with "Let's talk" or similar.`,
    imageStyle: "Professional business partnership visual: two people shaking hands in a modern, vibrant urban setting with sports facilities and cultural venues visible. Clean, corporate yet urban aesthetic. Brand collaboration concept.",
  },
  {
    id: "municipality",
    name: "Municipality & Public Sector",
    instruction: `Write a post aimed at municipalities, city councils, schools, and public-sector decision-makers. Show how Urban Culture Hub solves a real urban challenge: activating youth, connecting communities, making culture accessible. Mention talent discovery, youth program organization, cultural event management. Position Riki as someone who has already worked with municipalities successfully. End with an invitation to collaborate.`,
    imageStyle: "Vibrant city youth engagement scene: diverse young people participating in sports, arts, and community activities in a modern urban park or public space. Dutch city aesthetic, inclusive and energetic atmosphere.",
  },
  {
    id: "founder_story",
    name: "Founder Story",
    instruction: `Write a personal founder story post from Riki's perspective. He built an app covering the entire urban lifestyle space — sports, culture, events, venues — from scratch. He came from Syria, was a professional dancer, had a career-ending hand injury, and built platforms instead of stopping. Write with emotional weight but not pity — this is about the mission. Short, real, powerful paragraphs. End with where the platform is now.`,
    imageStyle: "Inspiring founder journey visual: a determined person at a laptop or smartphone, surrounded by imagery of dance, sports, and urban culture. Warm, authentic atmosphere. Story of transformation and building something from nothing.",
  },
  {
    id: "investor_signal",
    name: "Investor & Growth Signal",
    instruction: `Write a post that signals growth, traction, and opportunity — the kind that gets an investor's attention. Mention scale (3,000+ events, 500+ venues), the multi-role model, diverse revenue streams, and EU expansion roadmap. Use the language of someone building something at scale. Be specific but not dry. Show confidence in the vision. End with an open door for conversations.`,
    imageStyle: "Growth and scale concept: upward trending graph overlaid on a vibrant urban sports/culture scene. Modern infographic style with real people in action. Startup energy meets real-world impact. Professional yet dynamic.",
  },
  {
    id: "community_impact",
    name: "Community & Social Impact",
    instruction: `Write a post showing the human side of Urban Culture Hub — the real impact on people. Focus on what happens when you give an urban community the right tools: athletes find courts, artists find stages, youth find structure, people find each other. Show the variety of activities as examples of breadth. Show this is more than an app — it's infrastructure for a community. Warm, grounded, real.`,
    imageStyle: "Heartwarming community gathering: diverse group of people of all ages enjoying urban activities together — playing sports, making art, socializing — in a beautiful outdoor urban setting. Authentic joy, real connection, vibrant colors.",
  },
];

// ── Audience map ────────────────────────────────────────────────────────────
const AUDIENCE_CONTEXT: Record<string, string> = {
  general: "Write for a general LinkedIn audience — professionals, curious people, potential users.",
  sponsors: "Write specifically for brand managers, marketing directors, and sponsorship decision-makers at companies.",
  investors: "Write for investors, angels, VCs, and people who evaluate startups and growth platforms.",
  municipalities: "Write for policy makers, civil servants, aldermen, cultural program managers, and school directors.",
  media: "Write for journalists, editors, content creators, and media partners who might cover or amplify the story.",
  sports_orgs: "Write for sports federation managers, club directors, sports venue operators, and fitness brand leaders.",
};

// ── State ───────────────────────────────────────────────────────────────────
const state = {
  timer: null as NodeJS.Timeout | null,
  running: false,
  lastCheck: null as Date | null,
  lastError: null as { at: Date; message: string } | null,
  recentPosts: [] as { adminUserId: number; content: string; postType: string; imageUrl?: string; postedAt: Date; status: string }[],
  // Per-user diagnostics so the dashboard can show WHY the scheduler did or didn't fire on the last tick.
  perUserStatus: new Map<number, { lastCheckedAt: Date; nowInTz: string; targetTime: string; action: "fired" | "queued_for_approval" | "skipped" | "error"; reason: string }>(),
};

function recordUserStatus(adminUserId: number, info: { nowInTz: string; targetTime: string; action: "fired" | "queued_for_approval" | "skipped" | "error"; reason: string }): void {
  state.perUserStatus.set(adminUserId, { lastCheckedAt: new Date(), ...info });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function getNowInTimezone(tz: string): { HH: string; MM: string; dateStr: string } {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour: "2-digit", minute: "2-digit",
      year: "numeric", month: "2-digit", day: "2-digit", hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
    return { HH: get("hour"), MM: get("minute"), dateStr: `${get("year")}-${get("month")}-${get("day")}` };
  } catch {
    const now = new Date();
    return {
      HH: String(now.getHours()).padStart(2, "0"),
      MM: String(now.getMinutes()).padStart(2, "0"),
      dateStr: now.toISOString().split("T")[0],
    };
  }
}

function alreadyPostedToday(lastPostedAt: Date | null, timezone: string): boolean {
  if (!lastPostedAt) return false;
  const { dateStr } = getNowInTimezone(timezone);
  const lastDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(lastPostedAt);
  const [d, m, y] = lastDate.split("/");
  return `${y}-${m}-${d}` === dateStr;
}

// ── AI Image Generation ─────────────────────────────────────────────────────
async function generateImagePrompt(postContent: string, postType: POST_TYPE_ID, baseStyle: string, language: string): Promise<string> {
  const langNote = language === "nl" ? "The post is in Dutch (Netherlands)." : "The post is in English.";
  // Use Claude Opus 4.6 for the image prompt too — best creative prompt writing
  const msg = await aiChat({
    role: "linkedin",
    maxTokens: 200,
    messages: [{
      role: "user",
      content: `Create an image-generation prompt for a LinkedIn post promoting Urban Culture Hub — a platform connecting urban sports, culture, and lifestyle in the Netherlands. The prompt will be sent to a state-of-the-art image model (such as GPT Image 1 or DALL·E 3), so write it as a concrete visual description that any modern image model can render well.

${langNote}
Post type: ${postType}
Base visual style: ${baseStyle}
Post excerpt: "${postContent.slice(0, 300)}"

Rules:
- No text or words in the image
- Professional quality suitable for LinkedIn
- Modern, clean, visually striking
- Represents urban lifestyle, sports, culture, or community in the Netherlands
- Do NOT show graffiti as a primary focus — keep it broad
- Photorealistic or cinematic quality

Write ONLY the image prompt (2-4 sentences), nothing else.`,
    }],
  });
  return msg.text.trim() || baseStyle;
}

type POST_TYPE_ID = "app_pitch" | "sponsor_pitch" | "municipality" | "founder_story" | "investor_signal" | "community_impact";

async function generatePostImage(postContent: string, postType: string, baseStyle: string, language: string): Promise<{ dalleUrl: string; cloudinaryUrl?: string } | null> {
  try {
    const prompt = await generateImagePrompt(postContent, postType as POST_TYPE_ID, baseStyle, language);

    // Read the admin-configured image model (set via /admin/ai-control). Falls back to gpt-image-1.
    const { model, size, quality } = await resolveImageParams();
    console.log(`🎨 [${model} ${size} ${quality}] image prompt: ${prompt.slice(0, 100)}...`);

    // Build provider-specific request. gpt-image-1 returns b64_json by default; dall-e-* needs response_format=b64_json.
    const req: any = { model, prompt, n: 1, size };
    if (model === "gpt-image-1") {
      req.quality = quality; // low | medium | high | auto
    } else if (model === "dall-e-3") {
      req.quality = quality === "hd" ? "hd" : "standard";
      req.response_format = "b64_json";
    } else if (model === "dall-e-2") {
      req.response_format = "b64_json";
      // dall-e-2 only supports square sizes; force a safe one if landscape was requested
      if (!["256x256", "512x512", "1024x1024"].includes(size)) req.size = "1024x1024";
    }

    const imgResp = await openaiDirect.images.generate(req);

    // All three return b64_json; convert to data URL for upload
    const b64 = (imgResp.data[0] as any)?.b64_json;
    if (!b64) {
      // dall-e-3 may also return a `url` if response_format wasn't honored — fall through gracefully
      const fallbackUrl = (imgResp.data[0] as any)?.url;
      if (fallbackUrl) {
        console.log(`🎨 [${model}] returned URL (no b64), using directly`);
        return { dalleUrl: fallbackUrl, cloudinaryUrl: undefined };
      }
      return null;
    }

    const dataUrl = `data:image/png;base64,${b64}`;

    // Upload to Cloudinary for a permanent public URL (required for LinkedIn)
    let cloudinaryUrl: string | undefined;
    try {
      const uploadResult = await uploadImage(dataUrl, "linkedin-posts/ai-images");
      if (uploadResult.success && uploadResult.url) cloudinaryUrl = uploadResult.url;
    } catch (e) {
      console.warn("Cloudinary upload failed (non-fatal):", (e as Error).message);
    }

    // Use Cloudinary URL (permanent) or fall back to the data URL
    const finalUrl = cloudinaryUrl || dataUrl;
    return { dalleUrl: finalUrl, cloudinaryUrl };
  } catch (err: any) {
    console.error("GPT Image 1 generation failed (non-fatal):", err.message);
    return null;
  }
}

// ── LinkedIn Image Upload (register → upload binary → get asset URN) ────────
async function uploadImageToLinkedIn(imageUrl: string, accessToken: string, linkedinId: string): Promise<string | null> {
  try {
    // Step 1: Register upload
    const registerRes = await axios.post(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${linkedinId}`,
          serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    const uploadUrl = registerRes.data?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
    const assetUrn = registerRes.data?.value?.asset;
    if (!uploadUrl || !assetUrn) {
      console.warn("LinkedIn register upload: missing uploadUrl or asset URN");
      return null;
    }

    // Step 2: Download the DALL-E image as binary
    const imgRes = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 30000 });
    const imageBuffer = Buffer.from(imgRes.data);

    // Step 3: Upload binary to LinkedIn
    await axios.put(uploadUrl, imageBuffer, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/jpeg",
      },
      maxBodyLength: Infinity,
    });

    console.log(`✅ LinkedIn image uploaded: ${assetUrn}`);
    return assetUrn;
  } catch (err: any) {
    console.error("LinkedIn image upload failed (non-fatal):", err?.response?.data || err.message);
    return null;
  }
}

// ── Post to LinkedIn (text-only or with image) ──────────────────────────────
async function postToLinkedIn(
  accessToken: string,
  linkedinId: string,
  content: string,
  imageAssetUrn?: string | null
): Promise<string> {
  const body: any = {
    author: `urn:li:person:${linkedinId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content },
        shareMediaCategory: imageAssetUrn ? "IMAGE" : "NONE",
        ...(imageAssetUrn ? {
          media: [{
            status: "READY",
            media: imageAssetUrn,
            title: { text: "Urban Culture Hub" },
          }],
        } : {}),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await axios.post("https://api.linkedin.com/v2/ugcPosts", body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  return res.headers["x-restli-id"] || res.data?.id || "posted";
}

// ── Post content generation ─────────────────────────────────────────────────
async function generatePostContent(settings: {
  topics: string[];
  tone: string;
  template: string;
  includeHashtags: boolean;
  includeCta: boolean;
  language: string;
  targetAudience?: string;
  customContext?: string;
  postCount: number;
  adminUserId?: number;
}): Promise<{ content: string; postType: string; imageStyle: string; featureId: string | null }> {

  const idx = settings.template === "auto"
    ? settings.postCount % POST_TYPES.length
    : Math.max(0, POST_TYPES.findIndex(p => p.id === settings.template));
  const selectedType = POST_TYPES[idx] ?? POST_TYPES[settings.postCount % POST_TYPES.length];

  // ── Pull admin-trained brand intel + few-shot examples (best-effort) ──
  let intelBlock = "";
  let goldBlock = "";
  let avoidBlock = "";
  if (settings.adminUserId) {
    try {
      const [intel] = await db.select().from(linkedinBrandIntel)
        .where(eq(linkedinBrandIntel.adminUserId, settings.adminUserId)).limit(1);
      if (intel) {
        const parts: string[] = [];
        if (intel.brandStory) parts.push(`[BRAND STORY — admin-written]\n${intel.brandStory}`);
        if (intel.voiceRules?.length) parts.push(`[VOICE RULES — must obey]\n${intel.voiceRules.map((r: string) => "• " + r).join("\n")}`);
        if (intel.doNotSay?.length) parts.push(`[DO NOT SAY — never use]\n${intel.doNotSay.map((r: string) => "• " + r).join("\n")}`);
        if (intel.topicsLove?.length) parts.push(`[TOPICS WE LOVE]\n${intel.topicsLove.join(", ")}`);
        if (intel.topicsAvoid?.length) parts.push(`[TOPICS WE AVOID]\n${intel.topicsAvoid.join(", ")}`);
        if (intel.signaturePhrases?.length) parts.push(`[SIGNATURE PHRASES]\n${intel.signaturePhrases.map((r: string) => '"' + r + '"').join("\n")}`);
        if (intel.audienceNotes) parts.push(`[AUDIENCE NOTES]\n${intel.audienceNotes}`);
        if (intel.preferredHashtags?.length) parts.push(`[PREFERRED HASHTAGS — rotate from these]\n${intel.preferredHashtags.join(" ")}`);
        if (parts.length) intelBlock = `\n\n────────── ADMIN-TRAINED BRAND INTEL (highest priority) ──────────\n${parts.join("\n\n")}\n──────────────────────────────────────────────────────────────────`;
      }
      // 2 random gold + 1 avoid example for few-shot
      const golds = await db.select().from(linkedinPostExamples)
        .where(sql`${linkedinPostExamples.adminUserId} = ${settings.adminUserId} AND ${linkedinPostExamples.kind} = 'gold'`)
        .orderBy(sql`RANDOM()`).limit(2);
      if (golds.length) {
        goldBlock = `\n\n[GOLD EXAMPLES — admin marked these as the ideal voice; imitate their cadence]\n${golds.map((g, i) => `--- GOLD #${i + 1} ---\n${g.content}`).join("\n\n")}`;
      }
      const avoids = await db.select().from(linkedinPostExamples)
        .where(sql`${linkedinPostExamples.adminUserId} = ${settings.adminUserId} AND ${linkedinPostExamples.kind} = 'avoid'`)
        .limit(1);
      if (avoids.length) {
        avoidBlock = `\n\n[AVOID EXAMPLE — admin marked as off-brand; never write like this]\n${avoids[0].content}`;
      }
      // Bump usage counts so we rotate fairly
      const usedIds = [...golds.map(g => g.id), ...avoids.map(a => a.id)];
      if (usedIds.length) {
        await db.execute(sql`UPDATE linkedin_post_examples SET usage_count = usage_count + 1 WHERE id IN (${sql.join(usedIds.map(id => sql`${id}`), sql`, `)})`).catch(() => {});
      }
    } catch (err) {
      console.warn("[LinkedIn AI] brand intel load failed (non-fatal):", (err as any)?.message);
    }
  }

  const audience = settings.targetAudience || "general";
  const audienceCtx = AUDIENCE_CONTEXT[audience] || AUDIENCE_CONTEXT.general;

  const topicFocus = settings.topics.length > 0
    ? `\nCUSTOM FOCUS TOPICS: Weave these in naturally: ${settings.topics.join(", ")}.`
    : "";

  const customCtx = settings.customContext?.trim()
    ? `\nADDITIONAL CONTEXT: ${settings.customContext}`
    : "";

  const toneGuide: Record<string, string> = {
    engaging: "compelling and draws the reader in — makes them want to know more",
    professional: "authoritative and business-credible — speaks to decision-makers",
    casual: "human and approachable — like talking to a real person",
    inspiring: "visionary and motivating — shows what's possible",
    sales: "direct and confident — you believe in what you're selling and you show it",
  };

  const lang = settings.language === "nl" ? "Dutch" : "English";
  const tone = toneGuide[settings.tone] || toneGuide.engaging;

  const ctaOptions = [
    "Explore the platform: urbanculturehub.nl",
    "Download Urban Culture Hub on the App Store",
    "Learn more at urbanculturehub.nl",
    "Join the platform: urbanculturehub.nl",
    "Let's talk — DM me or visit urbanculturehub.nl",
    "See it for yourself: urbanculturehub.nl",
  ];
  const ctaChoice = ctaOptions[settings.postCount % ctaOptions.length];

  // ── LIVE PLATFORM BRAIN — real numbers + feature graph + rotating angle ──
  // Passing adminUserId enables angle rotation (avoid topics this admin used in last 8 posts)
  const factsBlock = await buildFactsBlock({
    adminUserId: settings.adminUserId,
    suggestAngle: true,
  }).catch((err) => {
    console.warn("[LinkedIn AI] platform facts load failed (non-fatal):", err?.message);
    return { text: "", suggestedFeatureId: null as string | null, toString() { return ""; } };
  });
  const featureId = factsBlock.suggestedFeatureId ?? null;

  const systemPrompt = `You are writing LinkedIn posts for Riki Almouti — founder and developer of Urban Culture Hub.

${AUTHOR_PROFILE}
${factsBlock}
${intelBlock}${goldBlock}${avoidBlock}

YOUR MISSION: Promote Urban Culture Hub. Attract sponsors, partners, investors, municipalities. Show the platform's power. Drive people to urbanculturehub.nl.

WRITING RULES:
- Write in ${lang}
- First sentence is the HOOK — stop the scroll. Bold, specific, or surprising.
- Max 1,300 characters total
- Short paragraphs: 1–3 sentences. Never a wall of text.
- Tone: ${tone}
- No emojis (or max 1 if it genuinely fits)
- No corporate buzzwords ("synergy", "leverage", "ecosystem" used unnaturally)
- Write like a human, not a press release
- Output ONLY the post text — no title, no label, no prefix
- Do NOT focus on graffiti — keep it broad: sports, lifestyle, culture
- Audience: ${audienceCtx}
- The ADMIN-TRAINED BRAND INTEL above (if present) is the highest authority — it overrides any default rule that conflicts with it.
- The GOLD EXAMPLES (if present) show the cadence, length, and energy you should imitate.`;

  const userPrompt = `Write LinkedIn post #${settings.postCount + 1}.

POST TYPE: ${selectedType.name}
INSTRUCTION: ${selectedType.instruction}
${topicFocus}${customCtx}

${settings.includeHashtags ? "Add 4–5 powerful, relevant hashtags at the end on their own line." : "No hashtags."}
${settings.includeCta ? `End with this CTA: "${ctaChoice}"` : "No CTA needed."}

Make this feel different from post #${settings.postCount} — fresh angle, fresh opening.`;

  const msg = await aiChat({
    role: "linkedin",
    maxTokens: 700,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const content = msg.text.trim();
  return { content, postType: selectedType.id, imageStyle: selectedType.imageStyle, featureId };
}

// ── Full post execution (content + optional image + LinkedIn publish) ────────
async function executePost(params: {
  settings: typeof linkedinAutoPostSettings.$inferSelect;
  conn: { accessToken: string; linkedinId: string };
}): Promise<{ content: string; postType: string; imageUrl?: string; linkedinPostId: string; featureId: string | null }> {
  const { settings, conn } = params;
  const includeImage = (settings as any).includeImage ?? false;

  const { content, postType, imageStyle, featureId } = await generatePostContent({
    topics: settings.topics || [],
    tone: settings.tone,
    template: settings.template,
    includeHashtags: settings.includeHashtags,
    includeCta: settings.includeCta,
    language: settings.language,
    targetAudience: (settings as any).targetAudience || "general",
    customContext: (settings as any).customContext || "",
    postCount: settings.postCount,
    adminUserId: settings.adminUserId,
  });

  let imageUrl: string | undefined;
  let linkedinAssetUrn: string | null = null;

  if (includeImage) {
    console.log(`🎨 Generating AI image for post [${postType}]...`);
    const imgResult = await generatePostImage(content, postType, imageStyle, settings.language);
    if (imgResult) {
      imageUrl = imgResult.cloudinaryUrl || imgResult.dalleUrl;
      // Upload to LinkedIn using the DALL-E URL (still valid at this point)
      linkedinAssetUrn = await uploadImageToLinkedIn(imgResult.dalleUrl, conn.accessToken, conn.linkedinId);
      if (linkedinAssetUrn) {
        console.log(`✅ Image uploaded to LinkedIn`);
      } else {
        console.warn("⚠️ LinkedIn image upload failed — posting text-only");
      }
    }
  }

  const linkedinPostId = await postToLinkedIn(conn.accessToken, conn.linkedinId, content, linkedinAssetUrn);
  return { content, postType, imageUrl, linkedinPostId, featureId };
}

// ── Scheduler ───────────────────────────────────────────────────────────────
async function runAutoPostCheck(): Promise<void> {
  if (state.running) return;
  state.running = true;
  state.lastCheck = new Date();

  try {
    const allSettings = await db.select().from(linkedinAutoPostSettings).where(eq(linkedinAutoPostSettings.enabled, true));

    for (const settings of allSettings) {
      // Hoisted so the per-user catch block can still record diagnostics with them.
      let nowStr = "—";
      let targetStr = "—";
      try {
        const { HH, MM } = getNowInTimezone(settings.timezone);
        const [configHH, configMM] = settings.postTime.split(":");
        const nowMin = parseInt(HH, 10) * 60 + parseInt(MM, 10);
        const targetMin = parseInt(configHH, 10) * 60 + parseInt(configMM, 10);
        nowStr = `${HH}:${MM}`;
        targetStr = `${configHH.padStart(2, "0")}:${configMM.padStart(2, "0")}`;

        // Self-healing window: instead of requiring an exact-minute hit (which silently
        // drops posts whenever a previous tick ran long, the server restarted past the
        // post time, or setInterval drifted), fire as soon as we are PAST the target
        // time on the current calendar day in the user's timezone — provided we have
        // not already posted today. This makes restarts and slow ticks self-correcting.
        if (alreadyPostedToday(settings.lastPostedAt, settings.timezone)) {
          recordUserStatus(settings.adminUserId, { nowInTz: nowStr, targetTime: targetStr, action: "skipped", reason: "Already posted today" });
          continue;
        }
        if (nowMin < targetMin) {
          recordUserStatus(settings.adminUserId, { nowInTz: nowStr, targetTime: targetStr, action: "skipped", reason: `Waiting for post time (${targetStr})` });
          continue;
        }

        const conn = await db.select().from(linkedinConnections)
          .where(eq(linkedinConnections.adminUserId, settings.adminUserId)).limit(1);
        if (!conn[0]?.accessToken) {
          console.log(`⚠️ No LinkedIn connection for user ${settings.adminUserId}`);
          recordUserStatus(settings.adminUserId, { nowInTz: nowStr, targetTime: targetStr, action: "skipped", reason: "No LinkedIn connection — reconnect from the LinkedIn tab" });
          continue;
        }

        // ── APPROVAL-GATED PATH ──
        // When admin requires approval, generate the post (text + optional image) but DO NOT publish.
        // Save it as `pending_approval` so admin can review/edit/approve from the dashboard.
        if (settings.requiresApproval) {
          const { content, postType, imageStyle, featureId } = await generatePostContent({
            topics: settings.topics || [],
            tone: settings.tone,
            template: settings.template,
            includeHashtags: settings.includeHashtags,
            includeCta: settings.includeCta,
            language: settings.language,
            targetAudience: (settings as any).targetAudience || "general",
            customContext: (settings as any).customContext || "",
            postCount: settings.postCount,
            adminUserId: settings.adminUserId,
          });

          let imageUrl: string | undefined;
          if ((settings as any).includeImage) {
            try {
              const imgResult = await generatePostImage(content, postType, imageStyle, settings.language);
              if (imgResult) imageUrl = imgResult.cloudinaryUrl || imgResult.dalleUrl;
            } catch (e: any) {
              console.warn(`⚠️ Image generation failed for pending post (text will still be saved): ${e.message}`);
            }
          }

          await db.insert(linkedinPosts).values({
            adminUserId: settings.adminUserId,
            linkedinPostId: null,
            content,
            postType,
            imageUrl: imageUrl || null,
            status: "pending_approval",
            publishedAt: null,
            featureId: featureId ?? null,
          });

          // Mark "posted" for the day so we don't generate twice in 24h
          const nowP = new Date();
          const tomorrowP = new Date(nowP);
          tomorrowP.setDate(tomorrowP.getDate() + 1);
          const [nhh, nmm] = settings.postTime.split(":");
          tomorrowP.setHours(parseInt(nhh), parseInt(nmm), 0, 0);
          await db.update(linkedinAutoPostSettings)
            .set({ lastPostedAt: nowP, lastPostContent: content, nextPostAt: tomorrowP, postCount: settings.postCount + 1, updatedAt: nowP })
            .where(eq(linkedinAutoPostSettings.id, settings.id));

          state.recentPosts.unshift({ adminUserId: settings.adminUserId, content, postType, imageUrl, postedAt: nowP, status: "pending_approval" as any });
          if (state.recentPosts.length > 30) state.recentPosts.pop();

          console.log(`📝 LinkedIn post drafted & queued for approval [${postType}]: user ${settings.adminUserId}`);
          recordUserStatus(settings.adminUserId, { nowInTz: nowStr, targetTime: targetStr, action: "queued_for_approval", reason: `Drafted [${postType}] — awaiting your approval` });
          continue;
        }

        // ── DIRECT-PUBLISH PATH (no approval required) ──
        const { content, postType, imageUrl, linkedinPostId, featureId } = await executePost({ settings, conn: conn[0] });

        await db.insert(linkedinPosts).values({
          adminUserId: settings.adminUserId,
          linkedinPostId,
          content,
          postType,
          imageUrl: imageUrl || null,
          status: "published",
          publishedAt: new Date(),
          featureId: featureId ?? null,
        });

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [nextHH, nextMM] = settings.postTime.split(":");
        tomorrow.setHours(parseInt(nextHH), parseInt(nextMM), 0, 0);

        await db.update(linkedinAutoPostSettings)
          .set({ lastPostedAt: now, lastPostContent: content, nextPostAt: tomorrow, postCount: settings.postCount + 1, updatedAt: now })
          .where(eq(linkedinAutoPostSettings.id, settings.id));

        state.recentPosts.unshift({ adminUserId: settings.adminUserId, content, postType, imageUrl, postedAt: now, status: "published" });
        if (state.recentPosts.length > 30) state.recentPosts.pop();

        console.log(`✅ LinkedIn auto-post [${postType}]${imageUrl ? " + image" : ""}: user ${settings.adminUserId}`);
        recordUserStatus(settings.adminUserId, { nowInTz: nowStr, targetTime: targetStr, action: "fired", reason: `Published [${postType}]${imageUrl ? " with image" : ""}` });
      } catch (err: any) {
        const reason = err?.response?.data?.message || err?.message || String(err);
        console.error(`❌ LinkedIn auto-post error for user ${settings.adminUserId}:`, err?.response?.data || err.message);
        state.recentPosts.unshift({ adminUserId: settings.adminUserId, content: `Error: ${reason}`, postType: "error", postedAt: new Date(), status: "failed" });
        recordUserStatus(settings.adminUserId, { nowInTz: nowStr, targetTime: targetStr, action: "error", reason });
      }
    }
  } catch (err: any) {
    console.error("LinkedIn auto-post scheduler error:", err.message);
    state.lastError = { at: new Date(), message: err?.message || String(err) };
  } finally {
    state.running = false;
  }
}

export function startLinkedInAutoPostScheduler(): void {
  console.log("📅 LinkedIn auto-post scheduler starting — checking every minute");
  state.timer = setInterval(() => { runAutoPostCheck().catch(console.error); }, CHECK_INTERVAL_MS);
  runAutoPostCheck().catch(console.error);
}

export function stopLinkedInAutoPostScheduler(): void {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
  console.log("🛑 LinkedIn auto-post scheduler stopped");
}

export function getAutoPostSchedulerStatus(adminUserId?: number) {
  const allEntries = Array.from(state.perUserStatus.entries()).map(([uid, info]) => ({
    adminUserId: uid,
    lastCheckedAt: info.lastCheckedAt.toISOString(),
    nowInTz: info.nowInTz,
    targetTime: info.targetTime,
    action: info.action,
    reason: info.reason,
  }));
  // When an adminUserId is supplied, only return that admin's own diagnostics + only recent
  // posts belonging to them. Avoids cross-admin data exposure on a shared dashboard endpoint.
  const filteredPerUser = typeof adminUserId === "number" ? allEntries.filter(e => e.adminUserId === adminUserId) : allEntries;
  const filteredRecent = typeof adminUserId === "number" ? state.recentPosts.filter(p => p.adminUserId === adminUserId) : state.recentPosts;
  return {
    running: state.running,
    lastCheck: state.lastCheck?.toISOString() ?? null,
    lastError: state.lastError ? { at: state.lastError.at.toISOString(), message: state.lastError.message } : null,
    recentPosts: filteredRecent.slice(0, 10),
    perUserStatus: filteredPerUser,
  };
}

export async function triggerManualAutoPost(adminUserId: number): Promise<{ success: boolean; content?: string; postType?: string; imageUrl?: string; error?: string }> {
  try {
    const [settings] = await db.select().from(linkedinAutoPostSettings)
      .where(eq(linkedinAutoPostSettings.adminUserId, adminUserId)).limit(1);
    if (!settings) return { success: false, error: "Auto-post settings not found. Save your settings first." };

    const [conn] = await db.select().from(linkedinConnections)
      .where(eq(linkedinConnections.adminUserId, adminUserId)).limit(1);
    if (!conn?.accessToken) return { success: false, error: "LinkedIn not connected" };

    const { content, postType, imageUrl, linkedinPostId, featureId } = await executePost({ settings, conn });

    await db.insert(linkedinPosts).values({
      adminUserId,
      linkedinPostId,
      content,
      postType,
      imageUrl: imageUrl || null,
      status: "published",
      publishedAt: new Date(),
      featureId: featureId ?? null,
    });

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [nextHH, nextMM] = (settings.postTime || "09:00").split(":");
    tomorrow.setHours(parseInt(nextHH, 10), parseInt(nextMM, 10), 0, 0);

    await db.update(linkedinAutoPostSettings)
      .set({ lastPostedAt: now, lastPostContent: content, nextPostAt: tomorrow, postCount: settings.postCount + 1, updatedAt: now })
      .where(eq(linkedinAutoPostSettings.id, settings.id));

    recordUserStatus(adminUserId, { nowInTz: "manual", targetTime: settings.postTime || "09:00", action: "fired", reason: `Published [${postType}] via manual trigger` });
    return { success: true, content, postType, imageUrl };
  } catch (err: any) {
    const reason = err?.response?.data?.message || err?.message || String(err);
    recordUserStatus(adminUserId, { nowInTz: "manual", targetTime: "—", action: "error", reason });
    return { success: false, error: reason };
  }
}

/**
 * Publish a previously-drafted (pending_approval) post to LinkedIn.
 * Handles optional image upload + text-only fallback. Used by the approval endpoint.
 */
export async function publishApprovedPost(params: {
  accessToken: string;
  linkedinId: string;
  content: string;
  imageUrl?: string;
}): Promise<{ linkedinPostId: string }> {
  let linkedinAssetUrn: string | null = null;
  if (params.imageUrl) {
    try {
      linkedinAssetUrn = await uploadImageToLinkedIn(params.imageUrl, params.accessToken, params.linkedinId);
    } catch (e: any) {
      console.warn(`[LinkedIn approve] image upload failed, posting text-only: ${e.message}`);
    }
  }
  const linkedinPostId = await postToLinkedIn(params.accessToken, params.linkedinId, params.content, linkedinAssetUrn);
  return { linkedinPostId };
}

export function getPostTypes() {
  return POST_TYPES.map(p => ({ id: p.id, name: p.name }));
}
