'use server';

/**
 * Authentication Server Actions
 * 
 * Server-side actions for login, signup, and signout
 */

import { signIn, signOut, registerUser } from '@/src/lib/auth';
import { loginSchema, signupSchema } from '@/src/lib/validations/auth';
import { isFeatureKilled, KILL_SWITCH_KEYS } from '@/src/lib/auth-guards';
import { AuthError } from 'next-auth';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

export interface AuthActionResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * Login with email and password
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
    
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
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
 */
export async function signupAction(
  formData: FormData
): Promise<AuthActionResult> {
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
    return {
      success: false,
      error: result.error,
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
