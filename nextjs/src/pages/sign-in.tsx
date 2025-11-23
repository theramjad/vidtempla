import Head from "next/head";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/utils/supabase/component";
import { useRouter } from "next/router";
import { useEffect, useState, useRef, useCallback } from "react";
import { appConfig } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { OTPInput, SlotProps, REGEXP_ONLY_DIGITS } from "input-otp";
import { cn } from "@/lib/utils";

/* 
Function to parse URL params. This is required because the auth flow from
the mobile app is in the format,
https://yourapp.com/sign-in#access_token={ACCESS_TOKEN}
&expires_at={EXPIRES_AT}
&expires_in={EXPIRES_IN}
&provider_token={PROVIDER_TOKEN}
&refresh_token={REFRESH_TOKEN}
&token_type={TOKEN_TYPE}
*/
const parseUrlParams = () => {
  const hash = window.location.hash.substring(1);
  const query = window.location.search.substring(1);
  const params = new URLSearchParams(hash || query);
  return Object.fromEntries(params.entries());
};

// Page
export default function Page() {
  // Hooks
  const router = useRouter();
  const supabase = createClient();
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();

  // States
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);

  // Refs
  const shownErrorsRef = useRef(new Set<string>());
  const verificationAttemptedRef = useRef(false);

  // If user is already signed in, show message and redirect
  useEffect(() => {
    if (user && !userLoading && !justSignedIn) {
      const returnTo = router.query.returnTo as string;
      if (returnTo) {
        router.push(decodeURIComponent(returnTo));
      } else {
        toast({
          title: "Already signed in",
          description: "You're already signed in!",
        });
      }
    }
  }, [user, userLoading, justSignedIn]);

  // Handle errors which are in the format: http://localhost:3000/sign-in#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
  useEffect(() => {
    // Check error params in query string (after '?')
    const { error: queryError, error_description: queryErrorDesc } =
      router.query;
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
      return;
    }

    // Check error params in hash (after '#')
    const hashParams = parseUrlParams();
    const { error: hashError, error_description: hashErrorDesc } = hashParams;
    if (hashError && hashErrorDesc) {
      const errorKey = `hash:${hashError}:${hashErrorDesc}`;
      if (!shownErrorsRef.current.has(errorKey)) {
        shownErrorsRef.current.add(errorKey);
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: decodeURIComponent(hashErrorDesc),
        });
      }
    }
  }, [router.query]);


  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

  /**
   * Handle sign in with magic link
   * @param e - Form event
   */
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL,
        },
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
          title: "Code sent",
          description: "Check your email for the login link and verification code!",
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

  /**
   * Handle OTP verification
   * @param code - The OTP code to verify
   */
  const handleVerifyOtp = useCallback(async (code: string) => {
    if (code.length !== 6) return;

    // Prevent duplicate submissions
    if (verificationAttemptedRef.current) return;
    verificationAttemptedRef.current = true;

    setIsVerifyingOtp(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: error.message,
        });
        setOtpCode(""); // Clear the OTP input on error
        verificationAttemptedRef.current = false; // Allow retry on error
      } else if (session) {
        setJustSignedIn(true);
        toast({
          title: "Success",
          description: "You've been signed in!",
        });
        // Redirect to the return URL or dashboard
        const returnTo = router.query.returnTo as string;
        if (returnTo) {
          router.push(decodeURIComponent(returnTo));
        } else {
          router.push("/dashboard/youtube");
        }
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
      setOtpCode("");
      verificationAttemptedRef.current = false; // Allow retry on error
    } finally {
      setIsVerifyingOtp(false);
    }
  }, [email, supabase, router.query.returnTo]);

  // Auto-verify when OTP code is complete
  useEffect(() => {
    if (otpCode.length === 6 && !isVerifyingOtp) {
      handleVerifyOtp(otpCode);
    }
  }, [otpCode, isVerifyingOtp, handleVerifyOtp]);

  // Helper component for OTP slot
  function Slot(props: SlotProps) {
    return (
      <div
        className={cn(
          "relative w-10 h-14 text-[2rem]",
          "flex items-center justify-center",
          "transition-all duration-300",
          "border-gray-300 border-y border-r first:border-l first:rounded-l-md last:rounded-r-md",
          "group-hover:border-emerald-400 group-focus-within:border-emerald-400",
          "outline outline-0 outline-emerald-400",
          {
            "outline-4 outline-emerald-500": props.isActive,
          }
        )}
      >
        <div className="group-has-[input[data-input-otp-placeholder-shown]]:opacity-20">
          {props.char ?? props.placeholderChar}
        </div>
        {props.hasFakeCaret && <FakeCaret />}
      </div>
    );
  }

  // Fake caret for empty slots
  function FakeCaret() {
    return (
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center animate-caret-blink">
        <div className="w-px h-8 bg-gray-900" />
      </div>
    );
  }

  // Fake dash separator
  function FakeDash() {
    return (
      <div className="flex w-10 justify-center items-center">
        <div className="w-3 h-1 rounded-full bg-gray-300" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Sign In | VidTempla</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        {user && !userLoading ? (
          <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Already Signed In</CardTitle>
            <CardDescription>
              Welcome back! You're already signed in and can continue to your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
        ) : (
          <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign In
          </h2>

          {/* Only show form if user is not signed in */}
          {!user && !userLoading && !magicLinkSent && (
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
                  We've sent a verification code to <span className="font-semibold">{email}</span>
                </p>

                <div className="w-full space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">
                        Enter the code or click the link in your email
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center space-y-2">
                    <OTPInput
                      maxLength={6}
                      value={otpCode}
                      onChange={setOtpCode}
                      disabled={isVerifyingOtp}
                      pattern={REGEXP_ONLY_DIGITS}
                      containerClassName="group flex items-center has-[:disabled]:opacity-30"
                      render={({ slots }) => (
                        <>
                          <div className="flex">
                            {slots.slice(0, 3).map((slot, idx) => (
                              <Slot key={idx} {...slot} />
                            ))}
                          </div>
                          <FakeDash />
                          <div className="flex">
                            {slots.slice(3).map((slot, idx) => (
                              <Slot key={idx} {...slot} />
                            ))}
                          </div>
                        </>
                      )}
                    />
                    {isVerifyingOtp && (
                      <p className="text-sm text-emerald-600">Verifying...</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMagicLinkSent(false);
                    setOtpCode("");
                    verificationAttemptedRef.current = false;
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