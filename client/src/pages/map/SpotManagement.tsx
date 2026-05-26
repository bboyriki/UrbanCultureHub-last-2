import React, { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ArrowLeft, 
  MapPin, 
  Eye, 
  ThumbsUp, 
  MessageSquare, 
  Calendar,
  Image,
  AlertCircle
} from 'lucide-react';

// Define types for our data
interface SpotInteraction {
  id: number;
  spotId: number;
  userId: number;
  type: 'view' | 'like' | 'comment' | 'share';
  createdAt: string;
  user?: {
    id: number;
    displayName: string;
    profilePicture?: string;
  };
  content?: string;
}

interface Spot {
  id: number;
  name: string;
  description: string;
  locationId: number;
  imageUrl: string;
  creatorId: number;
  latitude: number;
  longitude: number;
  categoryId: number;
  createdAt: string;
  updatedAt: string;
  location?: {
    id: number;
    name: string;
  };
  category?: {
    id: number;
    name: string;
  };
}

const SpotManagement: React.FC = () => {
  const [, params] = useRoute<{ id: string }>('/map/spots/:id/manage');
  const spotId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('analytics');

  // Fetch spot details
  const { data: spot, isLoading: isLoadingSpot } = useQuery({
    queryKey: ['/api/spots', spotId],
    queryFn: async () => {
      if (!spotId) return null;
      const response = await fetch(`/api/spots/${spotId}`);
      if (!response.ok) throw new Error('Failed to fetch spot');
      return response.json();
    },
    enabled: !!spotId
  });

  // Fetch spot interactions (views, likes, comments)
  const { data: interactions, isLoading: isLoadingInteractions } = useQuery({
    queryKey: ['/api/spots/interactions', spotId],
    queryFn: async () => {
      if (!spotId) return [];
      const response = await fetch(`/api/spots/${spotId}/interactions`);
      if (!response.ok) throw new Error('Failed to fetch interactions');
      return response.json();
    },
    enabled: !!spotId
  });

  if (isLoadingSpot || isLoadingInteractions) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading spot data...</span>
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <h2 className="text-lg font-semibold">Spot not found</h2>
          <p>The spot you're looking for doesn't exist or you don't have permission to view it.</p>
          <Link to="/map">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Map
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate analytics
  const allInteractions = interactions || [];
  const views = allInteractions.filter((i: SpotInteraction) => i.type === 'view').length;
  const likes = allInteractions.filter((i: SpotInteraction) => i.type === 'like').length;
  const comments = allInteractions.filter((i: SpotInteraction) => i.type === 'comment').length;
  const shares = allInteractions.filter((i: SpotInteraction) => i.type === 'share').length;

  // Group interactions by date for time-based analytics
  type InteractionCounts = {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    [key: string]: number;
  };
  
  type DateInteractionMap = {
    [date: string]: InteractionCounts;
  };
  
  const interactionsByDate = allInteractions.reduce((acc: DateInteractionMap, interaction: SpotInteraction) => {
    const date = format(new Date(interaction.createdAt), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = { views: 0, likes: 0, comments: 0, shares: 0 };
    acc[date][interaction.type]++;
    return acc;
  }, {});

  // Sort dates for the chart
  const sortedDates = Object.keys(interactionsByDate).sort();
  const last7Days = sortedDates.slice(-7);

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6">
        <div>
          <Link to="/map">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Map
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{spot.name}</h1>
          <p className="text-muted-foreground mb-2">
            <MapPin className="inline-block w-4 h-4 mr-1" />
            {spot.location?.name || 'Location not specified'}
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Link to={`/map?spotId=${spotId}`}>
            <Button variant="outline" size="sm" className="mr-2">
              <Eye className="mr-2 h-4 w-4" /> View on Map
            </Button>
          </Link>
          <Link to={`/map/spots/${spotId}/edit`}>
            <Button size="sm">
              Edit Spot
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 mb-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{views}</div>
            <p className="text-xs text-muted-foreground mt-1">Total spot views</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Likes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{likes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {views > 0 ? Math.round((likes / views) * 100) : 0}% engagement rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{comments}</div>
            <p className="text-xs text-muted-foreground mt-1">Community discussions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Shares</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{shares}</div>
            <p className="text-xs text-muted-foreground mt-1">Social media shares</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Spot Management</CardTitle>
          <CardDescription>
            Analytics and engagement for your urban culture spot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="analytics" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="engagement">User Engagement</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analytics">
              <div className="p-4 border rounded-md">
                <h3 className="text-lg font-medium mb-4">Interaction Trends</h3>
                
                {last7Days.length > 0 ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Last 7 Days Activity</p>
                      <div className="grid grid-cols-7 gap-2 text-xs text-center">
                        {last7Days.map(date => (
                          <div key={date} className="space-y-2">
                            <div>{format(new Date(date), 'MMM d')}</div>
                            <div className="h-24 flex flex-col justify-end space-y-1">
                              <div 
                                className="bg-primary/80 rounded-t-sm w-full"
                                style={{ 
                                  height: `${Math.min(interactionsByDate[date].views * 5, 100)}%`,
                                  minHeight: interactionsByDate[date].views ? '4px' : '0' 
                                }}
                              />
                            </div>
                            <div className="font-medium">{interactionsByDate[date].views}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 border rounded-md">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Top Viewing Hours</h4>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-xl font-bold">18:00 - 20:00</p>
                        <p className="text-xs text-muted-foreground">Peak engagement time</p>
                      </div>
                      
                      <div className="p-3 border rounded-md">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Most Active Day</h4>
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-xl font-bold">Saturday</p>
                        <p className="text-xs text-muted-foreground">Weekend activity spike</p>
                      </div>
                      
                      <div className="p-3 border rounded-md">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Engagement Rate</h4>
                          <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-xl font-bold">
                          {views > 0 ? Math.round(((likes + comments) / views) * 100) : 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">Interactions per view</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-2" />
                    <p className="text-muted-foreground">No analytics data available yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Data will appear as users interact with your spot</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="engagement">
              <div className="rounded-md border">
                {allInteractions.length > 0 ? (
                  <div className="divide-y">
                    {allInteractions
                      .filter((interaction: SpotInteraction) => interaction.type === 'comment' || interaction.type === 'like')
                      .sort((a: SpotInteraction, b: SpotInteraction) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 10)
                      .map((interaction: SpotInteraction) => (
                        <div key={interaction.id} className="flex items-start p-4">
                          <Avatar className="mr-4">
                            <AvatarImage src={interaction.user?.profilePicture} />
                            <AvatarFallback>{interaction.user?.displayName?.substring(0, 2) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{interaction.user?.displayName || 'Unknown User'}</p>
                              <div className="flex items-center space-x-2">
                                <Badge variant={interaction.type === 'like' ? 'default' : 'secondary'}>
                                  {interaction.type === 'like' ? (
                                    <ThumbsUp className="h-3 w-3 mr-1" />
                                  ) : (
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                  )}
                                  {interaction.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(interaction.createdAt), 'MMM d, h:mm a')}
                                </span>
                              </div>
                            </div>
                            {interaction.type === 'comment' && interaction.content && (
                              <p className="mt-1 text-sm">{interaction.content}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-2" />
                    <p className="text-muted-foreground">No engagement data yet</p>
                    <p className="text-xs text-muted-foreground mt-1">User interactions will appear here</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="photos">
              <div className="p-4 border rounded-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Spot Photos</h3>
                  <Button size="sm">
                    <Image className="mr-2 h-4 w-4" /> Add Photo
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {spot.imageUrl ? (
                    <div className="relative aspect-square rounded-md overflow-hidden group">
                      <img 
                        src={spot.imageUrl} 
                        alt={spot.name} 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <Button size="sm" variant="destructive">Remove</Button>
                        <Button size="sm" variant="secondary">Set as Main</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center border rounded-md aspect-square bg-muted">
                      <p className="text-muted-foreground text-sm">No photos available</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpotManagement;