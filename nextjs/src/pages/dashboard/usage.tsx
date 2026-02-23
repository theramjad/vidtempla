/**
 * API Usage Page
 * Shows request counts, quota usage, and breakdowns by endpoint and key
 */

import Head from 'next/head';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Loader2 } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function UsagePage() {
  const { data: usage, isLoading } =
    api.dashboard.apiKeys.getDetailedUsage.useQuery({});

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPeriod = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
  };

  return (
    <>
      <Head>
        <title>Usage | VidTempla</title>
      </Head>
      <DashboardLayout
        headerContent={
          <nav className="flex items-center gap-2 text-sm flex-1">
            <span className="font-medium">Usage</span>
          </nav>
        }
      >
        <div className="container mx-auto py-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center gap-2 p-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading usage data...</span>
            </div>
          ) : usage ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                    <p className="text-2xl font-bold">{usage.totals.requests.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">YouTube Quota Used</p>
                    <p className="text-2xl font-bold">{usage.totals.quotaUnits.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Period</p>
                    <p className="text-2xl font-bold">{formatPeriod(usage.periodStart, usage.periodEnd)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Daily breakdown */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Daily Breakdown</h3>
                {usage.daily.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Quota Units</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.daily.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{formatDate(day.date)}</TableCell>
                          <TableCell className="text-right">{day.requestCount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{day.quotaUnits.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No requests this period</p>
                )}
              </div>

              {/* Per-endpoint breakdown */}
              {usage.byEndpoint.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">By Endpoint</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Quota Units</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.byEndpoint.map((row) => (
                        <TableRow key={row.endpoint}>
                          <TableCell className="font-mono text-sm">{row.endpoint}</TableCell>
                          <TableCell className="text-right">{row.requests.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.quotaUnits.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Per-key breakdown */}
              {usage.byKey.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">By API Key</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key Name</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Quota Units</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.byKey.map((row) => (
                        <TableRow key={row.apiKeyId}>
                          <TableCell className="font-medium">{row.keyName}</TableCell>
                          <TableCell className="text-right">{row.requests.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.quotaUnits.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No usage data available</p>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}
