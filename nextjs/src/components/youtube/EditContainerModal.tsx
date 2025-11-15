/**
 * Edit Container Modal Component
 * Edit container name and reorder templates
 */

import { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, GripVertical, ArrowUp, ArrowDown, X } from 'lucide-react';

interface EditContainerModalProps {
  containerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditContainerModal({
  containerId,
  open,
  onOpenChange,
  onSuccess,
}: EditContainerModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [templateIds, setTemplateIds] = useState<string[]>([]);

  const { data: container } = api.admin.youtube.containers.list.useQuery(undefined, {
    enabled: open,
    select: (containers) => containers.find((c) => c.id === containerId),
  });

  const { data: allTemplates } = api.admin.youtube.templates.list.useQuery(undefined, {
    enabled: open,
  });

  const updateMutation = api.admin.youtube.containers.update.useMutation();

  // Initialize form data
  useEffect(() => {
    if (container) {
      setName(container.name);
      setTemplateIds(container.template_order || []);
    }
  }, [container]);

  const moveTemplate = (index: number, direction: 'up' | 'down') => {
    const newTemplateIds = [...templateIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newTemplateIds.length) return;

    [newTemplateIds[index], newTemplateIds[targetIndex]] = [
      newTemplateIds[targetIndex],
      newTemplateIds[index],
    ];

    setTemplateIds(newTemplateIds);
  };

  const removeTemplate = (templateId: string) => {
    setTemplateIds(templateIds.filter((id) => id !== templateId));
  };

  const availableTemplates =
    allTemplates?.filter((t) => !templateIds.includes(t.id)) || [];

  const addTemplate = (templateId: string) => {
    setTemplateIds([...templateIds, templateId]);
  };

  const getTemplateName = (templateId: string) => {
    return allTemplates?.find((t) => t.id === templateId)?.name || 'Unknown Template';
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: containerId,
        name,
        templateIds,
      });

      toast({
        title: 'Container updated',
        description: 'Container has been updated successfully.',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update container',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Container</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Container Name */}
          <div>
            <Label htmlFor="container-name">Container Name</Label>
            <Input
              id="container-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Product Videos"
            />
          </div>

          {/* Template Order */}
          <div>
            <Label>Template Order</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Templates will be applied in this order. Drag or use arrows to reorder.
            </p>

            {templateIds.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-md">
                <p className="text-muted-foreground text-sm">
                  No templates added yet. Add templates from the list below.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {templateIds.map((templateId, index) => (
                  <div
                    key={templateId}
                    className="flex items-center gap-2 p-3 border rounded-md bg-background"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <span className="flex-1 font-medium">
                      {index + 1}. {getTemplateName(templateId)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveTemplate(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveTemplate(index, 'down')}
                        disabled={index === templateIds.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTemplate(templateId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Templates */}
          {availableTemplates.length > 0 && (
            <div>
              <Label>Add Templates</Label>
              <div className="mt-2 border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {availableTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => addTemplate(template.id)}
                  >
                    <span className="text-sm">{template.name}</span>
                    <Button size="sm" variant="ghost">
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {templateIds.length > 0 && (
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="font-medium mb-1">Preview Order:</p>
              <div className="flex items-center gap-2 text-muted-foreground">
                {templateIds.map((templateId, index) => (
                  <span key={templateId}>
                    {getTemplateName(templateId)}
                    {index < templateIds.length - 1 && ' → '}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending || !name.trim()}>
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
