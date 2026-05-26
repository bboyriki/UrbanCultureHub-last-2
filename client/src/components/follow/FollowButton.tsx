import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { UserPlus, UserMinus, Clock, Loader2 } from 'lucide-react';

type FollowButtonProps = {
  userId: number;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
};

type FollowStatus = {
  isFollowing: boolean;
  status?: 'active' | 'pending';
};

export function FollowButton({ 
  userId, 
  className = '', 
  size = 'default',
  showText = true 
}: FollowButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isHovering, setIsHovering] = useState(false);

  const { data: followStatus, isLoading } = useQuery<FollowStatus>({
    queryKey: [`/api/users/${userId}/is-following`],
    enabled: !!user && user.id !== userId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest<{ status: string }>(`/api/users/${userId}/follow`, 'POST');
      return res;
    },
    onSuccess: (data: { status: string }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/is-following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/followers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/followers/count`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/following/count`] });
      
      const isPending = data?.status === 'pending';
      toast({
        title: isPending ? 'Follow Request Sent' : 'Following',
        description: isPending 
          ? 'Your follow request is pending approval.' 
          : 'You are now following this user.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to follow user.',
        variant: 'destructive',
      });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/users/${userId}/follow`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/is-following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/followers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/followers/count`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/following/count`] });
      
      toast({
        title: 'Unfollowed',
        description: 'You are no longer following this user.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to unfollow user.',
        variant: 'destructive',
      });
    },
  });

  if (!user || user.id === userId) {
    return null;
  }

  const isFollowing = followStatus?.isFollowing;
  const isPending = isFollowing && followStatus?.status === 'pending';
  const isPendingAction = followMutation.isPending || unfollowMutation.isPending;

  const handleClick = () => {
    if (isPendingAction) return;
    
    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  const getButtonContent = () => {
    if (isPendingAction) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {showText && <span className="ml-1">Loading...</span>}
        </>
      );
    }

    if (isPending) {
      return (
        <>
          <Clock className="h-4 w-4" />
          {showText && <span className="ml-1">Request Sent</span>}
        </>
      );
    }

    if (isFollowing) {
      return (
        <>
          <UserMinus className="h-4 w-4" />
          {showText && <span className="ml-1">{isHovering ? 'Disconnect' : 'Connected'}</span>}
        </>
      );
    }

    return (
      <>
        <UserPlus className="h-4 w-4" />
        {showText && <span className="ml-1">Connect</span>}
      </>
    );
  };

  const getVariant = () => {
    if (isPending) return 'secondary';
    if (isFollowing) return isHovering ? 'destructive' : 'secondary';
    return 'default';
  };

  return (
    <Button
      variant={getVariant()}
      size={size}
      onClick={handleClick}
      disabled={isLoading || isPendingAction}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={className}
      data-testid={`button-follow-${userId}`}
    >
      {getButtonContent()}
    </Button>
  );
}
