import { ReactNode, useMemo, useEffect, useState } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { ClientSecretProvider, useClientSecret } from "@/contexts/ClientSecretContext";

interface StripeWrapperProps {
  children: ReactNode;
  clientSecret?: string;
}

// Singleton cache for Stripe instance
let stripeInstanceCache: Stripe | null = null;

async function fetchAndLoadStripe(): Promise<Stripe | null> {
  try {
    const response = await fetch('/api/stripe/config');
    if (!response.ok) {
      console.error("Failed to fetch Stripe config");
      return null;
    }
    const { publishableKey } = await response.json();
    
    if (!publishableKey) {
      console.error("No Stripe publishable key received from server");
      return null;
    }

    console.log("Stripe publishable key fetched successfully");
    const stripe = await loadStripe(publishableKey);
    console.log("Stripe loaded successfully:", !!stripe);
    return stripe;
  } catch (error) {
    console.error("Failed to load Stripe:", error);
    return null;
  }
}

const appearance = {
  theme: 'flat' as const,
  variables: {
    colorPrimary: '#FFD800', // B-Boy Gold
    colorBackground: '#ffffff',
    colorText: '#1a1a1a',
    colorDanger: '#FF0000', // B-Boy Red
    fontFamily: 'Inter, system-ui, sans-serif',
    spacingUnit: '4px',
    borderRadius: '8px',
  },
  rules: {
    '.Input': {
      borderColor: '#FFD800',
      color: '#1a202c',
    },
    '.Input:focus': {
      borderColor: '#FFD800',
      boxShadow: '0 0 0 2px #FFD800',
    },
    '.Tab': {
      borderColor: '#FFD800',
      color: '#4a5568',
    },
    '.Tab--selected': {
      borderColor: '#FFD800',
      color: '#1a1a1a',
      backgroundColor: '#FFF5D6',
    },
    '.Label': {
      color: '#1a1a1a',
      fontWeight: '600',
    },
    // Make iDEAL payment method more visible
    '.PaymentElement [data-type="ideal"]': {
      opacity: '1',
      border: '2px solid #FFD800',
      padding: '12px',
      borderRadius: '8px',
      margin: '8px 0',
      backgroundColor: '#FFFAE6',
    },
  }
};

const StripeWrapperContent = ({ children }: { children: ReactNode }) => {
  const { clientSecret } = useClientSecret();
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Stripe configuration when component mounts
  useEffect(() => {
    // Use cached instance if available
    if (stripeInstanceCache) {
      setStripe(stripeInstanceCache);
      setIsLoading(false);
      return;
    }

    // Otherwise fetch and load Stripe
    fetchAndLoadStripe()
      .then((stripeInstance) => {
        if (stripeInstance) {
          stripeInstanceCache = stripeInstance;
          setStripe(stripeInstance);
        } else {
          setError("Failed to initialize Stripe");
        }
      })
      .catch((err) => {
        console.error("Error loading Stripe:", err);
        setError("Failed to initialize Stripe");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Use useMemo to create options only when clientSecret changes
  // This prevents recreation of options object on each render
  const options = useMemo(() => {
    const baseOptions = {
      appearance,
      fonts: [
        {
          cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
        },
      ],
      paymentMethodOrder: ['card', 'ideal'], // Prioritize iDEAL as a payment method option
    };
    
    // Only add clientSecret if it exists
    return clientSecret ? { ...baseOptions, clientSecret } : baseOptions;
  }, [clientSecret]);

  // Show loading state while fetching Stripe
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading payment system...</p>
        </div>
      </div>
    );
  }

  // Show error state if Stripe failed to load
  if (error || !stripe) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-destructive">{error || "Payment system unavailable"}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please try again later or contact support if the problem persists.
          </p>
        </div>
      </div>
    );
  }

  // Render Elements provider with or without clientSecret
  // When clientSecret is available, it will be included in options via useMemo
  // When not available, Elements will still be ready (children handle conditional rendering)
  return (
    <Elements 
      key={clientSecret || 'pending'}
      stripe={stripe}
      options={options}
    >
      {children}
    </Elements>
  );
};

const StripeWrapper = ({ children, clientSecret: _clientSecret }: StripeWrapperProps) => {
  return (
    <ClientSecretProvider>
      <StripeWrapperContent>{children}</StripeWrapperContent>
    </ClientSecretProvider>
  );
};

export default StripeWrapper;