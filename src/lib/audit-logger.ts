/**
 * API Audit Logger
 * 
 * Utility for logging external API calls for auditing, debugging, and rate limit tracking
 */

import { db } from '@/src/db/db';
import { apiAuditLogs, type NewApiAuditLog } from '@/src/db/schema';

export type ApiSource = 'AbuseIPDB' | 'OTX';

interface LogApiCallParams {
  userId?: string;
  apiSource: ApiSource;
  endpoint: string;
  indicator?: string;
  responseCode?: number;
  responseTime?: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * Log an external API call to the audit log
 * 
 * @param params - API call details to log
 * @returns The created audit log entry
 */
export async function logApiCall(params: LogApiCallParams): Promise<void> {
  try {
    const logEntry: NewApiAuditLog = {
      userId: params.userId,
      apiSource: params.apiSource,
      endpoint: params.endpoint,
      indicator: params.indicator,
      responseCode: params.responseCode,
      responseTime: params.responseTime,
      success: params.success,
      errorMessage: params.errorMessage,
    };

    await db.insert(apiAuditLogs).values(logEntry);
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Failed to log API call:', error);
  }
}

/**
 * Execute an API call with timing and automatic logging
 * 
 * @param apiSource - The API source being called
 * @param endpoint - The endpoint being called
 * @param indicator - Optional indicator being looked up
 * @param userId - Optional user ID making the request
 * @param apiCall - The async function to execute
 * @returns The result of the API call
 */
export async function withAuditLog<T>(
  apiSource: ApiSource,
  endpoint: string,
  indicator: string | undefined,
  userId: string | undefined,
  apiCall: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await apiCall();
    const responseTime = Date.now() - startTime;
    
    await logApiCall({
      userId,
      apiSource,
      endpoint,
      indicator,
      responseCode: 200,
      responseTime,
      success: true,
    });
    
    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Try to extract status code from error message
    const statusMatch = errorMessage.match(/\((\d{3})\)/);
    const responseCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
    
    await logApiCall({
      userId,
      apiSource,
      endpoint,
      indicator,
      responseCode,
      responseTime,
      success: false,
      errorMessage,
    });
    
    throw error;
  }
}
