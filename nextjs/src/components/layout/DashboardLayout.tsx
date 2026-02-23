import DashboardSidebar from "@/components/dashboard-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import RootLayout from "./RootLayout";

export default function DashboardLayout({
  children,
  headerContent,
}: {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}) {
  return (
    <RootLayout>
      <SidebarProvider>
        <DashboardSidebar />
        <main className="flex-1 flex flex-col">
          <div className="border-b bg-background">
            <div className="flex items-center gap-4 px-4 py-3">
              <SidebarTrigger />
              {headerContent}
            </div>
          </div>
          <div className="flex-1 p-4">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </RootLayout>
  );
}
