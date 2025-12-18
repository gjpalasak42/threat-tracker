import { NextResponse } from 'next/server';
import { db } from '@/src/db/db';
import { sql } from 'drizzle-orm';

/**
 * Health check endpoint for monitoring application and database status
 * 
 * GET /api/health
 * 
 * @returns JSON response with health status
 * - 200: Application and database are healthy
 * - 503: Service unavailable (database connection failed)
 */
export async function GET() {
  try {
    // Check database connectivity with a simple query
    await db.execute(sql`SELECT 1`);
    
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          application: 'running',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Log error for debugging (in production, use proper logging)
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'disconnected',
          application: 'running',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
