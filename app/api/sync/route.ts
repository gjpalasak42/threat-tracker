import { NextRequest, NextResponse } from 'next/server';
import { ingestFromAbuseIPDB } from '@/app/threats/actions';
import { db } from '@/src/db/db';
import { systemConfig, SYSTEM_CONFIG_KEYS, threatLogs } from '@/src/db/schema';
import { eq, max } from 'drizzle-orm';
import { getLastSyncTimestamp, isConfiguredApiKey, shouldThrottleSync } from '@/src/lib/sync-status';

/**
 * Sync Endpoint for Cron Job
 * 
 * POST /api/sync
 * 
 * Triggers ingestion from AbuseIPDB blacklist.
 * Protected by CRON_SECRET authorization.
 * Rate limited to 2 syncs per day (12-hour minimum gap).
 */

const MIN_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

export async function POST(request: NextRequest) {
  // Verify authorization
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!isConfiguredApiKey(process.env.ABUSEIPDB_API_KEY)) {
    return NextResponse.json(
      { error: 'ABUSEIPDB_API_KEY not configured' },
      { status: 503 }
    );
  }

  // Check source-specific last sync time to enforce rate limiting.
  const [configResult, lastSyncResult] = await Promise.all([
    db.select({ updatedAt: systemConfig.updatedAt })
      .from(systemConfig)
      .where(eq(systemConfig.key, SYSTEM_CONFIG_KEYS.LAST_ABUSEIPDB_SYNC))
      .limit(1),
    db.select({ lastSync: max(threatLogs.createdAt) })
      .from(threatLogs)
      .where(eq(threatLogs.source, 'AbuseIPDB')),
  ]);

  const lastSyncTime = getLastSyncTimestamp(
    configResult[0]?.updatedAt,
    lastSyncResult[0]?.lastSync
  );

  const throttle = shouldThrottleSync(lastSyncTime, new Date(), MIN_SYNC_INTERVAL_MS);
  if (throttle.throttled) {
    return NextResponse.json(
      {
        error: 'Rate limit: Sync too recent',
        message: `Please wait ${throttle.hoursRemaining} more hours before next sync`,
        lastSyncTime: lastSyncTime?.toISOString(),
      },
      { status: 429 }
    );
  }

  // Perform ingestion
  try {
    const result = await ingestFromAbuseIPDB(
      90, // confidenceMinimum
      undefined, // no limit
      process.env.THREAT_INGESTION_SECRET // auth token
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Ingestion failed',
          details: result.errors,
        },
        { status: 500 }
      );
    }

    // Record the successful attempt even when every indicator was already in
    // the database. Threat row timestamps alone cannot represent sync health.
    await db.insert(systemConfig)
      .values({
        key: SYSTEM_CONFIG_KEYS.LAST_ABUSEIPDB_SYNC,
        value: true,
        description: 'Last successful AbuseIPDB sync timestamp',
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { updatedAt: new Date() },
      });

    return NextResponse.json({
      success: true,
      source: result.source,
      processed: result.processed,
      inserted: result.inserted,
      duplicates: result.duplicates,
      rateLimit: result.rateLimit,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Sync failed', message },
      { status: 500 }
    );
  }
}

// Prevent static generation
export const dynamic = 'force-dynamic';
