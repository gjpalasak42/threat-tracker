/**
 * Standardized API Response Structure
 * 
 * Provides consistent response formatting across all API endpoints
 * to support multiple data sources (AbuseIPDB, VirusTotal, etc.)
 */

/**
 * Standard error format for API responses
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Metadata included with every API response
 */
export interface ApiMeta {
  source: string;       // Data source identifier (e.g., 'AbuseIPDB', 'internal')
  timestamp: string;    // ISO 8601 timestamp
  requestId?: string;   // Optional request tracking ID
}

/**
 * Standardized API response wrapper
 * @template T - The type of the data payload
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ApiMeta;
}

/**
 * Creates a successful API response
 */
export function successResponse<T>(
  data: T,
  source: string = 'internal',
  requestId?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      source,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    },
  };
}

/**
 * Creates an error API response
 */
export function errorResponse(
  code: string,
  message: string,
  source: string = 'internal',
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
    meta: {
      source,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Common error codes for consistency across the API
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
