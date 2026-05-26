import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Search, User, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NewConversationModalProps {
  onClose: () => void;
  onConversationCreated: (conversation: any) => void;
}

const NewConversationModal: React.FC<NewConversationModalProps> = ({
  onClose,
  onConversationCreated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  // Fetch users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/users'],
    enabled: !!user,
  });

  // Filter users based on search term and exclude current user
  const filteredUsers = users
    ? users.filter((u: any) => 
        u.id !== user?.id && 
        (u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
         u.email.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      // For 1-on-1 chats, we only need one participant
      console.log("Creating conversation with participant:", selectedUsers[0].id);
      
      return apiRequest({
        url: '/api/chat/conversations',
        method: 'POST',
        data: {
          participants: [selectedUsers[0].id]
        }
      });
    },
    onSuccess: (data) => {
      console.log("Conversation created:", data);
      toast({
        title: "Success",
        description: "Conversation created successfully."
      });
      onConversationCreated(data);
    },
    onError: (error: any) => {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create conversation. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Handle selecting/deselecting a user
  const toggleUserSelection = (user: any) => {
    if (selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      // Only allow one selection
      setSelectedUsers([user]);
    }
  };

  // Handle creating the conversation
  const handleCreateConversation = () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please select a user to chat with.",
        variant: "destructive"
      });
      return;
    }
    
    createConversationMutation.mutate();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a new conversation with another user.
          </DialogDescription>
        </DialogHeader>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Currently only 1-on-1 conversations are supported.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <Label>Select a user to chat with</Label>
          
          <div className="flex items-center space-x-2 bg-muted/50 rounded-md px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            />
          </div>
          
          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1 py-2">
              {selectedUsers.map(user => (
                <Badge 
                  key={user.id} 
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {user.displayName}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => toggleUserSelection(user)}
                  />
                </Badge>
              ))}
            </div>
          )}
          
          {/* User list */}
          <ScrollArea className="h-[200px]">
            {isLoadingUsers ? (
              <div className="py-4 text-center">Loading users...</div>
            ) : filteredUsers.length > 0 ? (
              <div className="space-y-1">
                {filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-muted ${
                      selectedUsers.some(u => u.id === user.id) ? "bg-muted" : ""
                    }`}
                    onClick={() => toggleUserSelection(user)}
                  >
                    <Checkbox
                      checked={selectedUsers.some(u => u.id === user.id)}
                      onCheckedChange={() => toggleUserSelection(user)}
                    />
                    <Avatar className="h-7 w-7">
                      {user.profilePicture ? (
                        <AvatarImage src={user.profilePicture} alt={user.displayName} />
                      ) : (
                        <AvatarFallback><User /></AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-muted-foreground">
                {searchTerm
                  ? "No users found matching your search"
                  : "No users available"}
              </div>
            )}
          </ScrollArea>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateConversation}
            disabled={selectedUsers.length === 0 || createConversationMutation.isPending}
          >
            {createConversationMutation.isPending ? "Creating..." : "Start Chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationModal;