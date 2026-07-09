export type FeedHealth = 'healthy' | 'stale' | 'never_synced' | 'not_configured';

const API_KEY_PLACEHOLDERS = new Set([
  'your_api_key_here',
  'your_abuseipdb_api_key_here',
  'your_otx_api_key_here',
  'changeme',
]);

/**
 * Treat copied example values as unconfigured so the UI and sync routes do not
 * advertise or attempt provider access with placeholder credentials.
 */
export function isConfiguredApiKey(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;

  const normalized = value.trim().toLowerCase();
  return !API_KEY_PLACEHOLDERS.has(normalized) && !normalized.includes('placeholder');
}

export function getFeedHealth(
  enabled: boolean,
  lastSync: Date | null,
  now: Date,
  staleAfterMs: number
): FeedHealth {
  if (!enabled) return 'not_configured';
  if (!lastSync || Number.isNaN(lastSync.getTime())) return 'never_synced';

  return now.getTime() - lastSync.getTime() > staleAfterMs ? 'stale' : 'healthy';
}

export function getLastSyncTimestamp(
  configUpdatedAt: Date | null | undefined,
  sourceThreatCreatedAt: Date | null | undefined
): Date | null {
  return configUpdatedAt ?? sourceThreatCreatedAt ?? null;
}

export function shouldThrottleSync(
  lastSyncTime: Date | null,
  now: Date,
  minIntervalMs: number
): { throttled: boolean; hoursRemaining: number } {
  if (!lastSyncTime) {
    return { throttled: false, hoursRemaining: 0 };
  }

  const timeSinceLastSync = now.getTime() - lastSyncTime.getTime();
  if (timeSinceLastSync >= minIntervalMs) {
    return { throttled: false, hoursRemaining: 0 };
  }

  return {
    throttled: true,
    hoursRemaining: Math.ceil((minIntervalMs - timeSinceLastSync) / (60 * 60 * 1000)),
  };
}
