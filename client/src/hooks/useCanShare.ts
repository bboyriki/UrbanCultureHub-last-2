import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns whether the current user is allowed to share posts/reels.
 * Admins always allowed. Other users need `canShareContent` granted via admin dashboard.
 */
export function useCanShare(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === "admin" || user.role === "super_admin") return true;
  return Boolean((user as any).canShareContent);
}
