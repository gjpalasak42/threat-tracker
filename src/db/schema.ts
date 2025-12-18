import { pgTable, uuid, text, integer, real, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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

// Type exports for use in application
export type ThreatLog = typeof threatLogs.$inferSelect;
export type NewThreatLog = typeof threatLogs.$inferInsert;
