import ShareTester from '@/components/sharing/ShareTester';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import NotificationTester from '@/components/NotificationTester';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ShareTestPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Social Sharing Testing</CardTitle>
          <CardDescription>
            Test the different sharing features and notification systems
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Tabs defaultValue="share" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="share">Share API Test</TabsTrigger>
          <TabsTrigger value="websocket">WebSocket Notifications</TabsTrigger>
        </TabsList>
        
        <TabsContent value="share" className="space-y-4">
          <ShareTester />
        </TabsContent>
        
        <TabsContent value="websocket" className="space-y-4">
          <NotificationTester />
        </TabsContent>
      </Tabs>
    </div>
  );
}