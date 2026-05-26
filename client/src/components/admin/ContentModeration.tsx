import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ContentFlag, ContentFlagStatus } from "@shared/schema";
import { AlertTriangle, RefreshCw, Flag, Clock, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type FlagStatus = "pending" | "approved" | "rejected" | "all";

const ContentModeration = () => {
  const [status, setStatus] = useState<FlagStatus>("pending");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<ContentFlag | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const adminId = user?.id || 1;

  const {
    data: flags = [],
    isLoading,
    refetch,
  } = useQuery<ContentFlag[]>({
    queryKey: ["/api/admin/content-flags", status !== "all" ? status : null],
    queryFn: async () => {
      const url = status !== "all"
        ? `/api/admin/content-flags?status=${status}`
        : `/api/admin/content-flags`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch content flags");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const reviewFlagMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes: string }) => {
      const response = await fetch(`/api/admin/content-flags/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes, reviewerId: adminId }),
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Failed to review content flag");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-flags"] });
      toast({
        title: "Flag updated",
        description: data.message || "Content flag has been updated.",
      });
      setReviewModalOpen(false);
      setReviewNotes("");
      setSelectedFlag(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update flag",
        description: error.message || "Could not update content flag",
        variant: "destructive",
      });
    },
  });

  const openReviewModal = (flag: ContentFlag) => {
    setSelectedFlag(flag);
    setReviewNotes(flag.reviewNotes || "");
    setReviewModalOpen(true);
  };

  const handleApprove = () => {
    if (selectedFlag) {
      reviewFlagMutation.mutate({ id: selectedFlag.id, status: ContentFlagStatus.APPROVED, notes: reviewNotes });
    }
  };

  const handleReject = () => {
    if (selectedFlag) {
      reviewFlagMutation.mutate({ id: selectedFlag.id, status: ContentFlagStatus.REJECTED, notes: reviewNotes });
    }
  };

  const handleResetPending = () => {
    if (selectedFlag) {
      reviewFlagMutation.mutate({ id: selectedFlag.id, status: ContentFlagStatus.PENDING, notes: reviewNotes });
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case ContentFlagStatus.PENDING:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case ContentFlagStatus.APPROVED:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case ContentFlagStatus.REJECTED:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{s}</span>;
    }
  };

  const getContentTypeLabel = (contentType: string) => {
    const map: Record<string, string> = {
      post: "Social Post",
      comment: "Comment",
      event: "Event",
      location: "Location",
      user: "User Profile",
      product: "Marketplace Item",
    };
    return map[contentType] || contentType;
  };

  const createTestFlag = async () => {
    try {
      const response = await fetch("/api/content-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "post", contentId: 1, reason: "Test flag — inappropriate content", reporterId: adminId }),
        credentials: "include",
      });
      if (response.ok) {
        toast({ title: "Test flag created" });
        refetch();
      } else {
        toast({ title: "Failed to create test flag", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error creating test flag", variant: "destructive" });
    }
  };

  const isReReview = selectedFlag && selectedFlag.status !== ContentFlagStatus.PENDING;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <h2 className="text-lg font-medium">Content Moderation</h2>
        <Button onClick={createTestFlag} variant="outline" size="sm">
          Create Test Flag
        </Button>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as FlagStatus)} className="mb-4">
        <TabsList className="flex w-full sm:w-auto">
          <TabsTrigger value="pending" className="flex-1 sm:flex-none text-xs sm:text-sm">Pending</TabsTrigger>
          <TabsTrigger value="approved" className="flex-1 sm:flex-none text-xs sm:text-sm">Approved</TabsTrigger>
          <TabsTrigger value="rejected" className="flex-1 sm:flex-none text-xs sm:text-sm">Rejected</TabsTrigger>
          <TabsTrigger value="all" className="flex-1 sm:flex-none text-xs sm:text-sm">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Loading content flags...</p>
        </div>
      ) : flags.length > 0 ? (
        <div className="space-y-3">
          {flags.map((flag: ContentFlag) => (
            <div
              key={flag.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Flag className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800">
                    {getContentTypeLabel(flag.contentType)}
                  </span>
                  <span className="text-xs text-gray-400">ID #{flag.contentId}</span>
                </div>
                {getStatusBadge(flag.status)}
              </div>

              <p className="text-sm text-gray-700 mb-2 break-words leading-relaxed">
                {flag.reason}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                <div className="flex flex-wrap gap-3">
                  <span>Reporter: User #{flag.reporterId || "Anonymous"}</span>
                  {flag.createdAt && (
                    <span>{format(new Date(flag.createdAt), "MMM d, yyyy · h:mm a")}</span>
                  )}
                  {flag.reviewNotes && (
                    <span className="text-gray-500">Note: {flag.reviewNotes}</span>
                  )}
                </div>
                <Button
                  variant={flag.status !== ContentFlagStatus.PENDING ? "outline" : "default"}
                  size="sm"
                  onClick={() => openReviewModal(flag)}
                  data-testid={`button-review-flag-${flag.id}`}
                  className="text-xs h-8"
                >
                  {flag.status !== ContentFlagStatus.PENDING ? (
                    <><RefreshCw className="w-3 h-3 mr-1" /> Re-review</>
                  ) : (
                    "Review"
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Flag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No content flags found</p>
          <p className="text-gray-400 text-xs mt-1">
            {status !== "all"
              ? "Try selecting a different status filter"
              : "When users report content, it will appear here for moderation"}
          </p>
        </div>
      )}

      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isReReview ? (
                <><RefreshCw className="w-4 h-4 text-blue-500" /> Re-review Flagged Content</>
              ) : (
                <><Flag className="w-4 h-4 text-orange-500" /> Review Flagged Content</>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedFlag && (
            <div className="space-y-4">
              {isReReview && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                  <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    This flag was already <strong>{selectedFlag.status}</strong>. You can change the decision below.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 mb-1">Content Type</p>
                  <p className="text-sm font-medium">{getContentTypeLabel(selectedFlag.contentType)}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 mb-1">Current Status</p>
                  <div className="mt-0.5">{getStatusBadge(selectedFlag.status)}</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Reason for Report</p>
                <p className="text-sm text-gray-800 break-words">{selectedFlag.reason}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Review Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Textarea
                  placeholder="Add your review notes here..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2 sm:justify-between pt-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setReviewModalOpen(false)} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              {isReReview && (
                <Button
                  variant="outline"
                  onClick={handleResetPending}
                  disabled={reviewFlagMutation.isPending}
                  className="flex-1 sm:flex-none text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Set Pending
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={reviewFlagMutation.isPending}
                className="flex-1 sm:flex-none"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                {selectedFlag?.status === ContentFlagStatus.REJECTED ? "Keep Rejected" : "Reject & Remove"}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={reviewFlagMutation.isPending}
                className="flex-1 sm:flex-none"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                {reviewFlagMutation.isPending ? "Saving..." : selectedFlag?.status === ContentFlagStatus.APPROVED ? "Keep Approved" : "Approve Content"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContentModeration;
