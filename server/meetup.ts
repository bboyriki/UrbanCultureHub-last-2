/**
 * Meetup API Integration — PREPARED (not yet active)
 * Will sync events from Meetup GraphQL API for Netherlands
 * Requires MEETUP_API_KEY secret when activated
 *
 * Note: Meetup's public API has been replaced with GraphQL + OAuth2
 * To set up when ready: https://www.meetup.com/api/general/
 */

const MEETUP_BASE = "https://api.meetup.com/gql";
const MEETUP_KEY = process.env.MEETUP_API_KEY || process.env.MEETUP_TOKEN;

export interface MeetupSyncResult {
  synced: number;
  skipped: number;
  errors: string[];
  isConfigured: boolean;
  message: string;
}

// Meetup GraphQL query for events in Netherlands by location
const MEETUP_EVENTS_QUERY = `
  query EventSearch($lat: Float!, $lon: Float!, $radius: Int!, $after: String) {
    results: keywordSearch(
      filter: {
        query: "music dance urban"
        lat: $lat
        lon: $lon
        radius: $radius
        source: EVENTS
        startDateRange: "now"
      }
      first: 50
      after: $after
    ) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          result {
            ... on Event {
              id title description dateTime endTime eventUrl
              venue { name city lat lng address }
              group { name urlname city }
              feeSettings { accepts amount currency }
              rsvpSettings { totalCount }
              going
            }
          }
        }
      }
    }
  }
`;

export async function syncMeetupEvents(options?: {
  city?: string;
  lat?: number;
  lon?: number;
  maxResults?: number;
  organizerId?: number;
}): Promise<MeetupSyncResult> {
  if (!MEETUP_KEY) {
    return {
      synced: 0, skipped: 0, errors: [],
      isConfigured: false,
      message: "Meetup API key not configured. Add MEETUP_API_KEY to your secrets.",
    };
  }

  return {
    synced: 0, skipped: 0, errors: [],
    isConfigured: true,
    message: "Meetup sync not yet implemented — API key detected, implementation coming soon.",
  };
}

export function getMeetupStatus() {
  return {
    configured: !!MEETUP_KEY,
    hasKey: !!MEETUP_KEY,
  };
}
