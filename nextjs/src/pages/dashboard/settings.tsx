/**
 * Settings Page
 * User account settings and preferences
 */

import Head from 'next/head';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUser } from '@/hooks/useUser';
import { Loader2, ExternalLink, Plus, Copy, Check, Trash2, Key } from 'lucide-react';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [portalLoading, setPortalLoading] = useState(false);

  // Fetch current subscription
  const { data: currentPlan, isLoading: planLoading } =
    api.dashboard.billing.getCurrentPlan.useQuery();

  // Fetch usage stats
  const { data: usageStats, isLoading: usageLoading } =
    api.dashboard.billing.getUsageStats.useQuery();

  // API Keys
  const { data: apiKeysList, isLoading: keysLoading } =
    api.dashboard.apiKeys.list.useQuery();

  const { data: apiUsage } =
    api.dashboard.apiKeys.getUsage.useQuery({});

  const utils = api.useUtils();

  const createKeyMutation = api.dashboard.apiKeys.create.useMutation({
    onSuccess: () => {
      utils.dashboard.apiKeys.list.invalidate();
    },
    onError: (error) => {
      toast.error('Failed to create API key', {
        description: error.message,
      });
    },
  });

  const revokeKeyMutation = api.dashboard.apiKeys.revoke.useMutation({
    onSuccess: () => {
      utils.dashboard.apiKeys.list.invalidate();
      utils.dashboard.apiKeys.getUsage.invalidate();
      toast.success('API key revoked');
    },
    onError: (error) => {
      toast.error('Failed to revoke API key', {
        description: error.message,
      });
    },
  });

  // Create key dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>('never');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Get customer portal URL
  const getPortalUrl = api.dashboard.billing.getCustomerPortalUrl.useQuery(
    undefined,
    {
      enabled: false, // Don't fetch automatically
    }
  );

  // Check for checkout success
  useEffect(() => {
    if (router.query.checkout === 'success') {
      toast.success('Subscription activated!', {
        description: 'Your subscription has been successfully activated.',
      });
      // Clear the query parameter
      router.replace('/dashboard/settings', undefined, { shallow: true });
    }
  }, [router]);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const result = await getPortalUrl.refetch();
      if (result.data?.portalUrl) {
        window.open(result.data.portalUrl, '_blank');
      }
    } catch (error) {
      toast.error('Failed to open customer portal', {
        description: error instanceof Error ? error.message : 'Please try again later',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatShortDate = (dateString: string | Date | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    const expiresInDays = newKeyExpiry === 'never' ? undefined : parseInt(newKeyExpiry);

    const result = await createKeyMutation.mutateAsync({
      name: newKeyName.trim(),
      expiresInDays,
    });

    setCreatedKey(result.plaintext);
    setNewKeyName('');
    setNewKeyExpiry('never');
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    toast.success('API key copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setCreatedKey(null);
    setCopied(false);
    setNewKeyName('');
    setNewKeyExpiry('never');
  };


  return (
    <>
      <Head>
        <title>Settings | VidTempla</title>
      </Head>
      <DashboardLayout>
        <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="grid gap-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your account details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                {userLoading ? (
                  <div className="flex items-center gap-2 p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  <Input
                    id="email"
                    type="email"
                    value={user?.email ?? ''}
                    disabled
                    className="bg-muted"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  This is the email address associated with your account.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan Information</CardTitle>
              <CardDescription>
                Your current subscription plan and usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {planLoading ? (
                <div className="flex items-center gap-2 p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading plan details...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium">Current Plan</span>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium capitalize">
                      {currentPlan?.planTier || 'Free'}
                    </span>
                  </div>

                  {currentPlan?.status && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium">Status</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
                        currentPlan.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        currentPlan.status === 'canceled' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {currentPlan.status}
                      </span>
                    </div>
                  )}

                  {currentPlan?.currentPeriodStart && currentPlan?.currentPeriodEnd && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium">Billing Period</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(currentPlan.currentPeriodStart)} - {formatDate(currentPlan.currentPeriodEnd)}
                      </span>
                    </div>
                  )}

                  {currentPlan?.cancelAtPeriodEnd && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        Your subscription will be canceled at the end of the current billing period.
                      </p>
                    </div>
                  )}

                  {!usageLoading && usageStats && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-3">Usage</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Videos</span>
                          <span>
                            {usageStats.videos.current} / {usageStats.videos.limit === Infinity ? '∞' : usageStats.videos.limit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Channels</span>
                          <span>
                            {usageStats.channels.current} / {usageStats.channels.limit === Infinity ? '∞' : usageStats.channels.limit}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Link href="/dashboard/pricing" className="flex-1">
                <Button variant="outline" className="w-full">
                  View All Plans
                </Button>
              </Link>
              {currentPlan?.planTier !== 'free' && currentPlan?.stripeCustomerId && (
                <Button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                >
                  {portalLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Manage Subscription
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* API Keys Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    API Keys
                  </CardTitle>
                  <CardDescription>
                    Manage API keys for programmatic access to VidTempla
                  </CardDescription>
                </div>
                <Dialog open={createDialogOpen} onOpenChange={(open) => {
                  if (!open) handleCloseCreateDialog();
                  else setCreateDialogOpen(true);
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    {createdKey ? (
                      <>
                        <DialogHeader>
                          <DialogTitle>API Key Created</DialogTitle>
                          <DialogDescription>
                            Copy your API key now. It will not be shown again.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <p className="text-sm text-yellow-800 font-medium">
                              Make sure to copy your API key. You will not be able to see it again.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={createdKey}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={handleCopyKey}
                            >
                              {copied ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleCloseCreateDialog}>
                            Done
                          </Button>
                        </DialogFooter>
                      </>
                    ) : (
                      <>
                        <DialogHeader>
                          <DialogTitle>Create API Key</DialogTitle>
                          <DialogDescription>
                            Create a new API key for programmatic access.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="key-name">Name</Label>
                            <Input
                              id="key-name"
                              placeholder="e.g., My Agent, Production Bot"
                              value={newKeyName}
                              onChange={(e) => setNewKeyName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="key-expiry">Expiration</Label>
                            <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="never">Never</SelectItem>
                                <SelectItem value="30">30 days</SelectItem>
                                <SelectItem value="60">60 days</SelectItem>
                                <SelectItem value="90">90 days</SelectItem>
                                <SelectItem value="365">1 year</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={handleCloseCreateDialog}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleCreateKey}
                            disabled={!newKeyName.trim() || createKeyMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-500"
                          >
                            {createKeyMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              'Create Key'
                            )}
                          </Button>
                        </DialogFooter>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {keysLoading ? (
                <div className="flex items-center gap-2 p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading API keys...</span>
                </div>
              ) : apiKeysList && apiKeysList.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeysList.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-0.5 rounded">
                            {key.keyPrefix}...
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatShortDate(key.lastUsedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {key.expiresAt ? (
                            <span className={
                              new Date(key.expiresAt) < new Date()
                                ? 'text-red-600'
                                : ''
                            }>
                              {formatShortDate(key.expiresAt)}
                            </span>
                          ) : (
                            'Never'
                          )}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to revoke the API key &quot;{key.name}&quot;? Any applications using this key will lose access immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() => revokeKeyMutation.mutate({ id: key.id })}
                                >
                                  Revoke Key
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No API keys yet</p>
                  <p className="text-xs mt-1">Create an API key to get started with the REST API</p>
                </div>
              )}

              {/* Usage summary */}
              {apiUsage && apiUsage.totals.requests > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2 text-sm">API Usage This Period</h4>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Requests: </span>
                      <span className="font-medium">{apiUsage.totals.requests.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">YouTube Quota Used: </span>
                      <span className="font-medium">{apiUsage.totals.quotaUnits.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
    </>
  );
}
