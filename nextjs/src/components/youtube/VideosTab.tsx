/**
 * Videos Tab Component
 * Manage videos and assign to containers
 */

import { useState } from 'react';
import { api } from '@/utils/api';
import type { RouterOutputs } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, Edit, History } from 'lucide-react';
import EditVariablesSheet from './EditVariablesSheet';
import HistoryDrawer from './HistoryDrawer';

type VideoWithRelations = RouterOutputs['dashboard']['youtube']['videos']['list'][number];

export default function VideosTab() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({ channelId: 'all', containerId: 'all', search: '' });
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editVariablesOpen, setEditVariablesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoWithRelations | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState('');

  const { data: channels } = api.dashboard.youtube.channels.list.useQuery();
  const { data: containers } = api.dashboard.youtube.containers.list.useQuery();

  // Convert "all" to empty string for the API query
  const apiFilters = {
    channelId: filters.channelId === 'all' ? '' : filters.channelId,
    containerId: filters.containerId === 'all' ? '' : filters.containerId,
    search: filters.search,
  };
  const { data: videos, isLoading, refetch } = api.dashboard.youtube.videos.list.useQuery(apiFilters);
  const assignMutation = api.dashboard.youtube.videos.assignToContainer.useMutation();

  const handleAssign = async () => {
    if (!selectedVideo || !selectedContainerId) return;

    try {
      await assignMutation.mutateAsync({
        videoId: selectedVideo.id,
        containerId: selectedContainerId,
      });
      toast({
        title: 'Video assigned',
        description: 'The video has been assigned to the container successfully.',
      });
      setAssignDialogOpen(false);
      setSelectedVideo(null);
      setSelectedContainerId('');
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign video',
        variant: 'destructive',
      });
    }
  };

  const openAssignDialog = (video: VideoWithRelations) => {
    setSelectedVideo(video);
    setAssignDialogOpen(true);
  };

  const openEditVariables = (video: VideoWithRelations) => {
    setSelectedVideo(video);
    setEditVariablesOpen(true);
  };

  const openHistory = (video: VideoWithRelations) => {
    setSelectedVideo(video);
    setHistoryOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Videos</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your YouTube videos and assign them to containers
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 pb-0">
            <div>
              <Label htmlFor="channel-filter">Channel</Label>
              <Select
                value={filters.channelId}
                onValueChange={(value) => setFilters({ ...filters, channelId: value })}
              >
                <SelectTrigger id="channel-filter">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {channels?.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="container-filter">Container</Label>
              <Select
                value={filters.containerId}
                onValueChange={(value) => setFilters({ ...filters, containerId: value })}
              >
                <SelectTrigger id="container-filter">
                  <SelectValue placeholder="All containers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All containers</SelectItem>
                  {containers?.map((container) => (
                    <SelectItem key={container.id} value={container.id}>
                      {container.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search videos..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>

          {/* Videos List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !videos || videos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No videos found. Sync your channel to import videos.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Thumbnail</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      <img
                        src={`https://img.youtube.com/vi/${video.video_id}/default.jpg`}
                        alt={video.title || 'Video thumbnail'}
                        className="w-24 h-auto rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{video.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>{video.channel?.title}</TableCell>
                    <TableCell>
                      {video.container ? (
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                          {video.container.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {video.published_at
                        ? new Date(video.published_at).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!video.container_id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignDialog(video)}
                          >
                            Assign
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditVariables(video)}
                              title="Edit Variables"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openHistory(video)}
                              title="Version History"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign to Container</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Video</Label>
                <p className="text-sm text-muted-foreground">{selectedVideo?.title}</p>
              </div>
              <div>
                <Label htmlFor="container-select">Container</Label>
                <Select value={selectedContainerId} onValueChange={setSelectedContainerId}>
                  <SelectTrigger id="container-select">
                    <SelectValue placeholder="Select a container" />
                  </SelectTrigger>
                  <SelectContent>
                    {containers?.map((container) => (
                      <SelectItem key={container.id} value={container.id}>
                        {container.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  Note: Container assignment is permanent and cannot be changed.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAssign}
                  disabled={!selectedContainerId || assignMutation.isPending}
                >
                  {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assign
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Variables Sheet */}
        {selectedVideo && (
          <EditVariablesSheet
            videoId={selectedVideo.id}
            videoTitle={selectedVideo.title ?? 'Untitled Video'}
            open={editVariablesOpen}
            onOpenChange={setEditVariablesOpen}
            onSuccess={refetch}
          />
        )}

        {/* History Drawer */}
        {selectedVideo && (
          <HistoryDrawer
            videoId={selectedVideo.id}
            videoTitle={selectedVideo.title ?? 'Untitled Video'}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            onSuccess={refetch}
          />
        )}
      </CardContent>
    </Card>
  );
}
