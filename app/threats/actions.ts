'use server';

/**
 * Server Actions for Threat Ingestion
 * 
 * Handles fetching threat data from external APIs and saving to database
 */

import { db } from '@/src/db/db';
import { threatLogs, type NewThreatLog, type ThreatLog } from '@/src/db/schema';
import { getBlacklist, checkIp } from '@/src/lib/abuseipdb';
import { desc, count } from 'drizzle-orm';
import { isIP } from 'net';
import { timingSafeEqual } from 'crypto';

const THREAT_SOURCE_ABUSEIPDB = 'AbuseIPDB';

/**
 * IPv4-mapped IPv6 address prefix
 * Used to detect IPv4 addresses in IPv6 format (e.g., ::ffff:192.0.2.1)
 */
const IPV4_MAPPED_IPV6_PREFIX = '::ffff:';

/**
 * Performs timing-safe comparison of two strings to prevent timing attacks
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function timingSafeCompare(a: string, b: string): boolean {
  // Convert strings to buffers for timing-safe comparison
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  // If lengths don't match, use dummy comparison to maintain constant time
  if (bufA.length !== bufB.length) {
    // Still perform a comparison to maintain timing consistency
    timingSafeEqual(bufA, bufA);
    return false;
  }
  
  return timingSafeEqual(bufA, bufB);
}

/**
 * Ingestion result for tracking what was processed
 */
export interface IngestionResult {
  success: boolean;
  source: string;
  processed: number;
  inserted: number;
  duplicates: number;
  errors: string[];
  rateLimit?: {
    remaining: number;
    limit: number;
  };
}

/**
 * Detect IP version from address string using Node.js net module
 * Handles IPv4-mapped IPv6 addresses (e.g., "::ffff:192.0.2.1") as IPv4
 * 
 * @param ip - The IP address string to check
 * @returns 'ipv4' or 'ipv6' based on the IP version
 */
function detectIpVersion(ip: string): 'ipv4' | 'ipv6' {
  // Check for IPv4-mapped IPv6 addresses
  if (ip.toLowerCase().startsWith(IPV4_MAPPED_IPV6_PREFIX)) {
    return 'ipv4';
  }
  
  // Use Node.js isIP for robust IP version detection
  // isIP returns 0 for invalid, 4 for IPv4, 6 for IPv6
  const ipVersion = isIP(ip);
  
  if (ipVersion === 4) {
    return 'ipv4';
  } else if (ipVersion === 6) {
    return 'ipv6';
  }
  
  // Fallback: if it contains ':', assume IPv6; otherwise, IPv4
  // This should rarely be hit if IP is valid
  return ip.includes(':') ? 'ipv6' : 'ipv4';
}

/**
 * Ingest threat data from AbuseIPDB blacklist endpoint
 * 
 * Fetches the blacklist and inserts unique indicators into the database.
 * Uses ON CONFLICT DO NOTHING for deduplication by indicator + source.
 * 
 * @param confidenceMinimum - Minimum abuse confidence score (25-100)
 * @param limit - Maximum number of IPs to fetch (optional)
 * @param authToken - Optional authentication token for authorization
 */
export async function ingestFromAbuseIPDB(
  confidenceMinimum: number = 90,
  limit?: number,
  authToken?: string
): Promise<IngestionResult> {
  // Check for authentication token if configured
  const expectedToken = process.env.THREAT_INGESTION_SECRET;
  if (expectedToken) {
    if (!authToken || !timingSafeCompare(authToken, expectedToken)) {
      return {
        success: false,
        source: THREAT_SOURCE_ABUSEIPDB,
        processed: 0,
        inserted: 0,
        duplicates: 0,
        errors: ['Unauthorized: Invalid or missing authentication token'],
      };
    }
  }
  
  const errors: string[] = [];
  let processed = 0;
  let inserted = 0;

  try {
    // Validate confidenceMinimum parameter
    if (!Number.isFinite(confidenceMinimum) || confidenceMinimum < 25 || confidenceMinimum > 100) {
      throw new RangeError('confidenceMinimum must be between 25 and 100.');
    }
    
    // Validate limit parameter if provided
    if (limit !== undefined) {
      if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
        throw new RangeError('limit must be a positive integer.');
      }
    }
    
    // Fetch blacklist from AbuseIPDB
    const { data: blacklist, rateLimit } = await getBlacklist(confidenceMinimum, limit);
    processed = blacklist.length;

    if (blacklist.length === 0) {
      return {
        success: true,
        source: THREAT_SOURCE_ABUSEIPDB,
        processed: 0,
        inserted: 0,
        duplicates: 0,
        errors: [],
        rateLimit: rateLimit ? { remaining: rateLimit.remaining, limit: rateLimit.limit } : undefined,
      };
    }

    // Prepare records for batch insert
    const records: NewThreatLog[] = blacklist.map((entry) => ({
      indicator: entry.ipAddress,
      type: detectIpVersion(entry.ipAddress),
      severity: entry.abuseConfidenceScore,
      confidenceScore: entry.abuseConfidenceScore / 100, // Normalize to 0-1
      source: THREAT_SOURCE_ABUSEIPDB,
      metadata: {
        lastReportedAt: entry.lastReportedAt,
        importedAt: new Date().toISOString(),
      },
    }));

    // Batch insert with conflict resolution for deduplication
    // This uses Drizzle's query builder to express ON CONFLICT DO NOTHING for deduplication
    const result = await db.insert(threatLogs)
      .values(records)
      .onConflictDoNothing({ target: [threatLogs.indicator, threatLogs.source] })
      .returning({ id: threatLogs.id });

    inserted = result.length;

    return {
      success: true,
      source: THREAT_SOURCE_ABUSEIPDB,
      processed,
      inserted,
      duplicates: processed - inserted,
      errors,
      rateLimit: rateLimit ? { remaining: rateLimit.remaining, limit: rateLimit.limit } : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);

    // Track duplicates even in error scenarios
    // If some records were inserted before the error, calculate duplicates
    const duplicates = inserted > 0 ? Math.max(processed - inserted, 0) : 0;

    return {
      success: false,
      source: THREAT_SOURCE_ABUSEIPDB,
      processed,
      inserted,
      duplicates,
      errors,
    };
  }
}

/**
 * Check and optionally ingest a single IP address
 * 
 * @param ipAddress - The IP address to check
 * @param autoIngest - If true, automatically save to database if abuse score > threshold
 * @param minSeverity - Minimum abuse score to auto-ingest (default 50)
 * @param authToken - Optional authentication token for authorization
 */
export async function checkAndIngestIp(
  ipAddress: string,
  autoIngest: boolean = false,
  minSeverity: number = 50,
  authToken?: string
): Promise<{
  ipData: Awaited<ReturnType<typeof checkIp>>['data'];
  ingested: boolean;
  rateLimit?: { remaining: number; limit: number };
}> {
  // Check for authentication token if auto-ingestion is enabled and token is configured
  const expectedToken = process.env.THREAT_INGESTION_SECRET;
  if (autoIngest && expectedToken) {
    if (!authToken || !timingSafeCompare(authToken, expectedToken)) {
      throw new Error('Unauthorized: Invalid or missing authentication token for threat ingestion');
    }
  }
  
  const { data, rateLimit } = await checkIp(ipAddress);
  let ingested = false;

  if (autoIngest && data.abuseConfidenceScore >= minSeverity) {
    const record: NewThreatLog = {
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
        importedAt: new Date().toISOString(),
      },
    };

    const result = await db.insert(threatLogs)
      .values(record)
      .onConflictDoNothing({ target: [threatLogs.indicator, threatLogs.source] })
      .returning({ id: threatLogs.id });

    ingested = result.length > 0;
  }

  return {
    ipData: data,
    ingested,
    rateLimit: rateLimit ? { remaining: rateLimit.remaining, limit: rateLimit.limit } : undefined,
  };
}

/**
 * Query results for threat logs
 */
export interface GetThreatsResult {
  threats: ThreatLog[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Get threat logs with pagination
 * 
 * @param limit - Maximum number of threats to return (default 50, max 100)
 * @param offset - Number of records to skip (default 0)
 */
export async function getThreats(
  limit: number = 50,
  offset: number = 0
): Promise<GetThreatsResult> {
  // Enforce limits
  const enforcedLimit = Math.max(1, Math.min(limit, 100));
  const enforcedOffset = Math.max(0, offset);

  // Fetch threats with pagination
  const [threats, totalResult] = await Promise.all([
    db.select()
      .from(threatLogs)
      .orderBy(desc(threatLogs.createdAt))
      .limit(enforcedLimit)
      .offset(enforcedOffset),
    db.select({ count: count() })
      .from(threatLogs),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    threats,
    pagination: {
      limit: enforcedLimit,
      offset: enforcedOffset,
      total,
      hasMore: enforcedOffset + threats.length < total,
    },
  };
}
