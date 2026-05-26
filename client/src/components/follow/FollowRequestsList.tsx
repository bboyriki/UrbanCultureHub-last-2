import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Check, X, Users, UserCircle, Loader2 } from 'lucide-react';

type FollowRequest = {
  id: number;
  followerId: number;
  followedId: number;
  status: string;
  createdAt: string;
  follower: {
    id: number;
    displayName: string;
    profilePicture: string | null;
    role: string;
  };
};

export function FollowRequestsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery<FollowRequest[]>({
    queryKey: ['/api/follow-requests'],
    enabled: !!user,
  });

  const acceptMutation = useMutation({
    mutationFn: async (followId: number) => {
      await apiRequest(`/api/follow-requests/${followId}/accept`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/follow-requests'] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/followers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/followers/count`] });
      toast({
        title: 'Request Accepted',
        description: 'You have a new follower!',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to accept follow request.',
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (followId: number) => {
      await apiRequest(`/api/follow-requests/${followId}/reject`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/follow-requests'] });
      toast({
        title: 'Request Rejected',
        description: 'Follow request has been declined.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to reject follow request.',
        variant: 'destructive',
      });
    },
  });

  if (!user) return null;

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Follow Requests
          {pendingRequests.length > 0 && (
            <Badge variant="default">{pendingRequests.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>People who want to follow you</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : pendingRequests.length > 0 ? (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {pendingRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/30 border"
                  data-testid={`follow-request-${request.follower.id}`}
                >
                  <Link 
                    href={`/profile/${request.follower.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={request.follower.profilePicture || undefined} />
                      <AvatarFallback>
                        {request.follower.displayName?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {request.follower.displayName}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {request.follower.role}
                      </Badge>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => acceptMutation.mutate(request.id)}
                      disabled={acceptMutation.isPending || rejectMutation.isPending}
                      data-testid={`button-accept-${request.id}`}
                    >
                      {acceptMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMutation.mutate(request.id)}
                      disabled={acceptMutation.isPending || rejectMutation.isPending}
                      data-testid={`button-reject-${request.id}`}
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <UserCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No pending follow requests</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
