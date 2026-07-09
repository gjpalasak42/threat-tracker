import { describe, expect, it } from 'bun:test';
import {
  getFeedHealth,
  getLastSyncTimestamp,
  isConfiguredApiKey,
  shouldThrottleSync,
} from '../sync-status';

describe('sync status helpers', () => {
  describe('getLastSyncTimestamp', () => {
    it('prefers the source-specific config timestamp over recent threat rows', () => {
      const configUpdatedAt = new Date('2026-04-24T01:00:00.000Z');
      const recentThreatAt = new Date('2026-04-24T12:00:00.000Z');

      expect(getLastSyncTimestamp(configUpdatedAt, recentThreatAt)).toBe(configUpdatedAt);
    });

    it('falls back to the source-specific threat timestamp when config is missing', () => {
      const abuseThreatAt = new Date('2026-04-24T12:00:00.000Z');

      expect(getLastSyncTimestamp(null, abuseThreatAt)).toBe(abuseThreatAt);
    });
  });

  describe('shouldThrottleSync', () => {
    it('does not throttle AbuseIPDB when only another source synced recently', () => {
      const now = new Date('2026-04-24T13:00:00.000Z');
      const abuseLastSync = new Date('2026-04-23T00:00:00.000Z');

      expect(shouldThrottleSync(abuseLastSync, now, 12 * 60 * 60 * 1000)).toEqual({
        throttled: false,
        hoursRemaining: 0,
      });
    });
  });

  describe('isConfiguredApiKey', () => {
    it('rejects empty and example placeholder values', () => {
      expect(isConfiguredApiKey(undefined)).toBe(false);
      expect(isConfiguredApiKey('your_abuseipdb_api_key_here')).toBe(false);
      expect(isConfiguredApiKey('YOUR_OTX_API_KEY_HERE')).toBe(false);
    });

    it('accepts a non-placeholder key', () => {
      expect(isConfiguredApiKey('provider-key-value')).toBe(true);
    });
  });

  describe('getFeedHealth', () => {
    const now = new Date('2026-07-09T12:00:00.000Z');
    const staleAfterMs = 24 * 60 * 60 * 1000;

    it('distinguishes setup, pending, stale, and healthy states', () => {
      expect(getFeedHealth(false, null, now, staleAfterMs)).toBe('not_configured');
      expect(getFeedHealth(true, null, now, staleAfterMs)).toBe('never_synced');
      expect(getFeedHealth(true, new Date('2026-07-07T12:00:00.000Z'), now, staleAfterMs)).toBe('stale');
      expect(getFeedHealth(true, new Date('2026-07-09T06:00:00.000Z'), now, staleAfterMs)).toBe('healthy');
    });
  });
});
