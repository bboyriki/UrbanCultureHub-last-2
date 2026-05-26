import { useState, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useServiceBookingNotifications } from '@/hooks/use-service-booking-notifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

/**
 * Service Booking Notification Bell Component
 * This component displays a notification bell that shows real-time updates
 * when users book services from a service provider.
 */
export function ServiceBookingNotifications() {
  const { bookingNotifications, clearNotifications } = useServiceBookingNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const hasNotifications = bookingNotifications.length > 0;

  // Function to handle viewing a booking
  const handleViewBooking = (bookingId: number) => {
    setIsOpen(false);
    navigate(`/bookings/${bookingId}`);
  };

  // Format the booking date for display
  const formatBookingDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative"
          aria-label="Service Booking Notifications"
        >
          {hasNotifications ? (
            <>
              <BellRing className="h-5 w-5" />
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                variant="destructive"
              >
                {bookingNotifications.length > 9 ? '9+' : bookingNotifications.length}
              </Badge>
            </>
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle>Service Booking Notifications</CardTitle>
            <CardDescription>
              {hasNotifications 
                ? `You have ${bookingNotifications.length} new booking${bookingNotifications.length !== 1 ? 's' : ''}` 
                : 'No new bookings'}
            </CardDescription>
          </CardHeader>
          <ScrollArea className="h-[300px]">
            {hasNotifications ? (
              <CardContent className="grid gap-2">
                {bookingNotifications.map((notification, index) => (
                  <div 
                    key={`${notification.bookingId}-${index}`} 
                    className="border rounded-lg p-3 bg-background hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => handleViewBooking(notification.bookingId)}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">{notification.serviceName}</h4>
                      <span className="text-xs text-muted-foreground">
                        {formatBookingDate(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Booked by {notification.customerName}
                    </p>
                    <p className="text-sm font-medium">
                      Price: {notification.price}
                    </p>
                  </div>
                ))}
              </CardContent>
            ) : (
              <CardContent>
                <div className="flex h-20 items-center justify-center">
                  <p className="text-sm text-muted-foreground">No new booking notifications</p>
                </div>
              </CardContent>
            )}
          </ScrollArea>
          <CardFooter className="flex justify-between border-t p-3">
            {hasNotifications && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearNotifications}
              >
                Mark all as read
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setIsOpen(false);
                navigate('/bookings');
              }}
            >
              View all bookings
            </Button>
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  );
}