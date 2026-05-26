import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FollowButton } from './FollowButton';
import { useAuth } from '@/contexts/AuthContext';
import { UserCheck, UserCircle } from 'lucide-react';

type Following = {
  id: number;
  followerId: number;
  followedId: number;
  status: string;
  createdAt: string;
  following: {
    id: number;
    displayName: string;
    profilePicture: string | null;
    role: string;
  };
};

type FollowingListProps = {
  userId: number;
  showCount?: boolean;
  maxItems?: number;
  asDialog?: boolean;
};

export function FollowingList({ 
  userId, 
  showCount = true, 
  maxItems,
  asDialog = false 
}: FollowingListProps) {
  const { user: currentUser } = useAuth();

  const { data: following, isLoading } = useQuery<Following[]>({
    queryKey: [`/api/users/${userId}/following`],
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: [`/api/users/${userId}/following/count`],
    enabled: showCount,
  });

  const displayFollowing = maxItems ? following?.slice(0, maxItems) : following;
  const count = countData?.count || following?.length || 0;

  const ListContent = () => (
    <>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : displayFollowing && displayFollowing.length > 0 ? (
        <ScrollArea className={asDialog ? "h-[400px]" : "max-h-[300px]"}>
          <div className="space-y-1">
            {displayFollowing.map((follow) => (
              <div 
                key={follow.id} 
                className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                data-testid={`following-item-${follow.following.id}`}
              >
                <Link 
                  href={`/profile/${follow.following.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={follow.following.profilePicture || undefined} />
                    <AvatarFallback>
                      {follow.following.displayName?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {follow.following.displayName}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {follow.following.role}
                      </Badge>
                      {follow.status === 'pending' && (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
                {currentUser && currentUser.id === userId && follow.following.id !== currentUser.id && (
                  <FollowButton 
                    userId={follow.following.id} 
                    size="sm"
                    showText={false}
                  />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <UserCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Not following anyone yet</p>
        </div>
      )}
    </>
  );

  if (asDialog) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" className="p-0 h-auto font-normal" data-testid="button-view-following">
            <span className="text-lg font-bold">{count}</span>
            <span className="text-muted-foreground ml-1">Following</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Following
            </DialogTitle>
          </DialogHeader>
          <ListContent />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Following
          {showCount && <Badge variant="secondary">{count}</Badge>}
        </CardTitle>
        <CardDescription>People this user follows</CardDescription>
      </CardHeader>
      <CardContent>
        <ListContent />
      </CardContent>
    </Card>
  );
}
