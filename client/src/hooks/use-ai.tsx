import { useState } from 'react';
import { toast } from "@/hooks/use-toast";

type ContentType = "event" | "post" | "service";

interface ContentSuggestionOptions {
  contentType: ContentType;
  keywords: string[];
  style?: string;
}

interface AnalyzeContentResult {
  sentiment: "positive" | "negative" | "neutral";
  topics: string[];
  keywords: string[];
}

interface RecommendationOptions {
  userInterests: string[];
  itemType: "events" | "services" | "products";
  count?: number;
}

interface RecommendedItem {
  id: number;
  title: string;
  description: string;
  category?: string;
}

export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  
  /**
   * Generate content suggestions for events, posts, or services
   */
  const generateContentSuggestion = async (options: ContentSuggestionOptions): Promise<string> => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/ai/suggest-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check if this is due to missing OpenAI API key
        if (response.status === 503 && data.error === 'OPENAI_API_KEY_MISSING') {
          toast({
            title: "AI Service Unavailable",
            description: "OpenAI API key is missing. Please contact the administrator.",
            variant: "destructive"
          });
          return 'AI service is currently unavailable. Please try again later or contact support.';
        }
        throw new Error(data.message || 'Failed to generate content suggestion');
      }
      
      return data.suggestion;
    } catch (error: any) {
      console.error('Error generating content suggestion:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive"
      });
      return '';
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Analyze text content for sentiment, topics, and keywords
   */
  const analyzeContent = async (text: string): Promise<AnalyzeContentResult | null> => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check if this is due to missing OpenAI API key
        if (response.status === 503 && data.error === 'OPENAI_API_KEY_MISSING') {
          toast({
            title: "AI Service Unavailable",
            description: "OpenAI API key is missing. Please contact the administrator.",
            variant: "destructive"
          });
          return null;
        }
        throw new Error(data.message || 'Failed to analyze content');
      }
      
      return data;
    } catch (error: any) {
      console.error('Error analyzing content:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze content. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Get personalized recommendations based on user interests
   */
  const getRecommendations = async (options: RecommendationOptions): Promise<RecommendedItem[]> => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check if this is due to missing OpenAI API key
        if (response.status === 503 && data.error === 'OPENAI_API_KEY_MISSING') {
          toast({
            title: "AI Service Unavailable",
            description: "OpenAI API key is missing. Please contact the administrator.",
            variant: "destructive"
          });
          return [];
        }
        throw new Error(data.message || 'Failed to get recommendations');
      }
      
      return data.recommendations;
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      toast({
        title: "Recommendations Failed",
        description: error.message || "Failed to generate recommendations. Please try again.",
        variant: "destructive"
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Direct interface to OpenAI completion
   */
  const getCompletion = async (prompt: string, maxTokens?: number, temperature?: number, model?: string): Promise<string> => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/ai/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          maxTokens,
          temperature,
          model
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check if this is due to missing OpenAI API key
        if (response.status === 503 && data.error === 'OPENAI_API_KEY_MISSING') {
          toast({
            title: "AI Service Unavailable",
            description: "OpenAI API key is missing. Please contact the administrator.",
            variant: "destructive"
          });
          return 'AI service is currently unavailable. Please try again later or contact support.';
        }
        throw new Error(data.message || 'Failed to get AI completion');
      }
      
      return data.completion;
    } catch (error: any) {
      console.error('Error getting AI completion:', error);
      toast({
        title: "AI Completion Failed",
        description: error.message || "Failed to get AI response. Please try again.",
        variant: "destructive"
      });
      return '';
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    isLoading,
    generateContentSuggestion,
    analyzeContent,
    getRecommendations,
    getCompletion
  };
}