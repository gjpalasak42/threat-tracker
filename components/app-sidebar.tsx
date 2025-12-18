'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Search, Activity, Shield } from 'lucide-react';

const navItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Investigate',
    href: '/investigate',
    icon: Search,
  },
  {
    title: 'Intelligence Pulse',
    href: '/pulse',
    icon: Activity,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10">
            <Shield className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Threat Tracker</span>
            <span className="text-[10px] text-muted-foreground">OSINT Investigation Hub</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href} className="w-full">
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <item.icon className={isActive ? 'text-emerald-500' : ''} />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

