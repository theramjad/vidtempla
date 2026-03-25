import { useRouter } from "next/router";
import { useState } from "react";
import Head from "next/head";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthApplication } from "@/db/schema";
import { authClient } from "@/lib/auth-client";

export const getServerSideProps: GetServerSideProps<{
  clientName: string;
}> = async (ctx) => {
  const clientId = ctx.query.client_id as string | undefined;
  let clientName = "An application";
  if (clientId) {
    const app = await db
      .select({ name: oauthApplication.name })
      .from(oauthApplication)
      .where(eq(oauthApplication.clientId, clientId))
      .then((rows) => rows[0]);
    if (app?.name) {
      clientName = app.name;
    }
  }
  return { props: { clientName } };
};

export default function ConsentPage({
  clientName,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleConsent = async (accept: boolean) => {
    setIsLoading(true);
    try {
      const consentCode = router.query.consent_code as string;
      const res = await authClient.$fetch("/oauth2/consent", {
        method: "POST",
        body: { accept, consent_code: consentCode },
      });
      const data = res.data as { redirectURI?: string } | undefined;
      if (data?.redirectURI) {
        window.location.href = data.redirectURI;
      }
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Authorize | VidTempla</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Authorize Access
            </h1>
            <p className="text-gray-600">
              <span className="font-medium text-gray-900">{clientName}</span>{" "}
              wants to access your VidTempla account.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-900">
              This will allow access to:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
              <li>Your YouTube channels and videos</li>
              <li>Your templates and containers</li>
              <li>Channel and video analytics</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => handleConsent(false)}
              disabled={isLoading}
            >
              Deny
            </button>
            <button
              className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={() => handleConsent(true)}
              disabled={isLoading}
            >
              {isLoading ? "Authorizing..." : "Authorize"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
