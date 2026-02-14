import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/router";

export function useUser() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const signOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  return {
    user: session?.user ?? null,
    session: session,
    loading: isPending,
    signOut,
  };
}
