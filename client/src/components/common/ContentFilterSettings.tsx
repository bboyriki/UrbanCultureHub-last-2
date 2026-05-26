import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Define filter levels
export enum ContentFilterLevel {
  NONE = "none",
  LOW = "low", 
  MEDIUM = "medium",
  HIGH = "high",
  STRICT = "strict"
}

interface ContentFilterSettingsProps {
  className?: string;
  userId?: number;
}

export function ContentFilterSettings({ className = "", userId }: ContentFilterSettingsProps) {
  const [filterLevel, setFilterLevel] = useState<ContentFilterLevel>(ContentFilterLevel.MEDIUM);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [enableFilter, setEnableFilter] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, getToken } = useAuth();

  // Map filter level to slider value
  const filterLevelToSliderValue = (level: ContentFilterLevel): number => {
    switch (level) {
      case ContentFilterLevel.NONE: return 0;
      case ContentFilterLevel.LOW: return 25;
      case ContentFilterLevel.MEDIUM: return 50;
      case ContentFilterLevel.HIGH: return 75;
      case ContentFilterLevel.STRICT: return 100;
      default: return 50;
    }
  };

  // Map slider value to filter level
  const sliderValueToFilterLevel = (value: number): ContentFilterLevel => {
    if (value < 12.5) return ContentFilterLevel.NONE;
    if (value < 37.5) return ContentFilterLevel.LOW;
    if (value < 62.5) return ContentFilterLevel.MEDIUM;
    if (value < 87.5) return ContentFilterLevel.HIGH;
    return ContentFilterLevel.STRICT;
  };

  // Get user's current filter settings
  useEffect(() => {
    const fetchFilterSettings = async () => {
      // If userId is provided, use it (for admin/profile view), otherwise use current user
      const currentUserContext = userId || (user ? user.id : null);
      
      if (!currentUserContext) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        // Get authentication token
        let token = null;
        try {
          token = await getToken();
        } catch (tokenError) {
          console.error("Failed to get authentication token:", tokenError);
          throw new Error("Authentication failed. Please try logging in again.");
        }
        
        // Track if we successfully loaded filter settings so we can display fallbacks
        let filterSettingsSuccess = false;
        
        // PART 1: Load filter settings
        try {
          // Fetch current filter settings using the direct endpoint when possible
          // Use the direct endpoint to bypass middleware issues
          const targetUserId = userId || (user?.id || 0);
          const endpoint = `/api/content/filter/${targetUserId}`;
          
          console.log('Fetching filter settings from endpoint:', endpoint);
          
          const response = await fetch(endpoint, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          });

          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            
            // Check if response is JSON
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.json();
              console.error('Filter settings error:', errorData);
              throw new Error(errorData.message || 'Failed to load filter settings');
            } else {
              // Handle HTML responses (when server returns error pages)
              const errorText = await response.text();
              console.error('Non-JSON error from filter settings endpoint:', errorText.substring(0, 200));
              throw new Error('Server returned an invalid response format. Please try again later.');
            }
          }

          // Check that response is actually JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.error('Expected JSON but got:', contentType);
            throw new Error('Server returned unexpected content type: ' + (contentType || 'unknown'));
          }

          // Parse the JSON data
          const data = await response.json();
          console.log('Filter settings loaded:', data);
          
          // Update UI with settings
          setFilterLevel(data.level as ContentFilterLevel || ContentFilterLevel.MEDIUM);
          setEnableFilter(data.filterProfanity !== false); // Default to true if not specified
          filterSettingsSuccess = true;
        } catch (filterError) {
          console.error('Failed to load filter settings:', filterError);
          
          // Apply defaults but allow component to continue loading blocked users
          setFilterLevel(ContentFilterLevel.MEDIUM);
          setEnableFilter(true);
          
          // Set error message
          setError(filterError instanceof Error ? 
            filterError.message : 
            'Failed to load filter settings. Using default settings.');
        }
        
        // PART 2: Load blocked users list (continue even if filter settings failed)
        try {
          // Fetch blocked users - if userId is provided (admin view), get that user's blocked list
          // Use direct-blocks endpoint to bypass middleware authentication issues
          const blockedEndpoint = userId ? `/api/users/direct-blocks/${userId}` : '/api/users/direct-blocks';
          console.log('Fetching blocked users from endpoint:', blockedEndpoint);
          
          const blockedResponse = await fetch(blockedEndpoint, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          });

          // Collect response debugging info
          console.log('Blocked users response status:', blockedResponse.status);
          console.log('Blocked users response headers:', 
            Array.from(blockedResponse.headers.entries())
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ')
          );

          // Even if the request failed, try to parse the response
          let blockedData = null;
          
          try {
            // First, get response as text to handle both JSON and non-JSON responses safely
            const responseText = await blockedResponse.text();
            console.log('Blocked users raw response (first 100 chars):', 
              responseText.substring(0, 100) + (responseText.length > 100 ? '...' : ''));
            
            // Try to parse as JSON if it looks like JSON
            if (responseText.trim().startsWith('[') || responseText.trim().startsWith('{')) {
              try {
                blockedData = JSON.parse(responseText);
                console.log('Blocked users data parsed successfully:', blockedData);
              } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                // Not valid JSON despite starting with { or [
              }
            } else if (responseText.includes('<!DOCTYPE html>')) {
              console.error('HTML response received instead of JSON:', responseText.substring(0, 200));
            }
          } catch (readError) {
            console.error('Error reading response body:', readError);
          }

          // Check if we got valid data that looks like blocked users list
          if (Array.isArray(blockedData)) {
            // Success case - we got a valid array
            console.log('Successfully loaded', blockedData.length, 'blocked users');
            setBlockedUsers(blockedData);
          } else {
            // Empty array as fallback
            console.warn('No valid blocked users data received, using empty array as fallback');
            setBlockedUsers([]);
            
            // Only show error if the response indicates a failure
            if (!blockedResponse.ok) {
              console.error('Failed to load blocked users - server returned error status:', blockedResponse.status);
              
              // Only override the error message if filter settings were successful
              if (filterSettingsSuccess) {
                setError(`Unable to load blocked users (${blockedResponse.status}). You can still adjust filter settings.`);
              }
            }
          }
        } catch (blockedError) {
          console.error('Critical error loading blocked users:', blockedError);
          
          // Set empty list as fallback
          setBlockedUsers([]);
          
          // Only override the error message if filter settings were successful
          // This prevents showing "blocked users error" when filter settings already failed
          if (filterSettingsSuccess) {
            setError('Unable to load blocked users. You can still adjust filter settings.');
          }
        }
      } catch (error) {
        // Handle any errors not caught by the inner try/catch blocks
        console.error('Critical error in content filter settings:', error);
        setError(error instanceof Error ? 
          error.message : 
          'Failed to load content filter settings. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilterSettings();
  }, [user, getToken, userId]);

  // Save filter settings
  const saveFilterSettings = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get authentication token
      let token = null;
      try {
        token = await getToken();
      } catch (tokenError) {
        console.error("Failed to get authentication token:", tokenError);
        throw new Error("Authentication failed. Please try logging in again.");
      }

      // Save new filter settings - use userId if provided (admin/moderator view)
      const endpoint = userId ? `/api/content/filter/${userId}` : '/api/content/filter';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json', 
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          level: filterLevel,
          filterProfanity: enableFilter,
          filterViolence: enableFilter,
          filterHateSpeech: enableFilter,
          filterExplicit: enableFilter,
          filterSpam: enableFilter
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        
        // Check if response is JSON
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          console.error('Save settings error:', errorData);
          throw new Error(errorData.message || 'Failed to save filter settings');
        } else {
          // Handle HTML or other non-JSON responses
          const errorText = await response.text();
          console.error('Non-JSON error from save settings endpoint:', errorText.substring(0, 200));
          throw new Error('Server returned an invalid response format. Please try again later.');
        }
      }

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Unexpected server response type: ' + (contentType || 'unknown'));
      }

      // Parse response data
      let responseData;
      try {
        responseData = await response.json();
        console.log('Filter settings saved successfully:', responseData);
      } catch (parseError) {
        console.error('Error parsing save response:', parseError);
        throw new Error('Invalid response format from server');
      }

      // Show success notification
      toast({
        title: 'Settings updated',
      });
      
      // Clear any previous errors
      setError(null);
    } catch (error) {
      console.error('Error saving filter settings:', error);
      setError(error instanceof Error ? error.message : 'Failed to save filter settings');
      
      toast({
        title: 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  // Unblock a user
  const handleUnblock = async (blockedId: number) => {
    if (!user) {
      toast({
        title: "Authentication required",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get authentication token
      let token = null;
      try {
        token = await getToken();
      } catch (tokenError) {
        console.error("Failed to get authentication token:", tokenError);
        throw new Error("Authentication failed. Please try logging in again.");
      }

      // Use our new simplified self-unblock endpoint for current user
      // Add support for direct unblock endpoint to avoid authentication middleware issues
      const endpoint = userId 
        ? `/api/users/${userId}/block/${blockedId}` // Admin path for managing other users' blocks
        : `/api/users/direct-unblock/${blockedId}`; // Direct endpoint for self-unblocking
      
      console.log('Attempting to unblock user with endpoint:', endpoint);
        
      // Assume success by default - we'll update the UI optimistically
      // and recover if the API call fails
      let success = true;
      let errorMessage = '';
        
      try {
        const response = await fetch(endpoint, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });

        console.log('Unblock response status:', response.status);
        console.log('Unblock response headers:', 
          Array.from(response.headers.entries())
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
        );

        // Read the response text first so we can debug it
        let responseText = '';
        try {
          responseText = await response.text();
          console.log('Unblock response body (first 100 chars):', 
            responseText.substring(0, 100) + (responseText.length > 100 ? '...' : ''));
        } catch (textError) {
          console.error('Error reading unblock response as text:', textError);
        }

        // Check if the response was successful
        if (!response.ok) {
          success = false;
          
          // Try to parse as JSON if it looks like JSON
          if (responseText && (responseText.trim().startsWith('{') || responseText.trim().startsWith('['))) {
            try {
              const errorData = JSON.parse(responseText);
              console.error('Unblock user error response:', errorData);
              errorMessage = errorData.message || 'Failed to unblock user';
            } catch (jsonError) {
              console.error('Response looked like JSON but failed to parse:', jsonError);
              errorMessage = 'Server returned an invalid response format';
            }
          } else if (responseText.includes('<!DOCTYPE html>')) {
            // It's an HTML error page
            console.error('HTML error response received:', responseText.substring(0, 200));
            errorMessage = 'Server returned an HTML error page instead of JSON';
          } else {
            // Some other error
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        } else {
          // Success!
          console.log('Unblock successful');
        }
      } catch (networkError) {
        console.error('Network error during unblock request:', networkError);
        success = false;
        errorMessage = 'Network error while trying to unblock user. Please check your connection and try again.';
      }

      if (success) {
        // Update local list by removing the unblocked user
        setBlockedUsers(blockedUsers.filter(blocked => blocked.user.id !== blockedId));

        // Show success message
        toast({
          title: 'User unblocked',
        });
        
        // Clear any previous errors
        setError(null);
      } else {
        throw new Error(errorMessage || 'Failed to unblock user');
      }
    } catch (error) {
      console.error('Error in unblock handler:', error);
      
      toast({
        title: 'Failed to unblock user',
        variant: 'destructive',
      });
    }
  };

  // Handle slider change
  const handleSliderChange = (value: number[]) => {
    const newFilterLevel = sliderValueToFilterLevel(value[0]);
    setFilterLevel(newFilterLevel);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Content Filtering</CardTitle>
          <CardDescription>Loading your settings...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Content Filtering</CardTitle>
        <CardDescription>
          Control what type of content you see and who can interact with you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600 flex items-start">
            <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-filter" className="text-base">Enable content filtering</Label>
            <Switch 
              id="enable-filter" 
              checked={enableFilter} 
              onCheckedChange={setEnableFilter} 
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="filter-level" className="text-base">Filter sensitivity</Label>
              <span className="text-sm font-medium">
                {filterLevel.charAt(0).toUpperCase() + filterLevel.slice(1)}
              </span>
            </div>
            <Slider
              id="filter-level"
              disabled={!enableFilter}
              value={[filterLevelToSliderValue(filterLevel)]}
              onValueChange={handleSliderChange}
              className="w-full"
              step={25}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>None</span>
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Strict</span>
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {filterLevel === ContentFilterLevel.NONE && (
                "No content filtering will be applied."
              )}
              {filterLevel === ContentFilterLevel.LOW && (
                "Only the most extreme content will be filtered."
              )}
              {filterLevel === ContentFilterLevel.MEDIUM && (
                "Balanced filtering for most inappropriate content."
              )}
              {filterLevel === ContentFilterLevel.HIGH && (
                "Strong filtering for sensitive content and language."
              )}
              {filterLevel === ContentFilterLevel.STRICT && (
                "Maximum filtering for a safe experience."
              )}
            </div>
          </div>
        </div>

        {/* Blocked users section */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium mb-3">Blocked Users ({blockedUsers.length})</h3>
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-gray-500">You haven't blocked any users yet.</p>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((blocked) => (
                <div key={blocked.blockId} className="flex justify-between items-center p-2 bg-slate-800 rounded-md">
                  <div className="text-sm">
                    <div className="font-medium text-white">{blocked.user?.displayName || 'User'}</div>
                    {blocked.reason && (
                      <div className="text-xs text-slate-300 mt-0.5">Reason: {blocked.reason}</div>
                    )}
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => handleUnblock(blocked.user.id)}
                    className="text-xs hover:text-red-500"
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={saveFilterSettings} className="w-full">
          Save Settings
        </Button>
      </CardFooter>
    </Card>
  );
}