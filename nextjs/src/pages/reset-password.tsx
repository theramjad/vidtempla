import Head from "next/head";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/utils/supabase/component";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { appConfig } from "@/config/app";

export default function Page() {
  // Hooks
  const router = useRouter();
  const supabase = createClient();
  const { user } = useUser();
  const { toast } = useToast();

  // States
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

  // Listen for PASSWORD_RECOVERY event
  useEffect(() => {
    if (!appConfig.auth.enablePasswordReset) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        // Show the password reset form when PASSWORD_RECOVERY event is detected
        setShowResetForm(true);
        toast({
          title: "Ready to reset",
          description: "You can now set your new password.",
        });
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, toast]);

  // Check if user is authenticated via the reset password flow
  useEffect(() => {
    if (!appConfig.auth.enablePasswordReset) return;

    const checkResetPasswordFlow = async () => {
      // If we have a hash in the URL, it means the user clicked on a reset password link
      const hash = window.location.hash;
      if (hash && hash.includes("type=recovery")) {
        setShowResetForm(true);
      } else if (!user && !hash) {
        // If no hash and no user, redirect to forgot-password
        toast({
          variant: "destructive",
          title: "Access denied",
          description: "You need a valid reset link to access this page.",
        });
        router.push("/forgot-password");
      }
    };

    checkResetPasswordFlow();
  }, [router, user, toast]);

  // Check if password reset is enabled
  if (!appConfig.auth.enablePasswordReset) {
    return (
      <>
        <Head>
          <title>Reset Password | VidTempla</title>
        </Head>
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
          <div className="flex flex-col items-center space-y-6">
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Password Reset Disabled
            </h2>
            <p className="text-center text-gray-600">
              Password reset is currently disabled. Please contact an administrator.
            </p>
            <button
              onClick={() => router.push("/sign-in")}
              className="group relative flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Handle password update
  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate passwords
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
      });
      setIsSubmitting(false);
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else if (data) {
        toast({
          title: "Success",
          description: "Your password has been updated successfully.",
        });
        setPassword("");
        setConfirmPassword("");

        // Redirect to sign-in after 3 seconds
        setTimeout(() => {
          router.push("/sign-in");
        }, 3000);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
      console.error("Password update error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password | VidTempla</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Set New Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below.
          </p>
        </div>

        {!showResetForm && (
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Waiting for authentication...
                </h3>
                <p className="mt-2 text-sm text-blue-700">
                  If you're not automatically redirected, please check your
                  email and click on the password reset link.
                </p>
              </div>
            </div>
          </div>
        )}

        {showResetForm && (
          <form className="mt-8 space-y-6" onSubmit={handlePasswordUpdate}>
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="sr-only">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="relative block w-full rounded-md border-0 px-4 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                  placeholder="New Password"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="sr-only">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="relative block w-full rounded-md border-0 px-4 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                  placeholder="Confirm New Password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:bg-emerald-300"
              >
                {isSubmitting ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
