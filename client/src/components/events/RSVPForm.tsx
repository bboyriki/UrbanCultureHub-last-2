import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Event } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { RsvpStatus } from "@/types";

interface RSVPFormProps {
  open: boolean;
  onClose: () => void;
  event: Event;
  existingRsvp?: any; // User's existing RSVP if they've already RSVP'd
}

const rsvpFormSchema = z.object({
  status: z.string({
    required_error: "Please select your RSVP status",
  }),
  notes: z.string().optional(),
});

type RSVPFormValues = z.infer<typeof rsvpFormSchema>;

const RSVPForm = ({ open, onClose, event, existingRsvp }: RSVPFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isUpdate = !!existingRsvp;

  const form = useForm<RSVPFormValues>({
    resolver: zodResolver(rsvpFormSchema),
    defaultValues: {
      status: existingRsvp?.status || RsvpStatus.GOING,
      notes: existingRsvp?.notes || "",
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async (data: RSVPFormValues) => {
      if (!user) {
        throw new Error("You must be logged in to RSVP to an event");
      }

      return apiRequest("/api/rsvps", "POST", {
        userId: user.id,
        eventId: event.id,
        status: data.status,
        notes: data.notes || ""
      });
    },
    onSuccess: () => {
      toast({
        title: isUpdate ? "RSVP updated!" : "RSVP successful!",
        description: isUpdate 
          ? "You have successfully updated your RSVP status."
          : "You have successfully RSVP'd to this event.",
      });
      onClose();
    },
    onError: (error: any) => {
      // Handle the conflict error separately with a more friendly message
      if (error.message?.includes("409") || error.message?.includes("already RSVP")) {
        toast({
          title: "Already RSVP'd",
          description: "You have already RSVP'd to this event.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to RSVP",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = async (values: RSVPFormValues) => {
    rsvpMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Update RSVP Status" : "RSVP to Event"}</DialogTitle>
          <DialogDescription>
            {isUpdate 
              ? "You can update your attendance status for this event."
              : "Let the organizer know if you're planning to attend this event."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="text-sm">
              <p className="font-medium mb-1">{event.title}</p>
              <p className="text-muted-foreground">
                {event.date ? new Date(event.date).toLocaleString() : 'Date TBD'}
              </p>
              <p className="text-muted-foreground">
                {event.location || 'Location TBD'}
              </p>
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Will you be attending?</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your RSVP status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={RsvpStatus.GOING}>Going</SelectItem>
                      <SelectItem value={RsvpStatus.NOT_GOING}>Not Going</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Any additional information" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full" 
              disabled={rsvpMutation.isPending}
            >
              {rsvpMutation.isPending 
                ? "Submitting..." 
                : isUpdate ? "Update RSVP" : "Confirm RSVP"
              }
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default RSVPForm;