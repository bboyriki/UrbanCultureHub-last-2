import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { TimePickerInput } from "@/components/shared/TimePickerInput";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

interface ManageTimeSlotsProps {
  serviceId: number;
}

export default function ManageTimeSlots({ serviceId }: ManageTimeSlotsProps) {
  const { toast } = useToast();
  const { token } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<Date>(
    new Date(new Date().setHours(9, 0, 0, 0))
  );
  const [endTime, setEndTime] = useState<Date>(
    new Date(new Date().setHours(10, 0, 0, 0))
  );
  const [notes, setNotes] = useState("");
  const [maxBookings, setMaxBookings] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch time slots for this service
  const { data: timeSlots, isLoading: isFetchingTimeSlots, refetch } = useQuery<TimeSlot[]>({
    queryKey: [`/api/service-time-slots`, { serviceId }],
    queryFn: async () => {
      const response = await fetch(`/api/service-time-slots?serviceId=${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch time slots");
      }
      return response.json();
    },
  });
  
  // Get the current user from AuthContext instead of making a separate API call
  const { user: currentUser } = useAuth();
  
  // Mutation to create a new time slot
  const createTimeSlotMutation = useMutation({
    mutationFn: async (data: any) => {
      // For debugging, log the token length
      if (token) {
        console.log(`Sending token with length: ${token.length}`);
      }
      
      const response = await fetch('/api/service-time-slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create time slot");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Time slot created",
        description: "The time slot has been added successfully.",
      });
      // Reset form and close dialog
      setDate(new Date());
      setStartTime(new Date(new Date().setHours(9, 0, 0, 0)));
      setEndTime(new Date(new Date().setHours(10, 0, 0, 0)));
      setNotes("");
      setMaxBookings(1);
      setIsAddDialogOpen(false);
      setIsSubmitting(false);
      
      // Invalidate and refetch time slots
      queryClient.invalidateQueries({ queryKey: [`/api/service-time-slots`] });
      refetch();
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      toast({
        title: "Error",
        description: error.message || "Failed to create time slot. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Mutation to delete a time slot
  const deleteTimeSlotMutation = useMutation({
    mutationFn: async (timeSlotId: number) => {
      const response = await fetch(`/api/service-time-slots/${timeSlotId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete time slot");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Time slot deleted",
        description: "The time slot has been removed successfully.",
      });
      
      // Invalidate and refetch time slots
      queryClient.invalidateQueries({ queryKey: [`/api/service-time-slots`] });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete time slot. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  function handleCreateTimeSlot() {
    // Validate input
    if (!date) {
      toast({
        title: "Missing date",
        description: "Please select a date for the time slot.",
        variant: "destructive",
      });
      return;
    }
    
    if (!startTime || !endTime) {
      toast({
        title: "Missing time",
        description: "Please select both start and end times.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if end time is after start time
    if (isBefore(endTime, startTime)) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if the date is in the past
    if (isBefore(date, new Date().setHours(0, 0, 0, 0))) {
      toast({
        title: "Invalid date",
        description: "You cannot create time slots for past dates.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // Format date and times for API - convert to ISO strings for proper serialization
    // Create full date-time objects by combining the date with the time components
    const startDateTime = new Date(date);
    startDateTime.setHours(
      startTime.getHours(),
      startTime.getMinutes(),
      startTime.getSeconds()
    );
    
    const endDateTime = new Date(date);
    endDateTime.setHours(
      endTime.getHours(),
      endTime.getMinutes(), 
      endTime.getSeconds()
    );
    
    // Format as ISO strings that the server can properly parse
    const formattedDate = format(date, "yyyy-MM-dd");
    const formattedStartTime = startDateTime.toISOString();
    const formattedEndTime = endDateTime.toISOString();
    
    // Use currentUser from the top-level query
    console.log("Current user info:", currentUser);
    
    // Make sure we have a valid user ID
    if (!currentUser?.id) {
      toast({
        title: "Authentication error",
        description: "Could not verify your account. Please try logging in again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    
    // Create time slot with required providerId
    createTimeSlotMutation.mutate({
      serviceId,
      providerId: currentUser.id, // This is required for authorization
      date: formattedDate,
      startTime: formattedStartTime,
      endTime: formattedEndTime,
      maxBookings,
      notes: notes || null,
    });
  }
  
  function handleDeleteTimeSlot(timeSlotId: number) {
    if (confirm("Are you sure you want to delete this time slot?")) {
      deleteTimeSlotMutation.mutate(timeSlotId);
    }
  }
  
  // Helper function to format time from database (HH:MM:SS) to display format (HH:MM AM/PM)
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
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Service Time Slots</h3>
          <p className="text-sm text-muted-foreground">
            Manage your available time slots for this service
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetchingTimeSlots}
          >
            {isFetchingTimeSlots ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Time Slot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Time Slot</DialogTitle>
                <DialogDescription>
                  Create a new time slot for booking your service.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : "Select a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(date) => date && setDate(date)}
                        initialFocus
                        disabled={(date) => isBefore(date, addDays(new Date(), -1))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <TimePickerInput
                      value={startTime}
                      onChange={setStartTime}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <TimePickerInput
                      value={endTime}
                      onChange={setEndTime}
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="maxBookings">Maximum Bookings</Label>
                  <Input 
                    id="maxBookings"
                    type="number"
                    min="1"
                    value={maxBookings}
                    onChange={(e) => setMaxBookings(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum number of clients that can book this time slot
                  </p>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea 
                    id="notes"
                    placeholder="Any special information for this time slot..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="resize-none"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleCreateTimeSlot}
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Time Slot
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {isFetchingTimeSlots ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : timeSlots && timeSlots.length > 0 ? (
        <div className="border rounded-md">
          <Table>
            <TableCaption>Your service time slots.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeSlots.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell className="font-medium">
                    {format(new Date(slot.date), "PPP")}
                  </TableCell>
                  <TableCell>
                    {formatTimeForDisplay(slot.startTime)} - {formatTimeForDisplay(slot.endTime)}
                    {slot.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{slot.notes}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {slot.currentBookings} / {slot.maxBookings}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={slot.status === "AVAILABLE" ? "outline" : "secondary"}
                    >
                      {slot.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTimeSlot(slot.id)}
                      disabled={deleteTimeSlotMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card className="bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 rounded-full border border-dashed p-4">
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No Time Slots Available</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              You haven't created any time slots for this service yet.
            </p>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Time Slot
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}