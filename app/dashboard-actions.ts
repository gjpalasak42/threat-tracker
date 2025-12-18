'use server';

/**
 * Dashboard Server Actions
 * 
 * Provides metrics and data for the home dashboard
 */

import { db } from '@/src/db/db';
import { threatLogs } from '@/src/db/schema';
import { count, max } from 'drizzle-orm';

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
