import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/utils/supabase/component";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { appConfig } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

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
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user is already signed in, show message and redirect
  useEffect(() => {
    if (user && !userLoading) {
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
  }, [user, userLoading, router, toast]);

  // Handle errors which are in the format: http://localhost:3000/sign-in#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
  useEffect(() => {
    // Check error params in query string (after '?')
    const { error: queryError, error_description: queryErrorDesc } =
      router.query;
    if (queryError && queryErrorDesc) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: decodeURIComponent(queryErrorDesc as string),
      });
      return;
    }

    // Check error params in hash (after '#')
    const hashParams = parseUrlParams();
    const { error: hashError, error_description: hashErrorDesc } = hashParams;
    if (hashError && hashErrorDesc) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: decodeURIComponent(hashErrorDesc),
      });
    }
  }, [router.query, router, toast]);

  // Handle auth redirect
  useEffect(() => {
    const handleAuthRedirect = async () => {
      const params = parseUrlParams();
      const { access_token, refresh_token } = params;

      if (access_token && refresh_token) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: access_token,
            refresh_token: refresh_token,
          });

          if (error) throw error;

          if (data.user) {
            // Attempt to close the browser window
            if (window.opener) {
              window.opener.postMessage("authentication_successful", "*");
              window.close();
            } else {
              toast({
                title: "Success",
                description:
                  "Sign in successful. You can now close this window.",
              });
            }
          }
        } catch (error) {
          console.error("Error setting session:", error);
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "Failed to authenticate. Please try again.",
          });
        }
      }
    };

    handleAuthRedirect();
  }, [router, toast]);

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

  // Handle sign in
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.message,
        });
      } else if (data.user) {
        toast({
          title: "Success",
          description: "Signed in successfully!",
        });
        router.push("/dashboard/youtube");
      } else {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: "No data returned from sign in",
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
          {!user && !userLoading && (
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
                      className="relative block w-full rounded-t-md border-0 px-4 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                      placeholder="Email address"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="sr-only">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="relative block w-full rounded-b-md border-0 px-4 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                      placeholder="Password"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:bg-emerald-300"
                  >
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </button>
                </div>
                {appConfig.auth.enablePasswordReset && (
                  <div className="text-center">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-emerald-600 hover:text-emerald-500"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                )}
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
              </form>
            )}
        </div>
      )}
    </div>
  );
}
