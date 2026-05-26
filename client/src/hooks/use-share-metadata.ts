import { useMemo } from 'react';
import { SharingMetadata } from '@/components/sharing/ShareWidget';
import UrbanInsightsService from '@/components/sharing/UrbanInsightsService';
import { Event, Location, Post } from '@/types/index';

export type ContentType = 'location' | 'event' | 'post' | 'service' | 'product';

interface UseShareMetadataOptions {
  includeInsights?: boolean;
  customInsight?: string;
  additionalHashtags?: string[];
}

/**
 * Hook to generate sharing metadata for different content types
 */
export function useShareMetadata(
  content: any,
  contentType: ContentType,
  options: UseShareMetadataOptions = {}
): SharingMetadata {
  const { includeInsights = true, customInsight, additionalHashtags = [] } = options;

  return useMemo(() => {
    // Default metadata
    let metadata: SharingMetadata = {
      title: 'Urban Culture App',
      description: 'Explore urban culture, art, dance and more.',
      url: window.location.href,
      hashtags: ['UrbanCulture', ...additionalHashtags]
    };

    // Generate content-specific metadata
    switch (contentType) {
      case 'location':
        if (content) {
          const location = content as Location;
          metadata = {
            title: location.name || 'Urban Location',
            description: location.description || 'Discover this urban culture location',
            url: `/locations/${location.id}`,
            imageUrl: location.image || undefined,
            hashtags: [
              'UrbanCulture',
              location.locationType || 'UrbanLocation',
              'UrbanSpaces',
              ...additionalHashtags
            ]
          };

          // Add location-specific insight
          if (includeInsights) {
            metadata.insights = customInsight || UrbanInsightsService.getLocationInsight(
              location.locationType || 'urban'
            );
          }
        }
        break;

      case 'event':
        if (content) {
          const event = content as Event;
          metadata = {
            title: event.title || 'Urban Event',
            description: event.description || 'Join this exciting urban culture event',
            url: `/events/${event.id}`,
            imageUrl: event.image || undefined,
            hashtags: [
              'UrbanCulture',
              event.category || 'UrbanEvent',
              'UrbanCommunity',
              ...additionalHashtags
            ]
          };

          // Add event-specific insight
          if (includeInsights) {
            metadata.insights = customInsight || UrbanInsightsService.getEventInsight(
              event.category || 'festival'
            );
          }
        }
        break;

      case 'post':
        if (content) {
          const post = content as Post;
          const hashtags = ['UrbanCulture', 'UrbanArt', 'UrbanCommunity', ...additionalHashtags];
          
          // Add content-specific hashtags if post has tags
          if (post.tags && Array.isArray(post.tags)) {
            hashtags.push(...post.tags);
          }
          
          metadata = {
            title: post.title || 'Urban Culture Post',
            description: post.content || 'Check out this urban culture post',
            url: `/posts/${post.id}`,
            imageUrl: post.image || undefined,
            hashtags
          };

          // Add art-specific insight
          if (includeInsights) {
            metadata.insights = customInsight || UrbanInsightsService.getArtInsight(
              post.artType || 'streetdance'
            );
          }
        }
        break;

      case 'service':
        if (content) {
          const service = content;
          metadata = {
            title: service.name || 'Urban Service',
            description: service.description || 'Check out this urban culture service',
            url: `/services/${service.id}`,
            imageUrl: Array.isArray(service.images) && service.images[0] ? service.images[0] : undefined,
            hashtags: [
              'UrbanCulture',
              service.category || 'UrbanService',
              'UrbanCommunity',
              service.type || 'UrbanTalent',
              ...additionalHashtags
            ]
          };

          // Add service-specific insight
          if (includeInsights) {
            metadata.insights = customInsight || UrbanInsightsService.getInsightForContent(
              'general', { serviceType: service.type }
            );
          }
        }
        break;

      case 'product':
        if (content) {
          const product = content;
          metadata = {
            title: product.name || 'Urban Culture Product',
            description: product.description || 'Check out this urban culture product',
            url: `/marketplace/${product.id}`,
            imageUrl: Array.isArray(product.images) && product.images[0] ? product.images[0] : undefined,
            hashtags: [
              'UrbanCulture',
              product.category || 'UrbanStyle',
              'UrbanMarketplace',
              ...additionalHashtags
            ]
          };

          // Add product-specific insight
          if (includeInsights) {
            metadata.insights = customInsight || UrbanInsightsService.getGeneralInsight();
          }
        }
        break;

      default:
        if (includeInsights) {
          metadata.insights = customInsight || UrbanInsightsService.getGeneralInsight();
        }
        break;
    }

    return metadata;
  }, [content, contentType, includeInsights, customInsight, additionalHashtags]);
}

export default useShareMetadata;