/**
 * Preview Modal Component
 * Preview final description and update to YouTube
 */

import { useState } from 'react';
import { api } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, RefreshCw } from 'lucide-react';

interface PreviewModalProps {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function PreviewModal({
  videoId,
  videoTitle,
  open,
  onOpenChange,
  onSuccess,
}: PreviewModalProps) {
  const { toast } = useToast();

  const {
    data: preview,
    isLoading,
    refetch,
  } = api.admin.youtube.videos.preview.useQuery({ videoId }, { enabled: open });

  const updateMutation = api.admin.youtube.videos.updateToYouTube.useMutation();

  const handleUpdateToYouTube = async () => {
    if (!preview?.description) return;

    try {
      await updateMutation.mutateAsync({ videoIds: [videoId] });

      toast({
        title: 'Update queued',
        description: 'The video description will be updated in the background.',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to queue description update',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Preview Description</DialogTitle>
          <p className="text-sm text-muted-foreground">{videoTitle}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !preview?.description ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No description preview available. Make sure all variables are set.
              </p>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Final Description</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetch()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                <Textarea
                  value={preview.description}
                  readOnly
                  rows={20}
                  className="font-mono text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Character count: {preview.description.length} / 5000
                </p>
              </div>

              {preview.description.length > 5000 && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                  Warning: Description exceeds YouTube's 5000 character limit. It
                  will be truncated when uploaded.
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleUpdateToYouTube}
            disabled={
              isLoading || !preview?.description || updateMutation.isPending
            }
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Update on YouTube
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
