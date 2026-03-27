import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { setOrganizationId } from "@/utils/api";
import { api } from "@/utils/api";

type OrgContextValue = {
  organizationId: string;
  slug: string;
  name: string;
  role: string;
  isOwner: boolean;
  isAdmin: boolean;
  loading: boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrganization() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}

export function useOptionalOrganization() {
  return useContext(OrgContext);
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const slug = router.query.slug as string | undefined;
  const [orgState, setOrgState] = useState<OrgContextValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function resolveOrg() {
      try {
        // List user's orgs to find the one matching the slug
        const { data: orgs } = await authClient.organization.list();
        if (cancelled) return;

        if (!orgs || orgs.length === 0) {
          setError("No organizations found");
          return;
        }

        const org = orgs.find((o: any) => o.slug === slug);
        if (!org) {
          setError("Organization not found");
          router.replace("/org/resolve");
          return;
        }

        // Set active organization
        await authClient.organization.setActive({ organizationId: org.id });
        if (cancelled) return;

        // Inject into tRPC headers
        setOrganizationId(org.id);

        // Fetch full org data to get user's role
        const { data: fullOrg } = await authClient.organization.getFullOrganization();
        if (cancelled) return;

        const { data: sessionData } = await authClient.getSession();
        const myMembership = fullOrg?.members?.find(
          (m: any) => m.userId === sessionData?.user?.id
        ) ?? null;
        const role = myMembership?.role ?? "member";

        setOrgState({
          organizationId: org.id,
          slug: org.slug ?? slug,
          name: org.name,
          role,
          isOwner: role === "owner",
          isAdmin: role === "owner" || role === "admin",
          loading: false,
        });
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to resolve organization:", err);
          setError("Failed to load organization");
        }
      }
    }

    setOrgState(null);
    setError(null);
    resolveOrg();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">{error}</p>
          <button
            className="text-sm underline"
            onClick={() => router.push("/org/resolve")}
          >
            Go to your organization
          </button>
        </div>
      </div>
    );
  }

  if (!orgState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading organization...</div>
      </div>
    );
  }

  return <OrgContext.Provider value={orgState}>{children}</OrgContext.Provider>;
}
