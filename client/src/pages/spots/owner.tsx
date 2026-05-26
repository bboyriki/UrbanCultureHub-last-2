import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Bell, Map, CheckCircle, Eye, MessageSquare, Heart, Edit, Trash2,
  Loader2, Calendar, CalendarPlus, ExternalLink, Lock, Plus, Clock,
  Users, Euro, BarChart3, Bookmark, ChevronDown, ChevronUp, RefreshCw,
  TrendingUp, Activity
} from 'lucide-react';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Heading from '@/components/ui/heading';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const editSpotSchema = z.object({
  name: z.string().min(3, 'Spot name must be at least 3 characters'),
  description: z.string().optional(),
  address: z.string().optional(),
  type: z.string().optional(),
  skillLevel: z.string().optional(),
  surfaceType: z.string().optional(),
  openingHours: z.string().optional(),
  isFree: z.boolean().optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  contactInfo: z.string().optional(),
});

type EditSpotFormData = z.infer<typeof editSpotSchema>;

interface SpotInteraction {
  id: number;
  spotId: number;
  userId: number;
  userName: string;
  type: string;
  content?: string;
  createdAt: string;
}

interface SpotStats {
  totalSpots: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  mostPopularSpot: string;
}

interface Spot {
  id: number;
  name: string;
  description?: string;
  address?: string;
  type?: string;
  category?: string;
  skillLevel?: string;
  surfaceType?: string;
  openingHours?: string;
  isFree?: boolean;
  website?: string;
  contactInfo?: string;
  approvalStatus?: string;
  isVisible?: boolean;
}

const SPOT_TYPES = [
  { value: 'graffiti', label: 'Graffiti Spot' },
  { value: 'dance', label: 'Dance Spot' },
  { value: 'music', label: 'Music Spot' },
  { value: 'rap', label: 'Rap/MC Spot' },
  { value: 'training', label: 'Training Spot' },
  { value: 'performance', label: 'Performance Venue' },
  { value: 'skate', label: 'Skating Spot' },
  { value: 'parkour', label: 'Parkour Spot' },
  { value: 'bmx', label: 'BMX Spot' },
  { value: 'workshop', label: 'Workshop Space' },
  { value: 'cultural_hub', label: 'Cultural Hub' },
  { value: 'open_mic', label: 'Open Mic Venue' },
];

const SKILL_LEVELS = [
  { value: 'all', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const SpotOwnerDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [stats, setStats] = useState<SpotStats>({
    totalSpots: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    mostPopularSpot: ''
  });
  const [recentInteractions, setRecentInteractions] = useState<SpotInteraction[]>([]);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  
  const editForm = useForm<EditSpotFormData>({
    resolver: zodResolver(editSpotSchema),
    defaultValues: {
      name: '',
      description: '',
      address: '',
      type: '',
      skillLevel: 'all',
      surfaceType: '',
      openingHours: '',
      isFree: true,
      website: '',
      contactInfo: '',
    },
  });

  const invalidateAllQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/spots/owner', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
    queryClient.invalidateQueries({ queryKey: ['/api/users/my-locations'] });
  };

  const { data: spots, isLoading: spotsLoading } = useQuery({
    queryKey: ['/api/spots/owner', user?.id],
    enabled: !!user?.id
  });

  const { data: interactions } = useQuery({
    queryKey: ['/api/spots/owner/interactions', user?.id],
    enabled: !!user?.id
  });

  const { data: programmeAccess } = useQuery({
    queryKey: ['/api/programme/access'],
    enabled: !!user?.id,
  });

  const { data: myProgrammeItems = [] } = useQuery<any[]>({
    queryKey: ['/api/programme/items'],
    enabled: !!(programmeAccess as any)?.isEnabled,
  });

  // Spot calendar / session management state
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [sessionStep, setSessionStep] = useState(1);
  const [sessionSpot, setSessionSpot] = useState<any>(null);
  const [sessionForm, setSessionForm] = useState({
    title: '', category: 'other', description: '',
    startTime: '', endTime: '',
    isRecurring: false, recurrenceType: 'weekly', recurrenceEnd: '',
    capacity: '', ticketPrice: '', isPublic: true,
  });

  // Owner analytics
  const { data: ownerAnalytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ['/api/owner/spot-analytics'],
    enabled: !!user?.id,
  });

  // Per-spot sessions (keyed by spotId)
  const spotsArr = (spots && Array.isArray(spots) ? spots : []) as any[];

  const createSessionMutation = useMutation({
    mutationFn: async ({ spotId, data }: { spotId: number; data: any }) => {
      const res = await apiRequest(`/api/spots/${spotId}/sessions`, 'POST', data);
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [`/api/spots/${vars.spotId}/sessions`] });
      queryClient.invalidateQueries({ queryKey: ['/api/owner/spot-analytics'] });
      setSessionSheetOpen(false);
      setSessionStep(1);
      setSessionForm({ title: '', category: 'other', description: '', startTime: '', endTime: '', isRecurring: false, recurrenceType: 'weekly', recurrenceEnd: '', capacity: '', ticketPrice: '', isPublic: true });
      toast({ title: '✅ Session added', description: 'The session is now visible on your spot page.' });
    },
    onError: (e: any) => {
      toast({ title: 'Failed to add session', description: e.message, variant: 'destructive' });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const res = await apiRequest(`/api/spots/sessions/${sessionId}`, 'DELETE');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spots'] });
      spotsArr.forEach(s => queryClient.invalidateQueries({ queryKey: [`/api/spots/${s.id}/sessions`] }));
      queryClient.invalidateQueries({ queryKey: ['/api/owner/spot-analytics'] });
      toast({ title: 'Session removed' });
    },
  });

  const openSessionSheet = (spot: any) => {
    setSessionSpot(spot);
    setSessionStep(1);
    setSessionForm({ title: '', category: 'other', description: '', startTime: '', endTime: '', isRecurring: false, recurrenceType: 'weekly', recurrenceEnd: '', capacity: '', ticketPrice: '', isPublic: true });
    setSessionSheetOpen(true);
  };

  const submitSession = () => {
    if (!sessionSpot) return;
    createSessionMutation.mutate({
      spotId: sessionSpot.id,
      data: {
        title: sessionForm.title,
        category: sessionForm.category,
        description: sessionForm.description || undefined,
        startTime: sessionForm.startTime,
        endTime: sessionForm.endTime,
        isRecurring: sessionForm.isRecurring,
        recurrenceType: sessionForm.isRecurring ? sessionForm.recurrenceType : undefined,
        recurrenceEnd: sessionForm.isRecurring && sessionForm.recurrenceEnd ? sessionForm.recurrenceEnd : undefined,
        capacity: sessionForm.capacity ? parseInt(sessionForm.capacity) : undefined,
        ticketPrice: sessionForm.ticketPrice || undefined,
        isPublic: sessionForm.isPublic,
      },
    });
  };

  const updateMutation = useMutation({
    mutationFn: async ({ spotId, data }: { spotId: number; data: Partial<Spot> }) => {
      return apiRequest(`/api/locations/${spotId}`, 'PATCH', data);
    },
    onSuccess: () => {
      invalidateAllQueries();
      setEditDialogOpen(false);
      setSelectedSpot(null);
      toast({
        title: 'Spot updated',
        description: 'Your spot has been updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Could not update spot',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (spotId: number) => {
      return apiRequest(`/api/locations/${spotId}`, 'DELETE');
    },
    onSuccess: () => {
      invalidateAllQueries();
      setDeleteDialogOpen(false);
      setSelectedSpot(null);
      toast({
        title: 'Spot deleted',
        description: 'Your spot has been permanently deleted',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Could not delete spot',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (spots && Array.isArray(spots) && interactions && Array.isArray(interactions)) {
      const likes = interactions.filter((i: any) => i.type === 'like').length;
      const comments = interactions.filter((i: any) => i.type === 'comment').length;
      const views = interactions.filter((i: any) => i.type === 'view').length;
      
      const spotCounts: Record<number, number> = {};
      interactions.forEach((i: any) => {
        spotCounts[i.spotId] = (spotCounts[i.spotId] || 0) + 1;
      });
      
      let mostPopularSpotId = -1;
      let highestCount = 0;
      
      Object.entries(spotCounts).forEach(([spotId, count]) => {
        if (count > highestCount) {
          highestCount = count;
          mostPopularSpotId = parseInt(spotId);
        }
      });
      
      const popularSpot = spots.find((s: any) => s.id === mostPopularSpotId);
      
      setStats({
        totalSpots: spots.length,
        totalViews: views,
        totalLikes: likes,
        totalComments: comments,
        mostPopularSpot: popularSpot ? popularSpot.name : 'None'
      });
    }
  }, [spots, interactions]);

  useEffect(() => {
    if (interactions && Array.isArray(interactions)) {
      const sortedInteractions = [...interactions]
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      setRecentInteractions(sortedInteractions);
    }
  }, [interactions]);

  useEffect(() => {
    const handleSpotNotification = (event: CustomEvent<any>) => {
      toast({
        title: event.detail.title || 'Spot Update',
        description: event.detail.message || 'Someone interacted with your spot',
        variant: 'default',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/spots/owner/interactions', user?.id] });
      
      if (event.detail.spotId) {
        queryClient.invalidateQueries({ queryKey: [`/api/spots/${event.detail.spotId}`] });
      }
    };

    window.addEventListener('notification:content', handleSpotNotification as EventListener);
    
    return () => {
      window.removeEventListener('notification:content', handleSpotNotification as EventListener);
    };
  }, [queryClient, toast, user?.id]);

  const handleEditClick = (spot: Spot) => {
    setSelectedSpot(spot);
    editForm.reset({
      name: spot.name || '',
      description: spot.description || '',
      address: spot.address || '',
      type: spot.type || spot.category || '',
      skillLevel: spot.skillLevel || 'all',
      surfaceType: spot.surfaceType || '',
      openingHours: spot.openingHours || '',
      isFree: spot.isFree ?? true,
      website: spot.website || '',
      contactInfo: spot.contactInfo || '',
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (spot: Spot) => {
    setSelectedSpot(spot);
    setDeleteDialogOpen(true);
  };

  const handleSaveEdit = (data: EditSpotFormData) => {
    if (selectedSpot) {
      updateMutation.mutate({
        spotId: selectedSpot.id,
        data: {
          name: data.name,
          description: data.description,
          address: data.address,
          type: data.type,
          skillLevel: data.skillLevel,
          surfaceType: data.surfaceType,
          openingHours: data.openingHours,
          isFree: data.isFree,
          website: data.website || undefined,
          contactInfo: data.contactInfo,
        }
      });
    }
  };

  const handleConfirmDelete = () => {
    if (selectedSpot) {
      deleteMutation.mutate(selectedSpot.id);
    }
  };

  const getStatusBadge = (spot: any) => {
    if (spot.approvalStatus === 'approved') {
      return <Badge variant="default" className="bg-green-500">Approved</Badge>;
    } else if (spot.approvalStatus === 'rejected') {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <p>Please log in to view your spot owner dashboard.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <Heading as="h1">Spot Owner Dashboard</Heading>
        <div className="flex items-center gap-2">
          <Link href="/spots/create">
            <Button data-testid="button-add-new-spot">
              <Map className="mr-2 h-4 w-4" />
              Add New Spot
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex justify-between items-center gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Total Spots</p>
              <h3 className="text-2xl font-bold">{stats.totalSpots}</h3>
            </div>
            <Map className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Views</p>
              <h3 className="text-2xl font-bold">{stats.totalViews}</h3>
            </div>
            <Eye className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Likes</p>
              <h3 className="text-2xl font-bold">{stats.totalLikes}</h3>
            </div>
            <Heart className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Comments</p>
              <h3 className="text-2xl font-bold">{stats.totalComments}</h3>
            </div>
            <MessageSquare className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4 col-span-1">
          <div className="flex justify-between items-center gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Most Popular</p>
              <h3 className="text-xl font-bold truncate max-w-[150px]">{stats.mostPopularSpot}</h3>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>
      </div>

      <Tabs defaultValue="spots">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="spots" data-testid="tab-my-spots">My Spots</TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </TabsTrigger>
          <TabsTrigger value="recent" data-testid="tab-recent-activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="spots">
          <Card>
            <Table>
              <TableCaption>All spots you've added to the map</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Spot Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Engagement</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spots && Array.isArray(spots) && spots.length > 0 ? (
                  spots.map((spot: any) => {
                    const interactionsList = Array.isArray(interactions) ? interactions : [];
                    const spotInteractions = interactionsList.filter((i: any) => i.spotId === spot.id);
                    const views = spotInteractions.filter((i: any) => i.type === 'view').length;
                    const likes = spotInteractions.filter((i: any) => i.type === 'like').length;
                    const comments = spotInteractions.filter((i: any) => i.type === 'comment').length;
                    
                    return (
                      <TableRow key={spot.id} data-testid={`row-spot-${spot.id}`}>
                        <TableCell className="font-medium">
                          <div>
                            <span>{spot.name}</span>
                            <span className="sm:hidden block text-xs text-muted-foreground">
                              {spot.type || spot.category}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline">{spot.type || spot.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {getStatusBadge(spot)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {views}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" /> {likes}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> {comments}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 sm:gap-2">
                            <Link href={`/locations/${spot.id}`}>
                              <Button variant="ghost" size="sm" data-testid={`button-view-${spot.id}`}>
                                <Eye className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                            </Link>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEditClick(spot)}
                              data-testid={`button-edit-${spot.id}`}
                            >
                              <Edit className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => handleDeleteClick(spot)}
                              data-testid={`button-delete-${spot.id}`}
                            >
                              <Trash2 className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {spotsLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading spots...
                        </div>
                      ) : (
                        <div>
                          <p className="text-muted-foreground mb-2">No spots found</p>
                          <Link href="/spots/create">
                            <Button variant="outline" size="sm">Add your first spot</Button>
                          </Link>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <SpotCalendarTab
            spots={spotsArr}
            spotsLoading={spotsLoading}
            onAddSession={openSessionSheet}
            onDeleteSession={(id) => deleteSessionMutation.mutate(id)}
            deletingId={deleteSessionMutation.isPending ? (deleteSessionMutation.variables as any) : null}
          />
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <Table>
              <TableCaption>Recent activity on your spots</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="hidden sm:table-cell">Content</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInteractions.length > 0 ? (
                  recentInteractions.map((interaction) => (
                    <TableRow key={interaction.id}>
                      <TableCell>{interaction.userName}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            interaction.type === 'like' 
                              ? 'default' 
                              : interaction.type === 'comment' 
                                ? 'outline' 
                                : 'secondary'
                          }
                        >
                          {interaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {interaction.content ? (
                          <span className="truncate block max-w-xs">{interaction.content}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(interaction.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/locations/${interaction.spotId}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No recent activity
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <OwnerAnalyticsTab data={ownerAnalytics} isLoading={analyticsLoading} />
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Spot</DialogTitle>
            <DialogDescription>
              Update your spot details. Changes will be visible to everyone.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleSaveEdit)} className="space-y-4 py-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spot Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter spot name"
                        data-testid="input-edit-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe this spot..."
                        rows={3}
                        data-testid="input-edit-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter address"
                        data-testid="input-edit-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spot Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SPOT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="skillLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skill Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-skill-level">
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SKILL_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={editForm.control}
                name="surfaceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface Type</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Concrete, Wood, Grass"
                        data-testid="input-edit-surface"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="openingHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Hours</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., 9am - 10pm daily"
                        data-testid="input-edit-hours"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://..."
                        data-testid="input-edit-website"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="contactInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Info</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Phone or email"
                        data-testid="input-edit-contact"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="isFree"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Free to use</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-free"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter className="gap-2 sm:gap-0">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Session Creation Wizard Sheet */}
      <Sheet open={sessionSheetOpen} onOpenChange={setSessionSheetOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] rounded-t-2xl pb-8 overflow-y-auto">
          <div className="mx-auto w-10 h-1.5 rounded-full bg-muted mb-4 mt-1" />
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <CalendarPlus className="h-4 w-4 text-primary" />
              Add Session — {sessionSpot?.name}
            </SheetTitle>
            <div className="flex gap-1.5 mt-1">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${sessionStep >= s ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </SheetHeader>

          {sessionStep === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Step 1 — What is this session?</p>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Session title *</Label>
                <Input
                  value={sessionForm.title}
                  onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Morning Yoga, Open Floor, Street Art Workshop"
                  className="h-12 text-base"
                  data-testid="input-session-title"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Category</Label>
                <select
                  value={sessionForm.category}
                  onChange={e => setSessionForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm"
                  data-testid="select-session-category"
                >
                  {[
                    ['fitness_class','Fitness Class'],['yoga','Yoga'],['pilates','Pilates'],
                    ['boxing','Boxing'],['martial_arts','Martial Arts'],['crossfit','CrossFit'],
                    ['spinning','Spinning'],['dance_class','Dance Class'],['dance_battle','Dance Battle'],
                    ['open_floor','Open Floor'],['open_training','Open Training'],
                    ['personal_training','Personal Training'],['group_session','Group Session'],
                    ['sports_training','Sports Training'],['workshop','Workshop'],
                    ['dj_night','DJ Night'],['live_music','Live Music'],['exhibition','Exhibition'],
                    ['open_mic','Open Mic'],['event','Event'],['other','Other'],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Description (optional)</Label>
                <Textarea
                  value={sessionForm.description}
                  onChange={e => setSessionForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What can attendees expect?"
                  rows={3}
                  data-testid="input-session-description"
                />
              </div>
              <Button
                className="w-full h-12 text-base font-semibold mt-2"
                disabled={!sessionForm.title.trim()}
                onClick={() => setSessionStep(2)}
                data-testid="button-session-next-1"
              >
                Next →
              </Button>
            </div>
          )}

          {sessionStep === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Step 2 — When?</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Start *</Label>
                  <Input
                    type="datetime-local"
                    value={sessionForm.startTime}
                    onChange={e => setSessionForm(f => ({ ...f, startTime: e.target.value }))}
                    className="h-12"
                    data-testid="input-session-start"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">End *</Label>
                  <Input
                    type="datetime-local"
                    value={sessionForm.endTime}
                    onChange={e => setSessionForm(f => ({ ...f, endTime: e.target.value }))}
                    className="h-12"
                    data-testid="input-session-end"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-3 px-4 rounded-xl border">
                <div>
                  <p className="text-sm font-medium">Recurring session</p>
                  <p className="text-xs text-muted-foreground">Repeat this session on a schedule</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSessionForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
                  className={`w-11 h-6 rounded-full transition-colors ${sessionForm.isRecurring ? 'bg-primary' : 'bg-muted'} relative`}
                  data-testid="toggle-recurring"
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all ${sessionForm.isRecurring ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              {sessionForm.isRecurring && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Repeat</Label>
                    <select
                      value={sessionForm.recurrenceType}
                      onChange={e => setSessionForm(f => ({ ...f, recurrenceType: e.target.value }))}
                      className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Until</Label>
                    <Input
                      type="date"
                      value={sessionForm.recurrenceEnd}
                      onChange={e => setSessionForm(f => ({ ...f, recurrenceEnd: e.target.value }))}
                      className="h-12"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12" onClick={() => setSessionStep(1)}>← Back</Button>
                <Button
                  className="flex-1 h-12 text-base font-semibold"
                  disabled={!sessionForm.startTime || !sessionForm.endTime}
                  onClick={() => setSessionStep(3)}
                  data-testid="button-session-next-2"
                >
                  Next →
                </Button>
              </div>
            </div>
          )}

          {sessionStep === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Step 3 — Capacity & Pricing</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Max spots (optional)</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="1"
                      value={sessionForm.capacity}
                      onChange={e => setSessionForm(f => ({ ...f, capacity: e.target.value }))}
                      placeholder="Unlimited"
                      className="h-12 pl-9"
                      data-testid="input-session-capacity"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Price €  (0 = free)</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      step="0.50"
                      value={sessionForm.ticketPrice}
                      onChange={e => setSessionForm(f => ({ ...f, ticketPrice: e.target.value }))}
                      placeholder="Free"
                      className="h-12 pl-9"
                      data-testid="input-session-price"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-3 px-4 rounded-xl border">
                <div>
                  <p className="text-sm font-medium">Public session</p>
                  <p className="text-xs text-muted-foreground">Visible to everyone on your spot page</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSessionForm(f => ({ ...f, isPublic: !f.isPublic }))}
                  className={`w-11 h-6 rounded-full transition-colors ${sessionForm.isPublic ? 'bg-primary' : 'bg-muted'} relative`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all ${sessionForm.isPublic ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              <div className="rounded-xl border p-4 bg-muted/30 text-sm space-y-1">
                <p className="font-medium">{sessionForm.title}</p>
                <p className="text-muted-foreground">{sessionForm.category} · {sessionForm.startTime ? format(new Date(sessionForm.startTime), 'dd MMM yyyy HH:mm') : '—'} – {sessionForm.endTime ? format(new Date(sessionForm.endTime), 'HH:mm') : '—'}</p>
                {sessionForm.isRecurring && <p className="text-xs text-primary">↻ Repeats {sessionForm.recurrenceType}</p>}
                {sessionForm.capacity && <p className="text-xs text-muted-foreground">Max {sessionForm.capacity} spots</p>}
                {sessionForm.ticketPrice && parseFloat(sessionForm.ticketPrice) > 0 && <p className="text-xs text-muted-foreground">€{sessionForm.ticketPrice} per person</p>}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12" onClick={() => setSessionStep(2)}>← Back</Button>
                <Button
                  className="flex-1 h-12 text-base font-semibold"
                  onClick={submitSession}
                  disabled={createSessionMutation.isPending}
                  data-testid="button-session-publish"
                >
                  {createSessionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Publish Session
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Spot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedSpot?.name}"? This action cannot be undone. 
              The spot will be permanently removed from the map and all associated data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Spot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── SpotCalendarTab ──────────────────────────────────────────────────────────
const SESSION_EMOJIS: Record<string, string> = {
  fitness_class: '🏋️', yoga: '🧘', pilates: '🤸', boxing: '🥊',
  martial_arts: '🥋', crossfit: '💪', spinning: '🚴', dance_class: '💃',
  dance_battle: '🕺', open_floor: '🪩', open_training: '🏃', personal_training: '👤',
  group_session: '👥', sports_training: '⚽', workshop: '🔨', dj_night: '🎛️',
  live_music: '🎵', exhibition: '🖼️', open_mic: '🎤', event: '📅', other: '📋',
};

function SpotDateSessions({ spot, dateStr, onDeleteSession, deletingId }: {
  spot: any;
  dateStr: string;
  onDeleteSession: (id: number) => void;
  deletingId: number | null;
}) {
  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: [`/api/spots/${spot.id}/sessions`],
    enabled: !!spot.id,
  });

  const filtered = sessions
    .filter(s => format(new Date(s.startTime), 'yyyy-MM-dd') === dateStr)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  if (filtered.length === 0) return null;

  return (
    <>
      {filtered.map(session => (
        <div key={session.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card" data-testid={`session-item-${session.id}`}>
          <div className="flex flex-col items-center justify-center min-w-[48px] h-14 bg-primary/10 rounded-xl p-2 flex-shrink-0">
            <span className="text-xl leading-none">{SESSION_EMOJIS[session.category] || '📋'}</span>
            <span className="text-[10px] font-bold text-primary mt-1">{format(new Date(session.startTime), 'HH:mm')}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{session.title}</p>
            <p className="text-xs text-muted-foreground truncate">{spot.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{format(new Date(session.startTime), 'HH:mm')}–{format(new Date(session.endTime), 'HH:mm')}</span>
              {session.capacity
                ? <span className="text-xs font-medium text-primary">{session.registrationCount}/{session.capacity} booked</span>
                : session.registrationCount > 0
                  ? <span className="text-xs text-muted-foreground">{session.registrationCount} booked</span>
                  : <span className="text-xs text-muted-foreground">No bookings yet</span>
              }
              {session.ticketPrice && parseFloat(session.ticketPrice) > 0
                ? <Badge variant="secondary" className="text-xs">€{session.ticketPrice}</Badge>
                : <Badge variant="outline" className="text-xs text-green-600 border-green-300">Free</Badge>
              }
              {session.isFull && <Badge variant="destructive" className="text-xs">Full</Badge>}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteSession(session.id)}
            disabled={deletingId === session.id}
            data-testid={`button-delete-session-${session.id}`}
          >
            {deletingId === session.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ))}
    </>
  );
}

function AllSpotSessionsForDate({ spots, selectedDate, onDeleteSession, deletingId }: {
  spots: any[];
  selectedDate: Date;
  onDeleteSession: (id: number) => void;
  deletingId: number | null;
}) {
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  return (
    <div className="space-y-2 min-h-[80px]">
      {spots.map(spot => (
        <SpotDateSessions
          key={spot.id}
          spot={spot}
          dateStr={dateStr}
          onDeleteSession={onDeleteSession}
          deletingId={deletingId}
        />
      ))}
    </div>
  );
}

function SpotCalendarTab({ spots, spotsLoading, onAddSession, onDeleteSession, deletingId }: {
  spots: any[];
  spotsLoading: boolean;
  onAddSession: (spot: any) => void;
  onDeleteSession: (id: number) => void;
  deletingId: number | null;
}) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Show all spots - backend enforces session creation rules
  const allSpots = spots;
  const pendingSpots = spots.filter(s => s.approvalStatus !== 'approved');

  // Build 14-day strip
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  if (spotsLoading) return (
    <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" /> Loading your spots…
    </div>
  );

  if (allSpots.length === 0) return (
    <Card className="p-8 flex flex-col items-center text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
        <Calendar className="w-7 h-7 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-1">No Spots Yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Add your first spot using the "Add Spot" button above, then you can schedule sessions here.
        </p>
      </div>
    </Card>
  );

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base">{isToday ? 'Today' : format(selectedDate, 'EEEE')}</h3>
          <p className="text-xs text-muted-foreground">{format(selectedDate, 'dd MMMM yyyy')}</p>
        </div>
        <Badge variant="outline" className="text-xs">{allSpots.length} spot{allSpots.length !== 1 ? 's' : ''}</Badge>
      </div>

      {/* Pending spots notice */}
      {pendingSpots.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            {pendingSpots.map(s => s.name).join(', ')} {pendingSpots.length === 1 ? 'is' : 'are'} awaiting admin approval. You can still schedule sessions.
          </span>
        </div>
      )}

      {/* Date strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {days.map(d => {
          const isSelected = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const isTod = format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`flex flex-col items-center justify-center min-w-[52px] h-16 rounded-2xl border transition-all flex-shrink-0 ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : isTod
                  ? 'border-primary text-primary font-semibold'
                  : 'bg-card text-muted-foreground hover:bg-muted/60'
              }`}
              data-testid={`date-button-${format(d, 'yyyy-MM-dd')}`}
            >
              <span className={`text-xs ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                {format(d, 'EEE')}
              </span>
              <span className="text-lg font-bold leading-tight">{format(d, 'd')}</span>
              {isTod && !isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Sessions for selected date */}
      <AllSpotSessionsForDate
        spots={allSpots}
        selectedDate={selectedDate}
        onDeleteSession={onDeleteSession}
        deletingId={deletingId}
      />

      {/* Add session per spot */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Add session to spot</p>
        <div className="flex flex-wrap gap-2">
          {allSpots.map(spot => (
            <Button
              key={spot.id}
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => onAddSession(spot)}
              data-testid={`button-add-session-${spot.id}`}
            >
              <Plus className="h-3.5 w-3.5" />
              {spot.name}
              {spot.approvalStatus !== 'approved' && (
                <Badge variant="outline" className="ml-1 text-[9px] text-amber-600 border-amber-400 px-1">Pending</Badge>
              )}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── OwnerAnalyticsTab ────────────────────────────────────────────────────────
function OwnerAnalyticsTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return (
    <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" /> Loading analytics…
    </div>
  );
  // Provide safe defaults so the tab always renders
  const d = data || { totalSpots: 0, approvedSpots: 0, totalSaves: 0, totalSessions: 0, totalBookings: 0, totalRevenue: 0, spotsWithStats: [], weeklyTrend: [] };

  const kpiCards = [
    { label: 'Total Spots', value: d.totalSpots, icon: Map, color: 'text-blue-500' },
    { label: 'Approved', value: d.approvedSpots, icon: CheckCircle, color: 'text-green-500' },
    { label: 'Spot Saves', value: d.totalSaves, icon: Bookmark, color: 'text-purple-500' },
    { label: 'Sessions', value: d.totalSessions, icon: Calendar, color: 'text-orange-500' },
    { label: 'Bookings', value: d.totalBookings, icon: Users, color: 'text-cyan-500' },
    { label: 'Revenue', value: `€${d.totalRevenue}`, icon: Euro, color: 'text-emerald-500' },
  ];

  const weeklyData = (d.weeklyTrend || []).map((w: any) => ({
    week: w.week.slice(5),
    bookings: w.bookings,
    revenue: w.revenue,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
              <Icon className={`h-7 w-7 ${color} opacity-80`} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Weekly Bookings
        </h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {d.spotsWithStats?.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Spots Performance
            </h3>
          </div>
          <div className="divide-y">
            {d.spotsWithStats.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{s.type?.replace(/_/g, ' ')} · {s.approvalStatus}</p>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground flex-shrink-0">
                  <span title="Saves">🔖 {s.saves}</span>
                  <span title="Sessions">📅 {s.sessions}</span>
                  <span title="Bookings">👥 {s.bookings}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default SpotOwnerDashboard;
