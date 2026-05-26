import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TimeSlot {
  id: number;
  serviceId: number;
  providerId: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  maxBookings: number;
  currentBookings: number;
  notes?: string;
}

interface TimeSlotSelectorProps {
  serviceId: number;
  onSelectTimeSlot: (timeSlotId: number) => void;
  selectedTimeSlotId?: number;
}

export default function TimeSlotSelector({ serviceId, onSelectTimeSlot, selectedTimeSlotId }: TimeSlotSelectorProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  
  // Fetch available time slots for this service
  const { data: timeSlots, isLoading } = useQuery<TimeSlot[]>({
    queryKey: [`/api/service-time-slots`, { serviceId, available: true }],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/service-time-slots?serviceId=${serviceId}&available=true`);
        if (!response.ok) {
          throw new Error("Failed to fetch available time slots");
        }
        return response.json();
      } catch (error) {
        console.error("Error fetching time slots:", error);
        toast({
          title: "Error",
          description: "Failed to fetch available time slots",
          variant: "destructive"
        });
        return [];
      }
    },
  });
  
  // When time slots data changes, update the available dates
  useEffect(() => {
    if (timeSlots && timeSlots.length > 0) {
      // Extract unique dates from time slots
      const dates = timeSlots.map(slot => new Date(slot.date));
      // Remove duplicates
      const uniqueDates = dates.filter((date, index, self) => 
        index === self.findIndex(d => d.toDateString() === date.toDateString())
      );
      setAvailableDates(uniqueDates);
    }
  }, [timeSlots]);
  
  // Filter time slots for the selected date
  const timeSlotsForSelectedDate = timeSlots?.filter(slot => {
    if (!selectedDate) return false;
    const slotDate = new Date(slot.date);
    return slotDate.toDateString() === selectedDate.toDateString();
  });
  
  // Helper function to format time
  function formatTimeForDisplay(timeString: string) {
    try {
      // Create a date object with the time
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours, 10));
      date.setMinutes(parseInt(minutes, 10));
      
      // Format the time
      return format(date, 'h:mm a');
    } catch (error) {
      return timeString;
    }
  }
  
  // Function to check if a date has available time slots
  function hasTimeSlots(date: Date) {
    return availableDates.some(availableDate => 
      availableDate.toDateString() === date.toDateString()
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <Label>Select a Date</Label>
        <div className="mt-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(date) => {
              // Disable dates in the past and dates with no time slots
              const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
              const hasNoSlots = !hasTimeSlots(date);
              return isPast || hasNoSlots;
            }}
            initialFocus
          />
        </div>
      </div>
      
      <div>
        <Label>Available Time Slots</Label>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : timeSlotsForSelectedDate && timeSlotsForSelectedDate.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {timeSlotsForSelectedDate.map((slot) => (
              <Card 
                key={slot.id} 
                className={`cursor-pointer transition-colors hover:bg-muted ${
                  selectedTimeSlotId === slot.id ? 'border-primary' : ''
                }`}
                onClick={() => onSelectTimeSlot(slot.id)}
              >
                <CardContent className="p-3 text-center">
                  <div className="font-medium">
                    {formatTimeForDisplay(slot.startTime)} - {formatTimeForDisplay(slot.endTime)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {slot.currentBookings}/{slot.maxBookings} booked
                  </div>
                  {slot.notes && (
                    <div className="text-xs mt-2 italic">{slot.notes}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : selectedDate ? (
          <div className="flex flex-col items-center justify-center h-40 border rounded-md bg-muted/50 mt-3">
            <p className="text-muted-foreground">No time slots available for this date</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 border rounded-md bg-muted/50 mt-3">
            <p className="text-muted-foreground">Please select a date</p>
          </div>
        )}
      </div>
    </div>
  );
}