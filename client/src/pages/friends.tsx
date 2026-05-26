import { useEffect } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderDescription } from "@/components/ui/page-header";
import { PageHeaderHeading } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserX } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export default function FriendsPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  
  // Redirect to home after a brief delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setLocation("/");
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="container max-w-6xl py-8">
      <PageHeader>
        <PageHeaderHeading>Friends Feature Removed</PageHeaderHeading>
        <PageHeaderDescription>
          This feature has been removed from the platform
        </PageHeaderDescription>
      </PageHeader>
      
      <Card className="mt-6">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <UserX className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Friend Functionality Has Been Discontinued</h3>
          <p className="text-muted-foreground mb-6">
            The friends feature is no longer available. You will be redirected to the home page in a few seconds.
          </p>
          <Link href="/">
            <Button>Return to Home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}