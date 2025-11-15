import DashboardLayout from "@/components/layout/DashboardLayout";
import { AccountsTab } from "@/components/twitter/AccountsTab";
import { PostsTab } from "@/components/twitter/PostsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Twitter() {
  return (
    <DashboardLayout>
      <div className="container mx-auto space-y-4 py-5">
        <h1 className="text-3xl font-bold">Twitter</h1>

        <Tabs defaultValue="accounts">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <AccountsTab />
          </TabsContent>

          <TabsContent value="posts">
            <PostsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
