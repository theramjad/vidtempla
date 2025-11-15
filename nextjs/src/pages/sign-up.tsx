import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/utils/supabase/component";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { appConfig } from "@/config/app";

export default function Page() {
  const router = useRouter();
  const supabase = createClient();
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  // Check if sign-up is enabled
  if (!appConfig.auth.enableSignUp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
          <div className="flex flex-col items-center space-y-6">
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Sign Up Disabled
            </h2>
            <p className="text-center text-gray-600">
              Account creation is currently disabled. Please contact an administrator.
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
    );
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else if (data.user) {
      toast({
        title: "Success",
        description: "Signed up successfully!",
      });
      router.push("/admin");
    } else {
      setError("No data returned from sign up");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
        {user && !userLoading ? (
          <div className="flex flex-col items-center space-y-6">
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              You're already signed in
            </h2>
            <button
              onClick={() => router.push("/admin")}
              className="group relative flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                Sign Up
              </h2>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
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

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  className="group relative flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  Sign up
                </button>
              </div>
              <div className="text-center">
                <a
                  href="/sign-in"
                  className="text-sm text-emerald-600 hover:text-emerald-500"
                >
                  Already have an account? Sign in
                </a>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
