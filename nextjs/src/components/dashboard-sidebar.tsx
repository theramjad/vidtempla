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
  useSidebar,
} from "@/components/ui/sidebar";
import { appConfig } from "@/config/app";
import { useUser } from "@/hooks/useUser";
import { api } from "@/utils/api";
import {
  CreditCard,
  LogOut,
  Settings,
  LayoutDashboard,
  Key,
  Server,
  BarChart3,
  Tag,
  Shield,
  ChevronUp,
} from "lucide-react";
import { Progress } from "./ui/progress";
import { isSuperAdmin } from "@/lib/admin";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard/youtube": LayoutDashboard,
  "/dashboard/api-keys": Key,
  "/dashboard/mcp-server": Server,
  "/dashboard/usage": BarChart3,
  "/dashboard/pricing": Tag,
};

function getInitial(email: string) {
  return email.charAt(0).toUpperCase();
}

function getDisplayName(email: string) {
  return email.split("@")[0] ?? email;
}

export default function DashboardSidebar() {
  const { user, signOut } = useUser();
  const router = useRouter();
  const { open } = useSidebar();

  const { data: plan } = api.dashboard.billing.getCurrentPlan.useQuery();
  const { data: credits } = api.dashboard.apiKeys.getCreditBalance.useQuery();
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
    <Sidebar collapsible="icon" className="border-r bg-background">
      {/* Header */}
      <SidebarHeader className="border-b h-16 flex items-center justify-center p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              href="/dashboard/youtube"
              className={`flex w-full items-center gap-2 ${open ? "px-4" : "justify-center"}`}
            >
              <span
                className={`font-bold text-foreground ${open ? "text-2xl" : "text-lg"}`}
              >
                {open ? appConfig.brand.name : appConfig.brand.name.charAt(0)}
              </span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = iconMap[item.url] ?? CreditCard;
                const isActive =
                  router.asPath === item.url ||
                  router.asPath.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                      <Link href={item.url}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin(user?.email) && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Admin"
                    isActive={router.asPath.startsWith("/admin")}
                  >
                    <Link href="/admin">
                      <Shield />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t p-4">
        <div className="space-y-4">
          {/* Credits display */}
          {open && credits && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Credits</span>
                <span>
                  {credits.balance.toLocaleString()} /{" "}
                  {credits.monthlyAllocation.toLocaleString()}
                </span>
              </div>
              <Progress
                value={
                  credits.monthlyAllocation > 0
                    ? (credits.balance / credits.monthlyAllocation) * 100
                    : 0
                }
                className="h-2"
              />
            </div>
          )}

          {/* Upgrade button for free tier */}
          {open && isFreePlan && (
            <Button
              className="w-full text-xs"
              size="sm"
              onClick={() => router.push("/dashboard/pricing")}
            >
              Upgrade Plan
            </Button>
          )}
        </div>

        <SidebarMenu className="mt-2">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="h-auto px-3 py-3">
                  <div className="flex w-full items-center gap-3">
                    <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                      {initial}
                    </div>
                    {open && (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {displayName}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {email}
                        </p>
                      </div>
                    )}
                    {open && (
                      <ChevronUp className="text-muted-foreground h-5 w-5 shrink-0" />
                    )}
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="start"
                className="w-64"
              >
                <div className="border-b px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {displayName}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {email}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/settings")}
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/pricing")}
                  >
                    <CreditCard className="mr-3 h-4 w-4" />
                    <span>Billing</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-3 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
