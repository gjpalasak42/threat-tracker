'use server';

/**
 * Authentication Server Actions
 * 
 * Server-side actions for login, signup, and signout
 * Includes rate limiting and brute force protection
 */

import { signIn, signOut, registerUser } from '@/src/lib/auth';
import { loginSchema, signupSchema } from '@/src/lib/validations/auth';
import { isFeatureKilled, KILL_SWITCH_KEYS } from '@/src/lib/auth-guards';
import { 
  checkLoginRateLimit, 
  recordFailedAttempt, 
  recordSuccessfulLogin,
  checkRegistrationRateLimit,
  recordRegistrationAttempt,
} from '@/src/lib/rate-limiter';
import { AuthError } from 'next-auth';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { headers } from 'next/headers';

export interface AuthActionResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * Get the client IP from request headers
 * Handles various proxy headers for accurate IP detection
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers();
  
  // Check common proxy headers in order of preference
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first (original client)
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  
  const realIp = headersList.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  const cfConnectingIp = headersList.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  return 'unknown';
}

/**
 * Login with email and password
 * Includes rate limiting and brute force protection
 */
export async function loginAction(
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  // Validate input
  const validationResult = loginSchema.safeParse(rawData);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || 'Invalid input',
    };
  }

  const email = validationResult.data.email;
  const ip = await getClientIp();

  // Check rate limit before attempting authentication
  const rateLimitResult = await checkLoginRateLimit(email, ip);
  if (!rateLimitResult.allowed) {
    if (rateLimitResult.reason === 'account_locked') {
      return {
        success: false,
        error: 'Account locked due to too many failed attempts. Please contact an administrator.',
      };
    }
    return {
      success: false,
      error: `Too many login attempts. Please try again in ${Math.ceil((rateLimitResult.retryAfterSeconds || 900) / 60)} minutes.`,
    };
  }

  try {
    await signIn('credentials', {
      email: validationResult.data.email,
      password: validationResult.data.password,
      redirect: false,
    });

    // Clear failed attempts on successful login
    await recordSuccessfulLogin(email);

    return {
      success: true,
      redirectTo: '/',
    };
  } catch (error) {
    // Auth.js throws redirect errors on success - rethrow them
    if (isRedirectError(error)) {
      throw error;
    }
    
    // Record failed attempt for rate limiting
    await recordFailedAttempt(email, ip);
    
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          // Generic message to prevent user enumeration
          return { success: false, error: 'Invalid email or password' };
        default:
          return { success: false, error: 'An error occurred during login' };
      }
    }
    
    // Log unexpected errors but return generic message
    console.error('Login error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Register a new user
 * Includes strict rate limiting to prevent user enumeration attacks
 */
export async function signupAction(
  formData: FormData
): Promise<AuthActionResult> {
  const ip = await getClientIp();

  // Check strict rate limit for registration FIRST (before any processing)
  const rateLimitResult = await checkRegistrationRateLimit(ip);
  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Too many registration attempts. Please try again in ${Math.ceil((rateLimitResult.retryAfterSeconds || 3600) / 60)} minutes.`,
    };
  }

  // Record this attempt regardless of outcome (prevents enumeration timing attacks)
  await recordRegistrationAttempt(ip);

  // Check if registration is enabled
  const registrationDisabled = await isFeatureKilled(KILL_SWITCH_KEYS.REGISTRATION_ENABLED);
  if (registrationDisabled) {
    return {
      success: false,
      error: 'New user registration is currently disabled',
    };
  }

  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  // Validate input
  const validationResult = signupSchema.safeParse(rawData);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || 'Invalid input',
    };
  }

  // Register the user
  const result = await registerUser(
    validationResult.data.name,
    validationResult.data.email,
    validationResult.data.password
  );

  if (!result.success) {
    // Return generic message to prevent user enumeration
    // The actual error (e.g., "email already exists") is not exposed to the user
    // Log detailed error server-side for admin troubleshooting
    console.error('User registration failed', {
      email: validationResult.data.email,
      result,
    });
    return {
      success: false,
      error: 'Registration failed. Please check your information and try again.',
    };
  }

  // Auto-login after successful registration
  try {
    await signIn('credentials', {
      email: validationResult.data.email,
      password: validationResult.data.password,
      redirect: false,
    });

    return {
      success: true,
      redirectTo: '/',
    };
  } catch (error) {
    // Auth.js throws redirect errors on success - rethrow them
    if (isRedirectError(error)) {
      throw error;
    }
    
    // Registration succeeded but auto-login failed, redirect to login
    return {
      success: true,
      redirectTo: '/auth/login?registered=true',
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
}
