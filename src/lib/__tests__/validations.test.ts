/**
 * Auth Validation Schema Tests
 * 
 * Tests for email/password validation, normalization, and signup password confirmation
 */

import { describe, it, expect } from 'bun:test';
import { 
  loginSchema, 
  signupSchema, 
  normalizeEmail,
  getSafeInternalPath,
} from '../validations/auth';

describe('Auth Validation Schemas', () => {
  describe('normalizeEmail', () => {
    it('should convert email to lowercase', () => {
      expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
    });

    it('should trim whitespace from email', () => {
      expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
    });

    it('should handle mixed case with whitespace', () => {
      expect(normalizeEmail('  Test@EXAMPLE.com  ')).toBe('test@example.com');
    });
  });

  describe('getSafeInternalPath', () => {
    it('preserves local paths with query strings and fragments', () => {
      expect(getSafeInternalPath('/investigate?ip=8.8.8.8#result')).toBe('/investigate?ip=8.8.8.8#result');
    });

    it('rejects absolute and protocol-relative external URLs', () => {
      expect(getSafeInternalPath('https://example.com/steal', '/')).toBe('/');
      expect(getSafeInternalPath('//example.com/steal', '/')).toBe('/');
    });

    it('rejects slash-prefixed backslash URLs normalized as external', () => {
      expect(getSafeInternalPath('/\\example.com/steal', '/')).toBe('/');
    });
  });

  describe('loginSchema', () => {
    it('should validate a valid login input', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123',
      });
      expect(result.success).toBe(true);
    });

    it('should normalize email on successful parse', () => {
      const result = loginSchema.safeParse({
        email: 'TEST@EXAMPLE.COM',
        password: 'Password123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('should reject invalid email format', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'Password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty email', () => {
      const result = loginSchema.safeParse({
        email: '',
        password: 'Password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'Short1',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    const validSignup = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    };

    it('should validate a valid signup input', () => {
      const result = signupSchema.safeParse(validSignup);
      expect(result.success).toBe(true);
    });

    it('should reject name shorter than 2 characters', () => {
      const result = signupSchema.safeParse({
        ...validSignup,
        name: 'J',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase letter', () => {
      const result = signupSchema.safeParse({
        ...validSignup,
        password: 'password123',
        confirmPassword: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase letter', () => {
      const result = signupSchema.safeParse({
        ...validSignup,
        password: 'PASSWORD123',
        confirmPassword: 'PASSWORD123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = signupSchema.safeParse({
        ...validSignup,
        password: 'PasswordABC',
        confirmPassword: 'PasswordABC',
      });
      expect(result.success).toBe(false);
    });

    it('should reject mismatched passwords', () => {
      const result = signupSchema.safeParse({
        ...validSignup,
        confirmPassword: 'DifferentPassword123',
      });
      expect(result.success).toBe(false);
    });

    it('should normalize email on successful parse', () => {
      const result = signupSchema.safeParse({
        ...validSignup,
        email: 'JOHN@EXAMPLE.COM',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('john@example.com');
      }
    });
  });
});
