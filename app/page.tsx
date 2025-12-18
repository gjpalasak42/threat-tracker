import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThreatTable } from '@/components/threat-table';
import { getDashboardMetrics } from '@/app/dashboard-actions';
import { getThreats } from '@/app/threats/actions';
import { Database, Clock, AlertTriangle } from 'lucide-react';

// Prevent static prerendering - requires database connection
export const dynamic = 'force-dynamic';

function formatLastSync(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default async function DashboardPage() {
  const [metrics, { threats }] = await Promise.all([
    getDashboardMetrics(),
    getThreats(10),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your threat intelligence database
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total IPs stored in threat_logs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLastSync(metrics.lastSyncTime)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.lastSyncTime 
                ? new Date(metrics.lastSyncTime).toLocaleString() 
                : 'No sync recorded'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <AlertTriangle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Threats Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Threats</CardTitle>
          <CardDescription>Most recently added entries from your database</CardDescription>
        </CardHeader>
        <CardContent>
          <ThreatTable threats={threats} />
        </CardContent>
      </Card>
    </div>
  );
}