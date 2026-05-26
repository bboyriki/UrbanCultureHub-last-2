import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Location } from "@shared/schema";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Star, MapPin, Clock, Bookmark, X, ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationDetailModalProps {
  location: Location;
  onClose: () => void;
}

function StarRating({ value, onChange, readonly = false, size = "md" }: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const sz = size === "sm" ? "w-4 h-4" : "w-6 h-6";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => !readonly && setHovered(i)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={cn("transition-transform", !readonly && "hover:scale-110 cursor-pointer")}
        >
          <Star
            className={cn(sz, (hovered || value) >= i ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600")}
          />
        </button>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const LocationDetailModal = ({ location, onClose }: LocationDetailModalProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myReview, setMyReview] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);

  const { isDarkMode } = useTheme();
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const hasImages = location.images && Array.isArray(location.images) && location.images.length > 0;

  // ── Ratings query ─────────────────────────────────────────────────────────
  const { data: ratingsData } = useQuery<{
    ratings: any[];
    average: number | null;
    count: number;
    myRating: any | null;
  }>({
    queryKey: ["/api/locations", location.id, "ratings"],
    queryFn: async () => {
      const res = await fetch(`/api/locations/${location.id}/ratings`, { credentials: "include" });
      if (!res.ok) return { ratings: [], average: null, count: 0, myRating: null };
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.myRating) {
        setMyRating(data.myRating.rating);
        setMyReview(data.myRating.review || "");
      }
    },
  } as any);

  const ratings = ratingsData?.ratings || [];
  const average = ratingsData?.average || null;
  const ratingCount = ratingsData?.count || 0;

  // ── Submit rating ─────────────────────────────────────────────────────────
  const ratingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/locations/${location.id}/ratings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: myRating, review: myReview }),
      });
      if (!res.ok) throw new Error("Failed to save rating");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations", location.id, "ratings"] });
      toast({ title: "Rating saved!" });
      setShowReviewForm(false);
    },
    onError: () => toast({ title: "Failed to save rating", variant: "destructive" }),
  });

  // ── Delete rating ─────────────────────────────────────────────────────────
  const deleteRatingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/locations/${location.id}/ratings`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations", location.id, "ratings"] });
      setMyRating(0);
      setMyReview("");
      toast({ title: "Rating removed" });
    },
  });

  // ── Save location ─────────────────────────────────────────────────────────
  const handleSaveLocation = async () => {
    if (!user) {
      toast({ title: "Please log in to save spots", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      let token: string | null = null;
      try { token = await getToken(); } catch {}
      if (!token) throw new Error("Auth failed");

      const response = await fetch(window.location.origin + "/api/saved-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, locationId: location.id }),
      });
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/saved-locations`] });
      toast({ title: "Spot saved!" });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getLocationTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      graffiti: "Graffiti Spot", dance: "Dance Area", skate: "Skateboarding Spot",
      parkour: "Parkour Area", workout: "Urban Workout", training: "Training Ground",
    };
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getBadgeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      graffiti: "bg-primary", dance: "bg-secondary", skate: "bg-green-500",
      parkour: "bg-amber-500", training: "bg-amber-500", workout: "bg-purple-500",
    };
    return colorMap[type] || "bg-gray-500";
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        "sm:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6",
        isDarkMode ? "bg-gray-800 text-white border-gray-700" : "bg-white"
      )}>
        <DialogHeader className="space-y-1 mb-3">
          <DialogTitle className={`text-lg sm:text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            {location.name}
          </DialogTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${getBadgeColor(location.type)} text-white text-xs`}>
              {getLocationTypeLabel(location.type)}
            </Badge>
            {average !== null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-foreground">{average}</span>
                <span>({ratingCount})</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Image Gallery */}
        {hasImages ? (
          <div className="relative overflow-hidden rounded-lg aspect-video mb-4">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImageIndex}
                src={location.images![currentImageIndex]}
                alt={`${location.name} - Photo ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </AnimatePresence>
            {location.images!.length > 1 && (
              <>
                <button onClick={() => setCurrentImageIndex(i => (i - 1 + location.images!.length) % location.images!.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setCurrentImageIndex(i => (i + 1) % location.images!.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {location.images!.map((_, i) => (
                    <div key={i} className={cn("h-1 rounded-full transition-all", i === currentImageIndex ? "w-3 bg-white" : "w-1 bg-white/50")} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={cn("rounded-lg aspect-video flex items-center justify-center mb-4 gap-2", isDarkMode ? "bg-gray-700" : "bg-gray-100")}>
            <MapPin className={isDarkMode ? "h-8 w-8 text-gray-500" : "h-8 w-8 text-gray-400"} />
            <p className="text-xs text-muted-foreground">No photos yet</p>
          </div>
        )}

        {/* Details */}
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">About</h3>
            <p className="text-sm">{location.description || "No description available"}</p>
          </div>
          {location.address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm">{location.address}</p>
            </div>
          )}
          {location.openingHours && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm">{location.openingHours}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {location.accessibility && <Badge variant="secondary">{location.accessibility}</Badge>}
            {location.surfaceType && <Badge variant="secondary">{location.surfaceType}</Badge>}
            {location.skillLevel && <Badge variant="secondary">{location.skillLevel}</Badge>}
            <Badge variant={location.isFree ? "default" : "outline"}>{location.isFree ? "Free" : "Paid"}</Badge>
          </div>
          {location.website && (
            <a href={location.website.startsWith("http") ? location.website : `https://${location.website}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 underline block truncate">
              {location.website}
            </a>
          )}
        </div>

        {/* ── Ratings & Reviews ──────────────────────────────────────────── */}
        <div className="mt-5 border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">Ratings</h3>
              {average !== null && (
                <div className="flex items-center gap-1">
                  <StarRating value={Math.round(average)} readonly size="sm" />
                  <span className="text-xs text-muted-foreground">({ratingCount})</span>
                </div>
              )}
            </div>
            {user && !showReviewForm && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowReviewForm(true)}
                data-testid="btn-write-review">
                {ratingsData?.myRating ? "Edit review" : "Rate this spot"}
              </Button>
            )}
          </div>

          {/* Write review form */}
          <AnimatePresence>
            {showReviewForm && user && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-xl bg-muted/50 border space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Your rating:</span>
                  <StarRating value={myRating} onChange={setMyRating} />
                </div>
                <Textarea
                  value={myReview}
                  onChange={e => setMyReview(e.target.value)}
                  placeholder="Share your experience at this spot..."
                  rows={3}
                  className="text-sm resize-none"
                  data-testid="input-review-text"
                />
                <div className="flex gap-2 justify-end">
                  {ratingsData?.myRating && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                      onClick={() => deleteRatingMutation.mutate()} disabled={deleteRatingMutation.isPending}>
                      Remove
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowReviewForm(false)}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs gap-1" disabled={myRating === 0 || ratingMutation.isPending}
                    onClick={() => ratingMutation.mutate()} data-testid="btn-submit-review">
                    {ratingMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Save
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reviews list */}
          {ratings.length > 0 ? (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {ratings.map((r: any) => (
                <div key={r.id} className="flex gap-2.5">
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarImage src={r.user?.profilePicture || undefined} />
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                      {r.user?.displayName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{r.user?.displayName}</span>
                      <StarRating value={r.rating} readonly size="sm" />
                      <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(r.createdAt)}</span>
                    </div>
                    {r.review && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{r.review}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">
              No reviews yet — be the first to rate this spot!
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center gap-2 mt-4 pt-3 border-t">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1"
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`, "_blank")}
              data-testid="btn-directions">
              <MapPin className="h-3 w-3" />
              Directions
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1"
              onClick={handleSaveLocation} disabled={isSaving} data-testid="btn-save-location">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bookmark className="h-3 w-3" />}
              Save
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose} data-testid="btn-close-location">
            <X className="h-3 w-3 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationDetailModal;
