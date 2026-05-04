import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setOrganizationId } from "@/utils/api";

type InvitationState = {
  organizationName: string;
  role: string;
  email: string;
  invitationId: string;
} | null;

export default function InvitePage() {
  const router = useRouter();
  const token = router.query.token as string | undefined;
  const { user } = useUser();
  const [invitation, setInvitation] = useState<InvitationState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (!token) return;

    async function loadInvitation() {
      try {
        const { data } = await authClient.organization.getInvitation({
          query: { id: token! },
        });
        if (data) {
          setInvitation({
            organizationName: data.organizationName ?? "Unknown Organization",
            role: data.role ?? "member",
            email: data.email ?? "",
            invitationId: data.id,
          });
        } else {
          setError("Invitation not found or has expired");
        }
      } catch {
        setError("Invitation not found or has expired");
      }
      setLoading(false);
    }

    loadInvitation();
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    try {
      const { data } = await authClient.organization.acceptInvitation({
        invitationId: token,
      });
      if (data) {
        // Set the new org as active
        await authClient.organization.setActive({
          organizationId: data.member.organizationId,
        });
        setOrganizationId(data.member.organizationId);

        // Resolve slug and redirect
        const { data: orgs } = await authClient.organization.list();
        const org = orgs?.find((o: any) => o.id === data.member.organizationId);
        const slug = org?.slug ?? data.member.organizationId;
        localStorage.setItem("lastOrgSlug", slug);
        router.push(`/org/${slug}/dashboard/youtube`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to accept invitation");
      setAccepting(false);
    }
  }

  async function handleDecline() {
    if (!token || declining) return;
    setDeclining(true);
    try {
      await authClient.organization.rejectInvitation({
        invitationId: token,
      });
      router.push("/org/resolve");
    } catch {
      router.push("/org/resolve");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading invitation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/org/resolve")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <>
      <Head>
        <title>Invitation | VidTempla</title>
      </Head>
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>You&apos;re invited!</CardTitle>
            <CardDescription>
              You&apos;ve been invited to join <strong>{invitation.organizationName}</strong> as a{" "}
              <strong>{invitation.role}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  You need to sign in before you can accept this invitation.
                </p>
                <Button
                  className="w-full"
                  onClick={() => router.push(`/sign-in?returnTo=/invite/${token}`)}
                >
                  Sign In
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {invitation.email && user.email && invitation.email !== user.email && (
                  <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
                    This invitation was sent to <strong>{invitation.email}</strong> but you&apos;re signed in as <strong>{user.email}</strong>.
                  </div>
                )}
                <div className="flex gap-3">
                  <Button onClick={handleAccept} disabled={accepting || declining} className="flex-1">
                    {accepting ? "Accepting..." : "Accept"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDecline}
                    disabled={accepting || declining}
                    className="flex-1"
                  >
                    {declining ? "Declining..." : "Decline"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
