'use server';

/**
 * Admin Server Actions
 * 
 * Server actions for user management and system configuration.
 * All actions require ADMIN role.
 */

import { db } from '@/src/db/db';
import { users, systemConfig, threatLogs, KILL_SWITCH_KEYS, type UserRole, SYSTEM_CONFIG_KEYS } from '@/src/db/schema';
import { requireRole } from '@/src/lib/auth-guards';
import { eq, desc, max, count } from 'drizzle-orm';
import { ingestFromAbuseIPDB } from '@/app/threats/actions';
import { getSubscribedPulses, mapOTXTypeToInternal, type OTXPulseWithIndicators } from '@/src/lib/otx';
import { calculateUnifiedRisk } from '@/src/lib/deconfliction';
import { logApiCall } from '@/src/lib/audit-logger';
import type { SourcesData, OTXSourceData } from '@/src/db/schema';

export interface UserListItem {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AdminActionResult {
  success: boolean;
  error?: string;
}

export interface SystemConfigItem {
  key: string;
  value: boolean;
  description: string | null;
}

export interface SyncStatusInfo {
  source: 'AbuseIPDB' | 'OTX';
  enabled: boolean;
  lastSync: string | null;
  indicatorCount: number;
}

export interface TriggerSyncResult {
  success: boolean;
  source: string;
  processed?: number;
  inserted?: number;
  updated?: number;
  errors?: string[];
  error?: string;
}

/**
 * Get all users for admin management
 */
export async function getAllUsers(): Promise<
  { success: true; users: UserListItem[] } | { success: false; error: string; code: number }
> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error, code: authResult.code };
  }

  try {
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
      .from(users)
      .orderBy(desc(users.createdAt));

    return {
      success: true,
      users: allUsers.map(u => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return { success: false, error: 'Failed to fetch users', code: 500 };
  }
}

/**
 * Update a user's role
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<AdminActionResult> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error };
  }

  const currentUserId = authResult.session.user.id;

  // Prevent self-demotion from ADMIN
  if (userId === currentUserId && newRole !== 'ADMIN') {
    return { success: false, error: 'Cannot demote yourself from ADMIN role' };
  }

  // Validate role
  const validRoles: UserRole[] = ['ADMIN', 'API_USER', 'STANDARD_USER'];
  if (!validRoles.includes(newRole)) {
    return { success: false, error: 'Invalid role specified' };
  }

  try {
    await db.update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error('Failed to update user role:', error);
    return { success: false, error: 'Failed to update user role' };
  }
}

/**
 * Toggle user active status
 */
export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<AdminActionResult> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error };
  }

  const currentUserId = authResult.session.user.id;

  // Prevent self-deactivation
  if (userId === currentUserId && !isActive) {
    return { success: false, error: 'Cannot deactivate your own account' };
  }

  try {
    await db.update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error('Failed to toggle user status:', error);
    return { success: false, error: 'Failed to update user status' };
  }
}

/**
 * Get all system configuration (kill switches)
 */
export async function getSystemConfig(): Promise<
  { success: true; config: SystemConfigItem[] } | { success: false; error: string; code: number }
> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error, code: authResult.code };
  }

  try {
    const config = await db.select({
      key: systemConfig.key,
      value: systemConfig.value,
      description: systemConfig.description,
    }).from(systemConfig);

    // Ensure all kill switch keys exist with defaults
    const defaultConfigs: SystemConfigItem[] = [
      { key: KILL_SWITCH_KEYS.REGISTRATION_ENABLED, value: true, description: 'Allow new user registrations' },
      { key: KILL_SWITCH_KEYS.EXTERNAL_API_ENABLED, value: true, description: 'Allow external API queries (AbuseIPDB)' },
      { key: KILL_SWITCH_KEYS.DATABASE_SEARCH_ENABLED, value: true, description: 'Allow local database searches' },
      { key: KILL_SWITCH_KEYS.OTX_SYNC_ENABLED, value: true, description: 'Allow AlienVault OTX sync and queries' },
    ];

    // Merge existing config with defaults
    const mergedConfig = defaultConfigs.map(defaultItem => {
      const existing = config.find(c => c.key === defaultItem.key);
      return existing || defaultItem;
    });

    return { success: true, config: mergedConfig };
  } catch (error) {
    console.error('Failed to fetch system config:', error);
    return { success: false, error: 'Failed to fetch system configuration', code: 500 };
  }
}

/**
 * Update a kill switch value
 */
export async function updateKillSwitch(
  key: string,
  value: boolean
): Promise<AdminActionResult> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error };
  }

  // Validate key
  const validKeys = Object.values(KILL_SWITCH_KEYS);
  if (!validKeys.includes(key as typeof validKeys[number])) {
    return { success: false, error: 'Invalid configuration key' };
  }

  try {
    // Upsert the config
    await db.insert(systemConfig)
      .values({
        key,
        value,
        description: getKillSwitchDescription(key),
        updatedBy: authResult.session.user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value,
          updatedBy: authResult.session.user.id,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (error) {
    console.error('Failed to update kill switch:', error);
    return { success: false, error: 'Failed to update configuration' };
  }
}

function getKillSwitchDescription(key: string): string {
  switch (key) {
    case KILL_SWITCH_KEYS.REGISTRATION_ENABLED:
      return 'Allow new user registrations';
    case KILL_SWITCH_KEYS.EXTERNAL_API_ENABLED:
      return 'Allow external API queries (AbuseIPDB)';
    case KILL_SWITCH_KEYS.DATABASE_SEARCH_ENABLED:
      return 'Allow local database searches';
    case KILL_SWITCH_KEYS.OTX_SYNC_ENABLED:
      return 'Allow AlienVault OTX sync and queries';
    default:
      return '';
  }
}

/**
 * Get sync status for threat intelligence sources
 */
export async function getThreatIntelStatus(): Promise<
  { success: true; sources: SyncStatusInfo[] } | { success: false; error: string }
> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error };
  }

  try {
    // Get last sync times from config
    const configs = await db.select()
      .from(systemConfig)
      .where(eq(systemConfig.key, SYSTEM_CONFIG_KEYS.LAST_OTX_SYNC));

    const otxLastSync = configs.find(c => c.key === SYSTEM_CONFIG_KEYS.LAST_OTX_SYNC);

    // Get indicator counts by source
    const abuseipdbCount = await db.select({ value: count() })
      .from(threatLogs)
      .where(eq(threatLogs.source, 'AbuseIPDB'));

    const otxCount = await db.select({ value: count() })
      .from(threatLogs)
      .where(eq(threatLogs.source, 'OTX'));

    // Get last AbuseIPDB sync from threat_logs
    const abuseipdbLastSync = await db.select({ value: max(threatLogs.createdAt) })
      .from(threatLogs)
      .where(eq(threatLogs.source, 'AbuseIPDB'));

    const sources: SyncStatusInfo[] = [
      {
        source: 'AbuseIPDB',
        enabled: !!process.env.ABUSEIPDB_API_KEY,
        lastSync: abuseipdbLastSync[0]?.value?.toISOString() ?? null,
        indicatorCount: Number(abuseipdbCount[0]?.value ?? 0),
      },
      {
        source: 'OTX',
        enabled: !!process.env.OTX_API_KEY,
        lastSync: otxLastSync?.updatedAt?.toISOString() ?? null,
        indicatorCount: Number(otxCount[0]?.value ?? 0),
      },
    ];

    return { success: true, sources };
  } catch (error) {
    console.error('Failed to get threat intel status:', error);
    return { success: false, error: 'Failed to get sync status' };
  }
}

/**
 * Trigger manual AbuseIPDB bulk sync
 */
export async function triggerAbuseIPDBSync(): Promise<TriggerSyncResult> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, source: 'AbuseIPDB', error: authResult.error };
  }

  if (!process.env.ABUSEIPDB_API_KEY) {
    return { success: false, source: 'AbuseIPDB', error: 'ABUSEIPDB_API_KEY not configured' };
  }

  try {
    const result = await ingestFromAbuseIPDB(
      90, // confidenceMinimum
      undefined, // no limit
      process.env.THREAT_INGESTION_SECRET
    );

    // Update last sync timestamp
    await db.insert(systemConfig)
      .values({
        key: SYSTEM_CONFIG_KEYS.LAST_ABUSEIPDB_SYNC,
        value: true,
        description: 'Last AbuseIPDB sync timestamp',
        updatedBy: authResult.session.user.id,
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { updatedAt: new Date(), updatedBy: authResult.session.user.id },
      });

    return {
      success: result.success,
      source: 'AbuseIPDB',
      processed: result.processed,
      inserted: result.inserted,
      errors: result.errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, source: 'AbuseIPDB', error: message };
  }
}

/**
 * Trigger manual OTX bulk sync
 */
export async function triggerOTXSync(): Promise<TriggerSyncResult> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, source: 'OTX', error: authResult.error };
  }

  if (!process.env.OTX_API_KEY) {
    return { success: false, source: 'OTX', error: 'OTX_API_KEY not configured' };
  }

  const THREAT_SOURCE_OTX = 'OTX';
  const MAX_PAGES = 5; // Limit for manual sync
  const PULSES_PER_PAGE = 50;

  let indicatorsProcessed = 0;
  let indicatorsInserted = 0;
  let indicatorsUpdated = 0;
  const errors: string[] = [];

  try {
    // Fetch subscribed pulses
    let page = 1;
    let hasMore = true;
    const allPulses: OTXPulseWithIndicators[] = [];

    while (hasMore && page <= MAX_PAGES) {
      try {
        const { data } = await getSubscribedPulses(page, PULSES_PER_PAGE);
        allPulses.push(...data.results);
        
        await logApiCall({
          userId: authResult.session.user.id,
          apiSource: 'OTX',
          endpoint: '/pulses/subscribed',
          responseCode: 200,
          success: true,
        });

        hasMore = data.next !== null;
        page++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Page ${page}: ${errorMessage}`);
        break;
      }
    }

    // Process indicators
    for (const pulse of allPulses) {
      for (const indicator of pulse.indicators || []) {
        indicatorsProcessed++;
        
        const internalType = mapOTXTypeToInternal(indicator.type);
        if (internalType === 'unknown') continue;

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
          const existing = await db.select()
            .from(threatLogs)
            .where(eq(threatLogs.indicator, indicator.indicator))
            .limit(1);

          if (existing.length > 0) {
            const existingSourcesData = (existing[0].sourcesData || {}) as SourcesData;
            const existingOtx = existingSourcesData.otx || { pulseCount: 0, pulses: [], references: [], fetchedAt: '' };
            
            const pulseExists = existingOtx.pulses.some(p => p.id === pulse.id);
            if (!pulseExists) {
              existingOtx.pulses.push(otxData.pulses[0]);
              existingOtx.pulseCount = existingOtx.pulses.length;
              existingOtx.fetchedAt = otxData.fetchedAt;

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

              indicatorsUpdated++;
            }
          } else {
            const unifiedRisk = calculateUnifiedRisk({ otxPulseCount: 1 });

            await db.insert(threatLogs)
              .values({
                indicator: indicator.indicator,
                type: internalType,
                severity: unifiedRisk.score,
                confidenceScore: unifiedRisk.score / 100,
                unifiedRiskScore: unifiedRisk.score,
                source: THREAT_SOURCE_OTX,
                sourcesData: { otx: otxData },
                metadata: { pulseId: pulse.id, pulseName: pulse.name },
              })
              .onConflictDoNothing();

            indicatorsInserted++;
          }
        } catch {
          // Skip individual indicator errors
        }
      }
    }

    // Update last sync timestamp
    await db.insert(systemConfig)
      .values({
        key: SYSTEM_CONFIG_KEYS.LAST_OTX_SYNC,
        value: true,
        description: 'Last OTX sync timestamp',
        updatedBy: authResult.session.user.id,
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { updatedAt: new Date(), updatedBy: authResult.session.user.id },
      });

    return {
      success: true,
      source: 'OTX',
      processed: indicatorsProcessed,
      inserted: indicatorsInserted,
      updated: indicatorsUpdated,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, source: 'OTX', error: message };
  }
}

// =============================================================================
// Account Lockout Management
// =============================================================================

import { 
  getLockedAccounts as getRateLimitLockedAccounts, 
  unlockAccount as rateLimitUnlockAccount,
  type AccountLockoutInfo,
} from '@/src/lib/rate-limiter';

// Re-export the type for admin page
export type { AccountLockoutInfo };

/**
 * Get all currently locked accounts (admin only)
 */
export async function getLockedAccountsAdmin(): Promise<
  { success: true; lockouts: AccountLockoutInfo[] } | { success: false; error: string }
> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error };
  }

  try {
    const lockouts = await getRateLimitLockedAccounts();
    return { success: true, lockouts };
  } catch (error) {
    console.error('Failed to get locked accounts:', error);
    return { success: false, error: 'Failed to fetch locked accounts' };
  }
}

/**
 * Unlock a locked account (admin only)
 */
export async function unlockAccountAdmin(email: string): Promise<AdminActionResult> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error };
  }

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return { success: false, error: 'Invalid email provided' };
  }

  try {
    const result = await rateLimitUnlockAccount(email, authResult.session.user.id);
    return result;
  } catch (error) {
    console.error('Failed to unlock account:', error);
    return { success: false, error: 'Failed to unlock account' };
  }
}
