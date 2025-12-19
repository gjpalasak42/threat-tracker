'use server';

/**
 * Admin Server Actions
 * 
 * Server actions for user management and system configuration.
 * All actions require ADMIN role.
 */

import { db } from '@/src/db/db';
import { users, systemConfig, KILL_SWITCH_KEYS, type UserRole } from '@/src/db/schema';
import { requireRole } from '@/src/lib/auth-guards';
import { eq, desc } from 'drizzle-orm';

export interface UserListItem {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AdminActionResult {
  success: boolean;
  error?: string;
}

export interface SystemConfigItem {
  key: string;
  value: boolean;
  description: string | null;
}

/**
 * Get all users for admin management
 */
export async function getAllUsers(): Promise<
  { success: true; users: UserListItem[] } | { success: false; error: string; code: number }
> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error, code: authResult.code };
  }

  try {
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
      .from(users)
      .orderBy(desc(users.createdAt));

    return {
      success: true,
      users: allUsers.map(u => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return { success: false, error: 'Failed to fetch users', code: 500 };
  }
}

/**
 * Update a user's role
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<AdminActionResult> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error };
  }

  const currentUserId = authResult.session.user.id;

  // Prevent self-demotion from ADMIN
  if (userId === currentUserId && newRole !== 'ADMIN') {
    return { success: false, error: 'Cannot demote yourself from ADMIN role' };
  }

  // Validate role
  const validRoles: UserRole[] = ['ADMIN', 'API_USER', 'STANDARD_USER'];
  if (!validRoles.includes(newRole)) {
    return { success: false, error: 'Invalid role specified' };
  }

  try {
    await db.update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error('Failed to update user role:', error);
    return { success: false, error: 'Failed to update user role' };
  }
}

/**
 * Toggle user active status
 */
export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<AdminActionResult> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error };
  }

  const currentUserId = authResult.session.user.id;

  // Prevent self-deactivation
  if (userId === currentUserId && !isActive) {
    return { success: false, error: 'Cannot deactivate your own account' };
  }

  try {
    await db.update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error('Failed to toggle user status:', error);
    return { success: false, error: 'Failed to update user status' };
  }
}

/**
 * Get all system configuration (kill switches)
 */
export async function getSystemConfig(): Promise<
  { success: true; config: SystemConfigItem[] } | { success: false; error: string; code: number }
> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error, code: authResult.code };
  }

  try {
    const config = await db.select({
      key: systemConfig.key,
      value: systemConfig.value,
      description: systemConfig.description,
    }).from(systemConfig);

    // Ensure all kill switch keys exist with defaults
    const defaultConfigs: SystemConfigItem[] = [
      { key: KILL_SWITCH_KEYS.REGISTRATION_ENABLED, value: true, description: 'Allow new user registrations' },
      { key: KILL_SWITCH_KEYS.EXTERNAL_API_ENABLED, value: true, description: 'Allow external API queries (AbuseIPDB)' },
      { key: KILL_SWITCH_KEYS.DATABASE_SEARCH_ENABLED, value: true, description: 'Allow local database searches' },
    ];

    // Merge existing config with defaults
    const mergedConfig = defaultConfigs.map(defaultItem => {
      const existing = config.find(c => c.key === defaultItem.key);
      return existing || defaultItem;
    });

    return { success: true, config: mergedConfig };
  } catch (error) {
    console.error('Failed to fetch system config:', error);
    return { success: false, error: 'Failed to fetch system configuration', code: 500 };
  }
}

/**
 * Update a kill switch value
 */
export async function updateKillSwitch(
  key: string,
  value: boolean
): Promise<AdminActionResult> {
  const authResult = await requireRole('ADMIN');
  if ('error' in authResult) {
    return { success: false, error: authResult.error };
  }

  // Validate key
  const validKeys = Object.values(KILL_SWITCH_KEYS);
  if (!validKeys.includes(key as typeof validKeys[number])) {
    return { success: false, error: 'Invalid configuration key' };
  }

  try {
    // Upsert the config
    await db.insert(systemConfig)
      .values({
        key,
        value,
        description: getKillSwitchDescription(key),
        updatedBy: authResult.session.user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value,
          updatedBy: authResult.session.user.id,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (error) {
    console.error('Failed to update kill switch:', error);
    return { success: false, error: 'Failed to update configuration' };
  }
}

function getKillSwitchDescription(key: string): string {
  switch (key) {
    case KILL_SWITCH_KEYS.REGISTRATION_ENABLED:
      return 'Allow new user registrations';
    case KILL_SWITCH_KEYS.EXTERNAL_API_ENABLED:
      return 'Allow external API queries (AbuseIPDB)';
    case KILL_SWITCH_KEYS.DATABASE_SEARCH_ENABLED:
      return 'Allow local database searches';
    default:
      return '';
  }
}
