import { NextResponse } from 'next/server';
import postgres from 'postgres';

/**
 * SSE Endpoint for real-time threat streaming
 * 
 * Uses Postgres LISTEN/NOTIFY to stream new threat insertions to clients.
 * Each connected client gets a dedicated database connection for listening.
 * 
 * GET /api/threats/stream
 */
export async function GET(request: Request) {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  // Create a dedicated connection for this SSE client
  // This connection will be used exclusively for LISTEN
  // 
  // IMPORTANT: Each SSE client creates a dedicated database connection that persists
  // for the duration of the connection. This can lead to connection pool exhaustion
  // under high load. The default Postgres connection limit is typically 100-200.
  // 
  // For production deployments:
  // - Monitor active SSE connections and database connection pool usage
  // - Set appropriate max_connections in PostgreSQL configuration
  // - Consider implementing a connection limit or load balancing strategy
  // - Document the expected maximum number of concurrent SSE clients
  const listener = postgres(connectionString, {
    max: 1,
    idle_timeout: 0, // Keep connection alive
    connect_timeout: 10,
  });

  // Track if the connection is still active
  let isConnected = true;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`)
      );

      // Set up LISTEN for new threats
      try {
        await listener.listen('new_threat', (payload: string) => {
          if (!isConnected) return;

          try {
            const threatData = JSON.parse(payload);
            
            // Sanitize threat data before streaming to clients
            // Remove potentially sensitive fields from metadata
            const sanitized = {
              ...threatData,
              metadata: threatData.metadata ? {
                // Only include non-sensitive metadata fields
                lastReportedAt: threatData.metadata.lastReportedAt,
                importedAt: threatData.metadata.importedAt,
                countryCode: threatData.metadata.countryCode,
                // Exclude other potentially sensitive fields like ISP, domain, etc.
              } : undefined,
            };
            
            const sseMessage = `event: threat\ndata: ${JSON.stringify(sanitized)}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          } catch (parseError) {
            console.error('Failed to parse threat notification:', parseError);
          }
        });

        // Send heartbeat every 30 seconds to keep connection alive
        heartbeatInterval = setInterval(() => {
          // Check connection status before attempting to send
          if (!isConnected) {
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
            return;
          }
          
          try {
            controller.enqueue(
              encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`)
            );
          } catch {
            // Connection closed during send, clean up
            isConnected = false;
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
          }
        }, 30000);

        // Handle client disconnect
        request.signal.addEventListener('abort', async () => {
          isConnected = false;
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
          }
          
          try {
            await listener.end();
          } catch (error) {
            console.error('Error closing listener connection:', error);
          }
          
          controller.close();
        });

      } catch (error) {
        console.error('Failed to set up threat listener:', error);
        isConnected = false;
        
        // Clean up heartbeat interval if it was created
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        
        // Send error event to client before closing
        try {
          const errorEvent = {
            message: 'Failed to set up threat listener',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`)
          );
        } catch {
          // If sending the error event fails, proceed to error the controller
        }
        
        // Clean up database connection
        try {
          await listener.end();
        } catch (cleanupError) {
          // Log cleanup errors but don't throw
          console.error('Error during listener cleanup:', cleanupError);
        }
        
        controller.error(error);
      }
    },

    cancel() {
      isConnected = false;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      listener.end().catch(console.error);
    },
  });

  // Return SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

// Prevent static generation for this dynamic endpoint
export const dynamic = 'force-dynamic';
