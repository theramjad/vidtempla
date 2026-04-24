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
        // Gate on session before anything else. If the user just signed out
        // (or their session expired), send them to /sign-in, not /org/resolve
        // — /org/resolve would show "create organization" to a signed-out user.
        const { data: sessionData } = await authClient.getSession();
        if (cancelled) return;
        if (!sessionData?.user) {
          router.replace("/sign-in");
          return;
        }

        const { data: orgs, error: listError } =
          await authClient.organization.list();
        if (cancelled) return;

        if (listError) {
          const status = (listError as { status?: number }).status;
          if (status === 401 || status === 403) {
            router.replace("/sign-in");
            return;
          }
          setError("Failed to load organization");
          return;
        }

        if (!orgs || orgs.length === 0) {
          router.replace("/org/resolve");
          return;
        }

        const org = orgs.find((o: any) => o.slug === slug);
        if (!org) {
          router.replace("/org/resolve");
          return;
        }

        await authClient.organization.setActive({ organizationId: org.id });
        if (cancelled) return;

        setOrganizationId(org.id);

        const { data: fullOrg } = await authClient.organization.getFullOrganization();
        if (cancelled) return;

        const myMembership = fullOrg?.members?.find(
          (m: any) => m.userId === sessionData.user.id
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
