import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { authClient } from "@/lib/auth-client";
import { setOrganizationId } from "@/utils/api";

type OrgContextValue = {
  organizationId: string;
  slug: string;
  name: string;
  role: string;
  isOwner: boolean;
  isAdmin: boolean;
  loading: boolean;
};

type OrganizationSummary = {
  id: string;
  slug?: string | null;
  name: string;
};

type MembershipSummary = {
  userId?: string | null;
  role?: string | null;
};

const OrgContext = createContext<OrgContextValue | null>(null);
const orgCacheBySlug = new Map<string, OrgContextValue>();

function createOrgContextValue(
  org: OrganizationSummary,
  fallbackSlug: string,
  role: string,
): OrgContextValue {
  return {
    organizationId: org.id,
    slug: org.slug ?? fallbackSlug,
    name: org.name,
    role,
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
    loading: false,
  };
}

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
  const cachedOrgState = slug ? orgCacheBySlug.get(slug) ?? null : null;
  const effectiveOrgState =
    orgState?.slug === slug ? orgState : cachedOrgState;

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    const cachedOrg = orgCacheBySlug.get(slug) ?? null;
    if (cachedOrg) {
      setOrgState(cachedOrg);
      setOrganizationId(cachedOrg.organizationId);
    } else {
      setOrgState(null);
    }
    setError(null);

    async function resolveOrg() {
      try {
        // Gate on session before anything else. If the user just signed out
        // (or their session expired), send them to /sign-in, not /org/resolve
        // — /org/resolve would show "create organization" to a signed-out user.
        const orgsPromise = authClient.organization.list().catch((err: unknown) => ({
          data: null,
          error: err,
        }));
        const sessionResult = await authClient.getSession();
        const { data: sessionData } = sessionResult;
        if (cancelled) return;
        if (!sessionData?.user) {
          router.replace("/sign-in");
          return;
        }

        const { data: orgs, error: listError } = await orgsPromise;
        if (cancelled) return;

        if (listError) {
          const status = (listError as { status?: number }).status;
          if (status === 401 || status === 403) {
            router.replace("/sign-in");
            return;
          }
          if (!cachedOrg) {
            setError("Failed to load organization");
          }
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

        setOrganizationId(org.id);
        const activeOrganizationId = (
          sessionData.session as { activeOrganizationId?: string | null } | undefined
        )?.activeOrganizationId;
        if (activeOrganizationId !== org.id) {
          await authClient.organization.setActive({ organizationId: org.id });
          if (cancelled) return;
        }

        const { data: fullOrg } = await authClient.organization.getFullOrganization();
        if (cancelled) return;

        const myMembership = fullOrg?.members?.find(
          (m: MembershipSummary) => m.userId === sessionData.user.id
        ) ?? null;
        const role = myMembership?.role ?? "member";
        const nextOrgState = createOrgContextValue(org, slug, role);

        orgCacheBySlug.set(slug, nextOrgState);
        setOrgState(nextOrgState);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to resolve organization:", err);
          if (!cachedOrg) {
            setError("Failed to load organization");
          }
        }
      }
    }

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

  if (!effectiveOrgState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading organization...</div>
      </div>
    );
  }

  return <OrgContext.Provider value={effectiveOrgState}>{children}</OrgContext.Provider>;
}
