import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, FileText, CheckCircle, XCircle, AlertTriangle, Clock, FilterX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { queryClient } from "@/lib/queryClient";

type DataDeletionRequest = {
  id: number;
  userId: number;
  userEmail?: string;
  userName?: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  createdAt: string;
  adminNotes: string | null;
  processedAt: string | null;
};

export default function DataDeletionRequestsPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [rejectionNotes, setRejectionNotes] = useState<string>("");
  const [approvalNotes, setApprovalNotes] = useState<string>("");
  const [selectedRequest, setSelectedRequest] = useState<DataDeletionRequest | null>(null);
  const { toast } = useToast();

  // Fetch all data deletion requests
  const { data: requests, isLoading, error } = useQuery<DataDeletionRequest[]>({
    queryKey: ["/api/legal/data-deletion-requests"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update request status mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNotes,
    }: {
      id: number;
      status: "approved" | "rejected";
      adminNotes: string;
    }) => {
      const response = await fetch(`/api/legal/data-deletion-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          approved: status === "approved", 
          adminNotes 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update request status");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Reset state
      setRejectionNotes("");
      setApprovalNotes("");
      setSelectedRequest(null);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/legal/data-deletion-requests"] });
      
      // Show success toast
      toast({
        title: "Request updated",
        description: "The data deletion request has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred while updating the request.",
        variant: "destructive",
      });
    },
  });

  // Handle approve click
  const handleApprove = (request: DataDeletionRequest) => {
    setSelectedRequest(request);
    setApprovalNotes("");
  };

  // Handle reject click
  const handleReject = (request: DataDeletionRequest) => {
    setSelectedRequest(request);
    setRejectionNotes("");
  };

  // Confirm approval
  const confirmApproval = () => {
    if (!selectedRequest) return;
    
    updateRequestMutation.mutate({
      id: selectedRequest.id,
      status: "approved",
      adminNotes: approvalNotes,
    });
  };

  // Confirm rejection
  const confirmRejection = () => {
    if (!selectedRequest || !rejectionNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }
    
    updateRequestMutation.mutate({
      id: selectedRequest.id,
      status: "rejected",
      adminNotes: rejectionNotes,
    });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} - ${formatDistanceToNow(date, { addSuffix: true })}`;
    } catch (e) {
      return "Invalid date";
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300"><AlertTriangle className="w-3 h-3 mr-1" /> Unknown</Badge>;
    }
  };

  // Filter requests based on active tab
  const filteredRequests = requests?.filter(request => {
    if (activeTab === "all") return true;
    return request.status === activeTab;
  }) || [];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading requests...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-2" />
        <h3 className="text-xl font-semibold">Error Loading Requests</h3>
        <p className="text-gray-600 max-w-md">
          We couldn't load the data deletion requests. Please try again or contact support.
        </p>
        <Button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/legal/data-deletion-requests"] })}
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Deletion Requests</h1>
          <p className="text-muted-foreground mt-2">
            Review and manage user requests for data deletion. Approved requests will permanently remove all user data.
          </p>
        </div>

        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="pending" className="relative">
                Pending
                {requests?.filter(r => r.status === "pending").length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {requests.filter(r => r.status === "pending").length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All Requests</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="space-y-4">
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FilterX className="w-12 h-12 text-gray-400 mb-3" />
                  <h3 className="text-xl font-medium">No {activeTab} requests found</h3>
                  <p className="text-gray-500 mt-1">
                    {activeTab === "pending" 
                      ? "There are currently no pending data deletion requests." 
                      : `No requests with status "${activeTab}" at this time.`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredRequests.map((request) => (
                  <Card key={request.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base font-medium">
                            Request #{request.id}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            Submitted {formatDate(request.createdAt)}
                          </CardDescription>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2 space-y-3 text-sm">
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          User Information
                        </div>
                        <div className="space-y-1">
                          <div>ID: <span className="font-semibold">{request.userId}</span></div>
                          <div>
                            Email: <span className="font-semibold">{request.userEmail || "Not available"}</span>
                          </div>
                          <div>
                            Name: <span className="font-semibold">{request.userName || "Not available"}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          Reason for Request
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                          {request.reason || "No reason provided by user"}
                        </div>
                      </div>
                      
                      {request.adminNotes && (
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">
                            Admin Notes
                          </div>
                          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                            {request.adminNotes}
                          </div>
                        </div>
                      )}
                      
                      {request.processedAt && (
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">
                            Processed
                          </div>
                          <div className="text-sm">
                            {formatDate(request.processedAt)}
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-between pt-2">
                      {request.status === "pending" && (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" onClick={() => handleReject(request)}>
                                <XCircle className="w-4 h-4 mr-1" /> Reject
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reject Data Deletion Request</AlertDialogTitle>
                                <AlertDialogDescription>
                                  You're about to reject the deletion request from user #{request.userId}.
                                  Please provide a reason for the rejection which will be communicated to the user.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="mt-2 mb-2">
                                <label className="text-sm font-medium mb-1 block">Rejection Reason</label>
                                <Textarea
                                  placeholder="Please explain why this request is being rejected..."
                                  value={rejectionNotes}
                                  onChange={(e) => setRejectionNotes(e.target.value)}
                                  className="w-full"
                                  rows={4}
                                />
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setRejectionNotes("")}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmRejection} disabled={!rejectionNotes.trim()}>
                                  {updateRequestMutation.isPending ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                                  ) : (
                                    <>Confirm Rejection</>
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="default" size="sm" onClick={() => handleApprove(request)}>
                                <CheckCircle className="w-4 h-4 mr-1" /> Approve
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Approve Data Deletion Request</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <div className="space-y-2">
                                    <p className="text-red-600 font-medium">Important: This action cannot be undone!</p>
                                    <p>
                                      You're about to approve the deletion request from user #{request.userId}.
                                      Once approved, all user data will be permanently deleted from our systems.
                                    </p>
                                    <p>
                                      This includes profile information, preferences, content uploads, comments, 
                                      activity history, and any other user-specific data.
                                    </p>
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="mt-2 mb-2">
                                <label className="text-sm font-medium mb-1 block">Additional Notes (Optional)</label>
                                <Textarea
                                  placeholder="Enter any additional notes for record keeping..."
                                  value={approvalNotes}
                                  onChange={(e) => setApprovalNotes(e.target.value)}
                                  className="w-full"
                                  rows={3}
                                />
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setApprovalNotes("")}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmApproval}>
                                  {updateRequestMutation.isPending ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                                  ) : (
                                    <>Confirm Approval</>
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                      
                      {request.status !== "pending" && (
                        <Button variant="outline" size="sm" disabled>
                          <FileText className="w-4 h-4 mr-1" /> View Details
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}