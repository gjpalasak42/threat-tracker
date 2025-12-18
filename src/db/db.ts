import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
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

// Get validated database URL
const connectionString = getDatabaseUrl();

/**
 * PostgreSQL client with connection pooling
 * Configuration optimized for production use
 */
const client = postgres(connectionString, {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  // Prevent connection leaks in serverless environments
  max_lifetime: 60 * 30, // 30 minutes
});

/**
 * Drizzle ORM database instance with schema
 * Use this instance for all database operations
 */
export const db = drizzle(client, { schema });

/**
 * Raw PostgreSQL client for advanced use cases
 * Use sparingly - prefer the `db` instance for type-safe queries
 */
export { client };
