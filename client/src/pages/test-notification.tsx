import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import NotificationTester from '@/components/NotificationTester';

export default function TestNotificationPage() {
  const { user } = useAuth();

  const [, navigate] = useLocation();
  
  if (!user) {
    navigate("/auth");
    return null;
  }

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
          <h2 className="text-lg font-medium text-red-800 dark:text-red-300">
            Access Restricted
          </h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            This page is only accessible to administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">WebSocket Notification Testing</h1>
      <p className="mb-6 text-muted-foreground">
        This page allows administrators to test the WebSocket notification system. You can send test notifications
        and see them appear in real-time.
      </p>
      
      <NotificationTester />
      
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-base font-medium text-blue-800 dark:text-blue-300 mb-2">
          About this test tool
        </h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 dark:text-blue-400">
          <li>Clicking "Test Notification" will send a request to the server to trigger a test notification</li>
          <li>The server will broadcast the notification through WebSocket</li>
          <li>This page will receive the notification and display it in the list</li>
          <li>Order status updates and tracking notifications use the same system</li>
          <li>Notifications are stored in memory and will be cleared on page refresh</li>
        </ul>
      </div>
    </div>
  );
}