import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/db/db';
import { threatLogs, systemConfig, SYSTEM_CONFIG_KEYS, type SourcesData, type OTXSourceData } from '@/src/db/schema';
import { getSubscribedPulses, mapOTXTypeToInternal, type OTXPulseWithIndicators } from '@/src/lib/otx';
import { calculateUnifiedRisk } from '@/src/lib/deconfliction';
import { logApiCall } from '@/src/lib/audit-logger';
import { eq, and } from 'drizzle-orm';
import { isConfiguredApiKey } from '@/src/lib/sync-status';

/**
 * OTX Sync Endpoint for Cron Job
 * 
 * POST /api/sync/otx
 * 
 * Triggers ingestion from AlienVault OTX subscribed pulses.
 * Protected by CRON_SECRET authorization.
 * Designed to run every 4 hours to respect OTX's 10,000/hr rate limit.
 */

const THREAT_SOURCE_OTX = 'OTX';
const MAX_PAGES = 10; // Limit pages to process per sync
const PULSES_PER_PAGE = 50;

interface SyncResult {
  success: boolean;
  pulsesProcessed: number;
  indicatorsProcessed: number;
  indicatorsInserted: number;
  indicatorsUpdated: number;
  errors: string[];
}

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

  // Check if OTX API key is configured
  if (!isConfiguredApiKey(process.env.OTX_API_KEY)) {
    return NextResponse.json(
      { error: 'OTX_API_KEY not configured' },
      { status: 500 }
    );
  }

  const startTime = Date.now();
  const result: SyncResult = {
    success: true,
    pulsesProcessed: 0,
    indicatorsProcessed: 0,
    indicatorsInserted: 0,
    indicatorsUpdated: 0,
    errors: [],
  };

  try {
    const lastSyncResult = await db.select({ lastSync: systemConfig.updatedAt })
      .from(systemConfig)
      .where(eq(systemConfig.key, SYSTEM_CONFIG_KEYS.LAST_OTX_SYNC))
      .limit(1);
    const modifiedSince = lastSyncResult[0]?.lastSync?.toISOString();

    // Fetch subscribed pulses with pagination
    let page = 1;
    let hasMore = true;
    const allPulses: OTXPulseWithIndicators[] = [];

    while (hasMore && page <= MAX_PAGES) {
      try {
        const { data } = await getSubscribedPulses(page, PULSES_PER_PAGE, modifiedSince);
        allPulses.push(...data.results);
        
        // Log API call
        await logApiCall({
          apiSource: 'OTX',
          endpoint: '/pulses/subscribed',
          responseCode: 200,
          responseTime: Date.now() - startTime,
          success: true,
        });

        hasMore = data.next !== null;
        page++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Page ${page}: ${errorMessage}`);
        result.success = false;
        
        await logApiCall({
          apiSource: 'OTX',
          endpoint: '/pulses/subscribed',
          success: false,
          errorMessage,
        });
        
        break;
      }
    }

    result.pulsesProcessed = allPulses.length;

    // Process indicators from all pulses
    for (const pulse of allPulses) {
      for (const indicator of pulse.indicators || []) {
        result.indicatorsProcessed++;
        
        const internalType = mapOTXTypeToInternal(indicator.type);
        
        // Skip unsupported indicator types
        if (internalType === 'unknown') {
          continue;
        }

        const otxData: OTXSourceData = {
          pulseCount: 1,
          pulses: [{
            id: pulse.id,
            name: pulse.name,
            author: pulse.author_name,
            tags: pulse.tags,
            created: pulse.created,
          }],
          references: pulse.references || [],
          fetchedAt: new Date().toISOString(),
        };

        try {
          // Check if indicator already exists from OTX source
          const existing = await db.select()
            .from(threatLogs)
            .where(
              and(
                eq(threatLogs.indicator, indicator.indicator),
                eq(threatLogs.source, THREAT_SOURCE_OTX)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            // Update existing - merge pulse data
            const existingSourcesData = (existing[0].sourcesData || {}) as SourcesData;
            const existingOtx = existingSourcesData.otx || { pulseCount: 0, pulses: [], references: [], fetchedAt: '' };
            
            // Add pulse if not already present
            const pulseExists = existingOtx.pulses.some(p => p.id === pulse.id);
            if (!pulseExists) {
              existingOtx.pulses.push(otxData.pulses[0]);
              existingOtx.pulseCount = existingOtx.pulses.length;
              existingOtx.fetchedAt = otxData.fetchedAt;
              
              // Merge references
              const allRefs = new Set([...existingOtx.references, ...otxData.references]);
              existingOtx.references = Array.from(allRefs);

              // Recalculate unified risk
              const unifiedRisk = calculateUnifiedRisk({
                abuseScore: existingSourcesData.abuseipdb?.confidence,
                otxPulseCount: existingOtx.pulseCount,
              });

              await db.update(threatLogs)
                .set({
                  sourcesData: { ...existingSourcesData, otx: existingOtx },
                  unifiedRiskScore: unifiedRisk.score,
                  updatedAt: new Date(),
                })
                .where(eq(threatLogs.id, existing[0].id));

              result.indicatorsUpdated++;
            }
          } else {
            // Insert new indicator
            const unifiedRisk = calculateUnifiedRisk({
              otxPulseCount: 1,
            });

            const insertResult = await db.insert(threatLogs)
              .values({
                indicator: indicator.indicator,
                type: internalType,
                severity: unifiedRisk.score, // Use unified score as severity for OTX-only
                confidenceScore: unifiedRisk.score / 100,
                unifiedRiskScore: unifiedRisk.score,
                source: THREAT_SOURCE_OTX,
                sourcesData: { otx: otxData },
                metadata: {
                  pulseId: pulse.id,
                  pulseName: pulse.name,
                  importedAt: new Date().toISOString(),
                },
              })
              .onConflictDoNothing({ target: [threatLogs.indicator, threatLogs.source] })
              .returning({ id: threatLogs.id });

            result.indicatorsInserted += insertResult.length;
          }
        } catch (dbError) {
          const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
          result.errors.push(`Indicator ${indicator.indicator}: ${errorMessage}`);
          result.success = false;
        }
      }
    }

    if (result.success) {
      await db.insert(systemConfig)
        .values({
          key: SYSTEM_CONFIG_KEYS.LAST_OTX_SYNC,
          value: true, // Using value field, actual timestamp is in updatedAt
          description: 'Last successful OTX sync timestamp',
        })
        .onConflictDoUpdate({
          target: systemConfig.key,
          set: {
            updatedAt: new Date(),
          },
        });
    }

    return NextResponse.json({
      ...result,
      modifiedSince,
      syncedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    }, { status: result.success ? 200 : 502 });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.success = false;
    result.errors.push(message);

    return NextResponse.json(
      { ...result, error: 'Sync failed', message },
      { status: 500 }
    );
  }
}

// Prevent static generation
export const dynamic = 'force-dynamic';
