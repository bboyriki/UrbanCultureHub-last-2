// Urban Insights Service
// Provides contextual urban culture information for different types of content

interface LocationInsight {
  locationName: string;
  locationType: string;
  insight: string;
}

interface EventInsight {
  eventName: string;
  eventCategory: string;
  insight: string;
}

interface ArtInsight {
  artType: string;
  insight: string;
}

type UrbanInsightType = 'location' | 'event' | 'art' | 'general';

// Collection of urban culture insights for different categories
const locationInsights: Record<string, string[]> = {
  'graffiti': [
    'Graffiti spots like this are often community landmarks that tell stories about local urban movements and evolution.',
    'Urban art locations have become central to the identity of many neighborhoods, transforming public spaces into open-air galleries.',
    'The presence of street art in this area reflects its role in urban cultural expression and community dialogue.'
  ],
  'breakdance': [
    'Breakdance locations are cultural hubs that preserve the legacy of urban dance communities.',
    'This spot has likely witnessed the evolution of street dance techniques that combine athleticism with artistic expression.',
    'Breakdance venues play a crucial role in youth development and cultural preservation in urban communities.'
  ],
  'studio': [
    'Urban dance studios are innovation centers where traditional and contemporary dance styles merge and evolve.',
    'Studios like this provide safe spaces for urban cultural expression and community building.',
    'The urban dance ecosystem relies on dedicated spaces that support both professional development and grassroots participation.'
  ],
  'streetart': [
    'Street art locations serve as geographical anchors for urban cultural movements and artistic progression.',
    'This spot showcases how public art transforms everyday spaces into galleries accessible to everyone.',
    'Areas with prominent street art often indicate neighborhoods undergoing cultural renaissance and community engagement.'
  ],
  'urban': [
    'Urban cultural spaces like this are living museums documenting city life and community values.',
    'Urban locations often serve as informal gathering places that foster innovation across street art, music, and dance.',
    'The urban fabric is strengthened by spaces that bring together diverse cultural practices and community connections.'
  ]
};

const eventInsights: Record<string, string[]> = {
  'battle': [
    'Dance battles are living traditions that showcase technical skill while preserving cultural heritage.',
    'Battle events create temporary communities where respect is earned through artistic excellence and innovation.',
    'These competitions are crucial networking opportunities that connect dancers across cities and countries.'
  ],
  'jam': [
    'Urban dance jams represent democracy in action—open spaces where hierarchy is based on skill and creativity.',
    'Jams like this maintain the improvisational essence of urban dance culture while building community bonds.',
    'The informal nature of jams makes them ideal incubators for new dance techniques and collaborative movements.'
  ],
  'workshop': [
    'Urban culture workshops transfer knowledge directly from pioneers to the next generation of practitioners.',
    'These educational events ensure authentic techniques and cultural context are preserved alongside physical movements.',
    'Workshops bridge commercial dance industries with traditional street culture, maintaining cultural integrity.'
  ],
  'exhibition': [
    'Urban art exhibitions democratize access to cultural movements often marginalized in traditional art spaces.',
    'Shows like this document the evolution of urban aesthetics and their influence on mainstream visual culture.',
    'These exhibitions play a vital role in legitimizing urban art forms within broader cultural conversations.'
  ],
  'festival': [
    'Urban festivals create concentrated cultural experiences that celebrate community achievement and artistic diversity.',
    'These events generate economic opportunities while preserving authentic cultural practices and innovations.',
    'Festivals serve as annual benchmarks that showcase the evolution of urban cultural movements and techniques.'
  ]
};

const artInsights: Record<string, string[]> = {
  'graffiti': [
    'Graffiti evolved from simple tags to complex murals that address social issues and community identity.',
    'Each style of graffiti represents different eras and geographic origins within the urban art movement.',
    'The ephemerality of graffiti—often painted over or weathered away—reflects urban culture\'s constant evolution.'
  ],
  'streetdance': [
    'Street dance styles developed as cultural responses to social conditions and musical innovations in urban centers.',
    'These movements preserve cultural heritage while constantly evolving through battles, cyphers, and community events.',
    'The physical techniques of urban dance contain encoded historical and cultural knowledge passed through generations.'
  ],
  'urbanmusic': [
    'Urban music genres emerged from specific neighborhood conditions and continue to document city life evolution.',
    'The production techniques pioneered in urban music have revolutionized the global music industry and sound design.',
    'These musical traditions maintain direct connections to dance innovations and visual art movements.'
  ],
  'fashion': [
    'Urban fashion styles originated as practical responses to urban environments before becoming global trends.',
    'These clothing traditions communicate complex information about community affiliation and cultural values.',
    'Urban fashion continues to influence high fashion while maintaining connections to authentic street culture.'
  ]
};

const generalInsights: string[] = [
  'Urban cultural practices create community resilience through shared creative expression and tradition.',
  'Street culture movements provide crucial economic opportunities and career pathways in creative industries.',
  'Urban arts education helps youth develop critical thinking skills, cultural awareness, and creative problem-solving abilities.',
  'The documentation and preservation of urban cultural practices ensures important cultural innovations aren\'t lost to history.',
  'Digital platforms have transformed how urban culture spreads, allowing local movements to gain global recognition overnight.'
];

/**
 * Get a random insight for a specific location type
 */
export function getLocationInsight(locationType: string): string {
  const normalizedType = locationType.toLowerCase();
  const insights = locationInsights[normalizedType] || generalInsights;
  return insights[Math.floor(Math.random() * insights.length)];
}

/**
 * Get a random insight for a specific event category
 */
export function getEventInsight(eventCategory: string): string {
  const normalizedCategory = eventCategory.toLowerCase();
  const insights = eventInsights[normalizedCategory] || generalInsights;
  return insights[Math.floor(Math.random() * insights.length)];
}

/**
 * Get a random insight for a specific art type
 */
export function getArtInsight(artType: string): string {
  const normalizedType = artType.toLowerCase();
  const insights = artInsights[normalizedType] || generalInsights;
  return insights[Math.floor(Math.random() * insights.length)];
}

/**
 * Get a random general urban culture insight
 */
export function getGeneralInsight(): string {
  return generalInsights[Math.floor(Math.random() * generalInsights.length)];
}

/**
 * Get an appropriate urban insight based on content type
 */
export function getInsightForContent(
  contentType: UrbanInsightType, 
  metadata: Record<string, any> = {}
): string {
  switch (contentType) {
    case 'location':
      return getLocationInsight(metadata.locationType || 'urban');
    case 'event':
      return getEventInsight(metadata.eventCategory || 'festival');
    case 'art':
      return getArtInsight(metadata.artType || 'streetdance');
    case 'general':
    default:
      return getGeneralInsight();
  }
}

// Export the insight service
const UrbanInsightsService = {
  getLocationInsight,
  getEventInsight,
  getArtInsight,
  getGeneralInsight,
  getInsightForContent
};

export default UrbanInsightsService;