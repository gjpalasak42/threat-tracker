/**
 * Authentication Validation Schemas
 * 
 * Zod schemas for validating auth-related inputs on both
 * client and server.
 */

import { z } from 'zod';

/**
 * Normalize email for validation
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Resolve an authentication callback to an application-local path.
 * URL parsing also rejects slash-prefixed backslash forms that browsers can
 * otherwise normalize into a protocol-relative external URL.
 */
export function getSafeInternalPath(
  candidate: string | null | undefined,
  fallback: string = '/'
): string {
  if (!candidate) return fallback;

  const localOrigin = 'https://threat-tracker.invalid';

  try {
    const parsed = new URL(candidate, localOrigin);
    if (parsed.origin !== localOrigin) return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .transform(normalizeEmail),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

/**
 * Signup form validation schema
 */
export const signupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .transform(normalizeEmail),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Inferred types for form data
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
