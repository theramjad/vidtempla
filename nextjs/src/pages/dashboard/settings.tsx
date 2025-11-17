/**
 * Settings Page
 * User account settings and preferences
 */

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/component';
import { Loader2, ExternalLink, CreditCard } from 'lucide-react';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  // Fetch current subscription
  const { data: currentPlan, isLoading: planLoading } =
    api.dashboard.billing.getCurrentPlan.useQuery();

  // Fetch usage stats
  const { data: usageStats, isLoading: usageLoading } =
    api.dashboard.billing.getUsageStats.useQuery();

  // Fetch recent orders
  const { data: orders, isLoading: ordersLoading } =
    api.dashboard.billing.getOrders.useQuery();

  // Get customer portal URL
  const getPortalUrl = api.dashboard.billing.getCustomerPortalUrl.useQuery(
    undefined,
    {
      enabled: false, // Don't fetch automatically
    }
  );

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.email) {
        setUserEmail(user.email);
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (cents: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  return (
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
                {loading ? (
                  <div className="flex items-center gap-2 p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  <Input
                    id="email"
                    type="email"
                    value={userEmail}
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
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                      {currentPlan?.plan_tier || 'Free'}
                    </span>
                  </div>

                  {currentPlan?.status && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium">Status</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
                        currentPlan.status === 'active' ? 'bg-green-100 text-green-700' :
                        currentPlan.status === 'canceled' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {currentPlan.status}
                      </span>
                    </div>
                  )}

                  {currentPlan?.current_period_start && currentPlan?.current_period_end && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium">Billing Period</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(currentPlan.current_period_start)} - {formatDate(currentPlan.current_period_end)}
                      </span>
                    </div>
                  )}

                  {currentPlan?.cancel_at_period_end && (
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
              {currentPlan?.plan_tier !== 'free' && currentPlan?.polar_customer_id && (
                <Button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="flex-1"
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

          {/* Payment History */}
          {orders && orders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment History
                </CardTitle>
                <CardDescription>
                  Your recent transactions and invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex items-center gap-2 p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading orders...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between py-3 border-b last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {formatCurrency(order.amount, order.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                          order.status === 'paid' ? 'bg-green-100 text-green-700' :
                          order.status === 'refunded' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
