/**
 * AlienVault OTX API Client
 * 
 * Provides methods for interacting with the AlienVault Open Threat Exchange API
 * @see https://otx.alienvault.com/api
 */

import { isConfiguredApiKey } from './sync-status';

const OTX_BASE_URL = 'https://otx.alienvault.com';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * OTX Pulse - A collection of threat indicators
 */
export interface OTXPulse {
  id: string;
  name: string;
  description: string;
  author_name: string;
  created: string;
  modified: string;
  tags: string[];
  references: string[];
  indicator_count: number;
  public: number;
  adversary: string;
  targeted_countries: string[];
  industries: string[];
  TLP: string;
}

/**
 * OTX Indicator from a pulse
 */
export interface OTXIndicator {
  id: number;
  indicator: string;
  type: string;
  created: string;
  content: string;
  title: string;
  description: string;
  expiration: string | null;
  is_active: number;
  role: string | null;
}

/**
 * OTX Pulse with indicators
 */
export interface OTXPulseWithIndicators extends OTXPulse {
  indicators: OTXIndicator[];
}

/**
 * OTX Subscribed Pulses Response
 */
export interface OTXSubscribedPulsesResponse {
  count: number;
  previous: string | null;
  next: string | null;
  results: OTXPulseWithIndicators[];
}

/**
 * OTX General Indicator Response
 */
export interface OTXIndicatorGeneralResponse {
  indicator: string;
  type: string;
  type_title: string;
  pulse_info: {
    count: number;
    pulses: Array<{
      id: string;
      name: string;
      description: string;
      author_name: string;
      created: string;
      modified: string;
      tags: string[];
      references: string[];
      TLP: string;
    }>;
    references: string[];
    related: {
      alienvault: {
        adversary: string[];
        malware_families: string[];
        industries: string[];
      };
      other: {
        adversary: string[];
        malware_families: string[];
        industries: string[];
      };
    };
  };
  base_indicator: {
    id: number;
    indicator: string;
    type: string;
    access_type: string;
  } | null;
  whois?: string;
  reputation?: number;
  validation?: Array<{
    source: string;
    message: string;
    name: string;
  }>;
  asn?: string;
  country_code?: string;
  country_name?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  accuracy_radius?: number;
  sections?: string[];
}

/**
 * OTX API Error Response
 */
export interface OTXError {
  detail?: string;
  error?: string;
}

/**
 * Rate limit information (OTX uses standard headers)
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getApiKey(): string {
  const key = process.env.OTX_API_KEY;
  if (!isConfiguredApiKey(key)) {
    throw new Error(
      'OTX_API_KEY environment variable is not set. ' +
      'Get a free API key at https://otx.alienvault.com/api'
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

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get subscribed pulses with their indicators
 * 
 * @param page - Page number (1-indexed)
 * @param limit - Number of pulses per page (default 10, max 50)
 * @param modifiedSince - Only return pulses modified after this date (ISO string)
 * @returns Paginated list of pulses with indicators
 */
export async function getSubscribedPulses(
  page: number = 1,
  limit: number = 10,
  modifiedSince?: string
): Promise<{ data: OTXSubscribedPulsesResponse; rateLimit: RateLimitInfo | null }> {
  const apiKey = getApiKey();
  
  // Validate parameters
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError('page must be a positive integer');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RangeError('limit must be between 1 and 50');
  }

  const url = new URL(`${OTX_BASE_URL}/api/v1/pulses/subscribed`);
  url.searchParams.set('page', page.toString());
  url.searchParams.set('limit', limit.toString());
  
  if (modifiedSince) {
    url.searchParams.set('modified_since', modifiedSince);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-OTX-API-KEY': apiKey,
    },
  });

  const rateLimit = parseRateLimitHeaders(response.headers);

  if (!response.ok) {
    const errorData = await response.json() as OTXError;
    const errorMessage = errorData.detail || errorData.error || 'Unknown error';
    throw new Error(`OTX API error (${response.status}): ${errorMessage}`);
  }

  const result = await response.json() as OTXSubscribedPulsesResponse;
  return { data: result, rateLimit };
}

/**
 * Get general information about an indicator
 * 
 * @param type - Indicator type: 'IPv4', 'IPv6', 'domain', 'hostname', 'url', 'FileHash-MD5', 'FileHash-SHA1', 'FileHash-SHA256'
 * @param value - The indicator value to lookup
 * @returns General indicator information including pulse presence
 */
export async function getIndicatorGeneral(
  type: 'IPv4' | 'IPv6' | 'domain' | 'hostname' | 'url' | 'FileHash-MD5' | 'FileHash-SHA1' | 'FileHash-SHA256',
  value: string
): Promise<{ data: OTXIndicatorGeneralResponse; rateLimit: RateLimitInfo | null }> {
  const apiKey = getApiKey();
  
  // Validate value
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Invalid indicator value: must be a non-empty string');
  }

  // URL encode the value for the path
  const encodedValue = encodeURIComponent(value.trim());
  const url = `${OTX_BASE_URL}/api/v1/indicators/${type}/${encodedValue}/general`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-OTX-API-KEY': apiKey,
    },
  });

  const rateLimit = parseRateLimitHeaders(response.headers);

  if (!response.ok) {
    const errorData = await response.json() as OTXError;
    const errorMessage = errorData.detail || errorData.error || 'Unknown error';
    throw new Error(`OTX API error (${response.status}): ${errorMessage}`);
  }

  const result = await response.json() as OTXIndicatorGeneralResponse;
  return { data: result, rateLimit };
}

/**
 * Get details of a specific pulse by ID
 * 
 * @param pulseId - The pulse ID to fetch
 * @returns Pulse details with indicators
 */
export async function getPulseDetails(
  pulseId: string
): Promise<{ data: OTXPulseWithIndicators; rateLimit: RateLimitInfo | null }> {
  const apiKey = getApiKey();
  
  if (!pulseId || typeof pulseId !== 'string' || pulseId.trim().length === 0) {
    throw new Error('Invalid pulse ID: must be a non-empty string');
  }

  const url = `${OTX_BASE_URL}/api/v1/pulses/${encodeURIComponent(pulseId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-OTX-API-KEY': apiKey,
    },
  });

  const rateLimit = parseRateLimitHeaders(response.headers);

  if (!response.ok) {
    const errorData = await response.json() as OTXError;
    const errorMessage = errorData.detail || errorData.error || 'Unknown error';
    throw new Error(`OTX API error (${response.status}): ${errorMessage}`);
  }

  const result = await response.json() as OTXPulseWithIndicators;
  return { data: result, rateLimit };
}

/**
 * Map OTX indicator type to internal type
 */
export function mapOTXTypeToInternal(otxType: string): string {
  const typeMap: Record<string, string> = {
    'IPv4': 'ipv4',
    'IPv6': 'ipv6',
    'domain': 'domain',
    'hostname': 'domain',
    'URL': 'url',
    'url': 'url',
    'FileHash-MD5': 'hash',
    'FileHash-SHA1': 'hash',
    'FileHash-SHA256': 'hash',
    'email': 'email',
    'CVE': 'cve',
  };
  return typeMap[otxType] || 'unknown';
}

/**
 * Convert internal type to OTX API type
 */
export function mapInternalTypeToOTX(internalType: string): 'IPv4' | 'IPv6' | 'domain' | 'url' | null {
  const typeMap: Record<string, 'IPv4' | 'IPv6' | 'domain' | 'url'> = {
    'ipv4': 'IPv4',
    'ipv6': 'IPv6',
    'domain': 'domain',
    'url': 'url',
  };
  return typeMap[internalType] || null;
}
