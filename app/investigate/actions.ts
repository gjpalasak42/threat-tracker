'use server';

/**
 * Investigate Server Action
 * 
 * Wrapper around the AbuseIPDB check endpoint for IP investigation.
 * Uses database as cache to minimize API calls.
 * 
 * SECURITY: Requires API_USER or ADMIN role for external API calls.
 * Cache-only lookups require STANDARD_USER or higher.
 */

import { checkIp } from '@/src/lib/abuseipdb';
import { getIndicatorGeneral } from '@/src/lib/otx';
import { calculateUnifiedRisk, type UnifiedRiskResult } from '@/src/lib/deconfliction';
import { withAuditLog } from '@/src/lib/audit-logger';
import { db } from '@/src/db/db';
import { 
  threatLogs, 
  type ThreatLog, 
  type SourcesData,
  type AbuseIPDBSourceData,
  type OTXSourceData,
  KILL_SWITCH_KEYS 
} from '@/src/db/schema';
import { eq, and } from 'drizzle-orm';
import { isIP } from 'net';
import { 
  requireRole, 
  requireRoleAndFeature,
  getSession,
  hasPermission,
} from '@/src/lib/auth-guards';

const THREAT_SOURCE_ABUSEIPDB = 'AbuseIPDB';
const THREAT_SOURCE_OTX = 'OTX';

/**
 * Check if the current user has API access (API_USER or ADMIN)
 * Used to conditionally show/hide UI elements
 */
export async function getUserApiAccess(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session?.user?.role) return false;
    return hasPermission(session.user.role, 'API_USER');
  } catch (error) {
    console.error('Failed to retrieve session in getUserApiAccess', error);
    return false;
  }
}

export interface InvestigateResult {
  success: boolean;
  fromCache: boolean;
  cachedAt?: string;
  data?: {
    ipAddress: string;
    abuseConfidenceScore: number;
    countryCode: string;
    countryName: string;
    isp: string;
    domain: string;
    isTor: boolean;
    totalReports: number;
    lastReportedAt: string | null;
    isWhitelisted: boolean | null;
    usageType: string;
  };
  // Multi-source data
  sourcesData?: SourcesData;
  unifiedRisk?: UnifiedRiskResult;
  error?: string;
  code?: number;
  rateLimit?: {
    remaining: number;
    limit: number;
  };
}

/**
 * Detect IP version from address string
 */
function detectIpVersion(ip: string): 'ipv4' | 'ipv6' {
  const ipVersion = isIP(ip);
  if (ipVersion === 4) return 'ipv4';
  if (ipVersion === 6) return 'ipv6';
  return ip.includes(':') ? 'ipv6' : 'ipv4';
}

/**
 * Convert cached threat log to investigate result data
 */
function threatLogToResultData(log: ThreatLog): InvestigateResult['data'] {
  const metadata = log.metadata as Record<string, unknown> || {};
  return {
    ipAddress: log.indicator,
    abuseConfidenceScore: log.severity,
    countryCode: (metadata.countryCode as string) || 'Unknown',
    countryName: (metadata.countryName as string) || 'Unknown',
    isp: (metadata.isp as string) || '',
    domain: (metadata.domain as string) || '',
    isTor: (metadata.isTor as boolean) || false,
    totalReports: (metadata.totalReports as number) || 0,
    lastReportedAt: (metadata.lastReportedAt as string) || null,
    isWhitelisted: (metadata.isWhitelisted as boolean) || null,
    usageType: (metadata.usageType as string) || '',
  };
}

/**
 * Investigate an IP address
 * 
 * SECURITY:
 * - Cache lookups: Require STANDARD_USER or higher
 * - External API calls (forceRefresh=true): Require API_USER or higher
 * - Respects EXTERNAL_API_ENABLED kill switch
 * 
 * @param ipAddress - The IP address to investigate
 * @param forceRefresh - If true, bypass cache and fetch from API (requires API_USER role)
 */
export async function investigateIp(
  ipAddress: string,
  forceRefresh: boolean = false
): Promise<InvestigateResult> {
  // Determine required role: API_USER for external API calls, STANDARD_USER for cache
  const requiredRole = forceRefresh ? 'API_USER' : 'STANDARD_USER';
  
  // Check authentication and role
  const authResult = await requireRole(requiredRole);
  if ('error' in authResult) {
    return {
      success: false,
      fromCache: false,
      error: authResult.error,
      code: authResult.code,
    };
  }

  // If forcing refresh (external API call), check kill switch
  if (forceRefresh) {
    const killSwitchResult = await requireRoleAndFeature('API_USER', KILL_SWITCH_KEYS.EXTERNAL_API_ENABLED);
    if ('error' in killSwitchResult) {
      return {
        success: false,
        fromCache: false,
        error: 'code' in killSwitchResult && killSwitchResult.code === 503
          ? 'External API queries are currently disabled'
          : killSwitchResult.error,
        code: killSwitchResult.code,
      };
    }
  }

  // Validate IP address
  if (!ipAddress || typeof ipAddress !== 'string') {
    return {
      success: false,
      fromCache: false,
      error: 'Please enter an IP address',
    };
  }

  const trimmedIp = ipAddress.trim();

  if (isIP(trimmedIp) === 0) {
    return {
      success: false,
      fromCache: false,
      error: 'Invalid IP address format',
    };
  }

  // Check cache first (unless force refresh is requested)
  if (!forceRefresh) {
    try {
      const cached = await db.select()
        .from(threatLogs)
        .where(
          and(
            eq(threatLogs.indicator, trimmedIp),
            eq(threatLogs.source, THREAT_SOURCE_ABUSEIPDB)
          )
        )
        .limit(1);

      if (cached.length > 0) {
        return {
          success: true,
          fromCache: true,
          cachedAt: cached[0].createdAt.toISOString(),
          data: threatLogToResultData(cached[0]),
        };
      }
      
      // IP not found in cache - check if user has API access
      // STANDARD_USER can only access cached data, not trigger new API calls
      const userRole = authResult.session.user.role;
      if (userRole === 'STANDARD_USER') {
        console.warn('Authorization denied: STANDARD_USER attempted uncached IP lookup requiring API access.');
        return {
          success: false,
          fromCache: false,
          error: 'Unable to retrieve information for this IP address.',
          code: 403,
        };
      }
    } catch (error) {
      // If cache lookup fails, continue to API call (for API_USER/ADMIN)
      console.error('Cache lookup failed:', error);
      
      // But if user is STANDARD_USER, don't fall back to API
      const userRole = authResult.session.user.role;
      if (userRole === 'STANDARD_USER') {
        return {
          success: false,
          fromCache: false,
          error: 'Database query failed. Please try again later.',
          code: 500,
        };
      }
    }
  }

  // Fetch from API
  try {
    const { data, rateLimit } = await checkIp(trimmedIp);

    // Save to database for future cache hits
    try {
      await db.insert(threatLogs)
        .values({
          indicator: data.ipAddress,
          type: detectIpVersion(data.ipAddress),
          severity: data.abuseConfidenceScore,
          confidenceScore: data.abuseConfidenceScore / 100,
          source: THREAT_SOURCE_ABUSEIPDB,
          metadata: {
            countryCode: data.countryCode,
            countryName: data.countryName,
            isp: data.isp,
            domain: data.domain,
            isTor: data.isTor,
            usageType: data.usageType,
            totalReports: data.totalReports,
            lastReportedAt: data.lastReportedAt,
            isWhitelisted: data.isWhitelisted,
            importedAt: new Date().toISOString(),
          },
        })
        .onConflictDoUpdate({
          target: [threatLogs.indicator, threatLogs.source],
          set: {
            severity: data.abuseConfidenceScore,
            confidenceScore: data.abuseConfidenceScore / 100,
            metadata: {
              countryCode: data.countryCode,
              countryName: data.countryName,
              isp: data.isp,
              domain: data.domain,
              isTor: data.isTor,
              usageType: data.usageType,
              totalReports: data.totalReports,
              lastReportedAt: data.lastReportedAt,
              isWhitelisted: data.isWhitelisted,
              updatedAt: new Date().toISOString(),
            },
          },
        });
    } catch (dbError) {
      // Log but don't fail the request if caching fails
      console.error('Failed to cache IP data:', dbError);
    }

    return {
      success: true,
      fromCache: false,
      data: {
        ipAddress: data.ipAddress,
        abuseConfidenceScore: data.abuseConfidenceScore,
        countryCode: data.countryCode,
        countryName: data.countryName,
        isp: data.isp,
        domain: data.domain,
        isTor: data.isTor,
        totalReports: data.totalReports,
        lastReportedAt: data.lastReportedAt,
        isWhitelisted: data.isWhitelisted,
        usageType: data.usageType,
      },
      rateLimit: rateLimit 
        ? { remaining: rateLimit.remaining, limit: rateLimit.limit }
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      fromCache: false,
      error: message,
    };
  }
}

/**
 * Investigate an IP address using multiple sources (AbuseIPDB + OTX)
 * 
 * SECURITY:
 * - Requires API_USER or higher for external API calls
 * - Respects kill switches for each source
 * 
 * @param ipAddress - The IP address to investigate
 * @param userId - Optional user ID for audit logging
 */
export async function investigateIpMultiSource(
  ipAddress: string,
  userId?: string
): Promise<InvestigateResult> {
  // Require API_USER for multi-source lookups
  const authResult = await requireRole('API_USER');
  if ('error' in authResult) {
    return {
      success: false,
      fromCache: false,
      error: authResult.error,
      code: authResult.code,
    };
  }

  // Check kill switch for external APIs
  const killSwitchResult = await requireRoleAndFeature('API_USER', KILL_SWITCH_KEYS.EXTERNAL_API_ENABLED);
  if ('error' in killSwitchResult) {
    return {
      success: false,
      fromCache: false,
      error: 'External API queries are currently disabled',
      code: 503,
    };
  }

  // Validate IP address
  if (!ipAddress || typeof ipAddress !== 'string') {
    return {
      success: false,
      fromCache: false,
      error: 'Please enter an IP address',
    };
  }

  const trimmedIp = ipAddress.trim();
  const ipVersion = isIP(trimmedIp);

  if (ipVersion === 0) {
    return {
      success: false,
      fromCache: false,
      error: 'Invalid IP address format',
    };
  }

  const effectiveUserId = userId || authResult.session.user.id;
  const sourcesData: SourcesData = {};
  let abuseData: Awaited<ReturnType<typeof checkIp>>['data'] | null = null;

  // Fetch from AbuseIPDB
  try {
    const result = await withAuditLog(
      'AbuseIPDB',
      '/check',
      trimmedIp,
      effectiveUserId,
      () => checkIp(trimmedIp)
    );
    abuseData = result.data;

    const abuseSourceData: AbuseIPDBSourceData = {
      confidence: result.data.abuseConfidenceScore,
      reports: result.data.totalReports,
      lastReported: result.data.lastReportedAt,
      countryCode: result.data.countryCode,
      countryName: result.data.countryName,
      isp: result.data.isp,
      domain: result.data.domain,
      isTor: result.data.isTor,
      usageType: result.data.usageType,
      isWhitelisted: result.data.isWhitelisted,
      fetchedAt: new Date().toISOString(),
    };
    sourcesData.abuseipdb = abuseSourceData;
  } catch (error) {
    console.error('AbuseIPDB lookup failed:', error);
    // Continue with OTX lookup even if AbuseIPDB fails
  }

  // Fetch from OTX
  try {
    const otxType = ipVersion === 4 ? 'IPv4' : 'IPv6';
    const result = await withAuditLog(
      'OTX',
      '/indicators/general',
      trimmedIp,
      effectiveUserId,
      () => getIndicatorGeneral(otxType, trimmedIp)
    );

    const otxSourceData: OTXSourceData = {
      pulseCount: result.data.pulse_info?.count || 0,
      pulses: (result.data.pulse_info?.pulses || []).slice(0, 10).map(p => ({
        id: p.id,
        name: p.name,
        author: p.author_name,
        tags: p.tags,
        created: p.created,
      })),
      references: result.data.pulse_info?.references || [],
      countryCode: result.data.country_code,
      countryName: result.data.country_name,
      reputation: result.data.reputation,
      fetchedAt: new Date().toISOString(),
    };
    sourcesData.otx = otxSourceData;
  } catch (error) {
    console.error('OTX lookup failed:', error);
    // Continue even if OTX fails
  }

  // Calculate unified risk score
  const unifiedRisk = calculateUnifiedRisk({
    abuseScore: sourcesData.abuseipdb?.confidence,
    otxPulseCount: sourcesData.otx?.pulseCount,
  });

  // Store/update in database
  try {
    const ipType = ipVersion === 4 ? 'ipv4' : 'ipv6';
    const severity = abuseData?.abuseConfidenceScore || unifiedRisk.score;

    await db.insert(threatLogs)
      .values({
        indicator: trimmedIp,
        type: ipType,
        severity,
        confidenceScore: severity / 100,
        unifiedRiskScore: unifiedRisk.score,
        source: abuseData ? THREAT_SOURCE_ABUSEIPDB : THREAT_SOURCE_OTX,
        sourcesData,
        metadata: abuseData ? {
          countryCode: abuseData.countryCode,
          countryName: abuseData.countryName,
          isp: abuseData.isp,
          domain: abuseData.domain,
          isTor: abuseData.isTor,
          usageType: abuseData.usageType,
          totalReports: abuseData.totalReports,
          lastReportedAt: abuseData.lastReportedAt,
          isWhitelisted: abuseData.isWhitelisted,
          importedAt: new Date().toISOString(),
        } : {},
      })
      .onConflictDoUpdate({
        target: [threatLogs.indicator, threatLogs.source],
        set: {
          severity,
          confidenceScore: severity / 100,
          unifiedRiskScore: unifiedRisk.score,
          sourcesData,
          updatedAt: new Date(),
        },
      });
  } catch (dbError) {
    console.error('Failed to store multi-source data:', dbError);
  }

  // Build response
  const responseData = abuseData ? {
    ipAddress: abuseData.ipAddress,
    abuseConfidenceScore: abuseData.abuseConfidenceScore,
    countryCode: abuseData.countryCode,
    countryName: abuseData.countryName,
    isp: abuseData.isp,
    domain: abuseData.domain,
    isTor: abuseData.isTor,
    totalReports: abuseData.totalReports,
    lastReportedAt: abuseData.lastReportedAt,
    isWhitelisted: abuseData.isWhitelisted,
    usageType: abuseData.usageType,
  } : {
    ipAddress: trimmedIp,
    abuseConfidenceScore: 0,
    countryCode: sourcesData.otx?.countryCode || 'Unknown',
    countryName: sourcesData.otx?.countryName || 'Unknown',
    isp: '',
    domain: '',
    isTor: false,
    totalReports: 0,
    lastReportedAt: null,
    isWhitelisted: null,
    usageType: '',
  };

  return {
    success: true,
    fromCache: false,
    data: responseData,
    sourcesData,
    unifiedRisk,
  };
}

/**
 * Get OTX data for an indicator from the database
 */
export async function getOtxDataFromCache(
  indicator: string
): Promise<OTXSourceData | null> {
  try {
    const result = await db.select({ sourcesData: threatLogs.sourcesData })
      .from(threatLogs)
      .where(eq(threatLogs.indicator, indicator))
      .limit(1);

    if (result.length > 0 && result[0].sourcesData) {
      return (result[0].sourcesData as SourcesData).otx || null;
    }
    return null;
  } catch {
    return null;
  }
}

