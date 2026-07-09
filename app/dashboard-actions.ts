'use server';

/**
 * Dashboard Server Actions
 * 
 * Provides metrics and data for the home dashboard
 */

import { db } from '@/src/db/db';
import { threatLogs, systemConfig, SYSTEM_CONFIG_KEYS } from '@/src/db/schema';
import { count, max, eq, or } from 'drizzle-orm';
import { getLastSyncTimestamp, isConfiguredApiKey } from '@/src/lib/sync-status';

export interface DashboardMetrics {
  totalRecords: number;
  lastSyncTime: string | null;
}

/**
 * Get dashboard metrics including total records and last sync time
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [countResult, lastSyncResult] = await Promise.all([
    db.select({ value: count() }).from(threatLogs),
    db.select({ value: max(threatLogs.createdAt) }).from(threatLogs),
  ]);

  const totalRecords = Number(countResult[0]?.value ?? 0);
  const lastSyncTime = lastSyncResult[0]?.value?.toISOString() ?? null;

  return {
    totalRecords,
    lastSyncTime,
  };
}

export interface SyncStatus {
  abuseipdb: {
    lastSync: string | null;
    enabled: boolean;
  };
  otx: {
    lastSync: string | null;
    enabled: boolean;
  };
}

/**
 * Get sync status for all threat intelligence sources
 * Used by the sidebar to display system health
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  try {
    // Get all sync-related config entries
    const configs = await db.select()
      .from(systemConfig)
      .where(
        or(
          eq(systemConfig.key, SYSTEM_CONFIG_KEYS.LAST_OTX_SYNC),
          eq(systemConfig.key, SYSTEM_CONFIG_KEYS.LAST_ABUSEIPDB_SYNC)
        )
      );

    const otxConfig = configs.find(c => c.key === SYSTEM_CONFIG_KEYS.LAST_OTX_SYNC);
    const abuseConfig = configs.find(c => c.key === SYSTEM_CONFIG_KEYS.LAST_ABUSEIPDB_SYNC);

    // Get last sync time for AbuseIPDB - prefer config entry, fallback to threat_logs
    const abuseLastEntry = await db.select({ value: max(threatLogs.createdAt) })
      .from(threatLogs)
      .where(eq(threatLogs.source, 'AbuseIPDB'));
    const abuseLastSync = getLastSyncTimestamp(
      abuseConfig?.updatedAt,
      abuseLastEntry[0]?.value
    )?.toISOString() ?? null;

    // Get last sync time for OTX - prefer config entry, fallback to threat_logs
    const otxLastEntry = await db.select({ value: max(threatLogs.createdAt) })
      .from(threatLogs)
      .where(eq(threatLogs.source, 'OTX'));
    const otxLastSync = getLastSyncTimestamp(
      otxConfig?.updatedAt,
      otxLastEntry[0]?.value
    )?.toISOString() ?? null;

    return {
      abuseipdb: {
        lastSync: abuseLastSync,
        enabled: isConfiguredApiKey(process.env.ABUSEIPDB_API_KEY),
      },
      otx: {
        lastSync: otxLastSync,
        enabled: isConfiguredApiKey(process.env.OTX_API_KEY),
      },
    };
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return {
      abuseipdb: { lastSync: null, enabled: false },
      otx: { lastSync: null, enabled: false },
    };
  }
}
