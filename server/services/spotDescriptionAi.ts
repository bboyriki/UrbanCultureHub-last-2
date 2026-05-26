/**
 * AI Spot Description Generator Service
 * Generates context-aware descriptions for spots based on their type and location
 */

import { aiChat } from '../aiRouter';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

export interface SpotDescriptionRequest {
  address: string;
  latitude?: string;
  longitude?: string;
  spotType?: string;
  spotName?: string;
}

export interface SpotDescriptionResponse {
  description: string;
  success: boolean;
  error?: string;
}

const SPOT_TYPE_LABELS: Record<string, { label: string; context: string }> = {
  graffiti:      { label: "Graffiti & Street Art spot", context: "street art, murals and graffiti culture" },
  dance:         { label: "Dance studio or practice area", context: "dance practice including breakdance, hip-hop, house and other styles" },
  music:         { label: "Music & DJ spot", context: "music production, DJing and live performance" },
  rap:           { label: "Rap & Spoken Word venue", context: "freestyle rap, MC battles and spoken word events" },
  performance:   { label: "Performance space", context: "live performances, shows and entertainment events" },
  beatbox:       { label: "Beatbox session spot", context: "beatboxing sessions and vocal percussion" },
  skate:         { label: "Skateboarding spot", context: "skateboarding, tricks and skate culture" },
  parkour:       { label: "Parkour & Freerunning area", context: "parkour, freerunning and urban movement" },
  training:      { label: "Outdoor training & calisthenics spot", context: "calisthenics, pull-ups and bodyweight training" },
  fitness:       { label: "Fitness center or gym", context: "fitness training, gym workouts and personal improvement" },
  bmx:           { label: "BMX spot", context: "BMX riding, tricks and dirt jumping" },
  street_sports: { label: "Street sports area", context: "street football, volleyball, handball and outdoor team sports" },
  basketball:    { label: "Basketball court", context: "basketball games, streetball and court culture" },
  table_tennis:  { label: "Table tennis venue", context: "table tennis matches, training and casual play" },
  bouldering:    { label: "Bouldering & climbing gym", context: "bouldering, climbing walls and strength training" },
  padel:         { label: "Padel court", context: "padel games and tennis-style play" },
  cafe:          { label: "Café with community vibe", context: "coffee, casual meetups and social hangouts" },
  restaurant:    { label: "Restaurant or food spot", context: "dining, food culture and community gatherings" },
  wellness:      { label: "Wellness & recovery space", context: "spa, sauna, yoga and recovery for active people" },
  nightlife:     { label: "Nightlife & club venue", context: "nightlife events, DJ nights and late-night culture" },
  cultural_hub:  { label: "Cultural community hub", context: "community events, cultural programming and creative collaboration" },
  open_mic:      { label: "Open mic & live music venue", context: "open mic nights, live music and spoken word events" },
  workshop:      { label: "Workshop & training space", context: "workshops, classes and skill development sessions" },
  other:         { label: "Community spot", context: "community activities and local gatherings" },
};

/**
 * Generates an AI description for a spot based on its type and location
 */
export async function generateSpotDescription(
  request: SpotDescriptionRequest
): Promise<SpotDescriptionResponse> {
  if (!isSpotDescriptionAiAvailable()) {
    return {
      description: '',
      success: false,
      error: 'AI service unavailable. No AI provider key configured.',
    };
  }

  try {
    const { address, latitude, longitude, spotType, spotName } = request;

    const typeInfo = spotType ? (SPOT_TYPE_LABELS[spotType] || { label: spotType, context: spotType }) : SPOT_TYPE_LABELS.other;

    const locationContext: string[] = [];
    if (address) locationContext.push(`Address: ${address}`);
    if (latitude && longitude) locationContext.push(`Coordinates: ${latitude}, ${longitude}`);
    if (spotName) locationContext.push(`Spot name: ${spotName}`);

    const prompt = `You are writing descriptions for a community spot-sharing platform. Write a short, genuine description (2-3 sentences, max 200 characters) for a ${typeInfo.label}.

Location details:
${locationContext.join('\n')}

The description should:
- Focus specifically on ${typeInfo.context}
- Describe what visitors can expect at this specific type of spot
- Feel authentic and helpful, not like marketing copy
- Be welcoming to anyone interested in ${typeInfo.context}

Write ONLY the description text. Be concise and specific to the spot type.`;

    const completion = await aiChat({
      role: 'spot_description',
      system: `You write authentic, concise spot descriptions for a community platform. You adapt your writing to the specific type of spot — whether that's a table tennis club, a skate park, an art gallery, a fitness gym, or any other venue. Never use emojis. Be genuine and informative.`,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 150,
      temperature: 0.7,
    });

    const description = completion.text?.trim() || '';

    if (!description) {
      return {
        description: '',
        success: false,
        error: 'AI generated empty response',
      };
    }

    return {
      description,
      success: true,
    };
  } catch (error: any) {
    console.error('Error generating spot description:', error);

    return {
      description: '',
      success: false,
      error: error.message || 'Failed to generate description',
    };
  }
}

/**
 * Check if AI spot description service is available
 */
export function isSpotDescriptionAiAvailable(): boolean {
  // Available if either provider is configured — central router handles routing.
  return !!(OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY);
}
