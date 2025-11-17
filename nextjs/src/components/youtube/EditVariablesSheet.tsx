/**
 * Edit Variables Sheet Component
 * Allows users to edit video-specific variable values
 */

import { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import type { RouterOutputs } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChevronDown } from 'lucide-react';

type VideoVariable = RouterOutputs['admin']['youtube']['videos']['getVariables'][number];

interface EditVariablesSheetProps {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditVariablesSheet({
  videoId,
  videoTitle,
  open,
  onOpenChange,
  onSuccess,
}: EditVariablesSheetProps) {
  const { toast } = useToast();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [formData, setFormData] = useState<
    Record<
      string,
      {
        templateId: string;
        name: string;
        value: string;
        type: 'text' | 'number' | 'date' | 'url';
        templateName: string;
      }
    >
  >({});

  const { data: variables, isLoading } = api.dashboard.youtube.videos.getVariables.useQuery(
    { videoId },
    { enabled: open }
  );

  const { data: preview, isLoading: isPreviewLoading } = api.dashboard.youtube.videos.preview.useQuery(
    { videoId },
    { enabled: open && isPreviewOpen }
  );

  const updateMutation = api.dashboard.youtube.videos.updateVariables.useMutation();

  // Initialize form data when variables are loaded
  useEffect(() => {
    if (variables) {
      const initialData: typeof formData = {};
      variables.forEach((variable: VideoVariable) => {
        const key = `${variable.template_id}-${variable.variable_name}`;
        const variableType = variable.variable_type as 'text' | 'number' | 'date' | 'url';
        initialData[key] = {
          templateId: variable.template_id,
          name: variable.variable_name,
          value: variable.variable_value || '',
          type: variableType || 'text',
          templateName: variable.template?.name || 'Unknown Template',
        };
      });
      setFormData(initialData);
    }
  }, [variables]);

  const handleValueChange = (key: string, value: string) => {
    setFormData((prev) => {
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          value,
        },
      };
    });
  };

  const handleTypeChange = (
    key: string,
    type: 'text' | 'number' | 'date' | 'url'
  ) => {
    setFormData((prev) => {
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          type,
        },
      };
    });
  };

  const handleSave = async () => {
    try {
      const variablesArray = Object.values(formData).map((v) => ({
        templateId: v.templateId,
        name: v.name,
        value: v.value,
        type: v.type,
      }));

      await updateMutation.mutateAsync({
        videoId,
        variables: variablesArray,
      });

      toast({
        title: 'Variables saved and update queued',
        description: 'Video variables have been saved and YouTube update is in progress.',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update variables',
        variant: 'destructive',
      });
    }
  };

  // Group variables by template
  const groupedVariables: Record<string, typeof formData> = {};
  Object.entries(formData).forEach(([key, value]) => {
    if (!groupedVariables[value.templateName]) {
      groupedVariables[value.templateName] = {};
    }
    groupedVariables[value.templateName]![key] = value;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <SheetHeader>
            <SheetTitle>Edit Variables</SheetTitle>
            <SheetDescription className="line-clamp-1">{videoTitle}</SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-6 py-6 space-y-8">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(groupedVariables).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No variables to edit. Assign this video to a container with templates
                containing variables.
              </p>
            </div>
          ) : (
            Object.entries(groupedVariables).map(([templateName, vars]) => (
              <div key={templateName} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    {templateName}
                  </h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-6">
                  {Object.entries(vars).map(([key, variable]) => (
                    <div key={key} className="space-y-3">
                      <div>
                        <Label htmlFor={`var-${key}`} className="text-base">
                          {'{{'} {variable.name} {'}}'}
                        </Label>
                        <Textarea
                          id={`var-${key}`}
                          value={variable.value}
                          onChange={(e) => handleValueChange(key, e.target.value)}
                          placeholder={`Enter ${variable.name}`}
                          className="resize-y min-h-[80px] mt-2"
                          rows={2}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`type-${key}`} className="text-sm text-muted-foreground">
                          Type:
                        </Label>
                        <Select
                          value={variable.type}
                          onValueChange={(value: 'text' | 'number' | 'date' | 'url') =>
                            handleTypeChange(key, value)
                          }
                        >
                          <SelectTrigger id={`type-${key}`} className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="url">URL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {Object.keys(formData).length > 0 && (
          <div className="px-6 pb-6">
            <Collapsible
              open={isPreviewOpen}
              onOpenChange={setIsPreviewOpen}
              className="space-y-3"
            >
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="lg" className="w-full justify-between">
                  <span className="font-medium">Preview Description</span>
                  <ChevronDown
                    className={`h-5 w-5 transition-transform duration-200 ${
                      isPreviewOpen ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3">
                {isPreviewLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : preview?.description ? (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <Textarea
                      value={preview.description}
                      readOnly
                      className="resize-y min-h-[200px] bg-background border-0 focus-visible:ring-0"
                      rows={10}
                    />
                  </div>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        <div className="sticky bottom-0 z-10 bg-background border-t px-6 py-4">
          <SheetFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || Object.keys(formData).length === 0}
              size="lg"
              className="flex-1 sm:flex-initial"
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Variables
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
