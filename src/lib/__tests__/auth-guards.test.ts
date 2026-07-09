/**
 * Auth Guards Unit Tests
 * 
 * Tests for role hierarchy, permission checks, and unauthorized access handling
 */

import { describe, it, expect } from 'bun:test';
import { hasPermission, KILL_SWITCH_KEYS } from '../auth-guards';

describe('Auth Guards', () => {
  describe('hasPermission', () => {
    it('should allow ADMIN to access all roles', () => {
      expect(hasPermission('ADMIN', 'ADMIN')).toBe(true);
      expect(hasPermission('ADMIN', 'API_USER')).toBe(true);
      expect(hasPermission('ADMIN', 'STANDARD_USER')).toBe(true);
    });

    it('should allow API_USER to access API_USER and below', () => {
      expect(hasPermission('API_USER', 'ADMIN')).toBe(false);
      expect(hasPermission('API_USER', 'API_USER')).toBe(true);
      expect(hasPermission('API_USER', 'STANDARD_USER')).toBe(true);
    });

    it('should allow STANDARD_USER to only access STANDARD_USER', () => {
      expect(hasPermission('STANDARD_USER', 'ADMIN')).toBe(false);
      expect(hasPermission('STANDARD_USER', 'API_USER')).toBe(false);
      expect(hasPermission('STANDARD_USER', 'STANDARD_USER')).toBe(true);
    });
  });

  describe('KILL_SWITCH_KEYS', () => {
    it('should have all expected kill switch keys defined', () => {
      expect(KILL_SWITCH_KEYS.REGISTRATION_ENABLED).toBe('registration_enabled');
      expect(KILL_SWITCH_KEYS.EXTERNAL_API_ENABLED).toBe('external_api_enabled');
      expect(KILL_SWITCH_KEYS.DATABASE_SEARCH_ENABLED).toBe('database_search_enabled');
      expect(KILL_SWITCH_KEYS.OTX_SYNC_ENABLED).toBe('otx_sync_enabled');
    });

    it('should have exactly 4 kill switch keys', () => {
      const keys = Object.keys(KILL_SWITCH_KEYS);
      expect(keys).toHaveLength(4);
    });
  });
});
