import { type Express, type Request, type Response } from "express";
import { db } from "./db";
import { users, appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { trackAI, getAIAnalytics } from "./aiAnalytics";
import { buildGlobalUserContext } from "./userAiProfile";
import { aiChat } from "./aiRouter";

async function getSessionUser(req: Request) {
  const userId = (req.session as any)?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
  return user || null;
}

async function requireAIPremium(req: Request, res: Response, next: Function) {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "AUTH_REQUIRED", message: "Login required" });
  // AI premium is currently free for all logged-in users
  return next();
}

async function chat(systemPrompt: string, userPrompt: string, jsonMode = false): Promise<string> {
  const result = await aiChat({
    role: "community",
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.8,
    maxTokens: 600,
    jsonMode,
  });
  return result.text || "";
}

export function registerAIContextRoutes(app: Express) {
  // ── Event Finder ────────────────────────────────────────────────────────────
  app.post("/api/ai/events/recommend", requireAIPremium as any, async (req: Request, res: Response) => {
    try {
      const { query, events } = req.body as {
        query: string;
        events: Array<{ id: number; title: string; category?: string; location?: string; date?: string; description?: string }>;
      };
      if (!query) return res.status(400).json({ error: "Query required" });

      const eventList = (events || []).slice(0, 40).map(e =>
        `[ID:${e.id}] ${e.title}${e.category ? ` (${e.category})` : ""}${e.location ? ` @ ${e.location}` : ""}${e.date ? ` — ${e.date}` : ""}`
      ).join("\n");

      const result = await chat(
        `Je bent een urban culture event-assistent voor Urban Culture Hub in Nederland. Je helpt gebruikers de beste events te vinden op basis van hun wensen. Je antwoord is altijd in het Nederlands tenzij de gebruiker Engels schrijft. Geef maximaal 5 aanbevelingen. Return JSON: {"recommendations": [{"id": number, "reason": "string (1 zin waarom dit event goed past)", "highlight": "string (1 opvallend detail)"}], "summary": "string (1-2 zinnen over je picks)"}`,
        `Gebruikersvraag: "${query}"\n\nBeschikbare events:\n${eventList}\n\nGeef je top aanbevelingen.`,
        true
      );

      let parsed: any = {};
      try { parsed = JSON.parse(result); } catch { parsed = { recommendations: [], summary: result }; }
      return res.json({ success: true, ...parsed });
    } catch (err: any) {
      console.error("AI events recommend error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Community Caption & Hashtag Generator ──────────────────────────────────
  app.post("/api/ai/community/caption", requireAIPremium as any, async (req: Request, res: Response) => {
    try {
      const { topic, mood, artType, city } = req.body as {
        topic?: string;
        mood?: string;
        artType?: string;
        city?: string;
      };

      const sessionUser = await getSessionUser(req);
      const userCtx = sessionUser ? await buildGlobalUserContext(sessionUser.id) : "";

      const result = await chat(
        `Je bent een social media expert voor de Urban Culture Hub community in Nederland — een platform voor urban sports, dans, graffiti, muziek en straatcultuur. Schrijf authentieke, energieke posts. Gebruik GEEN overdreven emojis. Schrijf in het Nederlands. Return JSON: {"caption": "string (post caption, max 200 tekens)", "hashtags": ["string"], "alternatives": ["string", "string"]}${userCtx ? `\n\n${userCtx}` : ""}`,
        `Maak een community post voor:
Onderwerp: ${topic || "urban culture moment"}
Mood: ${mood || "energiek en authentiek"}
Kunsttype: ${artType || "algemeen urban"}
Stad: ${city || "Amsterdam"}

Geef een sterke caption + 8-10 relevante hashtags + 2 alternatieven.`,
        true
      );

      let parsed: any = {};
      try { parsed = JSON.parse(result); } catch { parsed = { caption: result, hashtags: [] }; }
      return res.json({ success: true, ...parsed });
    } catch (err: any) {
      console.error("AI caption error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Spot / Nearby Guide ────────────────────────────────────────────────────
  app.post("/api/ai/nearby/guide", requireAIPremium as any, async (req: Request, res: Response) => {
    try {
      const { mood, city, artType, spots } = req.body as {
        mood?: string;
        city?: string;
        artType?: string;
        spots?: Array<{ name: string; category?: string; description?: string }>;
      };

      const sessionUser = await getSessionUser(req);
      trackAI({ feature: "nearbyGuide", userId: sessionUser?.id, displayName: sessionUser?.displayName || sessionUser?.username, city: city || sessionUser?.city });

      const spotList = (spots || []).slice(0, 20).map(s =>
        `${s.name}${s.category ? ` [${s.category}]` : ""}${s.description ? `: ${s.description.slice(0, 80)}` : ""}`
      ).join("\n");

      const result = await chat(
        `Je bent een lokale urban culture gids voor Urban Culture Hub in Nederland. Je geeft persoonlijk advies over plekken, spots en activiteiten gebaseerd op de mood en interesses van de gebruiker. Schrijf in het Nederlands. Wees specifiek en enthousiast. Return JSON: {"advice": "string (2-3 zinnen persoonlijk advies)", "suggestions": [{"name": "string", "why": "string", "tip": "string"}], "vibe": "string (één woord voor de sfeer van vandaag)"}`,
        `Gebruiker zoekt:
Mood / Wat zoek ik: ${mood || "een goede plek om te trainen of kunst te maken"}
Stad: ${city || "Amsterdam"}
Ik ben: ${artType || "urban culture fan"}
${spotList ? `Beschikbare spots in de buurt:\n${spotList}` : ""}

Geef persoonlijk advies en aanbevelingen.`,
        true
      );

      let parsed: any = {};
      try { parsed = JSON.parse(result); } catch { parsed = { advice: result, suggestions: [] }; }
      return res.json({ success: true, ...parsed });
    } catch (err: any) {
      console.error("AI nearby guide error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Marketplace Listing Helper ─────────────────────────────────────────────
  app.post("/api/ai/marketplace/listing", requireAIPremium as any, async (req: Request, res: Response) => {
    try {
      const { itemDescription, category, condition } = req.body as {
        itemDescription: string;
        category?: string;
        condition?: string;
      };
      if (!itemDescription) return res.status(400).json({ error: "Item description required" });

      const result = await chat(
        `Je bent een marketplace expert voor Urban Culture Hub — een platform voor urban culture artikelen (streetwear, sportmateriaal, muziekapparatuur, kunst, etc.). Schrijf professionele, eerlijke en aantrekkelijke product listings. Schrijf in het Nederlands. Return JSON: {"title": "string (max 60 tekens)", "description": "string (max 250 tekens, enthousiast maar eerlijk)", "tags": ["string"], "priceSuggestion": {"min": number, "max": number, "currency": "EUR"}, "tip": "string (1 verkooptip)"}`,
        `Artikel: ${itemDescription}
Categorie: ${category || "overig"}
Conditie: ${condition || "goed"}

Maak een professionele marketplace listing.`,
        true
      );

      let parsed: any = {};
      try { parsed = JSON.parse(result); } catch { parsed = { title: "", description: result, tags: [] }; }
      return res.json({ success: true, ...parsed });
    } catch (err: any) {
      console.error("AI listing error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Reel Caption & Hashtags ────────────────────────────────────────────────
  app.post("/api/ai/reels/caption", requireAIPremium as any, async (req: Request, res: Response) => {
    try {
      const { topic, artType, vibe } = req.body as {
        topic?: string;
        artType?: string;
        vibe?: string;
      };

      const result = await chat(
        `Je bent een content creator specialist voor Urban Culture Hub reels — korte video's over breaking, graffiti, skateboarding, muziek en urban culture. Schrijf catchy, authentieke captions. Max 300 tekens. Gebruik relevante hashtags. Schrijf in het Nederlands tenzij het internationale content is. Return JSON: {"caption": "string (energiek, max 220 tekens)", "hashtags": ["string"], "callToAction": "string (korte CTA, max 40 tekens)"}`,
        `Video gaat over: ${topic || "urban culture moment"}
Kunsttype / discipline: ${artType || "urban culture"}
Vibe: ${vibe || "raw en authentiek"}

Maak een killer reel caption met hashtags.`,
        true
      );

      let parsed: any = {};
      try { parsed = JSON.parse(result); } catch { parsed = { caption: result, hashtags: [] }; }
      return res.json({ success: true, ...parsed });
    } catch (err: any) {
      console.error("AI reel caption error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Profile Bio Writer ─────────────────────────────────────────────────────
  app.post("/api/ai/profile/bio", requireAIPremium as any, async (req: Request, res: Response) => {
    try {
      const { displayName, artType, city, highlights } = req.body as {
        displayName?: string;
        artType?: string;
        city?: string;
        highlights?: string;
      };

      const sessionUser = await getSessionUser(req);
      const userCtx = sessionUser ? await buildGlobalUserContext(sessionUser.id) : "";

      const result = await chat(
        `Je bent een personal branding expert voor Urban Culture Hub in Nederland. Schrijf korte, krachtige en authentieke profiel bio's voor urban artists, dansers, muzikanten en atleten. Maximaal 180 tekens (Twitter-stijl). Geen overdreven emojis. Geen clichés. Schrijf in het Nederlands tenzij de artiest duidelijk international is. Return JSON: {"bio": "string (max 180 tekens, krachtig en persoonlijk)", "alternatives": ["string", "string"]}${userCtx ? `\n\n${userCtx}` : ""}`,
        `Naam: ${displayName || "artiest"}
Type: ${artType || "urban artist"}
Stad: ${city || "Amsterdam"}
Hoogtepunten / details: ${highlights || "geen extra info"}

Schrijf een sterke, authentieke bio.`,
        true
      );

      let parsed: any = {};
      try { parsed = JSON.parse(result); } catch { parsed = { bio: result, alternatives: [] }; }
      return res.json({ success: true, ...parsed });
    } catch (err: any) {
      console.error("AI bio error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Smart Location Agent (category-aware) ──────────────────────────────────
  app.post("/api/ai/spot/agent", async (req: Request, res: Response) => {
    try {
      const { name, category, address, description, opening_hours, website, reviews } = req.body as {
        name: string;
        category?: string;
        address?: string;
        description?: string;
        opening_hours?: string;
        website?: string;
        reviews?: Array<{ rating: number; review?: string }>;
      };
      if (!name) return res.status(400).json({ error: "Name required" });

      const cat = (category || "other").toLowerCase();
      const sessionUser = await getSessionUser(req);
      trackAI({ feature: "spotAgent", userId: sessionUser?.id, displayName: sessionUser?.displayName || sessionUser?.username, category: cat });
      const avgRating = reviews?.length
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : null;
      const reviewSnippet = reviews?.slice(0, 3).map(r => r.review).filter(Boolean).join(" | ") || "";

      const categoryContexts: Record<string, string> = {
        dance: "Je bent een dance culture expert. Deze plek gaat over dans — denk aan breakdance, hiphop, salsa, urban dance. Focus op: vloerkwaliteit voor dance, welke stijlen hier beoefend worden, beste tijden om te komen voor freestyle of lessen, evenementen en battles, community energie, geluid & muziek setup.",
        breakdance: "Je bent een breakdance & bboy scene expert. Focus op: toplocatie voor breaks, vloer & ruimte kwaliteit, welke crews/events hier zijn, beste training tijden, open sessions, jam nights, de sfeer in de scene.",
        music: "Je bent een urban music expert. Focus op: genre en geluidskwaliteit, live muziek en open mic nights, DJ nights, studio faciliteiten, akoestiek, beste avonden om te komen, wie er regelmatig speelt.",
        rap: "Je bent een rap/hiphop cultuur expert. Focus op: freestyle sessies, cypher avonden, open mic nights, beatmakers community, de energie van de plek, welke artiesten hier kwamen/komen.",
        beatbox: "Je bent een beatbox community expert. Focus op: community events, freestyle sessies, hoe de plek aanvoelt voor beatboxers, welke events er zijn, beste tijden.",
        art: "Je bent een street art & urban art expert. Focus op: type kunst hier, legal walls in de buurt, welke kunstenaars hier actief zijn, de artistieke sfeer, of er workshops zijn, hoe de collectie/locatie de urban art scene ondersteunt.",
        graffiti: "Je bent een graffiti & street art expert. Focus op: legal wall status, de kwaliteit van de ruimte voor graffiti, welke stijlen en artiesten hier aktief zijn, veiligheid en omgeving.",
        skate: "Je bent een skate cultuur expert. Focus op: type obstacles (ledges, rails, banks, gaps, bowls), vloeroppervlak kwaliteit, beste tijden (drukte vs rustig), lokale skate community, film & photographiemogelijkheden, spot difficulty.",
        parkour: "Je bent een parkour & freerunning expert. Focus op: type structuren en jumps, veiligheid van de omgeving, trainingsmogelijkheden, lokale parkour community, beste trainingstijden.",
        bmx: "Je bent een BMX expert. Focus op: obstacles en features, park layout, niveaus van rijders, beste sessietijden, lokale BMX community energie.",
        sport: "Je bent een urban sport & fitness expert. Focus op: welke sporten hier beoefend worden, faciliteiten en apparatuur, trainingstijden, coaches/trainers beschikbaar, niveau van de community, membership opties.",
        fitness: "Je bent een fitness & training expert. Focus op: apparatuur kwaliteit, programma's en klassen, sfeer (gezellig vs serieus), crowd en niveaus, beste tijden om te gaan, personal training mogelijkheden.",
        training: "Je bent een sport training expert. Focus op: welk type training hier plaatsvindt, faciliteitskwaliteit, coaching niveaus, community energie, beste trainingstijden voor beginners vs gevorderden.",
        basketball: "Je bent een basketball en urban sport expert. Focus op: court kwaliteit, type spel (5v5, 3v3, pickup games), beste tijden voor pickup runs, community level, events en toernooien.",
        museum: "Je bent een cultureel museum expert. Focus op: de collectie hoogtepunten, beste bezoektijden (rustig vs druk), verborgen pareltjes in het museum, educatieve waarde, guided tours, prijzen en toegankelijkheid, digitale ervaringen.",
        community: "Je bent een community space expert. Focus op: welke activiteiten en groepen hier actief zijn, volunteer mogelijkheden, events agenda, hoe toegankelijk de plek is voor nieuwe mensen, membership, de missie van de plek.",
        restaurant: "Je bent een urban food culture expert. Focus op: keuken stijl en sfeer, signature gerechten, prijs-kwaliteitverhouding, sfeer (casual vs formeel), reserveren nodig, beste momenten om te gaan, local tips.",
        cafe: "Je bent een café cultuur expert. Focus op: sfeer en vibe, koffiekwaliteit, werkplek-vriendelijk, muziek en community events, beste tijden voor een relaxte sessie, wat de plek uniek maakt.",
        food: "Je bent een food & dining expert. Focus op: wat voor eten, sfeer, prijs niveau, local favorieten, beste tijden, wat je zeker moet proberen.",
        nightlife: "Je bent een nightlife en urban club expert. Focus op: muziek genres en DJs, entry en prijs, beste avonden, dress code, sfeer, wie er regelmatig is, what to expect.",
        workshop: "Je bent een creative workshop expert. Focus op: welke workshops er gegeven worden, skill niveaus, materialen, kosten, community van deelnemers, hoe je je kunt inschrijven.",
        wellness: "Je bent een wellness & mindfulness expert. Focus op: type behandelingen, sfeer en rust, boeken noodzaak, prijzen, beste tijden, community en reguliere bezoekers.",
        park: "Je bent een urban park & outdoor space expert. Focus op: de beste plekken binnen het park, outdoor activiteiten mogelijk, sport faciliteiten, evenementen, seizoensgebonden highlights, veiligheid en rust, mensen en community die het park gebruikt.",
      };

      const systemPrompt = categoryContexts[cat] || `Je bent een lokale stedelijke cultuur gids. Je geeft eerlijk en specifiek advies over plekken in Nederland. Focus op wat de plek uniek maakt voor de bezoekers van Urban Culture Hub.`;

      const locationInfo = [
        `Naam: ${name}`,
        address ? `Adres: ${address}` : null,
        opening_hours ? `Openingstijden: ${opening_hours}` : null,
        description ? `Beschrijving: ${description.slice(0, 300)}` : null,
        avgRating ? `Community rating: ${avgRating}/5 (${reviews?.length} reviews)` : null,
        reviewSnippet ? `Wat bezoekers zeggen: "${reviewSnippet}"` : null,
        website ? `Website: ${website}` : null,
      ].filter(Boolean).join("\n");

      const result = await chat(
        `${systemPrompt}\n\nGeef altijd antwoord in het Nederlands. Wees specifiek, energiek maar eerlijk. Return JSON met exact deze structuur.`,
        `Locatie informatie:\n${locationInfo}\n\nGeef een smart agent analyse van deze locatie. Return JSON: {
  "verdict": "string (1 krachtige zin die de essentie van de plek samenvat, max 100 tekens)",
  "bestFor": ["string", "string", "string"] (3 korte tags: voor wie is dit perfect),
  "tips": [{"title": "string", "body": "string (1-2 zinnen, praktisch advies)"}] (2-3 tips specifiek voor dit type plek),
  "bestTime": "string (wanneer is het beste moment om te komen, 1 zin)",
  "hidden": "string (één insider tip die de meeste bezoekers niet weten, 1 zin)",
  "energy": "low|medium|high|very-high" (energie niveau van de plek),
  "score": number (1-10, eerlijke beoordeling voor deze categorie)
}`,
        true
      );

      let parsed: any = {};
      try { parsed = JSON.parse(result); } catch { parsed = { verdict: result, tips: [] }; }
      return res.json({ success: true, category: cat, ...parsed });
    } catch (err: any) {
      console.error("AI spot agent error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Trending Topics for Community ──────────────────────────────────────────
  app.post("/api/ai/community/trending-topics", requireAIPremium as any, async (req: Request, res: Response) => {
    try {
      const { city, season } = req.body as { city?: string; season?: string };

      const result = await chat(
        `Je bent een urban culture trend expert in Nederland. Geef actuele post-ideeën voor de Urban Culture Hub community. Wees specifiek en relevant. Return JSON: {"topics": [{"title": "string", "description": "string (1 zin)", "hashtags": ["string"]}]}`,
        `Stad: ${city || "Amsterdam"}
Seizoen: ${season || "nu"}

Geef 6 trending post-ideeën voor de urban culture community.`,
        true
      );

      let parsed: any = {};
      try { parsed = JSON.parse(result); } catch { parsed = { topics: [] }; }
      return res.json({ success: true, ...parsed });
    } catch (err: any) {
      console.error("AI trending topics error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: AI Usage Analytics ──────────────────────────────────────────────
  app.get("/api/admin/ai-analytics", async (req: Request, res: Response) => {
    try {
      const sessionUser = await getSessionUser(req);
      if (!sessionUser || !["admin", "super_admin"].includes(sessionUser.role)) {
        return res.status(403).json({ error: "Admin only" });
      }
      return res.json(getAIAnalytics());
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
