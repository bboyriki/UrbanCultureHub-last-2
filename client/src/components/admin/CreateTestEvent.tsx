import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { insertEventSchema } from '@shared/schema';
import { z } from 'zod';
import { useLocation } from 'wouter';

// Form validation schema
const createEventSchema = insertEventSchema
  .extend({
    date: z.date(),
    price: z.coerce.number().min(0, "Price must be a positive number")
  });

type FormData = z.infer<typeof createEventSchema>;

function CreateTestEvent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState<FormData>({
    title: "Test Event - Urban Dance Workshop 2025",
    description: "This is a test event for the ticketing system. Join us for an exciting Urban Dance Workshop featuring top dancers! This event is designed to test the complete ticketing flow including purchases, QR code generation, email delivery, and ticket scanning.",
    location: "Urban Dance Studio, Amsterdam",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    category: "dance",
    isPaid: true,
    price: 1500, // 15.00 EUR in cents
    status: "approved",
    organizerId: user?.id || 1,
  });

  const [ticketTypes, setTicketTypes] = useState([
    {
      name: "Standard Ticket",
      description: "Regular admission ticket with all basic amenities",
      price: 1500, // 15.00 EUR in cents
      maxQuantity: 100,
      availableQuantity: 100,
      type: "standard",
    },
    {
      name: "VIP Ticket",
      description: "Premium access with front row seats, includes a drink and merchandise",
      price: 3000, // 30.00 EUR in cents
      maxQuantity: 20,
      availableQuantity: 20,
      type: "vip",
    }
  ]);

  // Mutation for creating the event
  const eventMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("/api/events", "POST", data);
      return response.json();
    },
    onSuccess: async (data) => {
      // Create ticket types for the event using the public test endpoint
      await Promise.all(ticketTypes.map(async (ticketType) => {
        try {
          await apiRequest(`/api/events/${data.id}/test-ticket-types`, "POST", {
            eventId: data.id,
            name: ticketType.name,
            description: ticketType.description,
            price: ticketType.price,
            maxQuantity: ticketType.maxQuantity,
            availableQuantity: ticketType.availableQuantity,
            type: ticketType.type,
          });
        } catch (error) {
          console.error("Error creating ticket type:", error);
          toast({
            title: "Warning",
            description: `Failed to create ticket type: ${ticketType.name}. Try again or create it manually.`,
            variant: "destructive",
          });
        }
      }));

      toast({
        title: "Success",
        description: "Test event and ticket types created successfully. You can now test the complete ticketing flow.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setLocation(`/events/${data.id}`);
    },
    onError: (error) => {
      console.error("Error creating test event:", error);
      toast({
        title: "Error",
        description: "Failed to create test event. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "price" ? parseInt(value) * 100 : value
    }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, date }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    eventMutation.mutate(formData);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Test Event</CardTitle>
        <CardDescription>
          This will create a test event with all necessary ticket types to test the complete ticketing system.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Event title */}
          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          {/* Event description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          {/* Event location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
            />
          </div>

          {/* Event date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Event price */}
          <div className="space-y-2">
            <Label htmlFor="price">Base Price (EUR)</Label>
            <Input
              id="price"
              name="price"
              type="number"
              value={(formData.price / 100).toString()}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
            />
            <p className="text-sm text-muted-foreground">This event has 2 ticket types: Standard (€15) and VIP (€30)</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full"
            disabled={eventMutation.isPending}
          >
            {eventMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Test Event...
              </>
            ) : (
              "Create Test Event & Ticket Types"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default CreateTestEvent;