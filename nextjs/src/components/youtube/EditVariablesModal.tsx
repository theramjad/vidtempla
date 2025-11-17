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

interface EditVariablesModalProps {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditVariablesModal({
  videoId,
  videoTitle,
  open,
  onOpenChange,
  onSuccess,
}: EditVariablesModalProps) {
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
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Variables</SheetTitle>
          <SheetDescription>{videoTitle}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
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
              <div key={templateName} className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">
                  {templateName}
                </h3>
                <div className="space-y-3 pl-4 border-l-2 border-muted">
                  {Object.entries(vars).map(([key, variable]) => (
                    <div key={key} className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor={`var-${key}`}>
                          {'{{'} {variable.name} {'}}'}
                        </Label>
                        <Textarea
                          id={`var-${key}`}
                          value={variable.value}
                          onChange={(e) => handleValueChange(key, e.target.value)}
                          placeholder={`Enter ${variable.name}`}
                          className="resize-y min-h-[50px]"
                          rows={1}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`type-${key}`}>Type</Label>
                        <Select
                          value={variable.type}
                          onValueChange={(value: 'text' | 'number' | 'date' | 'url') =>
                            handleTypeChange(key, value)
                          }
                        >
                          <SelectTrigger id={`type-${key}`}>
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
          <Collapsible
            open={isPreviewOpen}
            onOpenChange={setIsPreviewOpen}
            className="space-y-2"
          >
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Preview Description</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isPreviewOpen ? 'rotate-180' : ''
                  }`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">
              {isPreviewLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : preview?.description ? (
                <div className="rounded-md border bg-muted/50 p-4">
                  <Label>Preview</Label>
                  <Textarea
                    value={preview.description}
                    readOnly
                    className="mt-2 resize-y min-h-[200px] bg-background"
                    rows={10}
                  />
                </div>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        )}

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || Object.keys(formData).length === 0}
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Variables
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
