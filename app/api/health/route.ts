import { NextResponse } from 'next/server';
import { db } from '@/src/db/db';
import { sql } from 'drizzle-orm';
import { successResponse, errorResponse, ErrorCodes } from '@/src/lib/api-response';

interface HealthData {
  status: 'healthy' | 'unhealthy';
  services: {
    database: 'connected' | 'disconnected';
    application: 'running';
  };
}

/**
 * Health check endpoint for monitoring application and database status
 * 
 * GET /api/health
 * 
 * @returns JSON response with health status using standardized format
 * - 200: Application and database are healthy
 * - 503: Service unavailable (database connection failed)
 */
export async function GET() {
  try {
    // Check database connectivity with a simple query
    await db.execute(sql`SELECT 1`);
    
    const response = successResponse<HealthData>(
      {
        status: 'healthy',
        services: {
          database: 'connected',
          application: 'running',
        },
      },
      'internal'
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Log error for debugging (in production, use proper logging)
    console.error('Health check failed:', error);
    
    const response = errorResponse(
      ErrorCodes.CONNECTION_ERROR,
      'Database connection failed',
      'internal'
    );

    return NextResponse.json(response, { status: 503 });
  }
}
