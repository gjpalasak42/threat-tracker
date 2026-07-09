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
import { LayoutDashboard, Search, Activity, Shield, CheckCircle2, XCircle, Clock, AlertTriangle, CircleDashed } from 'lucide-react';
import { getSyncStatus, type SyncStatus } from '@/app/dashboard-actions';
import { RelativeTime } from '@/components/relative-time';
import { getFeedHealth } from '@/src/lib/sync-status';

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

const FEED_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function SourceStatus({
  label,
  enabled,
  lastSync,
}: {
  label: string;
  enabled: boolean;
  lastSync: string | null;
}) {
  const health = getFeedHealth(
    enabled,
    lastSync ? new Date(lastSync) : null,
    new Date(),
    FEED_STALE_AFTER_MS
  );

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex min-w-0 items-center gap-1.5">
        {health === 'healthy' && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />}
        {health === 'stale' && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />}
        {health === 'never_synced' && <CircleDashed className="h-3 w-3 shrink-0 text-sky-400" />}
        {health === 'not_configured' && <XCircle className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <span className="truncate text-muted-foreground">{label}</span>
      </div>

      {health === 'not_configured' && (
        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] text-muted-foreground">
          Not configured
        </Badge>
      )}
      {health === 'never_synced' && (
        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
          Pending
        </Badge>
      )}
      {(health === 'healthy' || health === 'stale') && lastSync && (
        <Badge
          variant="outline"
          className={`shrink-0 px-1.5 py-0 text-[10px] ${health === 'stale' ? 'border-amber-400/30 text-amber-400' : ''}`}
        >
          <Clock className="mr-1 h-2 w-2" />
          <RelativeTime date={lastSync} />
        </Badge>
      )}
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    getSyncStatus().then(setSyncStatus);
    
    // Check for status updates (changed/enabled state) every 60 seconds
    const interval = setInterval(() => {
      getSyncStatus().then(setSyncStatus);
    }, 60 * 1000);
    
    // Listen for manual sync events to update immediately
    const handleSyncComplete = () => {
      getSyncStatus().then(setSyncStatus);
    };
    
    window.addEventListener('threat-tracker:sync-complete', handleSyncComplete);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('threat-tracker:sync-complete', handleSyncComplete);
    };
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
              <SourceStatus
                label="AbuseIPDB"
                enabled={syncStatus?.abuseipdb.enabled ?? false}
                lastSync={syncStatus?.abuseipdb.lastSync ?? null}
              />
              <SourceStatus
                label="AlienVault OTX"
                enabled={syncStatus?.otx.enabled ?? false}
                lastSync={syncStatus?.otx.lastSync ?? null}
              />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
