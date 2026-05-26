import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { User, KvkVerificationStatus } from "@shared/schema";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, UserCog, Ban, CheckCircle2 } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type UserFilterType = "all" | "artist" | "municipality" | "school" | "enthusiast" | "pending" | "pending_verification";

// Form schema for user editing
const userEditSchema = z.object({
  displayName: z.string().min(3, "Display name must be at least 3 characters"),
  role: z.enum(["super_admin", "admin", "artist", "municipality", "school", "enthusiast"]),
  isApproved: z.boolean(),
  isVerified: z.boolean(), 
  status: z.enum(["active", "suspended", "banned"]),
  canPostServices: z.boolean(),
  kvkVerificationStatus: z.enum(["pending", "verified", "rejected", "failed", "none"]),
  notes: z.string().optional(),
});

type UserEditFormValues = z.infer<typeof userEditSchema>;

const UserManagement = () => {
  const [filter, setFilter] = useState<UserFilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [userEditDialogOpen, setUserEditDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users", filter !== "all" ? filter : null],
    queryFn: async () => {
      const response = await apiRequest("/api/users", "GET");
      return response.json();
    }
  });

  // Filter users based on search and role
  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = search === "" || 
      user.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());
    
    let matchesFilter = false;
    
    if (filter === "all") {
      matchesFilter = true;
    } else if (filter === "pending") {
      matchesFilter = !user.isApproved;
    } else if (filter === "pending_verification") {
      matchesFilter = user.kvkVerificationStatus === "pending" && user.isApproved;
    } else {
      matchesFilter = user.role === filter && user.isApproved;
    }
    
    return matchesSearch && matchesFilter;
  });

  // Approve user mutation
  const approveUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(`/api/users/${userId}`, "PATCH", {
        isApproved: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User approved",
        description: "The user has been approved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to approve user",
        description: error.message || "Could not approve user",
        variant: "destructive",
      });
    },
  });

  // Reject/Suspend user mutation
  const suspendUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(`/api/users/${userId}`, "PATCH", {
        isApproved: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User suspended",
        description: "The user has been suspended successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to suspend user",
        description: error.message || "Could not suspend user",
        variant: "destructive",
      });
    },
  });
  
  // Approve KVK verification mutation
  const approveVerificationMutation = useMutation({
    mutationFn: async (userId: number) => {
      // Use the dedicated verification API instead of direct update
      await apiRequest(`/api/admin/users/${userId}/manually-verify-kvk`, "POST", {
        notes: `Approved by admin on ${new Date().toLocaleDateString()}`,
        adminId: 1 // Default admin ID
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Verification approved",
        description: "The business verification has been approved successfully",
      });
      setVerificationDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to approve verification",
        description: error.message || "Could not approve verification",
        variant: "destructive",
      });
    },
  });
  
  // Reject KVK verification mutation
  const rejectVerificationMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
      // Use the dedicated rejection API instead of direct update
      await apiRequest(`/api/admin/users/${userId}/reject-kvk-verification`, "POST", {
        reason: reason || "Rejected by admin",
        adminId: 1 // Default admin ID
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Verification rejected",
        description: "The business verification has been rejected",
      });
      setVerificationDialogOpen(false);
      setSelectedUser(null);
      setRejectReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reject verification",
        description: error.message || "Could not reject verification",
        variant: "destructive",
      });
    },
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (userData: Partial<User> & { id: number }) => {
      const { id, ...updateData } = userData;
      await apiRequest(`/api/users/${id}`, "PATCH", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User updated",
        description: "The user has been updated successfully",
      });
      setUserEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update user",
        description: error.message || "Could not update user",
        variant: "destructive",
      });
    },
  });

  const form = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      displayName: "",
      role: "enthusiast",
      isApproved: true,
      isVerified: false,
      status: "active",
      canPostServices: false,
      kvkVerificationStatus: "none",
      notes: "",
    }
  });

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    
    // Reset form with user values
    form.reset({
      displayName: user.displayName || "",
      role: (user.role as any) || "enthusiast",
      isApproved: user.isApproved || false,
      isVerified: user.isVerified || false,
      status: (user.status as any) || "active",
      canPostServices: user.role === 'artist' || user.role === 'municipality' || user.kvkVerificationStatus === 'verified',
      kvkVerificationStatus: (user.kvkVerificationStatus as any) || "none",
      notes: "",
    });
    
    setUserEditDialogOpen(true);
  };
  
  const onSubmitUserEdit = (data: UserEditFormValues) => {
    if (!selectedUser) return;
    
    const userData: Partial<User> & { id: number } = {
      id: selectedUser.id,
      displayName: data.displayName,
      role: data.role,
      isApproved: data.isApproved,
      isVerified: data.isVerified,
      status: data.status,
    };
    
    // If KVK verification status is changed, update it
    if (data.kvkVerificationStatus !== selectedUser.kvkVerificationStatus) {
      userData.kvkVerificationStatus = data.kvkVerificationStatus;
      
      // Only set verified date if changing to verified status
      // Use a simple string date that the server can properly handle instead of Date object
      if (data.kvkVerificationStatus === 'verified') {
        // Use the server-side current date instead of client-side
        userData.kvkVerifiedAt = 'NOW()'; // Server will convert this to current timestamp
      } else if (data.kvkVerificationStatus === 'rejected' || data.kvkVerificationStatus === 'none') {
        // Clear verification date for rejected or none status
        userData.kvkVerifiedAt = null;
      }
    }
    
    // Add notes as a verification reason if provided
    if (data.notes) {
      userData.kvkVerificationFailReason = data.notes;
    }
    
    editUserMutation.mutate(userData);
  };

  const handleApproveUser = (user: User) => {
    approveUserMutation.mutate(user.id);
  };

  const handleSuspendUser = (user: User) => {
    suspendUserMutation.mutate(user.id);
  };
  
  const handleApproveVerification = () => {
    if (selectedUser) {
      approveVerificationMutation.mutate(selectedUser.id);
    }
  };
  
  const handleRejectVerification = () => {
    if (selectedUser) {
      rejectVerificationMutation.mutate({ 
        userId: selectedUser.id,
        reason: rejectReason 
      });
    }
  };
  
  const openVerificationDialog = (user: User) => {
    setSelectedUser(user);
    setVerificationDialogOpen(true);
  };

  const getUserRoleBadge = (user: User) => {
    let color = "";
    let label = "";

    if (!user.isApproved) {
      return (
        <Badge className="text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/70 dark:text-yellow-300 px-2.5 py-1 border border-yellow-200 dark:border-yellow-800">
          Pending
        </Badge>
      );
    }

    switch (user.role) {
      case "artist":
        color = "bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-300 border-blue-200 dark:border-blue-800";
        label = "Artist";
        break;
      case "enthusiast":
        color = "bg-green-100 text-green-800 dark:bg-green-900/70 dark:text-green-300 border-green-200 dark:border-green-800";
        label = "Enthusiast";
        break;
      case "municipality":
        color = "bg-purple-100 text-purple-800 dark:bg-purple-900/70 dark:text-purple-300 border-purple-200 dark:border-purple-800";
        label = "Municipality";
        break;
      case "school":
        color = "bg-orange-100 text-orange-800 dark:bg-orange-900/70 dark:text-orange-300 border-orange-200 dark:border-orange-800";
        label = "School";
        break;
      case "super_admin":
        color = "bg-violet-100 text-violet-800 dark:bg-violet-900/70 dark:text-violet-300 border-violet-200 dark:border-violet-800";
        label = "Super Admin";
        break;
      case "admin":
        color = "bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-300 border-red-200 dark:border-red-800";
        label = "Admin";
        break;
      default:
        color = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
        label = user.role || "User";
    }

    return <Badge className={`text-sm font-medium px-2.5 py-1 border ${color}`}>{label}</Badge>;
  };
  
  const getVerificationBadge = (user: User) => {
    if (!user.kvkNumber) return null;
    
    switch (user.kvkVerificationStatus) {
      case "verified":
        return (
          <div className="flex items-center ml-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-md border border-green-200 dark:border-green-800" title="Business verified">
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            <span className="text-sm font-medium">Verified</span>
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center ml-2 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-md border border-yellow-200 dark:border-yellow-800" title="Verification pending">
            <Shield className="h-4 w-4 mr-1.5" />
            <span className="text-sm font-medium">Pending verification</span>
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center ml-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800" title="Verification rejected">
            <ShieldX className="h-4 w-4 mr-1.5" />
            <span className="text-sm font-medium">Verification rejected</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center ml-2 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800" title="Verification failed">
            <ShieldAlert className="h-4 w-4 mr-1.5" />
            <span className="text-sm font-medium">Verification failed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center ml-2 bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700" title="Not verified">
            <Shield className="h-4 w-4 mr-1.5" />
            <span className="text-sm font-medium">Not verified</span>
          </div>
        );
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-primary">User Management</h2>
        <div className="relative w-72">
          <Input
            type="text"
            placeholder="Search users..."
            className="pl-10 pr-3 py-2 border-2 focus:border-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-500 absolute left-3 top-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* User Filter */}
      <div className="flex flex-wrap gap-2 mb-6 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          className={`flex-shrink-0 font-medium ${filter === "all" ? 'shadow-md' : ''}`}
          onClick={() => setFilter("all")}
        >
          All Users
        </Button>
        <Button
          variant={filter === "artist" ? "default" : "outline"}
          size="sm"
          className={`flex-shrink-0 font-medium ${filter === "artist" ? 'shadow-md' : ''}`}
          onClick={() => setFilter("artist")}
        >
          Artists
        </Button>
        <Button
          variant={filter === "municipality" ? "default" : "outline"}
          size="sm"
          className={`flex-shrink-0 font-medium ${filter === "municipality" ? 'shadow-md' : ''}`}
          onClick={() => setFilter("municipality")}
        >
          Municipalities
        </Button>
        <Button
          variant={filter === "school" ? "default" : "outline"}
          size="sm"
          className={`flex-shrink-0 font-medium ${filter === "school" ? 'shadow-md' : ''}`}
          onClick={() => setFilter("school")}
        >
          Schools
        </Button>
        <Button
          variant={filter === "enthusiast" ? "default" : "outline"}
          size="sm"
          className={`flex-shrink-0 font-medium ${filter === "enthusiast" ? 'shadow-md' : ''}`}
          onClick={() => setFilter("enthusiast")}
        >
          Enthusiasts
        </Button>
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          size="sm"
          className={`flex-shrink-0 font-medium ${filter === "pending" ? 'shadow-md' : ''}`}
          onClick={() => setFilter("pending")}
        >
          Pending Approval
        </Button>
        <Button
          variant={filter === "pending_verification" ? "default" : "outline"}
          size="sm"
          className={`flex-shrink-0 font-medium ${filter === "pending_verification" ? 'shadow-md' : ''}`}
          onClick={() => setFilter("pending_verification")}
        >
          <Shield className="h-4 w-4 mr-1" />
          Pending Verification
        </Button>
      </div>

      {/* User List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="mt-3 text-gray-500 font-medium">Loading users...</p>
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md divide-y divide-gray-100 dark:divide-gray-700">
          {filteredUsers.map((user: User) => (
            <div
              key={user.id}
              className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                !user.isApproved ? "bg-yellow-50 dark:bg-yellow-900/30" : ""
              } hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150`}
            >
              <div className="flex items-center w-full sm:w-auto">
                <Avatar className="w-12 h-12 rounded-full mr-4 border-2 border-gray-200 dark:border-gray-600">
                  <AvatarImage src={user.profilePicture || ""} alt={user.displayName} />
                  <AvatarFallback className="text-lg font-semibold">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-base mb-1">{user.displayName}</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    {getUserRoleBadge(user)}
                    <span className="text-gray-600 dark:text-gray-300 text-sm">
                      Joined: {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "Recently"}
                    </span>
                    {getVerificationBadge(user)}
                  </div>
                  <div className="text-sm mt-1 text-gray-500 dark:text-gray-400">{user.email}</div>
                </div>
              </div>
              <div className="flex space-x-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditUser(user)}
                  title="Edit user"
                  className="h-9 w-9 p-0"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-600 dark:text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </Button>
                
                {/* User approval/suspension buttons */}
                {!user.isApproved ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApproveUser(user)}
                    className="h-9 w-9 p-0 text-green-600 border-green-200 hover:border-green-400 hover:bg-green-50 dark:text-green-500 dark:border-green-800 dark:hover:bg-green-900/30"
                    title="Approve user"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuspendUser(user)}
                    className="h-9 w-9 p-0 text-red-600 border-red-200 hover:border-red-400 hover:bg-red-50 dark:text-red-500 dark:border-red-800 dark:hover:bg-red-900/30"
                    title="Suspend user"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  </Button>
                )}
                
                {/* KVK Verification buttons */}
                {user.isApproved && user.kvkNumber && user.kvkVerificationStatus === "pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openVerificationDialog(user)}
                    className="h-9 w-9 p-0 text-yellow-600 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50 dark:text-yellow-500 dark:border-yellow-800 dark:hover:bg-yellow-900/30"
                    title="Verify business"
                  >
                    <Shield className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <p className="text-gray-500 dark:text-gray-400 font-medium">No users found matching your criteria</p>
        </div>
      )}

      {/* Verification Dialog */}
      <Dialog open={verificationDialogOpen} onOpenChange={setVerificationDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Business Verification Review</DialogTitle>
            <DialogDescription>
              Review and verify the business details for {selectedUser?.displayName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="py-4">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-gray-500">Business Name:</div>
                  <div className="col-span-2 font-medium">{selectedUser.organizationName || "Not provided"}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-gray-500">KVK Number:</div>
                  <div className="col-span-2 font-medium">{selectedUser.kvkNumber || "Not provided"}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-gray-500">BTW/VAT Number:</div>
                  <div className="col-span-2 font-medium">{selectedUser.btwNumber || "Not provided"}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-gray-500">Verification Status:</div>
                  <div className="col-span-2">
                    <Badge 
                      variant="outline" 
                      className={
                        selectedUser.kvkVerificationStatus === "verified" ? "bg-green-50 text-green-700 border-green-200" :
                        selectedUser.kvkVerificationStatus === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        selectedUser.kvkVerificationStatus === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-gray-50 text-gray-700 border-gray-200"
                      }
                    >
                      {selectedUser.kvkVerificationStatus === "verified" && "Verified"}
                      {selectedUser.kvkVerificationStatus === "pending" && "Pending Verification"}
                      {selectedUser.kvkVerificationStatus === "rejected" && "Rejected"}
                      {selectedUser.kvkVerificationStatus === "failed" && "Verification Failed"}
                      {!selectedUser.kvkVerificationStatus && "Not Verified"}
                    </Badge>
                  </div>
                </div>
                
                {selectedUser.kvkVerificationStatus === "pending" && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Reject Reason (optional):</h4>
                    <Input 
                      placeholder="Provide a reason for rejection"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setVerificationDialogOpen(false)}>
              Cancel
            </Button>
            
            {selectedUser?.kvkVerificationStatus === "pending" && (
              <div className="flex space-x-2">
                <Button 
                  variant="destructive" 
                  onClick={handleRejectVerification}
                >
                  <ShieldX className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button 
                  variant="default" 
                  onClick={handleApproveVerification}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Edit Dialog */}
      <Dialog open={userEditDialogOpen} onOpenChange={setUserEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              {selectedUser && `Update user details for ${selectedUser.displayName}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitUserEdit)} className="space-y-5 py-4">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="artist">Artist</SelectItem>
                            <SelectItem value="municipality">Municipality</SelectItem>
                            <SelectItem value="school">School</SelectItem>
                            <SelectItem value="enthusiast">Enthusiast</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="banned">Banned</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isApproved"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Account Approved</FormLabel>
                          <FormDescription>
                            Allow user to access all features
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="canPostServices"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Allow Services</FormLabel>
                          <FormDescription>
                            Let user post services
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="kvkVerificationStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Verification Status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select verification status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Not Verified</SelectItem>
                          <SelectItem value="pending">Pending Verification</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Business verified users can post services without KVK verification
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add notes about this user or reason for verification changes"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Will be saved as verification reason if verification status is changed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter className="pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setUserEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={editUserMutation.isPending}
                  >
                    {editUserMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>Save Changes</>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;