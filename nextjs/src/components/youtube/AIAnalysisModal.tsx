import { useState } from 'react';
import { api } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, CheckCircle2, ArrowRight, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AIProposal } from '@/server/api/routers/dashboard/ai';

interface AIAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = 'select' | 'analyzing' | 'review' | 'applying' | 'success';

export default function AIAnalysisModal({
  open,
  onOpenChange,
  onSuccess,
}: AIAnalysisModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('select');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [proposal, setProposal] = useState<AIProposal | null>(null);
  const [selectedPreviewVideoId, setSelectedPreviewVideoId] = useState<string>('');
  
  // Queries & Mutations
  const { data: channels } = api.dashboard.youtube.channels.list.useQuery(undefined, {
    enabled: open,
  });
  const analyzeMutation = api.dashboard.ai.analyzeChannel.useMutation();
  const applyMutation = api.dashboard.ai.applyProposal.useMutation();

  const handleAnalyze = async () => {
    if (!selectedChannelId) return;
    setStep('analyzing');
    try {
      const result = await analyzeMutation.mutateAsync({
        channelId: selectedChannelId,
        limit: 20,
      });
      setProposal(result);
      if (result && result.videoAnalysis.length > 0) {
        setSelectedPreviewVideoId(result.videoAnalysis[0]!.videoId);
      }
      setStep('review');
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
      setStep('select');
    }
  };

  const handleApply = async () => {
    if (!proposal || !selectedChannelId) return;
    setStep('applying');
    try {
      await applyMutation.mutateAsync({
        channelId: selectedChannelId,
        proposal,
        applyToAllAnalyzed: true,
      });
      setStep('success');
    } catch (error) {
      toast({
        title: 'Migration Failed',
        description: error instanceof Error ? error.message : 'Failed to create container',
        variant: 'destructive',
      });
      setStep('review');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after transition
    setTimeout(() => {
      setStep('select');
      setProposal(null);
      setSelectedChannelId('');
    }, 300);
    if (step === 'success') {
      onSuccess();
    }
  };

  // Render Steps
  const renderStepContent = () => {
    switch (step) {
      case 'select':
        return (
          <div className="space-y-6 py-4">
            <div className="bg-secondary/50 p-4 rounded-lg border border-secondary flex items-start gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How it works</p>
                Gemini AI will analyze your last 20 videos to identify common patterns. It will propose a reusable Container and Templates, and automatically extract variables (like guest names or topics) from your existing descriptions.
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-base font-medium">Select Channel to Analyze</Label>
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select a channel..." />
                </SelectTrigger>
                <SelectContent>
                  {channels?.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'analyzing':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <Wand2 className="w-12 h-12 text-primary animate-bounce relative z-10" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-medium text-lg">Analyzing Descriptions...</h3>
              <p className="text-sm text-muted-foreground">Finding patterns in your last 20 videos</p>
              <p className="text-sm text-muted-foreground">This may take 1-2 minutes.</p>
              <p className="text-xs text-amber-600 font-medium pt-2">Please do not close this page</p>
            </div>
          </div>
        );

      case 'review':
        if (!proposal) return null;
        return (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-medium text-lg">Proposed Structure</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Container Name</Label>
                    <Input value={proposal.containerName} disabled />
                  </div>
                  <div>
                    <Label>Separator</Label>
                    <Input value={proposal.separator.replace(/\n/g, '\\n')} disabled />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Detected Templates ({proposal.templates.length})</Label>
                <Accordion type="single" collapsible className="w-full">
                  {proposal.templates.map((tpl, idx) => (
                    <AccordionItem key={idx} value={`tpl-${idx}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                            <span className="font-medium">{tpl.name}</span>
                            {tpl.action === 'reuse' ? (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">Reused</Badge>
                            ) : (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 hover:bg-green-200 border-green-200">New</Badge>
                            )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                          {tpl.content}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              <div className="space-y-2 border-t pt-4">
                <h3 className="font-medium text-lg flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  Migration Preview
                </h3>
                <p className="text-sm text-muted-foreground">
                  See how the AI extracted variables for your videos.
                </p>
                
                <Select value={selectedPreviewVideoId} onValueChange={setSelectedPreviewVideoId}>
                   <SelectTrigger>
                     <SelectValue placeholder="Select a video preview" />
                   </SelectTrigger>
                   <SelectContent>
                     {proposal.videoAnalysis.map((v) => (
                       <SelectItem key={v.videoId} value={v.videoId}>
                         Video ID: {v.videoId.slice(0, 8)}...
                       </SelectItem>
                     ))}
                   </SelectContent>
                </Select>

                {selectedPreviewVideoId && (
                   <div className="bg-muted/50 p-4 rounded-md space-y-2">
                     {(
                       proposal.videoAnalysis.find((v) => v.videoId === selectedPreviewVideoId)?.variableValues || []
                     ).map(({ name: key, value }) => (
                       <div key={key} className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                         <span className="font-mono text-muted-foreground">{`{{${key}}}`}:</span>
                         <span className="font-medium">{value || <span className="text-muted-foreground italic">(empty)</span>}</span>
                       </div>
                     ))}
                   </div>
                )}
              </div>
              
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-amber-800 text-sm">
                <p className="font-semibold">Note:</p>
                Applying this will create 1 Container, {proposal.templates.length} Templates, and automatically migrate the analyzed 20 videos to this new structure.
              </div>
            </div>
          </ScrollArea>
        );

      case 'applying':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p>Applying changes & migrating videos...</p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-medium text-xl">Migration Complete!</h3>
            <p className="text-muted-foreground max-w-xs">
              Your new container has been created and {proposal?.videoAnalysis.length} videos have been migrated.
            </p>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={step === 'applying' ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            AI Migration Assistant
          </DialogTitle>
          {step === 'select' && (
            <DialogDescription>
              Automatically detect patterns and setup your templates.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-1">
           {renderStepContent()}
        </div>

        <DialogFooter className="mt-4">
          {step === 'select' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleAnalyze} disabled={!selectedChannelId || analyzeMutation.isPending}>
                Start Analysis
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button onClick={handleApply} className="bg-purple-600 hover:bg-purple-700 text-white">
                Confirm & Apply Migration
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
