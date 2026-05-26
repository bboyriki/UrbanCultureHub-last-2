import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, User, MapPin, Phone, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";

// Create a schema factory function that returns a schema based on whether it's a digital product
const createBuyerDetailsSchema = (isDigitalProduct: boolean) => {
  const baseSchema = {
    fullName: z.string().min(3, "Full name must be at least 3 characters"),
    email: z.string().email("Please enter a valid email address"),
    phoneNumber: z.string().min(10, "Please enter a valid phone number"),
    notes: z.string().optional(),
  };
  
  // For digital products, make shipping fields optional
  const shippingFields = isDigitalProduct 
    ? {
        shippingAddress: z.string().optional().default(""),
        shippingPostalCode: z.string().optional().default(""),
        shippingCity: z.string().optional().default(""),
        shippingCountry: z.string().optional().default("NL"),
      }
    : {
        shippingAddress: z.string().min(5, "Please enter a valid shipping address"),
        shippingPostalCode: z.string().min(4, "Please enter a valid postal code"),
        shippingCity: z.string().min(2, "Please enter a valid city"),
        shippingCountry: z.string().default("NL"),
      };
  
  return z.object({
    ...baseSchema,
    ...shippingFields
  });
};

// Create a base type for buyer details form values
export type BuyerDetailsFormValues = {
  fullName: string;
  email: string;
  phoneNumber: string;
  shippingAddress: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingCountry: string;
  notes?: string;
};

interface BuyerDetailsFormProps {
  onDetailsSubmit: (details: BuyerDetailsFormValues) => void;
  isDigitalProduct: boolean;
}

const BuyerDetailsForm = ({ onDetailsSubmit, isDigitalProduct }: BuyerDetailsFormProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useIsMobile();

  // Create the schema based on product type
  const buyerDetailsSchema = createBuyerDetailsSchema(isDigitalProduct);
  
  // For logging/debugging with more detailed info
  console.log("Using form schema for", isDigitalProduct === true ? "digital product" : "physical product", { isDigitalProduct, isDigitalProductType: typeof isDigitalProduct });

  // Initialize the form with user data if available
  const form = useForm<BuyerDetailsFormValues>({
    resolver: zodResolver(buyerDetailsSchema),
    defaultValues: {
      fullName: user?.displayName || "",
      email: user?.email || "",
      phoneNumber: "",
      shippingAddress: "",
      shippingPostalCode: "",
      shippingCity: "",
      shippingCountry: "NL", // Using ISO 2-letter country code (NL for Netherlands)
      notes: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: BuyerDetailsFormValues) => {
    setIsSubmitting(true);
    try {
      // Store the buyer details in local storage for reference
      localStorage.setItem("buyerDetails", JSON.stringify(data));
      
      // Call the callback with the form data
      onDetailsSubmit(data);
    } catch (error) {
      console.error("Error saving buyer details:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 max-w-full">
      <div className="border rounded-lg p-2 sm:p-4 bg-card">
        <div className="flex items-center gap-1.5 mb-2">
          <User className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-sm sm:text-base font-medium">Buyer Information</h3>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 sm:space-y-4">
            {/* Full Name */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="space-y-1 sm:space-y-2">
                  <FormLabel className="text-xs font-medium">Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Your full name" {...field} className="h-8 sm:h-10 text-xs sm:text-sm" />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1 sm:space-y-2">
                  <FormLabel className="text-xs font-medium">Email *</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="Your email address" 
                      {...field}
                      className="h-8 sm:h-10 text-xs sm:text-sm" 
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {/* Phone Number */}
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem className="space-y-1 sm:space-y-2">
                  <FormLabel className="text-xs font-medium">Phone Number *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input 
                        placeholder="Your phone number" 
                        {...field} 
                        className="h-8 sm:h-10 pl-7 text-xs sm:text-sm"
                        inputMode="tel"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {!isDigitalProduct && (
              <>
                <div className="flex items-center gap-1.5 mt-3 mb-2 border-t pt-3">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <h3 className="text-sm sm:text-base font-medium">Shipping Information</h3>
                </div>

                {/* Shipping Address */}
                <FormField
                  control={form.control}
                  name="shippingAddress"
                  render={({ field }) => (
                    <FormItem className="space-y-1 sm:space-y-2">
                      <FormLabel className="text-xs font-medium">Shipping Address *</FormLabel>
                      <FormControl>
                        <Input placeholder="Street and house number" {...field} className="h-8 sm:h-10 text-xs sm:text-sm" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                {/* Postal Code and City - always stacked on mobile */}
                <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                  {/* Postal Code */}
                  <FormField
                    control={form.control}
                    name="shippingPostalCode"
                    render={({ field }) => (
                      <FormItem className="space-y-1 sm:space-y-2">
                        <FormLabel className="text-xs font-medium">Postal Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="Postal code" {...field} className="h-8 sm:h-10 text-xs sm:text-sm" />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  {/* City */}
                  <FormField
                    control={form.control}
                    name="shippingCity"
                    render={({ field }) => (
                      <FormItem className="space-y-1 sm:space-y-2">
                        <FormLabel className="text-xs font-medium">City *</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} className="h-8 sm:h-10 text-xs sm:text-sm" />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Country */}
                <FormField
                  control={form.control}
                  name="shippingCountry"
                  render={({ field }) => (
                    <FormItem className="space-y-1 sm:space-y-2">
                      <FormLabel className="text-xs font-medium">Country Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="2-letter country code (e.g. NL, US, GB)" {...field} className="h-8 sm:h-10 text-xs sm:text-sm" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                      <p className="text-[9px] text-muted-foreground">Use 2-letter country code (NL for Netherlands, DE for Germany, etc.)</p>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Order Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="space-y-1 sm:space-y-2">
                  <FormLabel className="text-xs font-medium flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Order Notes (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Special instructions" 
                      {...field} 
                      className="resize-none h-16 sm:h-20 text-xs sm:text-sm px-2 py-1.5"
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {isDigitalProduct && (
              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mt-2">
                <AlertDescription className="text-[10px] sm:text-xs flex items-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="mr-1.5 h-3.5 w-3.5 text-blue-600 dark:text-blue-400"
                  >
                    <path d="M12 22a7 7 0 0 0 7-7h-4v-8h4a7 7 0 0 0-7-7 7 7 0 0 0-7 7h4v8H5a7 7 0 0 0 7 7Z" />
                  </svg>
                  <span>
                    <strong>Digital product:</strong> No shipping required. You'll receive access instructions via email after purchase.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full mt-4 h-9 sm:h-10 text-xs sm:text-sm font-medium" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                  Continue to Payment
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default BuyerDetailsForm;