import { useState } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Event } from "@shared/schema";
import { EventCategories } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { ImageUploader } from "@/components/shared/ImageUploader";

const eventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  location: z.string().min(3, "Location is required"),
  category: z.string().min(1, "Category is required"),
  date: z.date(),
  image: z.string().optional().or(z.literal("")),
  price: z.coerce.number().min(0).optional(),
  isPaid: z.boolean().default(false),
});

interface EventEditDialogProps {
  event: Event;
  open: boolean;
  onClose: () => void;
}

export function EventEditDialog({ event, open, onClose }: EventEditDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: event.title || "",
      description: event.description || "",
      location: event.location || "",
      category: event.category || "",
      date: event.date ? new Date(event.date) : new Date(),
      image: event.image || "",
      price: event.price ? event.price / 100 : 0,
      isPaid: !!event.isPaid,
    },
  });

  const updateEvent = useMutation({
    mutationFn: async (data: z.infer<typeof eventSchema>) => {
      // Convert price from dollars to cents for database storage
      const priceCents = data.isPaid && data.price ? Math.round(data.price * 100) : 0;
      
      // Include user role and ID in both headers and query parameters for authorization
      const headers = {
        'X-User-ID': user?.id?.toString() || '',
        'X-User-Role': user?.role || '',
      };
      
      const response = await axios.patch(
        `/api/events/${event.id}?userId=${user?.id || ''}&userRole=${user?.role || ''}`, 
        {
          ...data,
          price: priceCents,
        },
        { headers }
      );
      
      console.log('Event update response:', response);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Event updated",
        description: "Your event has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["event", event.id.toString()] });
      onClose();
    },
    onError: (error) => {
      console.error("Failed to update event:", error);
      toast({
        title: "Failed to update event",
        description: "There was an error updating your event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof eventSchema>) => {
    if (isUploading) {
      toast({
        title: "Please wait",
        description: "Please wait for the image upload to complete before submitting the form.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    updateEvent.mutate(data);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        // Only allow closing if we're not uploading
        if (!isOpen && !isUploading) {
          onClose();
        } else if (!isOpen && isUploading) {
          // Prevent dialog from closing during upload
          toast({
            title: "Upload in progress",
            description: "Please wait for the image upload to complete before closing.",
            variant: "destructive"
          });
          return false;
        }
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            Update the details of your event below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter event title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your event"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Event location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(EventCategories).map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Event Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Image</FormLabel>
                  <FormControl>
                    <div className="flex flex-col items-center gap-4">
                      <ImageUploader
                        initialImage={field.value}
                        onImageUploaded={(imageUrl, publicId) => {
                          field.onChange(imageUrl);
                          setIsUploading(false);
                        }}
                        onUploadStart={() => {
                          setIsUploading(true);
                        }}
                        folder="urban-culture/events"
                        buttonText="Upload Event Image"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Upload an image for your event</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPaid"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>This is a paid event</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {form.watch("isPaid") && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Price (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting || isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {isSubmitting ? "Updating..." : isUploading ? "Uploading..." : "Update Event"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}