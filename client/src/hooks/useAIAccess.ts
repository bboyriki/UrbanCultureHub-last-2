import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

export interface AIAccessStatus {
  hasAccess: boolean;
  isPremium: boolean;
  isAdmin: boolean;
  mode: "contact_admin" | "subscription";
  subscriptionEnabled: boolean;
  monthlyPrice: string;
}

const DEFAULT_STATUS: AIAccessStatus = {
  hasAccess: false,
  isPremium: false,
  isAdmin: false,
  mode: "contact_admin",
  subscriptionEnabled: false,
  monthlyPrice: "9.99",
};

export function useAIAccess(): AIAccessStatus & { isLoading: boolean } {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<AIAccessStatus>({
    queryKey: ["/api/ai-access/status"],
    enabled: true,
    staleTime: 60 * 1000,
  });

  if (!user) return { ...DEFAULT_STATUS, isLoading };
  return { ...(data ?? DEFAULT_STATUS), isLoading };
}
