import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface LegalConsent {
  id: number;
  userId: number;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export default function UserLegalConsents() {
  const { user } = useAuth();
  
  // Query to fetch user's legal consents
  const { 
    data: consents, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['/api/legal/user-consents'],
    enabled: !!user,
    refetchOnWindowFocus: false
  });
  
  if (!user) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Your Legal Agreements</CardTitle>
          <CardDescription>
            You need to be logged in to view your legal consent history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
            <AlertDescription>
              Please sign in to view your legal consent history.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  // Loading state
  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Your Legal Agreements</CardTitle>
          <CardDescription>
            Loading your consent history...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if (isError) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Your Legal Agreements</CardTitle>
          <CardDescription>
            There was a problem loading your consent history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {String(error) || "Failed to load your legal consent history. Please try again later."}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  // No consent records found
  if (!consents || !Array.isArray(consents) || consents.length === 0) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Your Legal Agreements</CardTitle>
          <CardDescription>
            No consent records found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Records Found</AlertTitle>
            <AlertDescription>
              We couldn't find any records of your legal consent history. This may be because you haven't 
              yet explicitly accepted our Terms of Service or Privacy Policy.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  // Format consent for display
  const consent = consents[0] as LegalConsent; // Get the most recent consent
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not accepted";
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Your Legal Agreements</CardTitle>
        <CardDescription>
          Your consent history for our legal documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">Terms of Service:</span>
              <Badge 
                variant={consent.termsAccepted ? "default" : "destructive"}
                className={`px-2 py-1 ${consent.termsAccepted ? "bg-green-600" : ""}`}
              >
                {consent.termsAccepted ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Accepted
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Not Accepted
                  </span>
                )}
              </Badge>
            </div>
            {consent.termsAcceptedAt && (
              <span className="text-sm text-muted-foreground">
                Accepted on: {formatDate(consent.termsAcceptedAt)}
              </span>
            )}
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">Privacy Policy:</span>
              <Badge 
                variant={consent.privacyAccepted ? "default" : "destructive"}
                className={`px-2 py-1 ${consent.privacyAccepted ? "bg-green-600" : ""}`}
              >
                {consent.privacyAccepted ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Accepted
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Not Accepted
                  </span>
                )}
              </Badge>
            </div>
            {consent.privacyAcceptedAt && (
              <span className="text-sm text-muted-foreground">
                Accepted on: {formatDate(consent.privacyAcceptedAt)}
              </span>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
            <p>
              These records are maintained for legal compliance and to protect both you and our platform.
            </p>
            <p className="mt-2">
              Initial consent recorded: {formatDate(consent.createdAt)}
            </p>
            {consent.updatedAt && (
              <p className="mt-1">
                Last updated: {formatDate(consent.updatedAt)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}