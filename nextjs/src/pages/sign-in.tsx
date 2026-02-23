import Head from "next/head";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { appConfig } from "@/config/app";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function Page() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const shownErrorsRef = useRef(new Set<string>());

  // If user is already signed in, redirect
  useEffect(() => {
    if (user && !userLoading) {
      const returnTo = router.query.returnTo as string;
      if (returnTo && returnTo.startsWith('/')) {
        router.push(decodeURIComponent(returnTo));
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, userLoading]);

  // Handle error params in URL
  useEffect(() => {
    const { error: queryError, error_description: queryErrorDesc } = router.query;
    if (queryError && queryErrorDesc) {
      const errorKey = `query:${queryError}:${queryErrorDesc}`;
      if (!shownErrorsRef.current.has(errorKey)) {
        shownErrorsRef.current.add(errorKey);
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: decodeURIComponent(queryErrorDesc as string),
        });
      }
    }
  }, [router.query]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: "/dashboard/youtube",
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.message,
        });
      } else {
        setMagicLinkSent(true);
        toast({
          title: "Magic link sent",
          description: "Check your email for the login link!",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign In | VidTempla</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        {userLoading || user ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm text-gray-500">Redirecting...</p>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign In
          </h2>

          {!magicLinkSent && (
              <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
                <div className="-space-y-px rounded-md shadow-sm">
                  <div>
                    <label htmlFor="email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="relative block w-full rounded-md border-0 px-4 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:bg-emerald-300"
                  >
                    {isSubmitting ? "Sending link..." : "Send Magic Link"}
                  </button>
                </div>

                {appConfig.auth.enableSignUp && (
                  <div className="text-center">
                    <Link
                      href="/sign-up"
                      className="text-sm text-emerald-600 hover:text-emerald-500"
                    >
                      Don't have an account? Sign up
                    </Link>
                  </div>
                )}

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500">Or continue with</span>
                  </div>
                </div>

                {/* Google Sign-in Button */}
                <div>
                  <GoogleSignInButton className="w-full" />
                </div>
              </form>
            )}

            {/* Show message when magic link is sent */}
            {magicLinkSent && (
              <div className="mt-8 flex flex-col items-center space-y-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <svg
                    className="h-8 w-8 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-gray-900">Check your email</h3>
                <p className="text-center text-gray-600">
                  We've sent a magic link to <span className="font-semibold">{email}</span>
                </p>
                <p className="text-center text-sm text-gray-500">
                  Click the link in your email to sign in.
                </p>

                <button
                  onClick={() => {
                    setMagicLinkSent(false);
                  }}
                  className="text-sm text-emerald-600 hover:text-emerald-500"
                >
                  Use a different email
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
