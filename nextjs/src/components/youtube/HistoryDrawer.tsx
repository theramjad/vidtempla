/**
 * History Drawer Component
 * Shows version history with rollback capability
 */

import { useState } from 'react';
import { api } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Loader2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface HistoryDrawerProps {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function HistoryDrawer({
  videoId,
  videoTitle,
  open,
  onOpenChange,
  onSuccess,
}: HistoryDrawerProps) {
  const { toast } = useToast();
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  const { data: history, isLoading, refetch } = api.admin.youtube.videos.getHistory.useQuery(
    { videoId },
    { enabled: open }
  );

  const rollbackMutation = api.admin.youtube.videos.rollback.useMutation();

  const toggleExpanded = (historyId: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(historyId)) {
        next.delete(historyId);
      } else {
        next.add(historyId);
      }
      return next;
    });
  };

  const handleRollback = async (historyId: string, versionNumber: number) => {
    try {
      await rollbackMutation.mutateAsync({ videoId, historyId });

      toast({
        title: 'Rollback successful',
        description: `Rolled back to version ${versionNumber}. This created a new version.`,
      });

      refetch();
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to rollback',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <p className="text-sm text-muted-foreground">{videoTitle}</p>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !history || history.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No version history available.</p>
            </div>
          ) : (
            history.map((version: any, index: number) => {
              const isExpanded = expandedVersions.has(version.id);
              const isCurrent = index === 0;

              return (
                <div
                  key={version.id}
                  className={`border rounded-lg p-4 ${
                    isCurrent ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Version {version.version_number}</h4>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(version.created_at).toLocaleString()}
                      </p>
                      {version.user && (
                        <p className="text-xs text-muted-foreground">
                          by {version.user.email || 'Unknown'}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpanded(version.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>

                      {!isCurrent && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Rollback
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Rollback to Version {version.version_number}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will create a new version with the content from version{' '}
                                {version.version_number}. The current version will be preserved
                                in history.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleRollback(version.id, version.version_number)
                                }
                                disabled={rollbackMutation.isPending}
                              >
                                {rollbackMutation.isPending && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Rollback
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4">
                      <Textarea
                        value={version.description}
                        readOnly
                        rows={10}
                        className="font-mono text-sm resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {version.description.length} characters
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
