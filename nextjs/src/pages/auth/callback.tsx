import { useEffect } from "react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import Head from "next/head";

export default function AuthCallback() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { toast } = useToast();

  useEffect(() => {
    if (!router.isReady) return;

    // Check for error parameters in URL
    const { error, error_description, error_code } = router.query;

    if (error && error_description) {
      let displayDescription = error_description as string;
      if (error_code === 'signup_disabled' || displayDescription.toLowerCase().includes('signups not allowed')) {
        displayDescription = "Can't find an account associated with this email";
      }

      const params = new URLSearchParams({
        error: error as string,
        error_description: displayDescription,
        ...(error_code && { error_code: error_code as string }),
      });
      router.push(`/sign-in?${params.toString()}`);
      return;
    }

    // If session check is done, redirect accordingly
    if (!isPending) {
      if (session) {
        toast({
          title: "Success",
          description: "You've been signed in!",
        });
        const returnTo = router.query.returnTo as string;
        if (returnTo && returnTo.startsWith('/')) {
          router.push(decodeURIComponent(returnTo));
        } else {
          router.push("/dashboard/youtube");
        }
      } else {
        router.push("/sign-in");
      }
    }
  }, [router.isReady, isPending, session]);

  return (
    <>
      <Head>
        <title>Completing Sign In...</title>
        <meta name="description" content="Completing your sign in" />
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Completing sign in...</p>
        </div>
      </div>
    </>
  );
}
