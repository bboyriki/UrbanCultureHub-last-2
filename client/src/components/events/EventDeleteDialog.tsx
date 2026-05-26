import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Event } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

interface EventDeleteDialogProps {
  event: Event;
  open: boolean;
  onClose: () => void;
}

export function EventDeleteDialog({
  event,
  open,
  onClose,
}: EventDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const deleteEvent = useMutation({
    mutationFn: async () => {
      // Log data for debugging
      console.log('Deleting event with auth data:', {
        eventId: event.id,
        userId: user?.id,
        userRole: user?.role,
        organizerId: event.organizerId
      });
      
      // Use the apiRequest function which handles authentication
      const response = await apiRequest(
        `/api/events/${event.id}?userId=${user?.id}&userRole=${user?.role}`, 
        "DELETE"
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event deleted",
        description: "Your event has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      onClose();
    },
    onError: (error) => {
      console.error("Failed to delete event:", error);
      toast({
        title: "Failed to delete event",
        description: "There was an error deleting your event. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    },
  });

  const handleDelete = () => {
    setIsDeleting(true);
    // Check if user is logged in and is the event organizer or an admin
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to delete events.",
        variant: "destructive",
      });
      setIsDeleting(false);
      return;
    }

    if (event.organizerId !== user.id && user.role !== 'admin') {
      toast({
        title: "Permission denied",
        description: "You can only delete events that you've created.",
        variant: "destructive",
      });
      setIsDeleting(false);
      return;
    }

    deleteEvent.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this event?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your event
            "{event.title}" and remove all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Event"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}