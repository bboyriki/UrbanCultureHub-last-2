import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import StoryViewer, { type StoryUser } from "./StoryViewer";
import StoryCreator from "./StoryCreator";

interface Props {
  className?: string;
}

function StoryRing({ hasUnviewed, isOwn, children }: { hasUnviewed: boolean; isOwn: boolean; children: React.ReactNode }) {
  if (isOwn) {
    return (
      <div className={cn(
        "p-[2px] rounded-full",
        hasUnviewed
          ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
          : "bg-gradient-to-tr from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700"
      )}>
        <div className="bg-background rounded-full p-[2px]">{children}</div>
      </div>
    );
  }
  if (!hasUnviewed) {
    return (
      <div className="p-[2px] rounded-full bg-gray-300 dark:bg-gray-600">
        <div className="bg-background rounded-full p-[2px]">{children}</div>
      </div>
    );
  }
  return (
    <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
      <div className="bg-background rounded-full p-[2px]">{children}</div>
    </div>
  );
}

export default function StoryCircles({ className }: Props) {
  const { user } = useAuth();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const { data: feed = [], isLoading } = useQuery<StoryUser[]>({
    queryKey: ["/api/stories/feed"],
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const openViewer = (idx: number) => {
    setViewerStart(idx);
    setViewerOpen(true);
  };

  if (!user) return null;

  const myEntry = feed.find(u => u.userId === user.id);
  const hasMyStories = !!myEntry && myEntry.stories.length > 0;

  return (
    <>
      <div className={cn("flex gap-3 overflow-x-auto scrollbar-hide px-4 py-2", className)}>
        {/* ── Add Story Button ── */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <button
            onClick={() => hasMyStories ? openViewer(feed.findIndex(u => u.userId === user.id)) : setCreatorOpen(true)}
            data-testid="btn-add-story"
            className="relative"
          >
            <StoryRing hasUnviewed={myEntry?.hasUnviewed ?? false} isOwn={true}>
              <Avatar className="w-14 h-14">
                <AvatarImage src={(user as any).profilePicture || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-bold text-lg">
                  {user.displayName?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </StoryRing>
            {/* Plus badge */}
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
              <Plus className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          </button>
          <span className="text-[11px] text-muted-foreground font-medium truncate w-16 text-center">
            Your story
          </span>
        </div>

        {/* ── Loading state ── */}
        {isLoading && (
          <div className="flex items-center justify-center px-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Other users' stories ── */}
        {feed.filter(u => u.userId !== user.id).map((storyUser, relIdx) => {
          const absIdx = feed.findIndex(u => u.userId === storyUser.userId);
          return (
            <motion.div
              key={storyUser.userId}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: relIdx * 0.04, duration: 0.2 }}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <button onClick={() => openViewer(absIdx)} data-testid={`btn-story-user-${storyUser.userId}`}>
                <StoryRing hasUnviewed={storyUser.hasUnviewed} isOwn={false}>
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={storyUser.profilePicture || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-blue-500 text-white font-semibold text-base">
                      {storyUser.displayName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </StoryRing>
              </button>
              <span className="text-[11px] text-muted-foreground font-medium truncate w-16 text-center">
                {storyUser.displayName.split(" ")[0]}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Story Viewer */}
      <AnimatePresence>
        {viewerOpen && feed.length > 0 && (
          <StoryViewer
            users={feed}
            startUserIndex={viewerStart}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Story Creator */}
      <StoryCreator open={creatorOpen} onClose={() => setCreatorOpen(false)} />
    </>
  );
}

// Standalone story ring for profile pages — wraps children (e.g. Avatar)
export function ProfileStoryRing({
  userId,
  children,
  onClick,
}: {
  userId: number;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const { data: userStories = [] } = useQuery<any[]>({
    queryKey: [`/api/stories/user/${userId}`],
    refetchInterval: 60_000,
  });

  const [viewerOpen, setViewerOpen] = useState(false);
  const hasStories = userStories.length > 0;
  const hasUnviewed = userStories.some((s: any) => !s.viewed);

  const fakeUser: StoryUser = {
    userId,
    displayName: "",
    profilePicture: null,
    isOwn: false,
    hasUnviewed,
    stories: userStories,
  };

  if (!hasStories) {
    // No stories — just render children as-is
    return <>{children}</>;
  }

  return (
    <>
      <button
        onClick={() => { setViewerOpen(true); onClick?.(); }}
        className={cn(
          "p-[3px] rounded-full",
          hasUnviewed
            ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
            : "bg-gray-400"
        )}
        data-testid={`btn-profile-story-${userId}`}
      >
        <div className="bg-white dark:bg-gray-950 rounded-full p-[2px]">
          {children}
        </div>
      </button>

      <AnimatePresence>
        {viewerOpen && (
          <StoryViewer
            users={[fakeUser]}
            startUserIndex={0}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
