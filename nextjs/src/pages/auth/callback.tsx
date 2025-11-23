import { useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@/utils/supabase/component";
import { useToast } from "@/hooks/use-toast";
import Head from "next/head";

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      // Check for error parameters in URL (both query and hash)
      const { error, error_description, error_code } = router.query;

      if (error && error_description) {
        // Customize error message for signup disabled errors
        let displayDescription = error_description as string;
        if (error_code === 'signup_disabled' || displayDescription.toLowerCase().includes('signups not allowed')) {
          displayDescription = "Can't find an account associated with this email";
        }

        // Redirect to sign-in page with error params so they can be displayed there
        const params = new URLSearchParams({
          error: error as string,
          error_description: displayDescription,
          ...(error_code && { error_code: error_code as string }),
        });
        router.push(`/sign-in?${params.toString()}`);
        return;
      }

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          // Redirect to sign-in with error params
          const params = new URLSearchParams({
            error: 'auth_error',
            error_description: sessionError.message,
          });
          router.push(`/sign-in?${params.toString()}`);
          return;
        }

        if (data.session) {
          toast({
            title: "Success",
            description: "You've been signed in!",
          });
          // Check if there's a returnTo query parameter
          const returnTo = router.query.returnTo as string;
          if (returnTo) {
            router.push(decodeURIComponent(returnTo));
          } else {
            router.push("/dashboard/youtube");
          }
        } else {
          router.push("/sign-in");
        }
      } catch (err) {
        console.error("Callback error:", err);
        // Redirect to sign-in with error params
        const params = new URLSearchParams({
          error: 'unexpected_error',
          error_description: 'An unexpected error occurred during authentication.',
        });
        router.push(`/sign-in?${params.toString()}`);
      }
    };

    if (router.isReady) {
      handleCallback();
    }
  }, [router.isReady]);

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
