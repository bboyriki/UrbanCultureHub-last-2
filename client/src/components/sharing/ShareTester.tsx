import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A component for testing the share API endpoint
 */
export default function ShareTester() {
  const [contentType, setContentType] = useState<string>('event');
  const [contentId, setContentId] = useState<string>('1');
  const [platform, setPlatform] = useState<string>('twitter');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await apiRequest('/api/share', 'POST', {
        contentType,
        contentId: Number(contentId),
        platform,
        userId: user?.id || null
      });
      
      setResponse(response);
      toast({
        title: 'Share event recorded',
        description: 'The share event has been recorded and notifications sent',
      });
    } catch (error) {
      console.error('Error recording share event:', error);
      toast({
        title: 'Error recording share',
        description: 'Failed to record the share event',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Share API Tester</CardTitle>
        <CardDescription>
          Test the share API endpoint to record content sharing events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="contentType">Content Type</Label>
            <Select
              value={contentType}
              onValueChange={setContentType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="post">Post</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contentId">Content ID</Label>
            <Input
              id="contentId"
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              type="number"
              min="1"
              className="w-full"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select
              value={platform}
              onValueChange={setPlatform}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="clipboard">Clipboard</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Recording Share...' : 'Record Share Event'}
          </Button>
        </form>
      </CardContent>
      
      {response && (
        <CardFooter className="flex-col items-start">
          <h3 className="text-lg font-semibold mb-2">API Response:</h3>
          <pre className="bg-muted p-4 rounded-md w-full overflow-auto">
            {JSON.stringify(response, null, 2)}
          </pre>
        </CardFooter>
      )}
    </Card>
  );
}