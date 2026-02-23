import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { appConfig } from "@/config/app";
import { useUser } from "@/hooks/useUser";
import { api } from "@/utils/api";
import { CreditCard, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function getInitial(email: string) {
  return email.charAt(0).toUpperCase();
}

function getDisplayName(email: string) {
  return email.split("@")[0] ?? email;
}

export default function DashboardSidebar() {
  const { user, signOut } = useUser();
  const router = useRouter();

  const { data: plan } = api.dashboard.billing.getCurrentPlan.useQuery();
  const isFreePlan = !plan || plan.planTier === "free";

  const navItems = [
    ...appConfig.dashboard.navigation,
    ...(isFreePlan
      ? [{ title: "Pricing", url: "/dashboard/pricing" }]
      : []),
  ];

  const email = user?.email ?? "";
  const displayName = getDisplayName(email);
  const initial = getInitial(email);

  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <p
              onClick={() => router.push("/dashboard")}
              className="text-foreground-muted cursor-pointer px-2 pt-2 text-2xl font-bold"
            >
              {appConfig.brand.name}
            </p>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} className="px-4 py-3">
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-auto px-2 py-2">
                  <div className="flex w-full items-center gap-3">
                    <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{displayName}</p>
                      <p className="text-muted-foreground truncate text-xs">{email}</p>
                    </div>
                    <Settings className="text-muted-foreground h-4 w-4 shrink-0" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <div className="border-b px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{displayName}</p>
                      <p className="text-muted-foreground truncate text-xs">{email}</p>
                    </div>
                  </div>
                </div>
                <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/dashboard/pricing")}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Billing</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
