/**
 * YouTube Manager Dashboard
 * Main page with tabs for channels, templates, containers, and videos
 */

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import ChannelsTab from '@/components/youtube/ChannelsTab';
import TemplatesTab from '@/components/youtube/TemplatesTab';
import ContainersTab from '@/components/youtube/ContainersTab';
import VideosTab from '@/components/youtube/VideosTab';

export default function YouTubePage() {
  const [activeTab, setActiveTab] = useState('channels');

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            YouTube Description Manager
          </h1>
          <p className="text-muted-foreground">
            Manage your YouTube channels, templates, and video descriptions
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="containers">Containers</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="mt-6">
            <ChannelsTab />
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <TemplatesTab />
          </TabsContent>

          <TabsContent value="containers" className="mt-6">
            <ContainersTab />
          </TabsContent>

          <TabsContent value="videos" className="mt-6">
            <VideosTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
