import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { setOrganizationId } from "@/utils/api";

export function useUser() {
  const { data: session, isPending } = authClient.useSession();
  const { toast } = useToast();

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          if (typeof window === "undefined") return;
          setOrganizationId(null);
          localStorage.removeItem("lastOrgSlug");
          sessionStorage.setItem("justSignedOut", String(Date.now()));
          window.location.replace("/sign-in");
        },
        onError: (ctx) => {
          toast({
            variant: "destructive",
            title: "Sign out failed",
            description: ctx?.error?.message ?? "Please try again.",
          });
        },
      },
    });
  };

  return {
    user: session?.user ?? null,
    session: session,
    loading: isPending,
    signOut,
  };
}
