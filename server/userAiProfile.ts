import { db } from "./db";
import { instagramAiPersona } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface AnalyzedProfile {
  howToAddressMe?: string;
  communicationTone?: string;
  languagePreference?: string;
  myPreferences?: string[];
  avoidances?: string[];
  otherNotes?: string;
}

export async function buildGlobalUserContext(adminUserId: number): Promise<string> {
  try {
    const rows = await db.select().from(instagramAiPersona)
      .where(eq(instagramAiPersona.adminUserId, adminUserId)).limit(1);
    const persona = rows[0];
    if (!persona) return "";

    const lines: string[] = [];

    const profile = persona.analyzedProfile as AnalyzedProfile | null;
    if (profile && Object.keys(profile).length > 0) {
      lines.push("## Gebruikersvoorkeuren (Geleerd van de gebruiker)");
      if (profile.howToAddressMe) lines.push(`Hoe aanspreken: ${profile.howToAddressMe}`);
      if (profile.communicationTone) lines.push(`Gewenste toon: ${profile.communicationTone}`);
      if (profile.languagePreference) lines.push(`Taalvoorkeur: ${profile.languagePreference}`);
      if (Array.isArray(profile.myPreferences) && profile.myPreferences.length > 0)
        lines.push(`Wat de gebruiker graag wil: ${profile.myPreferences.join(", ")}`);
      if (Array.isArray(profile.avoidances) && profile.avoidances.length > 0)
        lines.push(`Wat vermijden: ${profile.avoidances.join(", ")}`);
      if (profile.otherNotes) lines.push(`Extra notities: ${profile.otherNotes}`);
      lines.push("");
    }

    if (persona.toneAndVoice?.trim()) {
      lines.push("## Stem & Toon van de Creator");
      lines.push(persona.toneAndVoice.trim());
      lines.push("");
    }

    if (persona.businessDirection?.trim()) {
      lines.push("## Merk & Richting");
      lines.push(persona.businessDirection.trim());
      lines.push("");
    }

    const facts = Array.isArray(persona.brandFacts) ? (persona.brandFacts as any[]) : [];
    if (facts.length > 0) {
      lines.push("## Over de Creator");
      facts.forEach((f: any) => {
        const text = typeof f === "string" ? f : f?.text;
        if (text?.trim()) lines.push(`• ${text.trim()}`);
      });
      lines.push("");
    }

    const vocab = Array.isArray(persona.customVocabulary) ? (persona.customVocabulary as any[]) : [];
    if (vocab.length > 0) {
      const hashtags = vocab.filter((v: any) => v.type === "hashtag").map((v: any) => v.value);
      const phrases = vocab.filter((v: any) => v.type === "phrase").map((v: any) => v.value);
      if (hashtags.length || phrases.length) {
        lines.push("## Signatuurwoorden");
        if (hashtags.length) lines.push(`Hashtags: ${hashtags.join(", ")}`);
        if (phrases.length) lines.push(`Zinnen: ${phrases.join(" | ")}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  } catch {
    return "";
  }
}
