/**
 * Admin Career Suite — Claude-powered identity / CV / portfolio / job-match.
 * All routes admin-only except GET /api/career/public/:slug.
 *
 * /api/admin/career/profile        GET / PATCH
 * /api/admin/career/profile/enrich POST          ← Claude reads rawNotes + structured fields, fills strengths/positioning/UVPs
 * /api/admin/career/cvs            GET / POST    (POST creates manually)
 * /api/admin/career/cvs/generate   POST          ← Claude composes a fresh CV from profile (+ optional job desc)
 * /api/admin/career/cvs/:id        GET / PATCH / DELETE
 * /api/admin/career/cvs/:id/tailor POST          ← Claude tailors an existing CV to a job
 * /api/admin/career/projects       GET / POST
 * /api/admin/career/projects/:id   PATCH / DELETE
 * /api/admin/career/portfolio/build POST         ← Claude assembles a recruiter-ready portfolio narrative
 * /api/admin/career/match          POST          ← Paste job description → fit score + analysis (saves match)
 * /api/admin/career/matches        GET / DELETE  ← list saved matches
 * /api/admin/career/insights       POST          ← Claude analyses gaps & positioning advice
 * /api/career/public/:slug         GET           ← public-facing portfolio JSON (no auth)
 */
import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  adminCareerProfile, adminCareerCvs, adminCareerProjects, adminCareerJobMatches,
  marketingContext, founderProfile, aiTrainingEntries, instagramAiPersona,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { aiChat } from "./aiRouter";
import { uploadImage } from "./cloudinary";
import { storage } from "./storage";

const CLAUDE = { provider: "anthropic" as const, balanced: "claude-sonnet-4-6", powerful: "claude-sonnet-4-6" };

// ── LANGUAGE GUIDES — native-quality writing instructions per language ──────────
// The AI gets explicit cultural / register / RTL / phrasing notes so output reads
// like a native professional wrote it, not like a literal translation.
export const SUPPORTED_LANGS = ["en", "nl", "ar", "fr", "de", "es"] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];

const LANGUAGE_GUIDES: Record<SupportedLang, { name: string; nativeName: string; rtl?: boolean; voice: string }> = {
  en: {
    name: "English", nativeName: "English",
    voice: `Write in modern, confident, recruiter-ready English. Sentences should be tight and active — short verbs, no marketing fluff, no "passionate self-starter" clichés. Use British or US spelling consistently with the rest of the document. Cover letters are warm but direct. Bullets quantify impact whenever a real number exists.`,
  },
  nl: {
    name: "Dutch", nativeName: "Nederlands",
    voice: `Schrijf in natuurlijk, professioneel Nederlands zoals een Nederlandse recruiter of HR-manager het zou lezen — direct, zakelijk, helder, niet vertaald-Engels. Vermijd letterlijke vertalingen ("een team-speler", "passievol"). Gebruik krachtige werkwoorden en concrete resultaten. Houd toon zelfverzekerd maar bescheiden — typisch Nederlandse "doe maar gewoon"-stijl. Begeleidende brieven openen met een directe haak, geen "Geachte heer/mevrouw, hierbij solliciteer ik..."-cliché. Behoud Engelse productnamen en Engelse vakjargon waar dat in NL standaard is (bijv. "lead", "growth", "stakeholder", "AI", "marketing").`,
  },
  ar: {
    name: "Arabic", nativeName: "العربية", rtl: true,
    voice: `اكتب بالعربية الفصحى الحديثة الراقية المناسبة للسير الذاتية التنفيذية والمراسلات المهنية في المنطقة (الإمارات، السعودية، لبنان، شمال إفريقيا). استخدم لغة محترفة، واثقة، دقيقة — لا ترجمة حرفية من الإنجليزية. حافظ على الأسماء والعلامات التجارية باللاتينية كما هي (Urban Culture Hub, Dance Healthy, Stichting Coffee & Dance, Amsterdam, AI). استخدم المصطلحات المهنية المعتمدة في المنطقة. اجعل خطاب التغطية يفتتح بجملة قوية مباشرة، بدون عبارات إنشائية. الأسلوب: مهني، عصري، واثق، ومحترم — كما يكتب مدير تنفيذي عربي. ملاحظة: سيُعرض النص من اليمين إلى اليسار (RTL).`,
  },
  fr: {
    name: "French", nativeName: "Français",
    voice: `Écris dans un français professionnel moderne et net, du niveau qu'un recruteur parisien ou bruxellois attendrait. Pas de calques anglais ("être passionné par", "compétences clés"). Utilise des verbes actifs, des chiffres concrets, un ton confiant mais sobre. Les lettres de motivation s'ouvrent par une accroche directe, pas par "Madame, Monsieur, Suite à votre annonce...". Garde les noms propres, marques, et acronymes anglais standards (AI, growth, stakeholder, lead) quand c'est l'usage du secteur.`,
  },
  de: {
    name: "German", nativeName: "Deutsch",
    voice: `Schreibe in modernem, professionellem Deutsch — präzise, sachlich, ergebnisorientiert. Vermeide wörtliche Übersetzungen aus dem Englischen ("leidenschaftlich", "Team-Player"). Verwende aktive Verben, konkrete Zahlen, einen selbstbewussten aber unaufgeregten Ton (DACH-Stil). Bewerbungsanschreiben öffnen mit einem starken Hook, nicht mit "Sehr geehrte Damen und Herren, hiermit bewerbe ich mich...". Englische Fachbegriffe (AI, Growth, Stakeholder, Lead, Marketing) bleiben wo sie im DACH-Raum üblich sind.`,
  },
  es: {
    name: "Spanish", nativeName: "Español",
    voice: `Escribe en español profesional moderno (España y LATAM-neutral). Voz directa, concreta, segura — sin calcos del inglés ("apasionado por", "team-player") ni clichés ("amplia experiencia"). Usa verbos activos y métricas reales. Las cartas de presentación abren con un gancho directo, no con "Estimados señores, me dirijo a ustedes...". Mantén marcas y términos técnicos en su forma original (AI, growth, marketing, stakeholder).`,
  },
};

function langCode(input?: string): SupportedLang {
  const v = String(input || "en").toLowerCase().split("-")[0];
  return (SUPPORTED_LANGS as readonly string[]).includes(v) ? (v as SupportedLang) : "en";
}

function languageDirective(lang: SupportedLang): string {
  const g = LANGUAGE_GUIDES[lang];
  return `═══ LANGUAGE — write 100% in ${g.name} (${g.nativeName})${g.rtl ? " · RTL" : ""} ═══
${g.voice}
Do NOT mix languages within a sentence. Do NOT explain the translation. Output strings in the JSON must already be in ${g.name}.`;
}

function tryParseJson(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/i, "").replace(/```\s*$/m, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

async function ensureProfile(userId?: number) {
  const [existing] = await db.select().from(adminCareerProfile).limit(1);
  if (existing) return existing;
  // Auto-seed with known info about Riki / Urban Culture Hub founder
  const [created] = await db.insert(adminCareerProfile).values({
    userId: userId ?? null,
    fullName: "Riki Almouti",
    headline: "Founder of Stichting Coffee & Dance · Builder of Urban Culture Hub · Dance, AI & community",
    location: "Amsterdam, Netherlands",
    email: "riki@dancehealthy.net",
    website: "https://urbanculturehub.nl",
    socials: { instagram: "bboy_rikimaru", linkedin: "", tiktok: "" },
    story: `I grew up in dance — bboy roots, breaking culture, the streets of Amsterdam. That world taught me everything: discipline, community, hustle, expression. I turned that into Stichting Coffee & Dance (a foundation bringing dance, health and community together), Dance Healthy (movement-as-medicine), and Back to the Street (battles, programs, and bringing the culture back where it started).

In parallel I've been building Urban Culture Hub — a full platform for street culture: spots map, events, marketplace, AI-powered community tools, Beat Lab, Graffiti Wall, Hall of Fame. I design, code, market and operate it myself, blending years of dance/community work with modern AI and growth marketing.

I'm looking for partnerships, roles, or grant opportunities where dance, urban culture, AI and meaningful community impact intersect.`,
    ventures: [
      { name: "Stichting Coffee & Dance", role: "Founder", period: "ongoing", summary: "Foundation bridging dance, café culture, health and community in Amsterdam.", impact: "Built community programs, events, and partnerships across NL." },
      { name: "Dance Healthy", role: "Founder", period: "ongoing", summary: "Movement-as-medicine — using dance to improve mental and physical health.", impact: "Workshops, content, and a brand reaching dancers across NL." },
      { name: "Back to the Street", role: "Founder / Curator", period: "ongoing", summary: "Battles, programs and events bringing the culture back to the streets where it was born.", impact: "Recurring battles, community programming, judge network." },
      { name: "Urban Culture Hub", role: "Founder & Builder", period: "ongoing", summary: "End-to-end platform for street culture: spot finder, events, marketplace, AI tools, Beat Lab, Graffiti Wall, Hall of Fame.", impact: "Self-built full-stack app + AI marketing engine, live in Amsterdam." },
    ],
    skills: [
      { name: "Community building", category: "Leadership" },
      { name: "Event production", category: "Operations" },
      { name: "Brand & marketing strategy", category: "Marketing" },
      { name: "AI / LLM application building", category: "Tech" },
      { name: "Full-stack product development", category: "Tech" },
      { name: "Dance education & coaching", category: "Dance" },
      { name: "Hip-hop & breaking culture", category: "Dance" },
      { name: "Stakeholder & funder relations", category: "Leadership" },
    ],
    languages: [
      { name: "Dutch", level: "Native" },
      { name: "English", level: "Fluent" },
      { name: "Arabic", level: "Conversational" },
    ],
    targetRoles: [
      "Marketing Lead", "Community Manager", "Cultural Programs Director",
      "Founder-in-Residence", "Brand Director", "AI Product Lead",
      "Partnerships Lead", "Grant-funded Programs Lead",
    ],
    rawNotes: "Bboy background — competing, judging, teaching. Built Urban Culture Hub solo with AI assistance. Comfortable wearing many hats: ops, marketing, product, dance, community, fundraising. Strong in NL street-culture network.",
  }).returning();
  return created;
}

// Pre-built role templates — tuned prompts for different industries
const TEMPLATE_PRESETS: Record<string, { label: string; angle: string; targetRole: string; style: string }> = {
  marketing_lead: { label: "Marketing Lead", angle: "Lead with growth, brand, AI-driven campaigns and the Urban Culture Hub marketing engine you built.", targetRole: "Marketing Lead / Head of Marketing", style: "modern" },
  community_manager: { label: "Community Manager", angle: "Lead with community-building track record across Stichting Coffee & Dance, Back to the Street, and the dance scene.", targetRole: "Community Manager / Community Lead", style: "creative" },
  cultural_programs: { label: "Cultural Programs Director", angle: "Lead with curation of programs, battles, partnerships and cultural impact in urban art and dance.", targetRole: "Cultural Programs Director", style: "creative" },
  founder_in_residence: { label: "Founder-in-Residence / EIR", angle: "Lead with end-to-end builder story: built Urban Culture Hub solo (product + marketing + ops) with AI as a force-multiplier.", targetRole: "Founder-in-Residence / Entrepreneur in Residence", style: "startup" },
  ai_product_lead: { label: "AI Product Lead", angle: "Lead with the AI features you shipped — Marketing Brain, Drafter, Career Suite, multi-LLM router. Position as a hands-on AI builder, not a theorist.", targetRole: "AI Product Lead / Applied AI", style: "startup" },
  brand_director: { label: "Brand Director", angle: "Lead with multi-brand portfolio (Coffee & Dance / Dance Healthy / Back to the Street / UCH) — visual identity, voice, positioning.", targetRole: "Brand Director", style: "creative" },
  partnerships_lead: { label: "Partnerships Lead", angle: "Lead with stakeholder relations, grants, sponsor work and cross-organization deals.", targetRole: "Partnerships Lead", style: "corporate" },
  grant_programs: { label: "Grant-funded Programs Lead", angle: "Lead with non-profit credentials (Stichting Coffee & Dance), social impact, measurable community outcomes.", targetRole: "Programs Lead — non-profit / social impact", style: "corporate" },
};

export const CAREER_TEMPLATES = TEMPLATE_PRESETS;

// Pull the entire admin AI knowledge: marketing brain, founder profile, training entries, Instagram persona.
async function gatherAdminContext() {
  try {
    const [mc] = await db.select().from(marketingContext).limit(1);
    const founder = await db.select().from(founderProfile).orderBy(founderProfile.sortOrder);
    const training = await db.select().from(aiTrainingEntries).where(eq(aiTrainingEntries.isActive, true)).orderBy(aiTrainingEntries.sortOrder);
    const [iaPersona] = await db.select().from(instagramAiPersona).limit(1);
    return { marketing: mc || null, founder, training, igPersona: iaPersona || null };
  } catch { return { marketing: null, founder: [], training: [], igPersona: null }; }
}

function adminContextForPrompt(ctx: { marketing: any; founder: any[]; training: any[]; igPersona: any }) {
  const lines: string[] = [];
  if (ctx.marketing) {
    const m = ctx.marketing;
    lines.push(`=== MARKETING BRAIN (their flagship product) ===`);
    if (m.appName) lines.push(`Product: ${m.appName}${m.tagline ? ` — "${m.tagline}"` : ""}`);
    if (m.pitch) lines.push(`Pitch: ${m.pitch}`);
    if (m.uniqueValue) lines.push(`Unique value: ${m.uniqueValue}`);
    if (Array.isArray(m.features) && m.features.length) lines.push(`Features they shipped:\n${m.features.slice(0, 12).map((f: any) => `  • ${f.name}: ${f.description || ""}`).join("\n")}`);
    if (Array.isArray(m.audiencePersonas) && m.audiencePersonas.length) lines.push(`Target audience: ${m.audiencePersonas.map((p: any) => p.name).filter(Boolean).join(", ")}`);
    if (m.brandVoice) lines.push(`Brand voice: ${m.brandVoice}`);
    if (Array.isArray(m.doSay) && m.doSay.length) lines.push(`Do-say words: ${m.doSay.join(", ")}`);
    if (Array.isArray(m.dontSay) && m.dontSay.length) lines.push(`Don't-say words: ${m.dontSay.join(", ")}`);
    if (m.geographicFocus) lines.push(`Market focus: ${m.geographicFocus}`);
  }
  if (ctx.founder?.length) {
    lines.push(`\n=== FOUNDER PROFILE (curated story sections) ===`);
    ctx.founder.forEach((f: any) => { if (f.content) lines.push(`[${f.label}] ${String(f.content).slice(0, 600)}`); });
  }
  if (ctx.training?.length) {
    lines.push(`\n=== AI KNOWLEDGE BASE (personal stories, values, knowledge nuggets) ===`);
    ctx.training.slice(0, 25).forEach((t: any) => lines.push(`[${t.category}/${t.title || "untitled"}] ${String(t.content || "").slice(0, 500)}`));
  }
  if (ctx.igPersona) {
    const ig = ctx.igPersona;
    lines.push(`\n=== INSTAGRAM PERSONA (their public voice) ===`);
    if (ig.toneAndVoice) lines.push(`Tone: ${ig.toneAndVoice}`);
    if (ig.communicationStyle) lines.push(`Style: ${ig.communicationStyle}`);
    if (ig.businessDirection) lines.push(`Direction: ${ig.businessDirection}`);
    if (Array.isArray(ig.brandFacts) && ig.brandFacts.length) lines.push(`Brand facts: ${ig.brandFacts.slice(0, 10).map((b: any) => typeof b === "string" ? b : (b.fact || b.text || JSON.stringify(b))).join(" · ")}`);
  }
  return lines.length ? lines.join("\n") : "";
}

// ── VENTURES BRAIN — explicit, in-your-face inventory of EVERYTHING the user does ──
// Many CV/portfolio outputs flatten the user into "founder of X". This block forces
// the AI to remember that this person operates a portfolio of named ventures
// (Urban Culture Hub, Stichting Coffee & Dance, Dance Healthy, Back to the Street,
//  events, AI tools, etc) and demands they appear in the output by name.
function venturesBrainBlock(p: any, projects: any[] = []): string {
  const j = (v: any) => (Array.isArray(v) ? v : []);
  const ventures = j(p.ventures);
  const projs = j(projects);
  const headlineEvents = projs.filter((x: any) => /event|festival|battle|turbo|back to the street/i.test(`${x.title} ${x.category} ${x.summary}`));
  const platformProjects = projs.filter((x: any) => /platform|app|hub|map|finder|tool|ai|admin/i.test(`${x.title} ${x.category} ${x.summary}`));

  const lines: string[] = [];
  lines.push(`█████ VENTURES BRAIN — THIS PERSON RUNS A PORTFOLIO, NOT ONE THING █████`);
  lines.push(`When you write CVs / portfolios / cover letters / match analysis, you MUST acknowledge`);
  lines.push(`ALL of the following ventures and pillars by name where contextually relevant. Do not`);
  lines.push(`flatten this person into a single role or a single product. Show range.`);
  lines.push(``);

  if (ventures.length) {
    lines.push(`◆ ACTIVE VENTURES (${ventures.length})`);
    ventures.forEach((v: any, i: number) => {
      lines.push(`  ${i + 1}. ${v.name} — ${v.role || "founder"} · ${v.period || "ongoing"}`);
      if (v.summary) lines.push(`     What it is: ${v.summary}`);
      if (v.impact) lines.push(`     Real impact: ${v.impact}`);
    });
    lines.push(``);
  }

  if (headlineEvents.length) {
    lines.push(`◆ FLAGSHIP EVENTS / PROGRAMS produced (mention by name when relevant)`);
    headlineEvents.slice(0, 8).forEach((x: any) => {
      lines.push(`  • ${x.title}${x.period ? ` (${x.period})` : ""}: ${x.summary || ""}${x.impact ? ` — ${x.impact}` : ""}`);
    });
    lines.push(``);
  }

  if (platformProjects.length) {
    lines.push(`◆ PLATFORM / PRODUCT / AI WORK shipped`);
    platformProjects.slice(0, 8).forEach((x: any) => {
      lines.push(`  • ${x.title}${x.period ? ` (${x.period})` : ""}: ${x.summary || ""}${x.impact ? ` — ${x.impact}` : ""}`);
    });
    lines.push(``);
  }

  lines.push(`◆ HOW TO USE THIS`);
  lines.push(`  – If the role is creative/cultural → lead with Stichting Coffee & Dance, Dance Healthy, Back to the Street, events.`);
  lines.push(`  – If the role is tech/AI/product → lead with Urban Culture Hub + AI tooling track record.`);
  lines.push(`  – If the role is marketing/brand → lead with multi-brand portfolio operating across all ventures.`);
  lines.push(`  – If the role is partnerships/grants → lead with Stichting Coffee & Dance municipal & grant work.`);
  lines.push(`  – ALWAYS show this person operates fluently across creative + technical + community + grant worlds.`);
  lines.push(`  – NEVER reduce this person to "founder of Urban Culture Hub" alone — they are a multi-venture cultural entrepreneur AND a hands-on AI builder AND a professional dancer.`);
  lines.push(`███████████████████████████████████████████████████████████████████████`);
  return lines.join("\n");
}

async function fullContextForAI(p: any, projects: any[] = [], lang: SupportedLang = "en") {
  const adm = await gatherAdminContext();
  const adminBlock = adminContextForPrompt(adm);
  const ventures = venturesBrainBlock(p, projects);
  const langGuide = languageDirective(lang);
  return profileSummaryForAI(p, projects)
    + `\n\n${ventures}`
    + (adminBlock ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${adminBlock}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : "")
    + `\n\n${langGuide}`;
}

function profileSummaryForAI(p: any, projects: any[] = []) {
  const j = (v: any) => (Array.isArray(v) ? v : []);
  return `=== IDENTITY ===
Name: ${p.fullName || "(unknown)"}
Headline: ${p.headline || ""}
Location: ${p.location || ""}
Email: ${p.email || ""}  Website: ${p.website || ""}
Socials: ${JSON.stringify(p.socials || {})}

=== STORY (the human behind the CV) ===
${p.story || "(no story yet)"}

=== RAW BRAIN-DUMP NOTES (mine these for hidden gems) ===
${p.rawNotes || "(none)"}

=== VENTURES & PILLARS ===
${j(p.ventures).map((v: any) => `• ${v.name} (${v.role || "founder"}, ${v.period || ""}): ${v.summary || ""}${v.impact ? ` — IMPACT: ${v.impact}` : ""}`).join("\n") || "(none)"}

=== EXPERIENCE ===
${j(p.experience).map((e: any) => `• ${e.title} @ ${e.org} (${e.period || ""}): ${e.summary || ""}${(e.achievements || []).length ? `\n   - ${(e.achievements || []).join("\n   - ")}` : ""}`).join("\n") || "(none)"}

=== EDUCATION ===
${j(p.education).map((e: any) => `• ${e.degree} — ${e.institution} (${e.period || ""})`).join("\n") || "(none)"}

=== SKILLS ===
${j(p.skills).map((s: any) => `${s.name}${s.level ? `(${s.level})` : ""}`).join(", ") || "(none)"}

=== LANGUAGES ===
${j(p.languages).map((l: any) => `${l.name}${l.level ? ` (${l.level})` : ""}`).join(", ") || "(none)"}

=== ACHIEVEMENTS ===
${j(p.achievements).map((a: any) => typeof a === "string" ? `• ${a}` : `• ${a.title}${a.year ? ` (${a.year})` : ""}: ${a.summary || ""}`).join("\n") || "(none)"}

=== PRESS / AWARDS ===
${j(p.pressAndAwards).map((a: any) => `• ${a.title} — ${a.source || ""} (${a.year || ""})`).join("\n") || "(none)"}

=== PROJECTS ===
${projects.map(pr => `• ${pr.title} [${pr.category || ""}] (${pr.period || ""}): ${pr.summary || ""}${pr.impact ? ` — IMPACT: ${pr.impact}` : ""}`).join("\n") || "(none)"}

=== CURRENT POSITIONING ===
${p.positioning || "(not yet defined)"}
Strengths: ${(j(p.strengths)).join(", ") || "(none)"}
UVPs: ${(j(p.uniqueValueProps)).join(" | ") || "(none)"}
Target roles: ${(j(p.targetRoles)).join(", ") || "(none)"}`;
}

export function registerCareerRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: any) => void,
) {
  // ── PROFILE ─────────────────────────────────────────────────────────────
  app.get("/api/admin/career/profile", requireAdmin, async (req, res) => {
    const p = await ensureProfile((req as any).user?.id);
    res.json(p);
  });

  app.patch("/api/admin/career/profile", requireAdmin, async (req, res) => {
    const p = await ensureProfile((req as any).user?.id);
    const patch: any = { ...req.body, updatedAt: new Date() };
    delete patch.id; delete patch.createdAt;
    const [updated] = await db.update(adminCareerProfile).set(patch).where(eq(adminCareerProfile.id, p.id)).returning();
    res.json(updated);
  });

  // ── IMPORT REAL CV (Riki) — fills career profile + seeds founder_profile so Urban AI knows the real him ──
  app.post("/api/admin/career/import-real-cv", requireAdmin, async (req, res) => {
    try {
      const p = await ensureProfile((req as any).user?.id);

      const realCv = {
        fullName: "Riki Almouti",
        headline: "Founder · Cultural Entrepreneur · AI Builder · Professional Dancer",
        location: "Zaandam, Netherlands",
        email: "rmaru2889@gmail.com",
        phone: "+31 6 8418 6452",
        website: "https://dancehealthy.nl",
        story: `I was born in Dubai on 12 June 1996 and grew up between Lebanon and the Netherlands. I started out as a professional dancer and turned that career into a multi-disciplinary practice spanning culture, community, technology and entrepreneurship. I studied Computer Science at the American University of Science and Technology in Beirut and HBO Dance at Lucia Marthas Institute For Performing Arts in Amsterdam. In 2021 I founded Dance Healthy — a community built around movement, music and healthy living. In 2024 I became Chairman of Stichting Coffee & Dance, where I produce flagship cultural events like Back to the Street and TurboVision, partner with municipalities and secure grants to give youth and adults real space to grow physically, mentally and socially.

Alongside the cultural work I built a deep AI specialism — content automation, voice, video, image and copy generation across ChatGPT, Claude, ElevenLabs, Runway, Stable Diffusion, MidJourney, InVideo, Descript, Canva AI and more. I am the founder and builder of Urban Culture Hub: a national platform for urban culture in the Netherlands with 30k+ mapped spots, an AI Finder, events, community, bookings and tickets — I built it end-to-end with AI integrations across the stack.

I am creative, energetic and social by nature. I speak English, Dutch and Arabic. My hobbies are professional dancing, rollerblading, table tennis, horseback riding and bouldering. My mission is simple: combine creativity, technology and community impact — and grow cultural and creative initiatives through partnerships, grants and projects that actually move the world forward.`,
        positioning: "I'm a rare hybrid: I started as a professional performer, became a cultural entrepreneur, and then became an AI builder shipping real products. I move fluently between creative direction, community leadership, event production and technical execution — and I turn each one into measurable impact.",
        education: [
          { degree: "HBO Dans", institution: "Lucia Marthas Institute For Performing Arts", period: "Sep 2015 – Jul 2016" },
          { degree: "Bachelor Computer Science", institution: "American University of Science and Technology, Beirut", period: "Sep 2014 – Jul 2015" },
          { degree: "HAVO Sociologie & Economie", institution: "Beirut, Lebanon", period: "Sep 2007 – Jun 2013" },
          { degree: "HTML, CSS & JavaScript", institution: "Course", period: "" },
          { degree: "Drone Pilot Certification", institution: "Course", period: "" },
        ],
        experience: [
          { title: "Founder & Director", org: "Dance Healthy", period: "Oct 2021 – Present", summary: "Founded a community-driven movement and entertainment company combining dance, sport and a healthy lifestyle. Produces events, festivals and sport days for companies, refugee shelters and schools across the Netherlands.", achievements: ["Built Dance Healthy from zero into an active community brand", "Produced cultural & corporate events nationwide", "Partnered with schools, companies and refugee shelters to deliver movement programs"] },
          { title: "Chairman & Event Manager (Bestuursvoorzitter)", org: "Stichting Coffee & Dance, Amsterdam", period: "2024 – Present", summary: "Leads the foundation that brings people together through street art, dance and music. Creates innovative, accessible cultural events, partners with municipalities, secures grants and supports youth and adults physically, mentally and socially.", achievements: ["Produces flagship events Back to the Street & TurboVision", "Secures municipal partnerships and cultural grants", "Builds artist, brand and organization partnerships"] },
          { title: "Marketing & Social Media Manager", org: "Ser.vi (Amsterdam / USA)", period: "Oct 2022 – Jan 2024", summary: "Owned marketing and social media for a cross-Atlantic startup.", achievements: [] },
          { title: "AI Specialist & Content Automation", org: "Independent", period: "Ongoing", summary: "Builds AI-driven content, automation and product workflows across text, voice, video and image — ChatGPT, Claude, DeepSeek, Notion AI, Grammarly, ElevenLabs, Speechify, InVideo, Runway ML, Descript, Veed.io, Stable Diffusion, MidJourney, Canva AI, Adobe Firefly.", achievements: ["End-to-end AI content automation", "Voice & video production pipelines", "Branding & visual content generation at scale"] },
          { title: "Social Media Manager (Volunteer)", org: "ZTTC", period: "Present", summary: "Volunteer social media management.", achievements: [] },
          { title: "Drone Videographer", org: "Independent", period: "Present", summary: "Certified drone pilot and aerial videographer.", achievements: [] },
        ],
        ventures: [
          { name: "Urban Culture Hub", role: "Founder & Builder", period: "2024 – Present", summary: "National platform for urban culture in the Netherlands — 30k+ mapped spots, AI Finder, events, community feed, booking & ticketing, admin dashboard, AI integrations across the stack.", impact: "Built end-to-end with AI; serving the urban culture community at national scale" },
          { name: "Dance Healthy", role: "Founder", period: "2021 – Present", summary: "Community brand fusing dance, sport and healthy lifestyle through events, festivals and corporate sport days.", impact: "Active multi-year community presence in NL" },
          { name: "Stichting Coffee & Dance", role: "Chairman", period: "2024 – Present", summary: "Cultural foundation producing Back to the Street, TurboVision and other street-art × dance × music events.", impact: "Municipal partnerships & grant funding secured" },
        ],
        skills: [
          { name: "Creative Direction", category: "Creative" }, { name: "Event Production", category: "Operations" },
          { name: "Community Leadership", category: "Leadership" }, { name: "Cultural Programming", category: "Creative" },
          { name: "Brand & Marketing", category: "Marketing" }, { name: "Social Media Management", category: "Marketing" },
          { name: "AI Content Automation", category: "Tech" }, { name: "AI Voice (ElevenLabs, Speechify)", category: "Tech" },
          { name: "AI Video (Runway, InVideo, Descript, Veed)", category: "Tech" }, { name: "AI Image (Stable Diffusion, MidJourney, Firefly)", category: "Tech" },
          { name: "Copywriting (ChatGPT, Claude, DeepSeek)", category: "Tech" }, { name: "Product Building", category: "Tech" },
          { name: "HTML / CSS / JavaScript", category: "Tech" }, { name: "Drone Cinematography", category: "Creative" },
          { name: "Grant Writing & Municipal Partnerships", category: "Operations" }, { name: "Professional Dance (Breaking, HipHop)", category: "Performance" },
        ],
        languages: [
          { name: "English", level: "Fluent" }, { name: "Nederlands", level: "Fluent" }, { name: "العربية (Arabic)", level: "Native" },
        ],
        achievements: [
          "Founded & built Urban Culture Hub — 30k+ spots, full AI-integrated platform",
          "Chairman of Stichting Coffee & Dance — flagship cultural events Back to the Street & TurboVision",
          "Founded Dance Healthy — multi-year active community brand",
          "Marketing & Social Media lead at Ser.vi (Amsterdam / USA)",
          "Professional dancer (HBO Dans — Lucia Marthas Institute)",
          "Computer Science background (American University of Science & Technology, Beirut)",
          "Certified drone pilot & aerial videographer",
          "Tri-lingual: English, Dutch, Arabic",
        ],
        targetRoles: [
          "Cultural Programs Director", "Creative Director / Producer", "AI Product Lead",
          "Founder-in-Residence", "Community & Partnerships Lead", "Marketing & Brand Director",
          "Event Production Lead", "Innovation Lead (Culture × Tech)",
        ],
        strengths: ["Building from zero", "Connecting culture, tech & community", "Creative direction", "AI execution at speed", "Event production at scale", "Cross-cultural fluency", "Resilience (turned injury into platform-building)", "Energetic, social leadership"],
        uniqueValueProps: [
          "Performer → entrepreneur → AI builder — three deep skill stacks in one person",
          "Ships real products end-to-end with AI, not just decks",
          "Operates fluently across creative, technical and municipal/grant worlds",
          "Tri-lingual cultural fluency (EN / NL / AR) across European, Middle-Eastern and global contexts",
        ],
        hobbies: ["Professional dancer", "Professional rollerblader", "Professional table tennis player", "Horseback riding", "Bouldering"],
      };

      const merge = (a: any, b: any) => (Array.isArray(b) && b.length ? b : a);
      const [updated] = await db.update(adminCareerProfile).set({
        fullName: realCv.fullName, headline: realCv.headline, location: realCv.location,
        email: realCv.email, phone: realCv.phone, website: realCv.website, story: realCv.story,
        positioning: realCv.positioning,
        education: realCv.education, experience: realCv.experience, ventures: realCv.ventures,
        skills: realCv.skills, languages: realCv.languages, achievements: realCv.achievements,
        targetRoles: realCv.targetRoles, strengths: realCv.strengths, uniqueValueProps: realCv.uniqueValueProps,
        publicSlug: p.publicSlug || "riki-almouti", publicEnabled: true,
        rawNotes: `${p.rawNotes || ""}\n\n--- imported from real CV ${new Date().toISOString().slice(0, 10)} ---\nDOB 12 Jun 1996 · Dubai-born · Herenstraat 32, 1506 DL Zaandam\nHobbies: ${realCv.hobbies.join(", ")}`.trim(),
        enrichedAt: new Date(), updatedAt: new Date(),
      }).where(eq(adminCareerProfile.id, p.id)).returning();

      // ── Seed founder_profile sections so Urban AI (platform-wide assistant) speaks the real Riki ──
      const sections: Array<[string, string, string, number]> = [
        ["bio", "Who Riki Is",
`Riki Almouti — born 12 June 1996 in Dubai, raised between Lebanon and the Netherlands, now based in Zaandam (Greater Amsterdam). Founder, cultural entrepreneur, AI specialist and professional dancer. Combines creative direction, technical execution and community leadership in everything he builds.`, 1],
        ["mission", "Mission",
`Combine creativity, technology and community impact. Grow cultural and creative initiatives through partnerships, grants and innovative projects. Give youth and adults real space to develop physically, mentally and socially through dance, street art and music.`, 2],
        ["ventures", "What Riki Built",
`• Urban Culture Hub (Founder & Builder, 2024–) — national NL platform for urban culture: 30k+ mapped spots, AI Finder, events, community, bookings, tickets, full AI integration across the stack.
• Stichting Coffee & Dance (Chairman, 2024–) — cultural foundation producing Back to the Street and TurboVision; municipal partnerships and cultural grants.
• Dance Healthy (Founder, 2021–) — movement, dance and healthy-living community; events, festivals and sport days for companies, schools and refugee shelters.`, 3],
        ["experience", "Experience Snapshot",
`Founder Dance Healthy (Oct 2021–present) · Chairman Stichting Coffee & Dance, Amsterdam (2024–present) · Marketing & Social Media Manager at Ser.vi Amsterdam/USA (Oct 2022–Jan 2024) · AI Specialist & Content Automation (ongoing) · Social Media Manager (volunteer) at ZTTC · Certified Drone Videographer.`, 4],
        ["education", "Education",
`HBO Dans — Lucia Marthas Institute For Performing Arts (Amsterdam, 2015–2016) · Bachelor Computer Science — American University of Science and Technology, Beirut (2014–2015) · HAVO Sociologie & Economie — Beirut, Lebanon (2007–2013) · Courses: HTML/CSS/JavaScript, Drone Pilot.`, 5],
        ["ai_expertise", "AI Expertise",
`Deep practitioner across the modern AI stack: ChatGPT, Claude, DeepSeek, Notion AI, Grammarly AI for text · ElevenLabs, Speechify for voice · InVideo, Runway ML, Descript, Veed.io for video · Stable Diffusion, MidJourney, Canva AI, Adobe Firefly for image and brand. Builds end-to-end automated content, voice, video, branding and product workflows.`, 6],
        ["skills", "Skills",
`Creative direction · Event production at scale · Cultural programming · Community leadership · Marketing & social media · AI content automation · Product building (HTML/CSS/JavaScript + AI integrations) · Grant writing & municipal partnerships · Drone cinematography · Professional dance (breaking, hip-hop).`, 7],
        ["languages", "Languages",
`English (fluent) · Nederlands (fluent) · العربية / Arabic (native).`, 8],
        ["hobbies", "Hobbies & Athletic Background",
`Professional dancer · professional rollerblader · professional table-tennis player · horseback riding · bouldering. Energetic, social, creative — moves through life with rhythm and discipline.`, 9],
        ["contact", "Contact",
`Email rmaru2889@gmail.com · Phone +31 6 8418 6452 · Web dancehealthy.nl · Based Herenstraat 32, 1506 DL Zaandam, Netherlands.`, 10],
        ["positioning", "How To Talk About Him",
`Rare hybrid: professional performer → cultural entrepreneur → AI builder shipping real products. Moves fluently between creative, technical, community and municipal/grant worlds. Tri-lingual (EN/NL/AR), born in Dubai, built in NL. Position him as a Cultural Programs Director, Creative Director / Producer, AI Product Lead, Founder-in-Residence, Community & Partnerships Lead, Marketing & Brand Director, or Innovation Lead at the intersection of culture × tech.`, 11],
      ];
      for (const [key, label, content, sortOrder] of sections) {
        await storage.upsertFounderProfileSection(key, label, content, sortOrder);
      }

      res.json({
        ok: true, profile: updated,
        founderSectionsWritten: sections.length,
        message: "Real CV imported. Career suite filled, and Urban AI now knows the real Riki across the entire platform for every user.",
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── MEGA START — one prompt → full profile + 8 CVs + portfolio + public link ──
  app.post("/api/admin/career/mega-start", requireAdmin, async (req, res) => {
    try {
      const { prompt, language = "en", templateIds, audience = "creative" } = req.body ?? {};
      if (!prompt || prompt.length < 50) return res.status(400).json({ error: "prompt too short — give the AI something to work with" });

      const p = await ensureProfile((req as any).user?.id);
      const adm = await gatherAdminContext();
      const adminBlock = adminContextForPrompt(adm);

      // 1) MAGIC PROFILE FILL — Claude Opus reads everything and writes a richly-structured profile
      const r1 = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.6, maxTokens: 5000,
        system: "You are a top-tier personal branding strategist. Take the user's brief, merge with their existing profile and admin AI context, and produce a complete, high-level professional profile. Be specific, professional, recruiter-ready. Reply with valid JSON only.",
        messages: [{ role: "user", content: `The user wrote this brief:
"""${prompt}"""

Existing profile to merge with (don't lose data):
${profileSummaryForAI(p)}

${adminBlock ? `Additional admin AI knowledge:\n${adminBlock}\n` : ""}

Return JSON (only fields you have content for):
{
  "fullName": "...",
  "headline": "1-line professional headline that POPS — should make a recruiter stop scrolling",
  "location": "...",
  "story": "3-paragraph narrative — origin → turning point → present mission. Modern, premium, real.",
  "ventures": [{"name":"","role":"","period":"","summary":"","impact":"concrete outcome"}],
  "experience": [{"title":"","org":"","period":"","summary":"","achievements":["measurable wins"]}],
  "education": [{"degree":"","institution":"","period":""}],
  "skills": [{"name":"","category":"e.g. Leadership / Tech / Creative / Operations"}],
  "languages": [{"name":"","level":""}],
  "achievements": ["7-10 punchy career achievements"],
  "targetRoles": ["8 distinct role ideas the brief points toward"],
  "positioning": "1-paragraph elevator positioning — why this person, why now",
  "strengths": ["6-8 strengths"],
  "uniqueValueProps": ["4-6 sharp differentiators"]
}` }],
      });
      const parsed = tryParseJson(r1.text);
      if (!parsed) return res.status(502).json({ error: "AI profile-fill failed" });
      const merge = (a: any, b: any) => (Array.isArray(b) && b.length ? b : a);
      const updateData: any = {
        fullName: parsed.fullName || p.fullName,
        headline: parsed.headline || p.headline,
        location: parsed.location || p.location,
        story: parsed.story || p.story,
        ventures: merge(p.ventures, parsed.ventures),
        experience: merge(p.experience, parsed.experience),
        education: merge(p.education, parsed.education),
        skills: merge(p.skills, parsed.skills),
        languages: merge(p.languages, parsed.languages),
        achievements: merge(p.achievements, parsed.achievements),
        targetRoles: merge(p.targetRoles, parsed.targetRoles),
        positioning: parsed.positioning || p.positioning,
        strengths: merge(p.strengths, parsed.strengths),
        uniqueValueProps: merge(p.uniqueValueProps, parsed.uniqueValueProps),
        rawNotes: `${p.rawNotes || ""}\n\n--- mega-start brief ${new Date().toISOString().slice(0, 10)} ---\n${prompt}`.trim(),
        publicSlug: p.publicSlug || (parsed.fullName || p.fullName || "me").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40),
        publicEnabled: true,
        enrichedAt: new Date(), updatedAt: new Date(),
      };
      const [updated] = await db.update(adminCareerProfile).set(updateData).where(eq(adminCareerProfile.id, p.id)).returning();
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));

      // 2) BULK CV GENERATION — one CV per template
      const ids: string[] = (templateIds && templateIds.length) ? templateIds : Object.keys(CAREER_TEMPLATES);
      const cvResults: any[] = [];
      const adminBlock2 = adminContextForPrompt(adm);
      const ctxText = profileSummaryForAI(updated, projects) + (adminBlock2 ? `\n\n${adminBlock2}` : "");
      for (const id of ids) {
        const tpl = CAREER_TEMPLATES[id]; if (!tpl) continue;
        try {
          const cr = await aiChat({
            role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.balanced,
            jsonMode: true, temperature: 0.55, maxTokens: 3500,
            system: "You are a world-class CV writer. Reply with valid JSON only.",
            messages: [{ role: "user", content: `Write a CV.

${ctxText}

═══ CV REQUEST ═══
Template: ${tpl.label}
Angle: ${tpl.angle}
Style: ${tpl.style}
Target role: ${tpl.targetRole}
Language: ${language === "nl" ? "Dutch" : "English"}

Return JSON:
{ "summary": "...", "skills": [{"category":"","items":[]}], "experience": [{"title":"","org":"","period":"","bullets":[]}], "ventures": [{"name":"","role":"","period":"","summary":"","highlights":[]}], "education": [{"degree":"","institution":"","period":""}], "languages": [{"name":"","level":""}], "achievements": [], "aiNotes": "what was emphasized & why" }` }],
          });
          const content = tryParseJson(cr.text); if (!content) continue;
          const aiNotes = content.aiNotes; delete content.aiNotes;
          const [created] = await db.insert(adminCareerCvs).values({
            profileId: updated.id, name: `${tpl.label} CV`, style: tpl.style,
            language, targetRole: tpl.targetRole, content, aiNotes,
          }).returning();
          cvResults.push(created);
        } catch (e: any) { /* skip individual failures */ }
      }

      // 3) PORTFOLIO NARRATIVE
      let portfolio: any = null;
      try {
        const pr = await aiChat({
          role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
          jsonMode: true, temperature: 0.7, maxTokens: 3500,
          system: "You are a top-tier portfolio editor. Reply with valid JSON only.",
          messages: [{ role: "user", content: `Build a portfolio narrative.\n\n${ctxText}\n\nAudience: ${audience}\nLanguage: ${language}\n\nReturn JSON: { "hero": { "headline":"", "subhead":"", "tagline":"" }, "story":"3-paragraph", "pillars":[{"title":"","blurb":"","metric":""}], "featuredProjects":[{"title":"","narrative":"","impact":"","tags":[]}], "skillsCloud":[], "callToAction":{"primary":"","secondary":""}, "videoScript":"60-90s", "soundbites":[] }` }],
        });
        portfolio = tryParseJson(pr.text);
      } catch {}

      res.json({ profile: updated, cvs: cvResults, portfolio, publicUrl: `/p/${updated.publicSlug}` });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── PHOTO UPLOAD (avatar / cover) ───────────────────────────────────────
  app.post("/api/admin/career/profile/photo", requireAdmin, async (req, res) => {
    try {
      const { dataUrl, kind = "avatar" } = req.body ?? {};
      if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
        return res.status(400).json({ error: "dataUrl must be a base64 image" });
      }

      let finalUrl = dataUrl; // default: store data URL directly (no Cloudinary needed)

      // Try Cloudinary if configured — fall back to data URL silently if not
      const cloudinaryConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
      if (cloudinaryConfigured) {
        const folder = `urban-culture/career/${kind}`;
        const r = await uploadImage(dataUrl, folder);
        if (r.success && r.url) finalUrl = r.url;
        // If Cloudinary fails even when configured, still fall back to data URL
      }

      const p = await ensureProfile((req as any).user?.id);
      const patch: any = { updatedAt: new Date() };
      if (kind === "cover") patch.coverUrl = finalUrl; else patch.avatarUrl = finalUrl;
      const [updated] = await db.update(adminCareerProfile).set(patch).where(eq(adminCareerProfile.id, p.id)).returning();
      res.json({ url: finalUrl, profile: updated });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── VOICE POLISH — clean up raw voice transcript for CV use ────────────
  app.post("/api/admin/career/profile/voice-polish", requireAdmin, async (req, res) => {
    try {
      const { transcript, fieldHint = "story" } = req.body ?? {};
      if (!transcript || typeof transcript !== "string" || transcript.trim().length < 3) {
        return res.status(400).json({ error: "transcript required" });
      }
      const fieldContext: Record<string, string> = {
        story: "professional personal story / narrative for a CV",
        notes: "raw career brain-dump notes",
        summary: "professional summary / elevator pitch",
      };
      const context = fieldContext[fieldHint] || "professional career content";
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.balanced,
        temperature: 0.35, maxTokens: 1500,
        system: "You clean up spoken voice transcripts for professional career use. Fix grammar, remove filler words (um, uh, like, you know), fix repetitions, add punctuation. Preserve the speaker's authentic voice, real names, and all facts. Output ONLY the polished text — no intro sentence, no preamble, no quotes.",
        messages: [{ role: "user", content: `The user spoke this out loud for their ${context}. Clean it up:\n\n"""${transcript.trim()}"""\n\nReturn only the polished text.` }],
      });
      res.json({ polished: r.text.trim() });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── CV SCORE & MASTER — score profile against a job + generate tailored CV ──
  app.post("/api/admin/career/cvs/score-and-master", requireAdmin, async (req, res) => {
    try {
      const { jobTitle = "", jobDescription, style = "modern", language = "en" } = req.body ?? {};
      if (!jobDescription || jobDescription.trim().length < 30) {
        return res.status(400).json({ error: "jobDescription required (min 30 chars)" });
      }
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));
      const scoreLang = langCode(language);
      const scoreLangMeta = LANGUAGE_GUIDES[scoreLang];
      const profileCtx = await fullContextForAI(p, projects, scoreLang);

      // 1) Scoring analysis
      const scoreR = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.4, maxTokens: 2500,
        system: `You are a senior recruiter and career coach. Objectively compare a candidate's profile to a job description. Be honest — not too harsh, not too lenient. Reply with valid JSON only.\n\n⚠️ Write ALL text values in ${scoreLangMeta.name}. Do NOT use English unless the language is English.`,
        messages: [{ role: "user", content: `Score this candidate for the job.

${profileCtx}

═══ JOB ═══
Title: ${jobTitle || "(see description)"}
Description:
"""${jobDescription}"""
═══════════

Return JSON:
{
  "fitScore": <0-100 integer>,
  "verdict": "1 sentence overall verdict — honest and direct",
  "matchedStrengths": ["top 4-5 genuine matches between profile and job"],
  "gaps": ["2-4 real gaps — skills, experience, or framing gaps the candidate should address"],
  "powerMoves": ["3-4 specific things they should emphasize or reframe to win this role"],
  "cvHeadline": "rewritten headline optimised for this specific job — compelling, role-specific",
  "applicationTip": "1 sharp piece of tactical advice for the application"
}` }],
      });
      const score = tryParseJson(scoreR.text);
      if (!score) return res.status(502).json({ error: "Score AI failed" });

      // 2) Generate the powered/tailored CV
      const cvR = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.5, maxTokens: 4000,
        system: `You are a world-class CV writer. Write a CV that maximizes this candidate's chances for this specific job. Never fabricate facts. Reply with valid JSON only.\n\n⚠️ OUTPUT LANGUAGE: ${scoreLangMeta.name}. Every string in the JSON must be in ${scoreLangMeta.name}.`,
        messages: [{ role: "user", content: `Write a MASTER CV tailored to this specific job.

${profileCtx}

═══ JOB TO TARGET ═══
Title: ${jobTitle || "(see description)"}
Description:
"""${jobDescription}"""
Recruiter's power moves to apply: ${(score.powerMoves || []).join("; ")}
Headline to use: ${score.cvHeadline || ""}
═══════════════════

Return JSON exactly:
{
  "name": "Master CV — ${jobTitle || "Tailored"}",
  "summary": "4-5 sentence professional summary laser-focused on this job",
  "skills": [{"category": "...", "items": ["..."]}],
  "experience": [{"title":"","org":"","location":"","period":"","bullets":["impact-led bullet"]}],
  "ventures": [{"name":"","role":"","period":"","summary":"","highlights":[]}],
  "education": [{"degree":"","institution":"","period":"","notes":""}],
  "languages": [{"name":"","level":""}],
  "achievements": ["..."],
  "aiNotes": "what was emphasized and why, for review"
}` }],
      });
      const cvContent = tryParseJson(cvR.text);
      if (!cvContent) return res.status(502).json({ error: "CV generation failed", score });

      const aiNotes = cvContent.aiNotes; delete cvContent.aiNotes;
      const cvName = cvContent.name || `Master CV — ${jobTitle || "Tailored"}`;
      delete cvContent.name;

      const [created] = await db.insert(adminCareerCvs).values({
        profileId: p.id, name: cvName, style: style as any, language: langCode(language),
        targetRole: jobTitle, targetJobDescription: jobDescription, content: cvContent, aiNotes,
      }).returning();

      res.json({ score, cv: created });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── ADMIN-AI CONTEXT (preview what's being fed to Claude) ───────────────
  app.get("/api/admin/career/admin-context", requireAdmin, async (_req, res) => {
    const ctx = await gatherAdminContext();
    res.json({
      preview: adminContextForPrompt(ctx),
      sources: {
        marketingBrain: !!ctx.marketing,
        founderProfileSections: ctx.founder.length,
        trainingEntries: ctx.training.length,
        instagramPersona: !!ctx.igPersona,
      },
    });
  });

  // ── SYNC FROM ADMIN AI — pull marketing brain + founder + training into the career profile ──
  app.post("/api/admin/career/profile/sync-from-admin", requireAdmin, async (req, res) => {
    try {
      const p = await ensureProfile((req as any).user?.id);
      const ctx = await gatherAdminContext();
      const adminBlock = adminContextForPrompt(ctx);
      if (!adminBlock) return res.status(400).json({ error: "No admin AI data to sync. Fill out Marketing Brain / Founder Profile / Training Entries first." });

      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.5, maxTokens: 4500,
        system: "You merge the user's marketing/brand/founder knowledge into their career profile. Keep existing profile data — only ADD or ENRICH. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Use the admin AI knowledge below to enrich this person's career profile. Pull product features into achievements/projects, weave brand voice into positioning, lift personal stories from training entries into the narrative, surface anything that proves their professional capability.

${profileSummaryForAI(p)}

${adminBlock}

Return JSON, only including fields where you have new/improved content. Don't invent facts.
{
  "story": "... richer 2-3 paragraph narrative if you can write a better one",
  "ventures": [{"name":"","role":"","period":"","summary":"","impact":""}],
  "achievements": ["... shipped/built things to add"],
  "skills": [{"name":"","category":""}],
  "positioning": "...",
  "strengths": ["..."],
  "uniqueValueProps": ["..."],
  "rawNotes": "... append distilled knowledge nuggets that don't fit elsewhere"
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI did not return valid JSON" });

      const dedupe = (existing: any[], incoming: any[], key: string) => {
        const seen = new Set((existing || []).map((x: any) => (x?.[key] || "").toLowerCase()));
        return [...(existing || []), ...((incoming || []).filter((x: any) => x?.[key] && !seen.has(String(x[key]).toLowerCase())))];
      };
      const update: any = {
        story: parsed.story || p.story,
        ventures: dedupe(p.ventures as any[], parsed.ventures || [], "name"),
        skills: dedupe(p.skills as any[], parsed.skills || [], "name"),
        achievements: Array.from(new Set([...((p.achievements as any[]) || []), ...((parsed.achievements as any[]) || [])])),
        positioning: parsed.positioning || p.positioning,
        strengths: Array.from(new Set([...((p.strengths as any[]) || []), ...((parsed.strengths as any[]) || [])])),
        uniqueValueProps: Array.from(new Set([...((p.uniqueValueProps as any[]) || []), ...((parsed.uniqueValueProps as any[]) || [])])),
        rawNotes: parsed.rawNotes ? `${p.rawNotes || ""}\n\n--- synced from admin AI ${new Date().toISOString().slice(0, 10)} ---\n${parsed.rawNotes}`.trim() : p.rawNotes,
        enrichedAt: new Date(), updatedAt: new Date(),
      };
      const [updated] = await db.update(adminCareerProfile).set(update).where(eq(adminCareerProfile.id, p.id)).returning();
      res.json({ profile: updated, sourcesUsed: { marketingBrain: !!ctx.marketing, founderSections: ctx.founder.length, trainingEntries: ctx.training.length, instagramPersona: !!ctx.igPersona } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TEMPLATES (industry presets) ────────────────────────────────────────
  app.get("/api/admin/career/templates", requireAdmin, (_req, res) => {
    res.json(Object.entries(CAREER_TEMPLATES).map(([id, t]) => ({ id, ...t })));
  });

  // ── MAGIC START — give a single prompt, Claude fills the whole profile ──
  app.post("/api/admin/career/profile/magic", requireAdmin, async (req, res) => {
    try {
      const { prompt, language } = req.body ?? {};
      if (!prompt || prompt.length < 20) return res.status(400).json({ error: "prompt too short" });
      const p = await ensureProfile((req as any).user?.id);

      // Detect language from the prompt itself if not explicitly provided.
      const detectFromText = (txt: string): SupportedLang => {
        if (/[\u0600-\u06FF]/.test(txt)) return "ar";
        const t = txt.toLowerCase();
        if (/\b(ik ben|mijn naam|werk|ondernemer|nederland|amsterdam|jaren|nederlands)\b/.test(t)) return "nl";
        if (/\b(je suis|mon nom|travaille|entrepreneur|france|paris|années|français)\b/.test(t)) return "fr";
        if (/\b(ich bin|mein name|arbeite|unternehmer|deutschland|berlin|jahre|deutsch)\b/.test(t)) return "de";
        if (/\b(soy|me llamo|trabajo|emprendedor|españa|madrid|años|español)\b/.test(t)) return "es";
        return "en";
      };
      const magicLang = langCode(language) !== "en" ? langCode(language) : detectFromText(prompt);

      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.6, maxTokens: 4000,
        system: "You expand a short personal description into a richly detailed, structured career profile. Be specific, infer reasonable details from the prompt, ground claims in what the user said. Always reply with valid JSON only.",
        messages: [{ role: "user", content: `The user wrote this about themselves:
"""${prompt}"""

Existing profile (merge intelligently — don't lose existing data unless they clearly contradict it):
${await fullContextForAI(p, [], magicLang)}

Return JSON with these fields (only include fields you have content for; arrays may be empty):
{
  "fullName": "...",
  "headline": "...",
  "location": "...",
  "story": "2-3 paragraph rich personal narrative",
  "ventures": [{"name":"","role":"","period":"","summary":"","impact":""}],
  "experience": [{"title":"","org":"","period":"","summary":"","achievements":[]}],
  "education": [{"degree":"","institution":"","period":""}],
  "skills": [{"name":"","category":""}],
  "languages": [{"name":"","level":""}],
  "achievements": ["..."],
  "targetRoles": ["..."],
  "positioning": "1-paragraph positioning",
  "strengths": ["..."],
  "uniqueValueProps": ["..."]
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI did not return valid JSON" });

      const merge = (existing: any, incoming: any) => (Array.isArray(incoming) && incoming.length ? incoming : existing);
      const update: any = {
        fullName: parsed.fullName || p.fullName,
        headline: parsed.headline || p.headline,
        location: parsed.location || p.location,
        story: parsed.story || p.story,
        ventures: merge(p.ventures, parsed.ventures),
        experience: merge(p.experience, parsed.experience),
        education: merge(p.education, parsed.education),
        skills: merge(p.skills, parsed.skills),
        languages: merge(p.languages, parsed.languages),
        achievements: merge(p.achievements, parsed.achievements),
        targetRoles: merge(p.targetRoles, parsed.targetRoles),
        positioning: parsed.positioning || p.positioning,
        strengths: merge(p.strengths, parsed.strengths),
        uniqueValueProps: merge(p.uniqueValueProps, parsed.uniqueValueProps),
        enrichedAt: new Date(),
        updatedAt: new Date(),
      };
      const [updated] = await db.update(adminCareerProfile).set(update).where(eq(adminCareerProfile.id, p.id)).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── BULK CV GENERATION (one click → all template variants) ──────────────
  app.post("/api/admin/career/cvs/generate-templates", requireAdmin, async (req, res) => {
    try {
      const { templateIds = [], language = "en" } = req.body ?? {};
      const ids: string[] = templateIds.length ? templateIds : Object.keys(CAREER_TEMPLATES);
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));

      const results: any[] = [];
      for (const id of ids) {
        const tpl = CAREER_TEMPLATES[id]; if (!tpl) continue;
        try {
          const r = await aiChat({
            role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.balanced,
            jsonMode: true, temperature: 0.55, maxTokens: 3500,
            system: "You are a world-class CV writer. Reply with valid JSON only.",
            messages: [{ role: "user", content: `Write a CV.

${await fullContextForAI(p, projects, langCode(language))}

═══ CV REQUEST ═══
Template: ${tpl.label}
Angle: ${tpl.angle}
Style: ${tpl.style}
Target role: ${tpl.targetRole}

Return JSON (all string values written in the target language defined above):
{ "summary": "...", "skills": [{"category":"","items":[]}], "experience": [{"title":"","org":"","period":"","bullets":[]}], "ventures": [{"name":"","role":"","period":"","summary":"","highlights":[]}], "education": [{"degree":"","institution":"","period":""}], "languages": [{"name":"","level":""}], "achievements": [], "aiNotes": "what was emphasized & why (in English regardless of CV language)" }` }],
          });
          const content = tryParseJson(r.text); if (!content) continue;
          const aiNotes = content.aiNotes; delete content.aiNotes;
          const [created] = await db.insert(adminCareerCvs).values({
            profileId: p.id, name: `${tpl.label} CV`, style: tpl.style,
            language: langCode(language), targetRole: tpl.targetRole, content, aiNotes,
          }).returning();
          results.push(created);
        } catch (e: any) { results.push({ error: e.message, templateId: id }); }
      }
      res.json({ created: results.length, cvs: results });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── PROFILE: Claude enrichment ──────────────────────────────────────────
  app.post("/api/admin/career/profile/enrich", requireAdmin, async (req, res) => {
    try {
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));

      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.6, maxTokens: 2500,
        system: "You are an elite career strategist. You analyze a person's full background and surface their real positioning. You never invent facts. You write tight, confident, modern copy. Always reply with valid JSON only.",
        messages: [{ role: "user", content: `Analyze this person and produce a strategic positioning JSON.

${await fullContextForAI(p, projects, "en")}

Return JSON exactly like (English — strategist's notes are always in English):
{
  "headline": "1-line professional headline (max 90 chars) capturing who they are",
  "positioning": "1 paragraph (3-4 sentences) elevator positioning a recruiter would remember",
  "strengths": ["6-8 specific strengths grounded in real evidence from their story"],
  "uniqueValueProps": ["4-6 differentiators — what nobody else in the same field has"],
  "targetRoles": ["6-10 realistic role titles they should pursue"],
  "story": "If their story field is weak, rewrite a richer 2-paragraph personal story; otherwise return null",
  "hiddenAssets": ["3-5 things in their background they're under-leveraging"],
  "blindSpots": ["2-3 honest weak spots to address before applying"]
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI did not return valid JSON", raw: r.text });

      const update: any = {
        headline: parsed.headline || p.headline,
        positioning: parsed.positioning,
        strengths: parsed.strengths || [],
        uniqueValueProps: parsed.uniqueValueProps || [],
        targetRoles: parsed.targetRoles || [],
        enrichedAt: new Date(),
        updatedAt: new Date(),
      };
      if (parsed.story && (!p.story || p.story.length < 200)) update.story = parsed.story;
      const [updated] = await db.update(adminCareerProfile).set(update).where(eq(adminCareerProfile.id, p.id)).returning();
      res.json({ profile: updated, hiddenAssets: parsed.hiddenAssets, blindSpots: parsed.blindSpots });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── CVs ─────────────────────────────────────────────────────────────────
  app.get("/api/admin/career/cvs", requireAdmin, async (_req, res) => {
    const rows = await db.select().from(adminCareerCvs).orderBy(desc(adminCareerCvs.updatedAt));
    res.json(rows);
  });

  app.get("/api/admin/career/cvs/:id", requireAdmin, async (req, res) => {
    const [row] = await db.select().from(adminCareerCvs).where(eq(adminCareerCvs.id, Number(req.params.id))).limit(1);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });

  app.post("/api/admin/career/cvs/generate", requireAdmin, async (req, res) => {
    try {
      const { style = "modern", theme = "", language = "en", targetRole = "", targetJobDescription = "", name } = req.body ?? {};
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));

      const styleGuide: Record<string, string> = {
        modern: "Clean, confident, mildly creative. Short bullets. Quantify impact. Sound human, not corporate.",
        corporate: "Polished, formal, results-driven. Conservative wording. Heavy emphasis on metrics, leadership, scale.",
        creative: "Distinctive voice, vivid verbs, story-led. Show personality. Use unconventional section headers.",
        startup: "Fast, scrappy, outcomes-only. Lead with what was built and what shipped. Comfortable with ambiguity language.",
      };

      const lang = langCode(language);
      const langMeta = LANGUAGE_GUIDES[lang];
      const langDirective = languageDirective(lang);

      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.55, maxTokens: 4000,
        system: `You are a world-class CV writer. You craft CVs that get interviews. You quantify impact, cut filler, surface hidden strengths. You ground every claim in the source material — never invent facts. Always reply with valid JSON only.

⚠️ OUTPUT LANGUAGE: ${langMeta.name} (${langMeta.nativeName}). Every string value in the JSON — summary, bullets, skills, everything — MUST be written in ${langMeta.name}. Do NOT write in English unless the selected language is English.`,
        messages: [{ role: "user", content: `▶ TASK: Write a professional CV in ${langMeta.name}.

${langDirective}

━━━ CANDIDATE PROFILE ━━━
${await fullContextForAI(p, projects, lang)}

━━━ CV REQUEST ━━━
Language: ${langMeta.name} — ALL text in the JSON must be in ${langMeta.name}.
Style: ${style} — ${styleGuide[style] || styleGuide.modern}
${targetRole ? `Target role: ${targetRole}\n` : ""}${targetJobDescription ? `Target job description:\n"""${targetJobDescription}"""\nTailor every section subtly toward this job — but don't lie.\n` : ""}
━━━━━━━━━━━━━━━━━

Return JSON exactly like:
{
  "name": "${name || `CV — ${style}${targetRole ? ` — ${targetRole}` : ""} (${langMeta.name})`}",
  "summary": "3-4 sentence professional summary IN ${langMeta.name}",
  "skills": [{"category": "Category name in ${langMeta.name}", "items": ["..."]}, ...],
  "experience": [{"title": "...", "org": "...", "location": "...", "period": "...", "bullets": ["impact-led bullet in ${langMeta.name}", "..."]}],
  "ventures": [{"name": "...", "role": "...", "period": "...", "summary": "1-2 lines in ${langMeta.name}", "highlights": ["..."]}],
  "projects": [{"title": "...", "summary": "...", "impact": "..."}],
  "education": [{"degree": "...", "institution": "...", "period": "...", "notes": "..."}],
  "languages": [{"name": "Dutch", "level": "Native"}],
  "achievements": ["..."],
  "pressAndAwards": [{"title": "...", "source": "...", "year": "..."}],
  "interests": ["short tagline list"],
  "aiNotes": "1 paragraph in ${langMeta.name}: what you emphasized, what you de-emphasized, and why"
}` }],
      });
      const content = tryParseJson(r.text);
      if (!content) return res.status(502).json({ error: "AI did not return valid JSON" });
      const aiNotes = content.aiNotes;
      delete content.aiNotes;
      const cvName = content.name || `CV — ${style}${targetRole ? ` — ${targetRole}` : ""}`;
      delete content.name;

      const [created] = await db.insert(adminCareerCvs).values({
        profileId: p.id, name: cvName, style: theme || style, language, targetRole, targetJobDescription,
        content, aiNotes,
      }).returning();
      res.json(created);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── SMART TAILOR — job title required, description optional ───────────────
  // Pass 1: Claude reads full profile and decides what to highlight/drop/reorder
  // Pass 2: Claude writes the final CV using only the curated selection
  app.post("/api/admin/career/cvs/smart-tailor", requireAdmin, async (req, res) => {
    try {
      const {
        jobTitle,
        jobDescription = "",   // optional
        language = "en",
        style = "modern",
        theme = "",
      } = req.body ?? {};

      if (!jobTitle || String(jobTitle).trim().length < 2) {
        return res.status(400).json({ error: "jobTitle is required" });
      }

      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));
      const lang = langCode(language);
      const langMeta = LANGUAGE_GUIDES[lang];
      const fullCtx = await fullContextForAI(p, projects, lang);

      // ── PASS 1: curation strategy ────────────────────────────────────────
      const curationR = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.3, maxTokens: 1500,
        system: `You are a senior career strategist. Your job is to read a candidate's full profile and decide — for a specific role — what to highlight, what to downplay, what order to put things in, and what to cut. Be decisive. Reply with valid JSON only.`,
        messages: [{ role: "user", content: `Analyse this profile for the target role and give me a curation plan.

${fullCtx}

═══ TARGET ROLE ═══
Job title: ${jobTitle}
${jobDescription ? `Job description:\n"""${jobDescription}"""` : "(No job description provided — infer from job title and industry norms)"}
═══════════════════

Return JSON:
{
  "fitScore": <0-100>,
  "topStrengths": ["3-5 genuine profile strengths that match this role"],
  "gaps": ["1-3 honest gaps — skills or experience missing for this role"],
  "highlight": ["exact experience titles / venture names / skills to PUT FIRST — most relevant"],
  "downplay": ["experience titles / items to move to bottom or omit — not relevant for this role"],
  "omit": ["items that hurt more than help for this role — leave them out entirely"],
  "sectionOrder": ["summary","experience","ventures","skills","education","achievements","languages"],
  "powerHeadline": "rewritten professional headline optimised for this exact role",
  "keywordsToWeave": ["5-8 keywords from the job that should appear naturally in the CV"],
  "strategistNotes": "2-3 sentence explanation of your curation decisions"
}` }],
      });

      const curation = tryParseJson(curationR.text);
      if (!curation) return res.status(502).json({ error: "Curation pass failed" });

      // ── PASS 2: write the curated CV ──────────────────────────────────────
      const cvR = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.5, maxTokens: 4500,
        system: `You are a world-class CV writer. You have been given a curated selection plan from a career strategist. Your job is to write the CV following that plan exactly — highlight what they said, omit what they said, use the section order they specified. Never fabricate facts. Reply with valid JSON only.

⚠️ OUTPUT LANGUAGE: ${langMeta.name} (${langMeta.nativeName}). Every string value in the JSON MUST be in ${langMeta.name}.`,
        messages: [{ role: "user", content: `Write a smart-tailored CV for this role, following the curation plan.

${languageDirective(lang)}

━━━ CANDIDATE PROFILE ━━━
${fullCtx}

━━━ TARGET ROLE ━━━
Job title: ${jobTitle}
${jobDescription ? `Job description:\n"""${jobDescription}"""` : "(Infer from job title)"}

━━━ CURATION PLAN (follow this exactly) ━━━
Fit score: ${curation.fitScore}/100
Top strengths to lead with: ${(curation.topStrengths || []).join(", ")}
Highlight first: ${(curation.highlight || []).join(", ")}
Downplay (move to bottom): ${(curation.downplay || []).join(", ")}
Omit entirely: ${(curation.omit || []).join(", ")}
Section order: ${(curation.sectionOrder || []).join(" → ")}
Rewritten headline: ${curation.powerHeadline || ""}
Keywords to weave in naturally: ${(curation.keywordsToWeave || []).join(", ")}
Strategist notes: ${curation.strategistNotes || ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return JSON:
{
  "name": "Smart CV — ${jobTitle} (${langMeta.name})",
  "headline": "${curation.powerHeadline || ""}",
  "summary": "4-5 sentence summary laser-focused on ${jobTitle}, in ${langMeta.name}",
  "skills": [{"category": "category in ${langMeta.name}", "items": ["..."]}],
  "experience": [{"title":"...","org":"...","location":"...","period":"...","bullets":["impact bullet in ${langMeta.name}"]}],
  "ventures": [{"name":"...","role":"...","period":"...","summary":"...","highlights":["..."]}],
  "projects": [{"title":"...","summary":"...","impact":"..."}],
  "education": [{"degree":"...","institution":"...","period":"...","notes":"..."}],
  "languages": [{"name":"...","level":"..."}],
  "achievements": ["..."],
  "aiNotes": "brief note on what was highlighted and what was cut, in ${langMeta.name}"
}` }],
      });

      const cvContent = tryParseJson(cvR.text);
      if (!cvContent) return res.status(502).json({ error: "CV write pass failed", curation });

      const aiNotes = cvContent.aiNotes; delete cvContent.aiNotes;
      const cvName = cvContent.name || `Smart CV — ${jobTitle} (${langMeta.name})`;
      delete cvContent.name;

      const [created] = await db.insert(adminCareerCvs).values({
        profileId: p.id,
        name: cvName,
        style: (theme || style) as any,
        language: lang,
        targetRole: jobTitle,
        targetJobDescription: jobDescription || null,
        content: cvContent,
        aiNotes: `FIT: ${curation.fitScore}/100\n\n${curation.strategistNotes || ""}\n\n${aiNotes || ""}`,
      }).returning();

      res.json({ ...created, curation });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/admin/career/cvs/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const patch: any = { ...req.body, updatedAt: new Date() };
    delete patch.id; delete patch.createdAt; delete patch.profileId;
    const [updated] = await db.update(adminCareerCvs).set(patch).where(eq(adminCareerCvs.id, id)).returning();
    res.json(updated);
  });

  app.delete("/api/admin/career/cvs/:id", requireAdmin, async (req, res) => {
    await db.delete(adminCareerCvs).where(eq(adminCareerCvs.id, Number(req.params.id)));
    res.json({ ok: true });
  });

  app.post("/api/admin/career/cvs/:id/tailor", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { jobDescription, jobTitle } = req.body ?? {};
      if (!jobDescription) return res.status(400).json({ error: "jobDescription required" });
      const [cv] = await db.select().from(adminCareerCvs).where(eq(adminCareerCvs.id, id));
      if (!cv) return res.status(404).json({ error: "not found" });

      const cvLang = langCode((cv as any).language);
      const cvLangGuide = languageDirective(cvLang);
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.5, maxTokens: 4000,
        system: "You tailor existing CVs to specific jobs. Re-order, rephrase, emphasize — never fabricate. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Tailor this CV for the job below. Return the updated CV in the same shape.

${cvLangGuide}

ORIGINAL CV JSON (already in ${LANGUAGE_GUIDES[cvLang].name} — keep it in that language):
${JSON.stringify(cv.content, null, 2)}

═══ JOB ═══
Title: ${jobTitle || "(unspecified)"}
Description:
"""${jobDescription}"""
═══════════

Return the same JSON structure as the original CV (same keys), tailored. Add an "aiNotes" field at the root (in English) explaining what you changed and why.` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI did not return valid JSON" });
      const aiNotes = parsed.aiNotes; delete parsed.aiNotes;
      const [created] = await db.insert(adminCareerCvs).values({
        profileId: cv.profileId, name: `${cv.name} → ${jobTitle || "tailored"}`,
        style: cv.style, language: cv.language,
        targetRole: jobTitle, targetJobDescription: jobDescription,
        content: parsed, aiNotes,
      }).returning();
      res.json(created);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TRANSLATE EXISTING CV — Claude rewrites all string content to target language ─
  app.post("/api/admin/career/cvs/:id/translate", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { language } = req.body ?? {};
      const targetLang = langCode(language);
      const guide = LANGUAGE_GUIDES[targetLang];
      const langName = `${guide.name} (${guide.nativeName})`;
      const [cv] = await db.select().from(adminCareerCvs).where(eq(adminCareerCvs.id, id));
      if (!cv) return res.status(404).json({ error: "not found" });

      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.2, maxTokens: 4000,
        system: `You are a professional CV translator who writes natively in the target language — never literal, always idiomatic and recruiter-grade. Translate ALL prose, summaries, bullets, role names, descriptions, and category labels into ${langName}. Keep proper nouns (company names, brand names, person names, city names) UNCHANGED unless they have a well-known native form. Keep dates and metrics intact. Reply with valid JSON only — same shape as input.`,
        messages: [{ role: "user", content: `Translate this CV's full content into ${langName}.

${languageDirective(targetLang)}

Return the EXACT same JSON shape with all string values rewritten in ${langName}. Do not add or remove fields. Do not add commentary.

ORIGINAL CV JSON:
${JSON.stringify(cv.content, null, 2)}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI did not return valid JSON" });
      delete parsed.aiNotes;
      const [updated] = await db.update(adminCareerCvs)
        .set({ content: parsed, language: targetLang })
        .where(eq(adminCareerCvs.id, id))
        .returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── PROJECTS / PORTFOLIO ────────────────────────────────────────────────
  app.get("/api/admin/career/projects", requireAdmin, async (_req, res) => {
    const p = await ensureProfile();
    const rows = await db.select().from(adminCareerProjects)
      .where(eq(adminCareerProjects.profileId, p.id))
      .orderBy(desc(adminCareerProjects.highlight), adminCareerProjects.sortOrder);
    res.json(rows);
  });

  app.post("/api/admin/career/projects", requireAdmin, async (req, res) => {
    const p = await ensureProfile();
    const [created] = await db.insert(adminCareerProjects).values({ ...req.body, profileId: p.id }).returning();
    res.json(created);
  });

  app.patch("/api/admin/career/projects/:id", requireAdmin, async (req, res) => {
    const patch: any = { ...req.body, updatedAt: new Date() };
    delete patch.id; delete patch.createdAt; delete patch.profileId;
    const [updated] = await db.update(adminCareerProjects).set(patch).where(eq(adminCareerProjects.id, Number(req.params.id))).returning();
    res.json(updated);
  });

  app.delete("/api/admin/career/projects/:id", requireAdmin, async (req, res) => {
    await db.delete(adminCareerProjects).where(eq(adminCareerProjects.id, Number(req.params.id)));
    res.json({ ok: true });
  });

  // ── PORTFOLIO BUILDER (Claude assembles a recruiter-ready narrative) ────
  app.post("/api/admin/career/portfolio/build", requireAdmin, async (req, res) => {
    try {
      const { audience = "creative", language = "en" } = req.body ?? {};
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));

      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.7, maxTokens: 3500,
        system: "You are a top-tier portfolio editor. You shape a person's life into a recruiter-ready story that's unforgettable, honest, and modern. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Build a portfolio narrative.

${await fullContextForAI(p, projects, langCode(language))}

Audience: ${audience} (creative | corporate | startup | investor)

Return JSON exactly like (all strings written in the target language defined above):
{
  "hero": { "headline": "...", "subhead": "1 line", "tagline": "5-7 word punch" },
  "story": "3-paragraph richly-written personal story arc — origin, turning point, present mission",
  "pillars": [{"title": "...", "blurb": "1 paragraph", "metric": "1 stat or proof"}],
  "featuredProjects": [{"title": "...", "narrative": "2-3 sentence story", "impact": "...", "tags": []}],
  "skillsCloud": ["...", "..."],
  "callToAction": { "primary": "Hire me for...", "secondary": "Or talk about..." },
  "videoScript": "60-90 second video script in 1st person — hooks in line 1, lands a clear ask in last line",
  "soundbites": ["3-5 quotable lines a recruiter would screenshot"]
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI did not return valid JSON" });
      res.json({ portfolio: parsed, profile: p, projects });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── JOB MATCH ───────────────────────────────────────────────────────────
  app.post("/api/admin/career/match", requireAdmin, async (req, res) => {
    try {
      const { jobTitle, company, location, jobUrl, jobDescription, source = "manual", language } = req.body ?? {};
      if (!jobDescription) return res.status(400).json({ error: "jobDescription required" });
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));

      // Auto-detect cover-letter language from job posting if not specified.
      // Heuristic: NL keywords → nl, FR → fr, DE → de, AR script → ar, ES → es, else en.
      const detectLang = (txt: string): SupportedLang => {
        const t = (txt || "").toLowerCase();
        if (/[\u0600-\u06FF]/.test(txt)) return "ar";
        if (/\b(wij zoeken|gezocht|functie|sollicitatie|salaris|fulltime|parttime|werkervaring|nederland|amsterdam|gemeente)\b/.test(t)) return "nl";
        if (/\b(nous recherchons|poste|salaire|temps plein|cdi|cdd|france|paris|expérience)\b/.test(t)) return "fr";
        if (/\b(wir suchen|stelle|gehalt|vollzeit|teilzeit|berlin|münchen|deutschland|erfahrung)\b/.test(t)) return "de";
        if (/\b(buscamos|puesto|salario|jornada completa|españa|madrid|barcelona|experiencia)\b/.test(t)) return "es";
        return "en";
      };
      const matchLang = langCode(language) || detectLang(jobDescription);

      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.4, maxTokens: 3500,
        system: "You are a brutal-but-fair job-fit analyst with deep recruiter instincts. You score honestly, find real gaps, give concrete actionable rewrite advice, and write a usable cover letter. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Score this job for this candidate, then give them a concrete game plan.

CANDIDATE:
${await fullContextForAI(p, projects, matchLang)}

═══ JOB ═══
Title: ${jobTitle || ""} @ ${company || ""} — ${location || ""}
Description:
"""${jobDescription}"""

Return JSON. Strategist fields (verdict, strengths, gaps, rewriteSuggestions, cvHighlights, cvDeprioritize, portfolioFocus, interviewTalkingPoints, salaryNote, applicationSubject) stay in English for the user's planning view. ONLY coverLetterDraft must be written in ${LANGUAGE_GUIDES[matchLang].name} matching the language the recruiter will read.

{
  "fitScore": 0-100,
  "verdict": "1-line honest verdict (e.g. 'Strong fit — apply', 'Stretch — apply with story', 'Skip')",
  "strengths": ["why this person fits — 3-5 bullets grounded in their ACTUAL ventures by name (Urban Culture Hub / Stichting Coffee & Dance / Dance Healthy / Back to the Street / events / AI tooling)"],
  "gaps": ["honest gaps — 2-4 bullets"],
  "rewriteSuggestions": ["3-5 specific tweaks to make to their CV/portfolio for this job"],
  "cvHighlights": ["3-6 SPECIFIC items from their existing CV/profile to feature prominently — by venture name, role, or metric (e.g. 'Lead with Stichting Coffee & Dance Chairman role + Back to the Street event production')"],
  "cvDeprioritize": ["2-4 SPECIFIC items to soften, shorten, or move to the bottom because they distract from this role (e.g. 'Drop drone certification — irrelevant for this role')"],
  "portfolioFocus": ["2-4 specific projects/events/ventures to lead the portfolio with for THIS role"],
  "interviewTalkingPoints": ["3 ready-to-tell stories from their background that map directly to this job's pain points"],
  "salaryNote": "1-2 sentences on positioning for compensation conversations given this role + their multi-venture leverage",
  "applicationSubject": "Recommended subject line / email opener (in ${LANGUAGE_GUIDES[matchLang].name}) — 6-10 words, attention-grabbing, role-aware",
  "coverLetterDraft": "150-220 word cover letter in ${LANGUAGE_GUIDES[matchLang].name}, 1st person, in the candidate's voice, naming SPECIFIC ventures/events from their real background"
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI did not return valid JSON" });

      const [saved] = await db.insert(adminCareerJobMatches).values({
        profileId: p.id, source, jobTitle, company, location, jobUrl, jobDescription,
        fitScore: parsed.fitScore ?? null, fitAnalysis: parsed,
      }).returning();
      res.json(saved);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/admin/career/matches", requireAdmin, async (_req, res) => {
    const rows = await db.select().from(adminCareerJobMatches).orderBy(desc(adminCareerJobMatches.createdAt));
    res.json(rows);
  });

  app.patch("/api/admin/career/matches/:id", requireAdmin, async (req, res) => {
    const [updated] = await db.update(adminCareerJobMatches).set({ status: req.body.status })
      .where(eq(adminCareerJobMatches.id, Number(req.params.id))).returning();
    res.json(updated);
  });

  app.delete("/api/admin/career/matches/:id", requireAdmin, async (req, res) => {
    await db.delete(adminCareerJobMatches).where(eq(adminCareerJobMatches.id, Number(req.params.id)));
    res.json({ ok: true });
  });

  // ── INSIGHTS (deeper strategic advice on demand) ────────────────────────
  app.post("/api/admin/career/insights", requireAdmin, async (req, res) => {
    try {
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));
      const matches = await db.select().from(adminCareerJobMatches).orderBy(desc(adminCareerJobMatches.createdAt)).limit(10);

      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.6, maxTokens: 2500,
        system: "You are a senior career strategist. You give honest, useful, prioritized advice. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Give strategic career insights (in English — this is the user's planning view).

${await fullContextForAI(p, projects, "en")}

RECENT JOB-MATCH HISTORY (${matches.length}):
${matches.map(m => `- ${m.jobTitle} @ ${m.company} — fit ${m.fitScore} — status ${m.status}`).join("\n") || "(none yet)"}

Return JSON:
{
  "topMoves": [{"action": "...", "why": "...", "effort": "low|med|high", "impact": "low|med|high"}],
  "positioningCritique": "honest 1-paragraph critique of how they're currently positioned",
  "skillGaps": ["specific skills to develop, in order"],
  "bestTargetCompanies": [{"name": "...", "why": "..."}],
  "outreachIdeas": ["3-5 outreach angles that fit their unique story"],
  "longGameAdvice": "1 paragraph 12-month strategic advice"
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI did not return valid JSON" });
      res.json(parsed);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── LINKEDIN BRAIN IMPORT ────────────────────────────────────────────────
  app.post("/api/admin/career/import-linkedin-brain", requireAdmin, async (req, res) => {
    try {
      const { messages = [], extractedData = {}, jobUrl = "", jobDescription = "", generateCv = false, cvStyle = "modern", language = "en" } = req.body ?? {};
      if (!messages.length && !Object.keys(extractedData).length) {
        return res.status(400).json({ error: "No brain data provided" });
      }
      const p = await ensureProfile((req as any).user?.id);
      const convBlock = messages.length
        ? `LINKEDIN AI BRAIN CONVERSATION:\n${messages.map((m: any) => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n\n")}`
        : "";
      const extractBlock = Object.keys(extractedData).length
        ? `EXTRACTED PROFILE FIELDS:\n${JSON.stringify(extractedData, null, 2)}`
        : "";
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.5, maxTokens: 4000,
        system: "You extract and merge career profile data from a LinkedIn AI Brain conversation. Never invent facts. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Extract career data from this LinkedIn AI Brain session and merge it into the person's career profile.

CURRENT PROFILE:
${profileSummaryForAI(p)}

${convBlock}

${extractBlock}

Return JSON with only the fields you have new/better content for:
{
  "fullName": "...",
  "headline": "...",
  "location": "...",
  "story": "2-3 paragraph narrative distilled from the conversation",
  "ventures": [{"name":"","role":"","period":"","summary":"","impact":""}],
  "experience": [{"title":"","org":"","period":"","summary":"","achievements":[]}],
  "education": [{"degree":"","institution":"","period":""}],
  "skills": [{"name":"","category":""}],
  "languages": [{"name":"","level":""}],
  "achievements": ["..."],
  "positioning": "...",
  "strengths": ["..."],
  "uniqueValueProps": ["..."],
  "targetRoles": ["..."]
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI could not extract profile data" });
      const merge = (existing: any, incoming: any) => (Array.isArray(incoming) && incoming.length ? incoming : existing);
      const update: any = {
        fullName: parsed.fullName || p.fullName,
        headline: parsed.headline || p.headline,
        location: parsed.location || p.location,
        story: parsed.story || p.story,
        ventures: merge(p.ventures, parsed.ventures),
        experience: merge(p.experience, parsed.experience),
        education: merge(p.education, parsed.education),
        skills: merge(p.skills, parsed.skills),
        languages: merge(p.languages, parsed.languages),
        achievements: merge(p.achievements, parsed.achievements),
        positioning: parsed.positioning || p.positioning,
        strengths: merge(p.strengths, parsed.strengths),
        uniqueValueProps: merge(p.uniqueValueProps, parsed.uniqueValueProps),
        targetRoles: merge(p.targetRoles, parsed.targetRoles),
        enrichedAt: new Date(), updatedAt: new Date(),
      };
      const [updatedProfile] = await db.update(adminCareerProfile).set(update).where(eq(adminCareerProfile.id, p.id)).returning();
      let cv = null;
      if (generateCv) {
        const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));
        const profileCtx = await fullContextForAI(updatedProfile, projects, langCode(language));
        const jobBlock = jobDescription ? `\nTARGET JOB:\nURL: ${jobUrl || "(not provided)"}\nDescription:\n"""${jobDescription}"""` : "";
        const cvR = await aiChat({
          role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
          jsonMode: true, temperature: 0.5, maxTokens: 4000,
          system: "You are a world-class CV writer. Write a complete, recruiter-ready CV. Reply with valid JSON only.",
          messages: [{ role: "user", content: `Write a ${cvStyle} style CV from this profile.${jobBlock ? " Tailor it to the target job." : ""}

${profileCtx}${jobBlock}

Return JSON:
{
  "name": "Descriptive CV name",
  "summary": "4-5 sentence professional summary",
  "skills": [{"category":"","items":[]}],
  "experience": [{"title":"","org":"","location":"","period":"","bullets":[]}],
  "ventures": [{"name":"","role":"","period":"","summary":"","highlights":[]}],
  "education": [{"degree":"","institution":"","period":""}],
  "languages": [{"name":"","level":""}],
  "achievements": [],
  "aiNotes": "what was emphasized and why"
}` }],
        });
        const cvContent = tryParseJson(cvR.text);
        if (cvContent) {
          const aiNotes = cvContent.aiNotes; delete cvContent.aiNotes;
          const cvName = cvContent.name || `LinkedIn Brain CV — ${new Date().toLocaleDateString()}`;
          delete cvContent.name;
          const [created] = await db.insert(adminCareerCvs).values({
            profileId: p.id, name: cvName, style: cvStyle as any, language: langCode(language),
            targetRole: jobUrl || "", targetJobDescription: jobDescription, content: cvContent, aiNotes,
          }).returning();
          cv = created;
        }
      }
      res.json({ profile: updatedProfile, cv, fieldsUpdated: Object.keys(parsed) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TOOL: INTERVIEW PREP ─────────────────────────────────────────────────
  app.post("/api/admin/career/tools/interview-prep", requireAdmin, async (req, res) => {
    try {
      const { jobTitle = "", jobDescription = "", language = "en" } = req.body ?? {};
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.6, maxTokens: 4500,
        system: "You are a top-tier interview coach. Generate hyper-personalized interview prep using the candidate's real background. Never fabricate facts. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Generate a complete interview prep kit for this candidate.

${await fullContextForAI(p, projects, langCode(language))}

TARGET ROLE: ${jobTitle || "general senior role"}
JOB DESCRIPTION: ${jobDescription || "(none provided — prep for typical senior interview)"}

Return JSON:
{
  "openingStatement": "30-second elevator pitch tailored to this role",
  "questions": [
    {
      "question": "likely interview question",
      "type": "behavioral|technical|situational|motivational",
      "starAnswer": {
        "situation": "specific real situation from their background",
        "task": "what they needed to do",
        "action": "what they did specifically",
        "result": "quantified outcome"
      },
      "tip": "quick delivery tip"
    }
  ],
  "questionsToAsk": ["5 smart questions to ask the interviewer"],
  "redFlags": ["2-3 potential concerns an interviewer might have — prepare for these"],
  "closingStatement": "Strong closing statement / expression of interest"
}
Generate 8-10 questions covering strengths, weaknesses, leadership, failure, culture fit, role-specific, and 2 curveball questions.` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI failed to generate interview prep" });
      res.json(parsed);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TOOL: COVER LETTER STUDIO ────────────────────────────────────────────
  app.post("/api/admin/career/tools/cover-letter", requireAdmin, async (req, res) => {
    try {
      const {
        jobTitle = "", company = "", jobDescription = "",
        tone = "confident", language = "en",
        hiringManager = "",   // new: "Dear Sarah," instead of "Dear Hiring Manager,"
        includePs = true,     // new: whether to add a P.S. line
      } = req.body ?? {};
      if (!jobDescription || jobDescription.trim().length < 30) {
        return res.status(400).json({ error: "Job description required (min 30 chars)" });
      }
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));
      const lang = langCode(language);
      const langMeta = LANGUAGE_GUIDES[lang];

      const toneGuides: Record<string, string> = {
        confident: "Direct, bold, confident. Short punchy sentences. States value upfront. No filler words. Reads like a senior exec wrote it.",
        warm: "Personable, genuine, human. Shows personality behind the CV. Professional but approachable — the reader feels like they already know this person.",
        creative: "Starts with a surprising hook or micro-story from their background. Unexpected angle. Memorable. Shows personality without being gimmicky.",
        formal: "Polished, structured, impeccable business letter format. Conservative vocabulary. Measured confidence. Ideal for corporates, banks, governments.",
        startup: "Casual, fast-paced, culture-driven. Sounds like someone who ships things. Mentions impact over process. Shows they'd fit a lean team.",
      };

      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.65, maxTokens: 3500,
        system: `You are an elite cover letter writer. Your letters get interviews because they read like a real human wrote them — not ChatGPT, not a template.

RULES:
- Tone: ${tone} — ${toneGuides[tone] || toneGuides.confident}
- Language: ${langMeta.name} (${langMeta.nativeName}). Write EVERYTHING in ${langMeta.name}.
- Length: 280-350 words for the main body. NOT shorter, NOT longer.
- Structure: 4 strong paragraphs:
  1. HOOK — compelling opener that makes them stop scrolling. Reference the company/role by name.
  2. PROOF — 2-3 specific achievements from their real background with concrete detail. Name ventures, events, platforms by their real names.
  3. FIT — show you understand their specific needs (drawn from the job description) and connect it to something the candidate actually built/did.
  4. CLOSE — confident ask. Specific next step. Not "I hope to hear from you" — something with more conviction.
- P.S. line: ${includePs ? "Add a P.S. — one unexpected, memorable personal detail that reinforces fit. Should feel human, not corporate." : "No P.S."}
- NEVER start with 'I am writing to apply', 'I am very excited', 'As a passionate', or 'I believe I would be a great fit'.
- NEVER use the word 'passionate', 'synergy', 'leverage', 'dynamic', 'go-getter', or 'team player'.
- ONLY use real facts from the profile. Do NOT invent achievements.
- The ${hiringManager ? `salutation addresses ${hiringManager} personally` : "salutation uses the correct professional greeting for the language — NOT 'Dear Hiring Manager'"}.

Reply with valid JSON only.`,
        messages: [{ role: "user", content: `Write a cover letter for this application.

${languageDirective(lang)}

━━━ CANDIDATE PROFILE ━━━
${await fullContextForAI(p, projects, lang)}

━━━ JOB APPLICATION ━━━
Role: ${jobTitle || "(see description)"}
Company: ${company || "(see description)"}
${hiringManager ? `Hiring manager: ${hiringManager}` : ""}
Job description:
"""${jobDescription}"""
━━━━━━━━━━━━━━━━━━━━━━

Return JSON:
{
  "subject": "Perfect email subject line — 6-10 words, specific to role + company, attention-grabbing",
  "salutation": "Opening salutation in ${langMeta.name}",
  "paragraph1": "HOOK paragraph — compelling opener",
  "paragraph2": "PROOF paragraph — 2-3 specific achievements with real names/numbers",
  "paragraph3": "FIT paragraph — their needs + your proof",
  "paragraph4": "CLOSE paragraph — confident ask with specific next step",
  "postscript": "${includePs ? "P.S. line — unexpected personal detail that reinforces fit" : ""}",
  "coverLetter": "Full letter assembled from the 4 paragraphs above, with salutation and closing, formatted as a single string with \\n\\n between paragraphs",
  "keyHooks": ["3 strongest angles used in this letter — in English (for your reference)"],
  "sendingTips": ["2-3 tactical tips for sending/following up — in English"],
  "emailSubjectVariants": ["2 alternative subject line options"]
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI failed to generate cover letter" });
      res.json(parsed);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── JOB SEARCH — Adzuna API proxy ─────────────────────────────────────────
  // Sign up free at https://developer.adzuna.com — 250 calls/day on free tier.
  // Set ADZUNA_APP_ID and ADZUNA_APP_KEY in Railway Variables.
  app.get("/api/admin/career/jobs/search", requireAdmin, async (req, res) => {
    try {
      const {
        q = "",           // search keywords
        where = "",       // location, e.g. "Amsterdam" or "Netherlands"
        country = "nl",   // ISO country code: nl, gb, us, de, fr, be, etc.
        page = "1",
        resultsPerPage = "10",
        salaryMin = "",
        fulltime = "",
      } = req.query as Record<string, string>;

      const appId  = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;

      if (!appId || !appKey) {
        // Return a helpful mock when keys not set yet
        return res.json({
          configured: false,
          message: "Adzuna API not configured. Add ADZUNA_APP_ID and ADZUNA_APP_KEY to your Railway Variables. Sign up free at https://developer.adzuna.com",
          jobs: [],
          total: 0,
        });
      }

      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: resultsPerPage,
        what: q,
        ...(where ? { where } : {}),
        ...(salaryMin ? { salary_min: salaryMin } : {}),
        ...(fulltime === "1" ? { full_time: "1" } : {}),
        content_type: "application/json",
      });

      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params}`;
      const adzunaRes = await fetch(url, { headers: { "Accept": "application/json" } });

      if (!adzunaRes.ok) {
        const errText = await adzunaRes.text();
        return res.status(502).json({ error: `Adzuna API error: ${adzunaRes.status}`, detail: errText });
      }

      const data: any = await adzunaRes.json();
      const jobs = (data.results || []).map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company?.display_name || "",
        location: j.location?.display_name || "",
        salary: j.salary_min && j.salary_max
          ? `€${Math.round(j.salary_min / 1000)}k – €${Math.round(j.salary_max / 1000)}k`
          : j.salary_min ? `€${Math.round(j.salary_min / 1000)}k+` : "",
        description: j.description || "",
        url: j.redirect_url || "",
        created: j.created,
        category: j.category?.label || "",
        contractType: j.contract_type || "",
      }));

      res.json({ configured: true, total: data.count || 0, jobs });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TOOL: BIO PACK ───────────────────────────────────────────────────────
  app.post("/api/admin/career/tools/bio-pack", requireAdmin, async (req, res) => {
    try {
      const { language = "en", targetRole = "" } = req.body ?? {};
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.65, maxTokens: 3000,
        system: "You write punchy, platform-specific professional bios. Each bio uses only real facts from the profile, optimized for its specific context. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Write 6 professional bios for different contexts, all in ${LANGUAGE_GUIDES[langCode(language) as SupportedLang]?.name || "English"}.

${await fullContextForAI(p, projects, langCode(language))}
${targetRole ? `\nFOCUS ANGLE: ${targetRole}` : ""}

Return JSON:
{
  "twitter": "Twitter/X bio — max 160 chars, punchy, personality + credibility",
  "linkedin": "LinkedIn 'About' first 2-3 sentences — hook + credibility + mission",
  "speaker": "Conference/event speaker intro — 3-4 sentences, credentials + what they speak about",
  "press": "Press/media bio — ~90 words, third person, major highlights only",
  "aboutPage": "Personal website 'About' section opener — 120-150 words, story-led, first person, authentic",
  "elevator": "30-second verbal elevator pitch — conversational, natural, memorable. Written as spoken words.",
  "tips": ["3 tips for using and adapting these bios"]
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI failed to generate bio pack" });
      res.json(parsed);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TOOL: SKILLS GAP RADAR ──────────────────────────────────────────────
  app.post("/api/admin/career/tools/skills-gap", requireAdmin, async (req, res) => {
    try {
      const { targetRole = "", targetCompany = "", language = "en" } = req.body ?? {};
      if (!targetRole) return res.status(400).json({ error: "Target role required" });
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.5, maxTokens: 3500,
        system: "You are a skills gap analyst and learning strategist. Give honest, actionable, prioritized analysis. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Analyze this candidate's skills gap for their target role.

${await fullContextForAI(p, projects, langCode(language))}

TARGET ROLE: ${targetRole}${targetCompany ? `\nTARGET COMPANY: ${targetCompany}` : ""}

Return JSON:
{
  "readinessScore": <0-100>,
  "readinessVerdict": "1-sentence honest verdict on how ready they are for this role",
  "strengths": [{"skill": "...", "evidence": "specific proof from their background", "relevance": "high|med|low"}],
  "gaps": [
    {
      "skill": "skill/knowledge gap",
      "priority": "critical|important|nice-to-have",
      "why": "why this gap matters for the role",
      "howToClose": "specific, actionable steps",
      "timeToClose": "realistic estimate (e.g. 2-4 weeks)",
      "resources": ["specific courses, tools, or projects to do"]
    }
  ],
  "learningPlan": {
    "30days": ["3-4 specific actions to take in month 1"],
    "60days": ["what to focus on in month 2"],
    "90days": ["what to focus on in month 3"]
  },
  "quickWins": ["2-3 things they can do this week to start closing gaps"],
  "hiddenStrengths": ["2-3 underrated strengths from their background for this role"]
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI failed to analyze skills gap" });
      res.json(parsed);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TOOL: SALARY INTELLIGENCE ────────────────────────────────────────────
  app.post("/api/admin/career/tools/salary-intel", requireAdmin, async (req, res) => {
    try {
      const { targetRole = "", location = "", yearsExperience = "", currentSalary = "", language = "en" } = req.body ?? {};
      if (!targetRole) return res.status(400).json({ error: "Target role required" });
      const p = await ensureProfile((req as any).user?.id);
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.balanced,
        jsonMode: true, temperature: 0.4, maxTokens: 2500,
        system: "You are a compensation expert and salary negotiation coach. Provide realistic, research-based salary intelligence. Acknowledge that figures are estimates. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Provide salary intelligence and negotiation strategy for this candidate.

${profileSummaryForAI(p)}

TARGET ROLE: ${targetRole}
LOCATION: ${location || (p.location as string) || "Netherlands"}
YEARS OF EXPERIENCE: ${yearsExperience || "not specified"}
CURRENT SALARY: ${currentSalary || "not disclosed"}

Return JSON:
{
  "salaryRange": {
    "low": "conservative estimate (€/year or local currency)",
    "mid": "realistic mid-range",
    "high": "ambitious but achievable ceiling",
    "currency": "EUR or relevant",
    "notes": "key factors affecting this range"
  },
  "marketPosition": "entry|junior|mid|senior|lead|executive",
  "negotiationScript": {
    "openingAsk": "exact phrasing when asked 'what are your salary expectations?'",
    "anchorNumber": "specific number to anchor on (slightly above mid)",
    "counterOffer": "how to respond if they come in low",
    "whenToWalk": "at what point to walk away"
  },
  "totalCompensation": ["3-4 non-salary items to negotiate (equity, remote, PTO, training budget)"],
  "leveragePoints": ["3-4 genuine strengths that justify higher comp for this specific role"],
  "redFlags": ["2 signals the offer is below market"],
  "marketTrend": "brief note on demand/supply dynamics for this role in this market"
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI failed to generate salary intelligence" });
      res.json(parsed);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TOOL: REFERENCE LETTER DRAFTER ──────────────────────────────────────
  app.post("/api/admin/career/tools/reference-letter", requireAdmin, async (req, res) => {
    try {
      const { refereeName = "", refereeRole = "", relationship = "", targetRole = "", language = "en" } = req.body ?? {};
      if (!refereeName) return res.status(400).json({ error: "Referee name required" });
      const p = await ensureProfile((req as any).user?.id);
      const projects = await db.select().from(adminCareerProjects).where(eq(adminCareerProjects.profileId, p.id));
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.powerful,
        jsonMode: true, temperature: 0.55, maxTokens: 2500,
        system: `You write compelling reference letters in ${LANGUAGE_GUIDES[langCode(language) as SupportedLang]?.name || "English"}. Written from the referee's perspective about the candidate. Use only real facts from the candidate's profile. Warm, specific, genuinely persuasive. Reply with valid JSON only.`,
        messages: [{ role: "user", content: `Write a reference letter draft for ${refereeName} to use/customize.

CANDIDATE PROFILE:
${await fullContextForAI(p, projects, langCode(language))}

REFEREE: ${refereeName}${refereeRole ? ` — ${refereeRole}` : ""}
RELATIONSHIP: ${relationship || "professional collaboration"}
TARGET ROLE: ${targetRole || "general career opportunities"}

Return JSON:
{
  "subject": "Email subject line for sending this reference",
  "letter": "Full reference letter — 3-4 paragraphs, ~300 words, written in first person as ${refereeName}. Specific, warm, credible. Opens with relationship context, details specific contributions and character, closes with strong endorsement.",
  "keyPoints": ["3-4 specific points emphasized in this letter"],
  "sendingInstructions": "Brief note to the referee about customizing and using this draft"
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI failed to generate reference letter" });
      res.json(parsed);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TOOL: ATS SCORE OPTIMIZER ────────────────────────────────────────────
  app.post("/api/admin/career/tools/ats-score", requireAdmin, async (req, res) => {
    try {
      const { cvText = "", jobDescription = "" } = req.body ?? {};
      if (!cvText || cvText.trim().length < 50) return res.status(400).json({ error: "CV text required (min 50 chars)" });
      if (!jobDescription || jobDescription.trim().length < 30) return res.status(400).json({ error: "Job description required (min 30 chars)" });
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.balanced,
        jsonMode: true, temperature: 0.3, maxTokens: 3000,
        system: "You are an ATS (Applicant Tracking System) expert. Analyze keyword density and ATS compatibility objectively. Be specific and actionable. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Analyze this CV's ATS compatibility against the job description.

CV TEXT:
"""
${cvText}
"""

JOB DESCRIPTION:
"""
${jobDescription}
"""

Return JSON:
{
  "atsScore": <0-100>,
  "verdict": "1 sentence assessment",
  "matchedKeywords": ["keywords from job description found in CV"],
  "missingKeywords": [
    {
      "keyword": "missing keyword/phrase",
      "importance": "critical|important|nice-to-have",
      "whereToAdd": "which CV section to add it"
    }
  ],
  "formatIssues": ["ATS formatting problems detected (tables, columns, images, special chars, etc.)"],
  "quickFixes": [
    {
      "issue": "specific problem",
      "fix": "exact fix to apply",
      "impact": "how much this improves ATS score"
    }
  ],
  "optimizedHeadline": "Rewritten headline with better keyword density",
  "keywordDensityScore": <0-100>,
  "readabilityScore": <0-100>
}` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI failed to analyze ATS compatibility" });
      res.json(parsed);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── PUBLIC PORTFOLIO (no auth) ──────────────────────────────────────────
  app.get("/api/career/public/:slug", async (req, res) => {
    const [p] = await db.select().from(adminCareerProfile)
      .where(and(eq(adminCareerProfile.publicSlug, req.params.slug), eq(adminCareerProfile.publicEnabled, true))).limit(1);
    if (!p) return res.status(404).json({ error: "not found" });
    const projects = await db.select().from(adminCareerProjects)
      .where(eq(adminCareerProjects.profileId, p.id))
      .orderBy(desc(adminCareerProjects.highlight), adminCareerProjects.sortOrder);
    // Strip private fields
    const { email, phone, rawNotes, userId, ...publicProfile } = p as any;
    res.json({ profile: publicProfile, projects });
    res.json({ profile: publicProfile, projects });
  });

  // ── GRANTS — Dutch & EU funding database ─────────────────────────────────
  app.get("/api/admin/career/grants", requireAdmin, async (req, res) => {
    try {
      const { country, category, q } = req.query as Record<string, string>;
      let grants = GRANTS_DATABASE;
      if (country) grants = grants.filter(g => g.country.toLowerCase().includes(country.toLowerCase()));
      if (category) grants = grants.filter(g => g.category.toLowerCase().includes(category.toLowerCase()));
      if (q) {
        const lq = q.toLowerCase();
        grants = grants.filter(g =>
          g.name.toLowerCase().includes(lq) ||
          g.focus.toLowerCase().includes(lq) ||
          g.description.toLowerCase().includes(lq)
        );
      }
      res.json({ grants, total: grants.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/career/grants/match", requireAdmin, async (req, res) => {
    try {
      const { projectDescription = "", projectTitle = "" } = req.body ?? {};
      if (!projectDescription || projectDescription.trim().length < 20) {
        return res.status(400).json({ error: "Project description required (min 20 chars)" });
      }
      const p = await ensureProfile((req as any).user?.id);
      const grantsJson = JSON.stringify(GRANTS_DATABASE.map(g => ({
        id: g.id, name: g.name, country: g.country, category: g.category,
        focus: g.focus, maxAmount: g.maxAmount, eligibility: g.eligibility,
      })));
      const r = await aiChat({
        role: "content", overrideProvider: CLAUDE.provider, overrideModel: CLAUDE.balanced,
        jsonMode: true, temperature: 0.3, maxTokens: 2000,
        system: "You are a grant-matching expert for Dutch and EU cultural organisations. Match projects to the most relevant grants based on focus areas, eligibility, and amounts. Reply with valid JSON only.",
        messages: [{ role: "user", content: `Match this project to the best grants from the database.

PROJECT:
Title: ${projectTitle || "(untitled)"}
Description: ${projectDescription}

ORG PROFILE: ${p.headline || p.name || "Cultural organisation"}

GRANTS DATABASE:
${grantsJson}

Return JSON:
{
  "matches": [
    {
      "grantId": "grant id from database",
      "grantName": "grant name",
      "matchScore": 0-100,
      "matchReason": "why this grant fits — 2 sentences max",
      "keyStrengths": ["2-3 strengths of this application"],
      "warnings": ["any eligibility concerns"]
    }
  ]
}
Return top 5 matches only, sorted by matchScore descending.` }],
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI failed to match grants" });
      const enriched = (parsed.matches ?? []).map((m: any) => ({
        ...m,
        grant: GRANTS_DATABASE.find(g => g.id === m.grantId) ?? null,
      }));
      res.json({ matches: enriched });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
