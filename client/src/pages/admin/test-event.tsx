import React from 'react';
import CreateTestEvent from '@/components/admin/CreateTestEvent';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function TestEventPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Check if user is admin or super_admin
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need admin privileges to access this page.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => setLocation('/')}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Test Event Creation</h1>
        <p className="text-muted-foreground mt-2">
          Create a test event with multiple ticket types to test the complete ticketing system including 
          purchase flow, QR code generation, email delivery, and ticket scanning.
        </p>
      </div>

      <div className="grid gap-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <CreateTestEvent />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Complete Testing Flow</h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">1. Create Test Event</h3>
              <p className="text-sm text-muted-foreground">
                Use the form above to create a test event with Standard and VIP ticket types.
              </p>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">2. Purchase Tickets</h3>
              <p className="text-sm text-muted-foreground">
                Navigate to the event page and purchase tickets using the Stripe test card (4242 4242 4242 4242).
              </p>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">3. View Tickets</h3>
              <p className="text-sm text-muted-foreground">
                Check your email for the ticket confirmation and PDF ticket. You can also view your 
                tickets in the "My Tickets" section of your profile.
              </p>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">4. Scan Tickets</h3>
              <p className="text-sm text-muted-foreground">
                Use the admin ticket scanner to validate tickets by scanning the QR code. This can be 
                done from another device or by showing the QR code to the camera.
              </p>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">5. View Admin Records</h3>
              <p className="text-sm text-muted-foreground">
                Check the Activity Log to see all ticket-related actions and verify that everything
                is working correctly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}