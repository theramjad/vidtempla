import Head from "next/head";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/component";
import Link from "next/link";
import { useState } from "react";
import { appConfig } from "@/config/app";

export default function Page() {
  // Hooks
  const supabase = createClient();
  const { toast } = useToast();

  // States
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if password reset is enabled
  if (!appConfig.auth.enablePasswordReset) {
    return (
      <>
        <Head>
          <title>Forgot Password | VidTempla</title>
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
            <Link
              href="/sign-in"
              className="group relative flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Handle password reset request
  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        toast({
          title: "Success",
          description:
            "Password reset instructions have been sent to your email address.",
        });
        setEmail("");
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
      console.error("Password reset error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Forgot Password | VidTempla</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address and we'll send you instructions to reset
            your password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handlePasswordReset}>
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

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:bg-emerald-300"
            >
              {isSubmitting ? "Sending..." : "Send Reset Instructions"}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/sign-in"
              className="text-sm text-emerald-600 hover:text-emerald-500"
            >
              Back to Sign In
            </Link>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}
