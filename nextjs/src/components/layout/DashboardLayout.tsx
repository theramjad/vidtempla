import DashboardSidebar from "@/components/dashboard-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import RootLayout from "./RootLayout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RootLayout>
      <SidebarProvider>
        <DashboardSidebar />
        <main className="flex-1 p-4">
          <SidebarTrigger />
          {children}
        </main>
      </SidebarProvider>
    </RootLayout>
  );
}
