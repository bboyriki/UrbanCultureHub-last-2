import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Calendar, Star, ArrowLeft } from "lucide-react";
import { BookingList } from "@/components/services/BookingList";

export default function ManageServiceBookingsPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const serviceId = parseInt(id);

  const { data: service, isLoading: isServiceLoading } = useQuery({
    queryKey: [`/api/services/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/services/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch service");
      }
      return response.json();
    },
    enabled: !!serviceId && !!user,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  if (isServiceLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!service) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-center text-red-500">Service Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center">
            The service you're trying to manage could not be found.
          </p>
          <div className="flex justify-center mt-4">
            <Button onClick={() => navigate("/services/my-services")}>
              Back to My Services
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if the user is authorized to manage this service
  if (user.id !== service.providerId && user.role !== 'admin') {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-center text-red-500">Unauthorized</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center">
            You are not authorized to manage bookings for this service.
          </p>
          <div className="flex justify-center mt-4">
            <Button onClick={() => navigate(`/services/${id}`)}>
              View Service
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">{service.name}</h1>
          <p className="text-muted-foreground">Manage bookings for this service</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/services/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Service
          </Button>
          <Button variant="outline" onClick={() => navigate(`/services/edit/${id}`)}>
            Edit Service
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Bookings</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="pt-4">
          <BookingList providerId={user.id} isProvider={true} />
        </TabsContent>
        <TabsContent value="pending" className="pt-4">
          <BookingList providerId={user.id} isProvider={true} />
        </TabsContent>
        <TabsContent value="confirmed" className="pt-4">
          <BookingList providerId={user.id} isProvider={true} />
        </TabsContent>
        <TabsContent value="completed" className="pt-4">
          <BookingList providerId={user.id} isProvider={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}