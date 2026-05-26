import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Event } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useAuth } from "@/contexts/AuthContext";
import { useClientSecret } from "@/contexts/ClientSecretContext";
import { useEffect, useState } from "react";

interface TicketPurchaseFormProps {
  open: boolean;
  onClose: () => void;
  event: Event;
}

const ticketFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  ticketQuantity: z.coerce.number().min(1).max(10),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

const TicketPurchaseForm = ({ open, onClose, event }: TicketPurchaseFormProps) => {
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const [_, setLocation] = useLocation();
  const { user } = useAuth();
  const { clientSecret, setClientSecret } = useClientSecret();
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      name: user?.displayName || '',
      email: user?.email || '',
      ticketQuantity: 1,
    },
  });

  // Update form values when user changes (e.g., after login)
  useEffect(() => {
    if (user) {
      form.setValue('name', user.displayName || '');
      form.setValue('email', user.email || '');
    }
  }, [user, form]);

  // Clear clientSecret when dialog closes
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setPaymentIntentId(null);
    }
  }, [open, setClientSecret]);

  // Preload payment intent when dialog opens
  useEffect(() => {
    // Only load if dialog is open, user exists, and we don't already have a clientSecret
    if (open && user && !clientSecret) {
      const loadPaymentIntent = async () => {
        try {
          const response = await apiRequest(
            "/api/payments/create-intent",
            "POST",
            {
              amount: (event.price || 0) * 1,
              ticketQuantity: 1,
              eventId: event.id,
              email: user.email || '',
              name: user.displayName || '',
            }
          );
          const data = await response.json();
          setClientSecret(data.clientSecret);
          setPaymentIntentId(data.paymentIntentId);
        } catch (err) {
          console.error("Failed to preload payment intent:", err);
        }
      };
      loadPaymentIntent();
    }
  }, [open, user, clientSecret, event.id, event.price, setClientSecret]);

  const purchaseMutation = useMutation({
    mutationFn: async (data: TicketFormValues) => {
      if (!stripe || !elements) {
        throw new Error("Stripe has not been initialized");
      }
      
      if (!user || !user.id) {
        throw new Error("You must be logged in to purchase tickets");
      }

      if (!clientSecret) {
        throw new Error("Payment system not ready, please try again");
      }

      setIsLoadingPayment(true);

      // Extract payment intent ID from client secret (format: pi_XXX_secret_YYY)
      const intentId = clientSecret?.split('_secret_')[0] || paymentIntentId;
      const returnUrl = `https://urbanculturehub.nl/tickets/success?paymentIntentId=${intentId}`;

      let result: any = {};
      let paymentIntent: any = null;

      try {
        // Confirm payment with Stripe - don't redirect automatically
        result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: returnUrl,
          },
          redirect: "if_required"
        });
        paymentIntent = result.paymentIntent;
      } catch (error: any) {
        // If error is due to iframe restrictions, fetch payment intent to get redirect URL
        if (error.message && error.message.includes('href')) {
          // Fetch the payment intent to get the redirect URL
          try {
            const response = await fetch(`/api/stripe/payment-intent/${clientSecret}`);
            if (response.ok) {
              const intentData = await response.json();
              paymentIntent = intentData;
            }
          } catch (fetchError) {
            console.error("Failed to fetch payment intent:", fetchError);
          }
        } else {
          // For other errors, throw
          setIsLoadingPayment(false);
          throw error;
        }
      }

      // Handle errors from confirmPayment
      if (result.error) {
        setIsLoadingPayment(false);
        throw new Error(result.error.message);
      }

      // If payment requires redirect (iDEAL), navigate in the same window
      if (paymentIntent?.status === 'requires_action' && 
          paymentIntent?.next_action?.type === 'redirect_to_url') {
        const redirectUrl = paymentIntent.next_action.redirect_to_url.url;
        // Navigate in the same tab so user returns to app after payment
        try {
          if (window.top && window.top.location) {
            window.top.location.href = redirectUrl;
          } else {
            window.location.href = redirectUrl;
          }
        } catch (e) {
          window.location.href = redirectUrl;
        }
        return {};
      }

      // Payment succeeded without redirect (card payment)
      return {};
    },
    onSuccess: (data: any) => {
      setIsLoadingPayment(false);
      toast({
        title: "Tickets purchased successfully!",
        description: "We've sent you a confirmation email with your tickets.",
      });
      onClose();
      
      // Use payment intent ID for the success page (ticket will be created by webhook)
      const intentId = clientSecret?.split('_secret_')[0] || paymentIntentId;
      const successUrl = `https://urbanculturehub.nl/tickets/success?paymentIntentId=${intentId}`;
      window.location.href = successUrl;
    },
    onError: (error: any) => {
      setIsLoadingPayment(false);
      toast({
        title: "Failed to purchase tickets",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (values: TicketFormValues) => {
    purchaseMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[425px] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0 border-b border-border/60">
          <DialogTitle className="text-lg sm:text-xl">Purchase Tickets</DialogTitle>
          <DialogDescription className="sr-only">Complete your ticket purchase for this event.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4" id="ticket-form">
              <div className="text-xs sm:text-sm bg-muted/50 p-2 sm:p-3 rounded-md">
                <p className="font-medium mb-0.5 sm:mb-1 truncate">{event.title}</p>
                <p className="text-muted-foreground">
                  Price: €{((event.price || 0) / 100).toFixed(2)} per ticket
                </p>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your name" {...field} className="text-sm h-9 sm:h-10" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter your email" {...field} className="text-sm h-9 sm:h-10" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="flex justify-between items-center bg-muted/30 p-2 sm:p-3 rounded-md">
                <span className="text-xs sm:text-sm font-medium">Quantity:</span>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 sm:h-9 w-8 sm:w-9 p-0"
                    onClick={() => {
                      const current = form.getValues("ticketQuantity");
                      if (current > 1) {
                        form.setValue("ticketQuantity", current - 1);
                      }
                    }}
                    data-testid="button-quantity-decrease"
                  >
                    −
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">{form.watch("ticketQuantity")}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 sm:h-9 w-8 sm:w-9 p-0"
                    onClick={() => {
                      const current = form.getValues("ticketQuantity");
                      if (current < 10) {
                        form.setValue("ticketQuantity", current + 1);
                      }
                    }}
                    data-testid="button-quantity-increase"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="border-t border-border pt-3 sm:pt-4 space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs sm:text-sm font-medium">Payment Method</label>
                  <div className="bg-background border border-border rounded-md p-2 sm:p-3">
                    {clientSecret ? (
                      <PaymentElement 
                        options={{
                          layout: "tabs",
                          wallets: {
                            googlePay: "never",
                            applePay: "never"
                          }
                        }}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground">Loading payment options...</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center bg-muted/30 p-2 sm:p-3 rounded-md">
                  <span className="text-xs sm:text-sm font-medium">Total:</span>
                  <span className="font-bold text-sm sm:text-base">
                    €{(((event.price || 0) * form.watch("ticketQuantity")) / 100).toFixed(2)}
                  </span>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  We accept card and iDEAL payments. Your payment is secured by Stripe.
                </p>
              </div>
            </form>
          </Form>
        </div>

        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border/60 shrink-0">
          <Button 
            type="submit"
            form="ticket-form"
            className="w-full text-sm sm:text-base h-10 font-semibold" 
            disabled={purchaseMutation.isPending || isLoadingPayment || !stripe || !clientSecret}
            data-testid="button-buy-tickets"
          >
            {purchaseMutation.isPending || isLoadingPayment ? "Processing..." : "Buy Tickets"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TicketPurchaseForm;