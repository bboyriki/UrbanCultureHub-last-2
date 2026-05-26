import { FC, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { apiRequest } from "@/lib/queryClient";

interface TermsOfServiceDisplayProps {
  content?: string;
  previewMode?: boolean;
  termsVersion?: string;
}

/**
 * Displays terms of service content with proper formatting
 * Sanitizes HTML content to prevent XSS attacks
 * Can automatically fetch terms content from the API if not provided
 */
const TermsOfServiceDisplay: FC<TermsOfServiceDisplayProps> = ({ 
  content, 
  previewMode = false,
  termsVersion = 'current'
}) => {
  const [termsContent, setTermsContent] = useState<string | null>(content || null);
  const [loading, setLoading] = useState<boolean>(!content && previewMode);

  // Fetch terms content if in preview mode and no content provided
  useEffect(() => {
    if (previewMode && !content) {
      const fetchTerms = async () => {
        setLoading(true);
        try {
          const response = await apiRequest(`/api/legal/terms?version=${termsVersion}`, {
            method: "GET",
          });
          
          if (response && response.content) {
            setTermsContent(response.content);
          } else {
            setTermsContent("Unable to load terms of service content for preview.");
          }
        } catch (error) {
          console.error("Error fetching terms for preview:", error);
          setTermsContent("Error loading terms of service content.");
        } finally {
          setLoading(false);
        }
      };
      
      fetchTerms();
    }
  }, [previewMode, content, termsVersion]);

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading terms content...</div>;
  }

  if (!termsContent) {
    return <div className="py-4 text-center text-muted-foreground">No terms content available</div>;
  }

  // Sanitize the HTML content to prevent XSS attacks
  const sanitizedContent = DOMPurify.sanitize(termsContent, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
  });

  return (
    <div className="terms-of-service-content prose prose-sm max-w-none dark:prose-invert">
      {termsContent?.includes('<') ? (
        <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
      ) : (
        // If content is plain text, format with proper line breaks
        <div>
          {termsContent.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default TermsOfServiceDisplay;