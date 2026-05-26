import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * This test component simulates an iDEAL payment redirect flow to test the payment redirect handling
 * 
 * It offers two test scenarios:
 * 1. Simulate successful iDEAL redirect
 * 2. Simulate failed/canceled iDEAL redirect
 */
const IdealRedirectTest = () => {
  const [testRunning, setTestRunning] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failure' | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].slice(0, 8)} - ${message}`]);
  };

  // Generate a fake payment intent ID for testing
  const generateFakePaymentId = () => {
    return `pi_test_${Math.random().toString(36).substring(2, 10)}`;
  };

  const runSuccessTest = () => {
    setTestRunning(true);
    setTestCompleted(false);
    setLogs([]);
    
    const paymentIntentId = generateFakePaymentId();
    addLog(`Generated test payment ID: ${paymentIntentId}`);
    addLog('Starting successful iDEAL payment redirect simulation...');
    
    // Store test data in localStorage to simulate the BookingPayment component behavior
    localStorage.setItem('idealPaymentPending', 'true');
    localStorage.setItem('idealPaymentIntentId', paymentIntentId);
    localStorage.setItem('idealPaymentTimestamp', Date.now().toString());
    
    const pendingData = {
      serviceId: 1,
      bookingData: {
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        notes: "iDEAL Test Booking"
      },
      paymentIntentId: paymentIntentId,
      isPaid: true,
      emailTrigger: true,
      status: "pending_ideal",
      paymentMethod: "ideal",
      timestamp: Date.now(),
      redirectUrl: window.location.origin + '/payments/redirect',
      paymentAmount: 5000,
      serviceName: "Test Service",
      paymentMetadata: {
        paymentType: "iDEAL",
        currency: "eur"
      }
    };
    
    localStorage.setItem('pendingBookingData', JSON.stringify(pendingData));
    addLog('Test data stored in localStorage');
    
    // Add a small delay to simulate the redirect time
    setTimeout(() => {
      addLog('Simulating bank redirect back to application...');
      
      // This simulates the bank redirecting back to our application's payment redirect URL
      // We'll automatically redirect to the payments/redirect URL with success parameters
      const redirectUrl = `/payments/redirect?payment_intent=${paymentIntentId}&redirect_status=succeeded&source=ideal`;
      
      addLog(`Redirecting to: ${redirectUrl}`);
      window.location.href = redirectUrl;
    }, 3000);
  };

  const runFailureTest = () => {
    setTestRunning(true);
    setTestCompleted(false);
    setLogs([]);
    
    const paymentIntentId = generateFakePaymentId();
    addLog(`Generated test payment ID: ${paymentIntentId}`);
    addLog('Starting failed iDEAL payment redirect simulation...');
    
    // Store test data in localStorage to simulate the BookingPayment component behavior
    localStorage.setItem('idealPaymentPending', 'true');
    localStorage.setItem('idealPaymentIntentId', paymentIntentId);
    localStorage.setItem('idealPaymentTimestamp', Date.now().toString());
    
    const pendingData = {
      serviceId: 1,
      bookingData: {
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        notes: "iDEAL Test Booking"
      },
      paymentIntentId: paymentIntentId,
      isPaid: false,
      emailTrigger: true,
      status: "pending_ideal",
      paymentMethod: "ideal",
      timestamp: Date.now(),
      redirectUrl: window.location.origin + '/payments/redirect',
      paymentAmount: 5000,
      serviceName: "Test Service",
      paymentMetadata: {
        paymentType: "iDEAL",
        currency: "eur"
      }
    };
    
    localStorage.setItem('pendingBookingData', JSON.stringify(pendingData));
    addLog('Test data stored in localStorage');
    
    // Add a small delay to simulate the redirect time
    setTimeout(() => {
      addLog('Simulating bank redirect back to application (payment failed)...');
      
      // This simulates the bank redirecting back to our application with an error
      const redirectUrl = `/payments/redirect?payment_intent=${paymentIntentId}&redirect_status=failed&error=payment_failed&source=ideal`;
      
      addLog(`Redirecting to: ${redirectUrl}`);
      window.location.href = redirectUrl;
    }, 3000);
  };

  return (
    <div className="container max-w-4xl py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>iDEAL Redirect Test Tool</CardTitle>
          <CardDescription>
            Test the iDEAL payment redirect flow to ensure proper handling of bank payment redirects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Alert className="border-primary/30 bg-primary/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This is a test tool that simulates the iDEAL payment redirect flow. No actual payments will be processed.
              </AlertDescription>
            </Alert>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" /> 
                    Success Test
                  </CardTitle>
                  <CardDescription>
                    Simulates a successful iDEAL payment and redirect
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button 
                    onClick={runSuccessTest} 
                    disabled={testRunning}
                    className="w-full"
                    variant="default"
                  >
                    Run Success Test
                  </Button>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600 flex items-center gap-2">
                    <XCircle className="h-5 w-5" /> 
                    Failure Test
                  </CardTitle>
                  <CardDescription>
                    Simulates a failed iDEAL payment and redirect
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button 
                    onClick={runFailureTest}
                    disabled={testRunning}
                    className="w-full"
                    variant="destructive"
                  >
                    Run Failure Test
                  </Button>
                </CardFooter>
              </Card>
            </div>
            
            {testRunning && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Test Logs:</h3>
                <div className="bg-muted p-4 rounded-md h-60 overflow-y-auto font-mono text-sm">
                  {logs.map((log, index) => (
                    <div key={index} className="pb-1">{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-center">
        <Link href="/">
          <Button variant="default" className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" /> Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default IdealRedirectTest;