import { 
  pgTable, 
  pgEnum,
  uuid, 
  text, 
  integer, 
  real, 
  jsonb, 
  timestamp, 
  uniqueIndex,
  boolean,
  primaryKey
} from 'drizzle-orm/pg-core';
import type { AdapterAccount } from 'next-auth/adapters';

// =============================================================================
// User Role Enum for RBAC
// =============================================================================
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'API_USER', 'STANDARD_USER']);

export type UserRole = 'ADMIN' | 'API_USER' | 'STANDARD_USER';

// =============================================================================
// Auth.js Tables
// =============================================================================

/**
 * Users table for authentication
 * Email is normalized (lowercase, trimmed) before storage to prevent duplicate/similar email attacks
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(), // Unique constraint prevents duplicate emails
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  hashedPassword: text('hashed_password'), // For credentials provider
  role: userRoleEnum('role').default('STANDARD_USER').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Accounts table for OAuth providers
 */
export const accounts = pgTable('accounts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').$type<AdapterAccount['type']>().notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (account) => [
  primaryKey({ columns: [account.provider, account.providerAccountId] }),
]);

/**
 * Sessions table for database session strategy
 */
export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

/**
 * Verification tokens for email verification
 */
export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}, (vt) => [
  primaryKey({ columns: [vt.identifier, vt.token] }),
]);

// =============================================================================
// System Configuration (Kill Switches)
// =============================================================================

/**
 * System configuration table for global settings and kill switches
 */
export const systemConfig = pgTable('system_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: boolean('value').default(true).notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

// Kill switch key constants
export const KILL_SWITCH_KEYS = {
  REGISTRATION_ENABLED: 'registration_enabled',
  EXTERNAL_API_ENABLED: 'external_api_enabled',
  DATABASE_SEARCH_ENABLED: 'database_search_enabled',
} as const;

// =============================================================================
// Threat Intelligence Tables (Existing)
// =============================================================================

/**
 * Threat logs table for storing threat intelligence indicators
 */
export const threatLogs = pgTable('threat_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  indicator: text('indicator').notNull(),
  type: text('type').notNull(), // 'ipv4', 'ipv6', 'domain', 'url', 'hash', etc.
  severity: integer('severity').notNull(), // 1-100 scale
  confidenceScore: real('confidence_score').notNull().default(0), // For multi-source deconfliction
  source: text('source').notNull(), // e.g., 'AbuseIPDB', 'VirusTotal'
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}), // Flexible extra data
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Unique constraint for deduplication: same indicator from same source
  uniqueIndex('uq_threat_logs_indicator_source').on(table.indicator, table.source),
]);

// =============================================================================
// Type Exports
// =============================================================================

// User types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Session types
export type Session = typeof sessions.$inferSelect;

// System config types
export type SystemConfig = typeof systemConfig.$inferSelect;
export type NewSystemConfig = typeof systemConfig.$inferInsert;

// Threat log types
export type ThreatLog = typeof threatLogs.$inferSelect;
export type NewThreatLog = typeof threatLogs.$inferInsert;
