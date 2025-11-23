import { useAuthStore } from "@/stores/use-auth-store";
import { useRouter } from "next/router";
import { useEffect } from "react";

export function useUser() {
  const router = useRouter();
  const { user, session, isInitialized, initialize, signOut: storeSignOut } = useAuthStore();

  // Initialize auth listener once on mount
  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  // Enhanced signOut that also redirects
  const signOut = async () => {
    await storeSignOut();
    router.push("/sign-in");
  };

  return {
    user,
    session,
    loading: !isInitialized, // Only loading until initialized
    signOut,
  };
}
