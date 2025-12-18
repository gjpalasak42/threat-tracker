/**
 * AbuseIPDB API Client
 * 
 * Provides methods for interacting with the AbuseIPDB API v2
 * @see https://docs.abuseipdb.com/
 */

const ABUSEIPDB_BASE_URL = 'https://api.abuseipdb.com/api/v2';

/**
 * AbuseIPDB CHECK endpoint response
 */
export interface AbuseIPDBCheckResponse {
  data: {
    ipAddress: string;
    isPublic: boolean;
    ipVersion: 4 | 6;
    isWhitelisted: boolean | null;
    abuseConfidenceScore: number;
    countryCode: string;
    countryName: string;
    usageType: string;
    isp: string;
    domain: string;
    hostnames: string[];
    isTor: boolean;
    totalReports: number;
    numDistinctUsers: number;
    lastReportedAt: string | null;
  };
}

/**
 * AbuseIPDB BLACKLIST endpoint response
 */
export interface AbuseIPDBBlacklistResponse {
  meta: {
    generatedAt: string;
  };
  data: Array<{
    ipAddress: string;
    abuseConfidenceScore: number;
    lastReportedAt: string;
  }>;
}

/**
 * Rate limit information from response headers
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

/**
 * API error structure
 */
export interface AbuseIPDBError {
  errors: Array<{
    detail: string;
    status: number;
  }>;
}

function getApiKey(): string {
  const key = process.env.ABUSEIPDB_API_KEY;
  if (!key) {
    throw new Error(
      'ABUSEIPDB_API_KEY environment variable is not set. ' +
      'Please configure it in your .env file.'
    );
  }
  return key;
}

function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const limit = headers.get('X-RateLimit-Limit');
  const remaining = headers.get('X-RateLimit-Remaining');
  const reset = headers.get('X-RateLimit-Reset');

  if (limit && remaining && reset) {
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
    };
  }
  return null;
}

/**
 * Check a single IP address for abuse history
 * 
 * @param ipAddress - The IP address to check
 * @param maxAgeInDays - How far back to check (1-365, default 90)
 * @returns IP abuse data with rate limit info
 */
export async function checkIp(
  ipAddress: string,
  maxAgeInDays: number = 90
): Promise<{ data: AbuseIPDBCheckResponse['data']; rateLimit: RateLimitInfo | null }> {
  const apiKey = getApiKey();
  
  const url = new URL(`${ABUSEIPDB_BASE_URL}/check`);
  url.searchParams.set('ipAddress', ipAddress);
  url.searchParams.set('maxAgeInDays', maxAgeInDays.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Key': apiKey,
    },
  });

  const rateLimit = parseRateLimitHeaders(response.headers);

  if (!response.ok) {
    const errorData = await response.json() as AbuseIPDBError;
    const errorMessage = errorData.errors?.[0]?.detail || 'Unknown error';
    throw new Error(`AbuseIPDB API error: ${errorMessage}`);
  }

  const result = await response.json() as AbuseIPDBCheckResponse;
  return { data: result.data, rateLimit };
}

/**
 * Get the blacklist of most reported IP addresses
 * 
 * @param confidenceMinimum - Minimum abuse confidence score (25-100, default 90)
 * @param limit - Maximum number of results (optional, depends on subscription)
 * @returns Array of blacklisted IPs with rate limit info
 */
export async function getBlacklist(
  confidenceMinimum: number = 90,
  limit?: number
): Promise<{ data: AbuseIPDBBlacklistResponse['data']; meta: AbuseIPDBBlacklistResponse['meta']; rateLimit: RateLimitInfo | null }> {
  const apiKey = getApiKey();
  
  const url = new URL(`${ABUSEIPDB_BASE_URL}/blacklist`);
  url.searchParams.set('confidenceMinimum', confidenceMinimum.toString());
  if (limit) {
    url.searchParams.set('limit', limit.toString());
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Key': apiKey,
    },
  });

  const rateLimit = parseRateLimitHeaders(response.headers);

  if (!response.ok) {
    const errorData = await response.json() as AbuseIPDBError;
    const errorMessage = errorData.errors?.[0]?.detail || 'Unknown error';
    throw new Error(`AbuseIPDB API error (${response.status}): ${errorMessage}`);
  }

  const result = await response.json() as AbuseIPDBBlacklistResponse;
  return { data: result.data, meta: result.meta, rateLimit };
}
