import { NextRequest, NextResponse } from 'next/server';
import { ingestFromAbuseIPDB } from '@/app/threats/actions';
import { db } from '@/src/db/db';
import { threatLogs } from '@/src/db/schema';
import { max, sql } from 'drizzle-orm';

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

  // Check last sync time to enforce rate limiting
  const lastSyncResult = await db
    .select({ lastSync: max(threatLogs.createdAt) })
    .from(threatLogs);

  const lastSyncTime = lastSyncResult[0]?.lastSync;

  if (lastSyncTime) {
    const timeSinceLastSync = Date.now() - new Date(lastSyncTime).getTime();
    
    if (timeSinceLastSync < MIN_SYNC_INTERVAL_MS) {
      const hoursRemaining = Math.ceil((MIN_SYNC_INTERVAL_MS - timeSinceLastSync) / (60 * 60 * 1000));
      return NextResponse.json(
        { 
          error: 'Rate limit: Sync too recent',
          message: `Please wait ${hoursRemaining} more hours before next sync`,
          lastSyncTime: lastSyncTime.toISOString(),
        },
        { status: 429 }
      );
    }
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
