'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  SidebarFooter,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, Search, Activity, Shield, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getSyncStatus, type SyncStatus } from '@/app/dashboard-actions';
import { RelativeTime } from '@/components/relative-time';

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
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    getSyncStatus().then(setSyncStatus);
    
    // Check for status updates (changed/enabled state) every 60 seconds
    const interval = setInterval(() => {
      getSyncStatus().then(setSyncStatus);
    }, 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

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
      
      {/* System Health Footer */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs">System Health</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-2 px-2 py-1">
              {/* AbuseIPDB Status */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  {syncStatus?.abuseipdb.enabled ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground">AbuseIPDB</span>
                </div>
                {syncStatus?.abuseipdb.lastSync && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    <Clock className="h-2 w-2 mr-1" />
                    <RelativeTime date={syncStatus.abuseipdb.lastSync} />
                  </Badge>
                )}
              </div>
              
              {/* OTX Status */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  {syncStatus?.otx.enabled ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground">AlienVault OTX</span>
                </div>
                {syncStatus?.otx.enabled && syncStatus?.otx.lastSync && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    <Clock className="h-2 w-2 mr-1" />
                    <RelativeTime date={syncStatus.otx.lastSync} />
                  </Badge>
                )}
                {syncStatus?.otx.enabled && !syncStatus?.otx.lastSync && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Pending
                  </Badge>
                )}
                {!syncStatus?.otx.enabled && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                    Not configured
                  </Badge>
                )}
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
