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
import { Users, UserCircle } from 'lucide-react';

type Follower = {
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

type FollowersListProps = {
  userId: number;
  showCount?: boolean;
  maxItems?: number;
  asDialog?: boolean;
};

export function FollowersList({ 
  userId, 
  showCount = true, 
  maxItems,
  asDialog = false 
}: FollowersListProps) {
  const { user: currentUser } = useAuth();

  const { data: followers, isLoading } = useQuery<Follower[]>({
    queryKey: [`/api/users/${userId}/followers`],
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: [`/api/users/${userId}/followers/count`],
    enabled: showCount,
  });

  const displayFollowers = maxItems ? followers?.slice(0, maxItems) : followers;
  const count = countData?.count || followers?.length || 0;

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
      ) : displayFollowers && displayFollowers.length > 0 ? (
        <ScrollArea className={asDialog ? "h-[400px]" : "max-h-[300px]"}>
          <div className="space-y-1">
            {displayFollowers.map((follow) => (
              <div 
                key={follow.id} 
                className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                data-testid={`follower-item-${follow.follower.id}`}
              >
                <Link 
                  href={`/profile/${follow.follower.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={follow.follower.profilePicture || undefined} />
                    <AvatarFallback>
                      {follow.follower.displayName?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {follow.follower.displayName}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {follow.follower.role}
                    </Badge>
                  </div>
                </Link>
                {currentUser && currentUser.id !== follow.follower.id && (
                  <FollowButton 
                    userId={follow.follower.id} 
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
          <p className="text-sm">No followers yet</p>
        </div>
      )}
    </>
  );

  if (asDialog) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" className="p-0 h-auto font-normal" data-testid="button-view-followers">
            <span className="text-lg font-bold">{count}</span>
            <span className="text-muted-foreground ml-1">Followers</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Followers
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
          <Users className="h-5 w-5" />
          Followers
          {showCount && <Badge variant="secondary">{count}</Badge>}
        </CardTitle>
        <CardDescription>People who follow this user</CardDescription>
      </CardHeader>
      <CardContent>
        <ListContent />
      </CardContent>
    </Card>
  );
}
