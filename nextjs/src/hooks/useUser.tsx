import { authClient } from "@/lib/auth-client";

export function useUser() {
  const { data: session, isPending } = authClient.useSession();

  const signOut = async () => {
    await authClient.signOut();
    // Hard navigate so OrganizationProvider (still mounted with the old slug)
    // can't race to /org/resolve before /sign-in lands.
    if (typeof window !== "undefined") {
      window.location.href = "/sign-in";
    }
  };

  return {
    user: session?.user ?? null,
    session: session,
    loading: isPending,
    signOut,
  };
}
