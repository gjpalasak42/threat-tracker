/**
 * Authentication Guards
 * 
 * Higher-order functions and utilities for protecting server actions
 * with role-based access control.
 */

import { auth } from '@/src/lib/auth';
import type { Session } from 'next-auth';
import { db } from '@/src/db/db';
import { systemConfig, KILL_SWITCH_KEYS, type UserRole } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Standard unauthorized response structure
 */
export interface UnauthorizedResponse {
  error: string;
  code: 401 | 403;
}

/**
 * Standard kill switch blocked response
 */
export interface KillSwitchBlockedResponse {
  error: string;
  code: 503;
  killSwitch: string;
}

/**
 * Role hierarchy for permission checks
 * Higher index = more permissions
 */
const ROLE_HIERARCHY: UserRole[] = ['STANDARD_USER', 'API_USER', 'ADMIN'];

/**
 * Get the hierarchy level for a role
 */
function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Check if a role has at least the required permission level
 */
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

/**
 * Get the current authenticated user's session
 * Returns null if not authenticated
 */
export async function getSession() {
  return await auth();
}

/**
 * Require authentication for a server action
 * Returns the session if authenticated, or an error response
 */
export async function requireAuth(): Promise<
  { session: Session } | UnauthorizedResponse
> {
  const session = await auth();

  if (!session?.user) {
    logUnauthorizedAttempt('unauthenticated', 'requireAuth');
    return {
      error: 'Authentication required',
      code: 401,
    };
  }

  if (!session.user.isActive) {
    logUnauthorizedAttempt(session.user.id, 'requireAuth', 'Account is deactivated');
    return {
      error: 'Account is deactivated',
      code: 403,
    };
  }

  return { session };
}

/**
 * Require a specific role (or higher) for a server action
 * Returns the session if authorized, or an error response
 */
export async function requireRole(requiredRole: UserRole): Promise<
  { session: Session } | UnauthorizedResponse
> {
  const authResult = await requireAuth();

  if ('error' in authResult) {
    return authResult;
  }

  const { session } = authResult;
  const userRole = session.user.role;

  if (!hasPermission(userRole, requiredRole)) {
    logUnauthorizedAttempt(
      session.user.id,
      `requireRole(${requiredRole})`,
      `User role: ${userRole}`
    );
    return {
      error: 'Unauthorized access detected',
      code: 403,
    };
  }

  return { session };
}

/**
 * Check if a kill switch is enabled (blocking functionality)
 * Returns true if the feature is DISABLED (kill switch is ON)
 */
export async function isKillSwitchEnabled(key: string): Promise<boolean> {
  try {
    const config = await db.select({ value: systemConfig.value })
      .from(systemConfig)
      .where(eq(systemConfig.key, key))
      .limit(1);

    // If no config exists, default to enabled (not killed)
    if (config.length === 0) {
      return false;
    }

    // If value is false, the feature is disabled (kill switch is ON)
    return !config[0].value;
  } catch (error) {
    console.error('Error checking kill switch:', error);
    // On error, assume feature is disabled (fail closed) for security.
    return true;
  }
}

/**
 * Require that a feature is not killed by a kill switch
 * Returns true if allowed to proceed, or an error response if blocked
 */
export async function requireFeatureEnabled(killSwitchKey: string): Promise<
  { allowed: true } | KillSwitchBlockedResponse
> {
  const isKilled = await isKillSwitchEnabled(killSwitchKey);

  if (isKilled) {
    return {
      error: 'This feature is currently disabled by system administrators',
      code: 503,
      killSwitch: killSwitchKey,
    };
  }

  return { allowed: true };
}

/**
 * Combined check: require role AND feature enabled
 */
export async function requireRoleAndFeature(
  requiredRole: UserRole,
  killSwitchKey: string
): Promise<
  { session: Session } | UnauthorizedResponse | KillSwitchBlockedResponse
> {
  // Check role first
  const roleResult = await requireRole(requiredRole);
  if ('error' in roleResult) {
    return roleResult;
  }

  // Then check kill switch
  const featureResult = await requireFeatureEnabled(killSwitchKey);
  if ('error' in featureResult) {
    return featureResult;
  }

  return roleResult;
}

/**
 * Log unauthorized access attempts for security monitoring
 */
function logUnauthorizedAttempt(
  userId: string,
  action: string,
  details?: string
): void {
  const timestamp = new Date().toISOString();
  const message = `[SECURITY] Unauthorized attempt | Time: ${timestamp} | User: ${userId} | Action: ${action}${details ? ` | Details: ${details}` : ''}`;
  console.warn(message);
  // TODO: In production, send to security monitoring service
}

// Export kill switch keys for convenience
export { KILL_SWITCH_KEYS };
