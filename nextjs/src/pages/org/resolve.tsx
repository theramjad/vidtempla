import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { setOrganizationId } from "@/utils/api";

export default function OrgResolvePage() {
  const router = useRouter();
  const returnTo = (router.query.returnTo as string) || "dashboard/youtube";
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function resolve() {
      try {
        // Check localStorage for last-used slug
        const lastSlug = typeof window !== "undefined"
          ? localStorage.getItem("lastOrgSlug")
          : null;

        const { data: orgs } = await authClient.organization.list();

        if (!orgs || orgs.length === 0) {
          setError("no_orgs");
          return;
        }

        // Try last-used slug first, fall back to first org
        const org = lastSlug
          ? orgs.find((o: any) => o.slug === lastSlug) ?? orgs[0]
          : orgs[0];

        const slug = org?.slug ?? org?.id;
        if (slug) {
          localStorage.setItem("lastOrgSlug", slug);
          router.replace(`/org/${slug}/${returnTo}`);
        }
      } catch {
        setError("failed");
      }
    }

    resolve();
  }, [returnTo]);

  async function handleCreateOrg() {
    setCreating(true);
    try {
      const { data } = await authClient.organization.create({
        name: "My Organization",
        slug: "my-org-" + crypto.randomUUID().slice(0, 6),
      });
      if (data) {
        setOrganizationId(data.id);
        localStorage.setItem("lastOrgSlug", data.slug ?? data.id);
        router.replace(`/org/${data.slug}/${returnTo}`);
      }
    } catch {
      setError("failed");
    }
    setCreating(false);
  }

  if (error === "no_orgs") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">You don&apos;t have any organizations yet.</p>
          <Button onClick={handleCreateOrg} disabled={creating}>
            {creating ? "Creating..." : "Create Organization"}
          </Button>
        </div>
      </div>
    );
  }

  if (error === "failed") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Failed to resolve your organization.</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-muted-foreground">Redirecting...</div>
    </div>
  );
}
