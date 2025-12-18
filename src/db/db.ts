import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';

/**
 * Validates and returns the database connection URL from environment variables
 * @throws {Error} If DATABASE_URL is not set
 * @returns {string} The validated database connection URL
 */
function getDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Please ensure it is configured in your .env file.'
    );
  }
  
  // Basic validation of the connection string format
  if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL connection string ' +
      '(starting with postgres:// or postgresql://)'
    );
  }
  
  return connectionString;
}

// Singleton instances for lazy initialization
let clientInstance: Sql | null = null;
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Get or create the PostgreSQL client with connection pooling
 * Configuration optimized for production use
 */
function getClient(): Sql {
  if (!clientInstance) {
    const connectionString = getDatabaseUrl();
    clientInstance = postgres(connectionString, {
      max: 10, // Maximum number of connections in the pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
      // Prevent connection leaks in serverless environments
      max_lifetime: 60 * 30, // 30 minutes
    });
  }
  return clientInstance;
}

/**
 * Drizzle ORM database instance with schema
 * Use this instance for all database operations
 * 
 * Uses lazy initialization to support Next.js static builds
 */
export const db: PostgresJsDatabase<typeof schema> = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    if (!dbInstance) {
      dbInstance = drizzle(getClient(), { schema });
    }
    return (dbInstance as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Raw PostgreSQL client for advanced use cases
 * Use sparingly - prefer the `db` instance for type-safe queries
 */
export const client: Sql = new Proxy({} as Sql, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
