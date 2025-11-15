/**
 * Channels Tab Component
 * Manage connected YouTube channels
 */

import { useState } from 'react';
import { api } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, RefreshCw, Plus } from 'lucide-react';
import Image from 'next/image';

export default function ChannelsTab() {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: channels, isLoading, refetch } = api.admin.youtube.channels.list.useQuery();
  const disconnectMutation = api.admin.youtube.channels.disconnect.useMutation();
  const syncMutation = api.admin.youtube.channels.syncVideos.useMutation();

  const handleConnect = () => {
    window.location.href = '/api/auth/youtube/initiate';
  };

  const handleDisconnect = async (channelId: string) => {
    setDeletingId(channelId);
    try {
      await disconnectMutation.mutateAsync({ channelId });
      toast({
        title: 'Channel disconnected',
        description: 'The channel has been removed successfully.',
      });
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect channel',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSync = async (channelId: string) => {
    setSyncingId(channelId);
    try {
      await syncMutation.mutateAsync({ channelId });
      toast({
        title: 'Sync started',
        description: 'Videos are being synced in the background.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sync videos',
        variant: 'destructive',
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>YouTube Channels</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your YouTube channels to manage video descriptions
            </p>
          </div>
          <Button onClick={handleConnect}>
            <Plus className="mr-2 h-4 w-4" />
            Connect Channel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !channels || channels.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No channels connected yet
            </p>
            <Button onClick={handleConnect} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Connect Your First Channel
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead>Last Synced</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {channel.thumbnail_url && (
                        <Image
                          src={channel.thumbnail_url}
                          alt={channel.title || 'Channel'}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      )}
                      <span className="font-medium">{channel.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {channel.subscriber_count?.toLocaleString() || '—'}
                  </TableCell>
                  <TableCell>
                    {channel.last_synced_at
                      ? new Date(channel.last_synced_at).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(channel.id)}
                        disabled={syncingId === channel.id}
                      >
                        {syncingId === channel.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingId === channel.id}
                          >
                            {deletingId === channel.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Disconnect Channel?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the channel and all associated videos,
                              variables, and history. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDisconnect(channel.id)}
                            >
                              Disconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
