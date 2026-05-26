import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

export function ReviewerNameDisplay({ reviewerId }: { reviewerId: number }) {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: [`/api/users/${reviewerId}`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/users/${reviewerId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch user");
        }
        return response.json();
      } catch (error) {
        console.error("Error fetching user:", error);
        throw error;
      }
    },
    enabled: !!reviewerId,
  });

  if (isLoading) return <span className="text-gray-400">Loading user...</span>;
  if (error || !user) return <span className="text-gray-400">Anonymous User</span>;
  
  return <span>{user.displayName}</span>;
}