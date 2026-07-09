import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThreatTable } from '@/components/threat-table';
import { getDashboardMetrics, getSyncStatus } from '@/app/dashboard-actions';
import { getThreats } from '@/app/threats/actions';
import { RelativeTime } from '@/components/relative-time';
import { getFeedHealth, type FeedHealth } from '@/src/lib/sync-status';
import { Activity, Clock3, Database } from 'lucide-react';

// Prevent static prerendering - requires database connection
export const dynamic = 'force-dynamic';

const FEED_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function latestTimestamp(timestamps: Array<string | null>): string | null {
  const validTimestamps = timestamps
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .map((timestamp) => new Date(timestamp))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (validTimestamps.length === 0) return null;
  return new Date(Math.max(...validTimestamps.map((date) => date.getTime()))).toISOString();
}

function getOverallFeedStatus(statuses: FeedHealth[]) {
  if (statuses.every((status) => status === 'not_configured')) {
    return { label: 'Setup needed', detail: 'Add a provider API key to resume updates', tone: 'text-amber-400' };
  }
  if (statuses.includes('stale')) {
    return { label: 'Stale', detail: 'At least one configured feed is overdue', tone: 'text-amber-400' };
  }
  if (statuses.includes('never_synced')) {
    return { label: 'Awaiting sync', detail: 'A configured feed has not completed yet', tone: 'text-sky-400' };
  }
  if (statuses.includes('not_configured')) {
    return { label: 'Partial', detail: 'One intelligence provider is not configured', tone: 'text-sky-400' };
  }
  return { label: 'Healthy', detail: 'Configured feeds updated within 24 hours', tone: 'text-emerald-400' };
}

export default async function DashboardPage() {
  const [metrics, { threats }, syncStatus] = await Promise.all([
    getDashboardMetrics(),
    getThreats(10),
    getSyncStatus(),
  ]);

  const lastSyncTime = latestTimestamp([
    syncStatus.abuseipdb.lastSync,
    syncStatus.otx.lastSync,
    metrics.lastSyncTime,
  ]);
  const now = new Date();
  const feedStatus = getOverallFeedStatus([
    getFeedHealth(
      syncStatus.abuseipdb.enabled,
      syncStatus.abuseipdb.lastSync ? new Date(syncStatus.abuseipdb.lastSync) : null,
      now,
      FEED_STALE_AFTER_MS
    ),
    getFeedHealth(
      syncStatus.otx.enabled,
      syncStatus.otx.lastSync ? new Date(syncStatus.otx.lastSync) : null,
      now,
      FEED_STALE_AFTER_MS
    ),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Threat intelligence</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Operations overview</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Current coverage, feed freshness, and the latest indicators in your database.
        </p>
      </div>

      <div className="grid overflow-hidden rounded-xl border border-border/80 bg-card/40 sm:grid-cols-3">
        <section className="relative min-w-0 p-5 sm:border-r sm:border-border/80">
          <Database className="absolute right-5 top-5 h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">Stored indicators</p>
          <p className="mt-4 text-2xl font-semibold tabular-nums">{metrics.totalRecords.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">Across all intelligence sources</p>
        </section>

        <section className="relative min-w-0 border-t border-border/80 p-5 sm:border-r sm:border-t-0">
          <Clock3 className="absolute right-5 top-5 h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">Latest feed activity</p>
          <p className="mt-4 text-2xl font-semibold">
            <RelativeTime date={lastSyncTime} />
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {lastSyncTime
              ? `${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(lastSyncTime))} UTC`
              : 'No successful sync recorded'}
          </p>
        </section>

        <section className="relative min-w-0 border-t border-border/80 p-5 sm:border-t-0">
          <Activity className={`absolute right-5 top-5 h-4 w-4 ${feedStatus.tone}`} />
          <p className="text-xs font-medium text-muted-foreground">Feed status</p>
          <p className={`mt-4 text-2xl font-semibold ${feedStatus.tone}`}>{feedStatus.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{feedStatus.detail}</p>
        </section>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent indicators</CardTitle>
          <CardDescription>The ten most recently stored threat records</CardDescription>
        </CardHeader>
        <CardContent>
          <ThreatTable threats={threats} />
        </CardContent>
      </Card>
    </div>
  );
}
