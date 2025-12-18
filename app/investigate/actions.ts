'use server';

/**
 * Investigate Server Action
 * 
 * Wrapper around the AbuseIPDB check endpoint for IP investigation
 */

import { checkIp } from '@/src/lib/abuseipdb';
import { isIP } from 'net';

export interface InvestigateResult {
  success: boolean;
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
  error?: string;
  rateLimit?: {
    remaining: number;
    limit: number;
  };
}

/**
 * Investigate an IP address using AbuseIPDB
 */
export async function investigateIp(ipAddress: string): Promise<InvestigateResult> {
  // Validate IP address
  if (!ipAddress || typeof ipAddress !== 'string') {
    return {
      success: false,
      error: 'Please enter an IP address',
    };
  }

  const trimmedIp = ipAddress.trim();

  if (isIP(trimmedIp) === 0) {
    return {
      success: false,
      error: 'Invalid IP address format',
    };
  }

  try {
    const { data, rateLimit } = await checkIp(trimmedIp);

    return {
      success: true,
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
      error: message,
    };
  }
}
