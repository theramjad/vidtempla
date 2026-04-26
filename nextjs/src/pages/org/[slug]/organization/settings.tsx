import Head from "next/head";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { authClient } from "@/lib/auth-client";
import { api, setOrganizationId } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function OrgSettingsContent() {
  const { organizationId, name, slug, isOwner } = useOrganization();
  const { toast } = useToast();
  const router = useRouter();
  const [orgName, setOrgName] = useState(name);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgCount, setOrgCount] = useState<number | null>(null);

  const { data: plan } = api.dashboard.billing.getCurrentPlan.useQuery();

  // Defense-in-depth: resync local state when the org name prop changes (e.g.
  // active org switches in-place without a remount). Dirty-guarded so it
  // doesn't stomp on user typing.
  useEffect(() => {
    if (!isDirty) setOrgName(name);
  }, [name, isDirty]);

  useEffect(() => {
    authClient.organization.list().then(({ data }) => {
      setOrgCount(data?.length ?? 0);
    });
  }, []);

  const isPaid = plan?.planTier && plan.planTier !== "free";
  const isLastOrg = orgCount !== null && orgCount <= 1;
  const canDelete = isOwner && !isPaid && !isLastOrg;

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await authClient.organization.update({
        data: { name: orgName },
      });
      toast({ title: "Organization updated" });
      // Allow future prop changes to resync the input again.
      setIsDirty(false);
      // If slug changed, redirect
      if (data?.slug && data.slug !== slug) {
        router.replace(`/org/${data.slug}/organization/settings`);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err?.message || "Unknown error" });
    }
    setSaving(false);
  }

  async function handleDelete() {
    try {
      await authClient.organization.delete({ organizationId });
      localStorage.removeItem("lastOrgSlug");
      localStorage.removeItem("activeOrganizationId");
      setOrganizationId(null);
      toast({ title: "Organization deleted" });
      router.replace("/org/resolve");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err?.message || "Unknown error" });
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your organization details</p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Organization Name</label>
        <Input
          value={orgName}
          onChange={(e) => {
            setOrgName(e.target.value);
            setIsDirty(true);
          }}
        />
        <Button onClick={handleSave} disabled={saving || orgName === name}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Danger zone */}
      {isOwner && (
        <div className="border border-destructive/20 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">
            Deleting this organization is permanent and cannot be undone. All channels,
            templates, containers, and API keys will be lost.
          </p>
          {isPaid && (
            <p className="text-sm text-destructive">
              Cancel your subscription before deleting this organization.{" "}
              <a href={`/org/${slug}/settings`} className="underline">Go to billing →</a>
            </p>
          )}
          {!isPaid && isLastOrg && (
            <p className="text-sm text-destructive">
              You cannot delete your only organization.
            </p>
          )}
          {canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Organization</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the organization and all its data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="destructive" disabled>Delete Organization</Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrgSettingsPage() {
  return (
    <OrganizationProvider>
      <Head>
        <title>Organization Settings | VidTempla</title>
      </Head>
      <DashboardLayout>
        <OrgSettingsContent />
      </DashboardLayout>
    </OrganizationProvider>
  );
}
