import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Trophy, Check, Lock, Loader2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { getSportConfig } from "@/lib/competitionSports";

interface EventCategory {
  id: number;
  eventId: number;
  name: string;
  competitionSport: string | null;
  description: string | null;
  registrationMode: "PAID" | "RESERVATION_ONLY";
  registrationFee: number | null;
  maxParticipants: number | null;
}

interface Registration {
  id: number;
  categoryId: number;
  userId: number;
  paymentStatus: string;
  status: string;
}

interface DancerRegistrationProps {
  eventId: number;
  userId: number | null;
  isAuthenticated: boolean;
  onCategorySelect?: (categoryId: number | null) => void;
  selectedCategoryId?: number | null;
}

export function DancerRegistration({ eventId, userId, isAuthenticated, onCategorySelect, selectedCategoryId }: DancerRegistrationProps) {
  const { toast } = useToast();
  const [processingCategoryId, setProcessingCategoryId] = useState<number | null>(null);

  const { data: categories = [], isLoading } = useQuery<EventCategory[]>({
    queryKey: [`/api/events/${eventId}/categories`],
  });

  const { data: userRegistrations = [] } = useQuery<Registration[]>({
    queryKey: [`/api/users/${userId}/registrations`],
    enabled: !!userId,
  });

  const { data: allRegistrations = [] } = useQuery<any[]>({
    queryKey: [`/api/events/${eventId}/registrations`],
  });

  const registerMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      const res = await apiRequest(`/api/events/${eventId}/categories/${categoryId}/register`, "POST");
      return res.json();
    },
    onSuccess: (data, categoryId) => {
      const category = categories.find(c => c.id === categoryId);
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/registrations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/registrations`] });
      
      if (category?.registrationMode === "PAID") {
        toast({ title: "Registration created - proceed to payment" });
      } else {
        toast({ title: "Successfully registered for category!" });
      }
      setProcessingCategoryId(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Registration failed", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
      setProcessingCategoryId(null);
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      const res = await apiRequest(`/api/events/${eventId}/categories/${categoryId}/checkout`, "POST");
      return res.json();
    },
    onSuccess: async (data: { sessionId: string; url: string }) => {
      if (data.url && data.url.startsWith('https://')) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Checkout failed", 
        description: error.message,
        variant: "destructive" 
      });
      setProcessingCategoryId(null);
    },
  });

  const handleRegister = async (category: EventCategory) => {
    if (!isAuthenticated || !userId) {
      toast({ title: "Please log in to register", variant: "destructive" });
      return;
    }

    setProcessingCategoryId(category.id);

    if (category.registrationMode === "PAID" && category.registrationFee) {
      checkoutMutation.mutate(category.id);
    } else {
      registerMutation.mutate(category.id);
    }
  };

  const getRegistrationStatus = (categoryId: number) => {
    return userRegistrations.find(r => r.categoryId === categoryId);
  };

  const getRegistrationCount = (categoryId: number) => {
    return allRegistrations.filter((r: any) => r.categoryId === categoryId && r.status === 'CONFIRMED').length;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No competition categories available yet</p>
          <p className="text-sm text-muted-foreground">Check back soon for registration options</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Competition Registration</h3>
        <p className="text-sm text-muted-foreground">
          Choose a category and register to compete
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const sportConfig = getSportConfig(category.competitionSport);
          const registration = getRegistrationStatus(category.id);
          const regCount = getRegistrationCount(category.id);
          const isFull = category.maxParticipants && regCount >= category.maxParticipants;
          const isRegistered = !!registration;
          const isPending = registration?.status === 'PENDING_PAYMENT';
          const isProcessing = processingCategoryId === category.id;

          return (
            <Card 
              key={category.id} 
              data-testid={`card-register-category-${category.id}`}
              className={`transition-all ${
                selectedCategoryId === category.id 
                  ? 'ring-2 ring-primary shadow-lg' 
                  : 'hover-elevate'
              }`}
              onClick={() => onCategorySelect?.(category.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {category.name}
                      {selectedCategoryId === category.id && (
                        <Trophy className="h-4 w-4 text-primary" />
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <span>{sportConfig.emoji}</span>
                        {sportConfig.label}
                      </Badge>
                    </div>
                  </div>
                  {isRegistered && (
                    <Badge variant={isPending ? "secondary" : "default"}>
                      {isPending ? "Payment Pending" : "Registered"}
                    </Badge>
                  )}
                </div>
                {category.description && (
                  <CardDescription className="mt-2">
                    {category.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Entry Fee:</span>
                    <span className="font-medium">
                      {category.registrationMode === "PAID" 
                        ? `€${category.registrationFee?.toFixed(2)}`
                        : "Free"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Registered:</span>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>
                        {regCount}
                        {category.maxParticipants && ` / ${category.maxParticipants}`}
                        {" "}{sportConfig.participantLabelPlural}
                      </span>
                    </div>
                  </div>
                </div>

                {isRegistered && !isPending ? (
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    disabled
                    data-testid={`button-registered-${category.id}`}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Registered
                  </Button>
                ) : isPending ? (
                  <Button 
                    className="w-full"
                    onClick={() => handleRegister(category)}
                    disabled={isProcessing}
                    data-testid={`button-complete-payment-${category.id}`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Complete Payment"
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleRegister(category)}
                    disabled={!isAuthenticated || isFull || isProcessing}
                    data-testid={`button-register-${category.id}`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isFull ? (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Category Full
                      </>
                    ) : !isAuthenticated ? (
                      "Log in to Register"
                    ) : category.registrationMode === "PAID" ? (
                      `Pay €${category.registrationFee?.toFixed(2)} to Register`
                    ) : (
                      "Register for Free"
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
