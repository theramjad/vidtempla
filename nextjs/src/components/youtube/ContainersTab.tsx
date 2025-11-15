/**
 * Containers Tab Component
 * Manage containers with template ordering
 */

import { useState } from 'react';
import { api } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Loader2, Plus, Edit2, Trash2 } from 'lucide-react';
import EditContainerModal from './EditContainerModal';

export default function ContainersTab() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', templateIds: [] as string[] });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: containers, isLoading, refetch } = api.admin.youtube.containers.list.useQuery();
  const { data: templates } = api.admin.youtube.templates.list.useQuery();
  const createMutation = api.admin.youtube.containers.create.useMutation();
  const deleteMutation = api.admin.youtube.containers.delete.useMutation();

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Container name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createMutation.mutateAsync(formData);
      toast({
        title: 'Container created',
        description: 'Your container has been created successfully.',
      });
      setFormData({ name: '', templateIds: [] });
      setCreateDialogOpen(false);
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create container',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      toast({
        title: 'Container deleted',
        description: 'The container has been deleted successfully.',
      });
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete container',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleTemplate = (templateId: string) => {
    setFormData((prev) => ({
      ...prev,
      templateIds: prev.templateIds.includes(templateId)
        ? prev.templateIds.filter((id) => id !== templateId)
        : [...prev.templateIds, templateId],
    }));
  };

  const openEditDialog = (containerId: string) => {
    setSelectedContainerId(containerId);
    setEditDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Containers</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Containers are collections of templates applied to videos
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Container
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Container</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Container Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Product Videos"
                  />
                </div>
                <div>
                  <Label>Select Templates</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
                    {templates && templates.length > 0 ? (
                      templates.map((template) => (
                        <label
                          key={template.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.templateIds.includes(template.id)}
                            onChange={() => toggleTemplate(template.id)}
                            className="rounded"
                          />
                          <span>{template.name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No templates available. Create templates first.</p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Templates will be applied in the order selected
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !containers || containers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No containers created yet
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Container
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Templates</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {containers.map((container) => (
                <TableRow key={container.id}>
                  <TableCell className="font-medium">{container.name}</TableCell>
                  <TableCell>
                    {container.template_order?.length || 0} template(s)
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(container.id)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingId === container.id}
                          >
                            {deletingId === container.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Container?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the container. Videos assigned to this container will become unassigned.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(container.id)}>
                              Delete
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

        {/* Edit Container Modal */}
        {selectedContainerId && (
          <EditContainerModal
            containerId={selectedContainerId}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSuccess={refetch}
          />
        )}
      </CardContent>
    </Card>
  );
}
