import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/component";
import { useRouter } from "next/router";

export default function UnauthorizedPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

  return (
    <>
      <Head>
        <title>Unauthorized | VidTempla</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <ShieldX className="h-16 w-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access the dashboard. Please contact an administrator if you believe this is an error.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <Button asChild className="w-full">
            <Link href="/">Go Home</Link>
          </Button>
          <Button onClick={handleSignOut} variant="outline" className="w-full">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
    </>
  );
}