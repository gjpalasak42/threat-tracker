'use server';

/**
 * Rate Limiter
 * 
 * Provides rate limiting and brute force protection for authentication.
 * Uses a hybrid approach: in-memory for IP tracking, database for account lockouts.
 */

import { db } from '@/src/db/db';
import { accountLockouts, users } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

// =============================================================================
// Configuration
// =============================================================================

/** Rate limit configuration */
const RATE_LIMIT_CONFIG = {
  login: {
    maxAttemptsPerEmail: 5,        // Max attempts before temporary block
    maxAttemptsPerIpPerHour: 20,   // IP-based limit
    blockDurationMinutes: 15,      // Temporary block duration
    accountLockoutThreshold: 10,   // Failed attempts before admin unlock required
  },
  registration: {
    maxAttemptsPerIpPerHour: 3,    // Extremely strict for enumeration prevention
    blockDurationMinutes: 60,       // 1 hour block
  },
} as const;

// =============================================================================
// In-Memory IP Rate Limiting
// =============================================================================

interface IpAttempt {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

/** In-memory storage for IP-based rate limiting */
const ipAttempts = new Map<string, IpAttempt>();

/** Cleanup interval for clearing old entries (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** TTL for IP entries (1 hour) */
const IP_ENTRY_TTL_MS = 60 * 60 * 1000;

// Periodically clean up old entries
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipAttempts.entries()) {
      if (now - data.firstAttemptAt > IP_ENTRY_TTL_MS) {
        ipAttempts.delete(ip);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Get or create IP attempt record
 */
function getIpAttempt(ip: string): IpAttempt {
  const existing = ipAttempts.get(ip);
  const now = Date.now();

  // Reset if entry is older than 1 hour
  if (existing && now - existing.firstAttemptAt > IP_ENTRY_TTL_MS) {
    ipAttempts.delete(ip);
    return { count: 0, firstAttemptAt: now };
  }

  return existing || { count: 0, firstAttemptAt: now };
}

// =============================================================================
// Rate Limit Result Types
// =============================================================================

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'rate_limit' | 'account_locked';
  retryAfterSeconds?: number;
  remainingAttempts?: number;
}

export interface AccountLockoutInfo {
  email: string;
  failedAttempts: number;
  lockedUntil: string | null;
  lastAttemptAt: string;
  lastAttemptIp: string | null;
  userId: string | null;
}

// =============================================================================
// Login Rate Limiting
// =============================================================================

/**
 * Check if a login attempt should be allowed
 * 
 * @param email - The email being used to attempt login
 * @param ip - The IP address of the requester
 * @returns Whether the attempt is allowed and any restrictions
 */
export async function checkLoginRateLimit(
  email: string,
  ip: string
): Promise<RateLimitResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();

  // Check IP-based rate limit first
  const ipData = getIpAttempt(ip);
  if (ipData.blockedUntil && now < ipData.blockedUntil) {
    return {
      allowed: false,
      reason: 'rate_limit',
      retryAfterSeconds: Math.ceil((ipData.blockedUntil - now) / 1000),
    };
  }

  if (ipData.count >= RATE_LIMIT_CONFIG.login.maxAttemptsPerIpPerHour) {
    ipData.blockedUntil = now + RATE_LIMIT_CONFIG.login.blockDurationMinutes * 60 * 1000;
    ipAttempts.set(ip, ipData);
    return {
      allowed: false,
      reason: 'rate_limit',
      retryAfterSeconds: RATE_LIMIT_CONFIG.login.blockDurationMinutes * 60,
    };
  }

  // Check email-based lockout from database
  try {
    const lockout = await db.select()
      .from(accountLockouts)
      .where(eq(accountLockouts.email, normalizedEmail))
      .limit(1);

    if (lockout.length > 0) {
      const record = lockout[0];

      // Check if account is locked (admin unlock required)
      if (record.lockedUntil) {
        const lockedUntilTime = new Date(record.lockedUntil).getTime();
        
        if (now < lockedUntilTime) {
          return {
            allowed: false,
            reason: 'account_locked',
            retryAfterSeconds: Math.ceil((lockedUntilTime - now) / 1000),
          };
        }
      }

      // Check if approaching lockout
      const remainingAttempts = Math.max(
        0,
        RATE_LIMIT_CONFIG.login.maxAttemptsPerEmail - record.failedAttempts
      );

      if (remainingAttempts === 0) {
        // Too many attempts but no lockout time set - they're in the warning zone
        return {
          allowed: true,
          remainingAttempts: 0,
        };
      }

      return {
        allowed: true,
        remainingAttempts,
      };
    }
  } catch (error) {
    console.error('Error checking login rate limit:', error);
    // Allow on error to avoid blocking legitimate users
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt
 * 
 * @param email - The email that failed login
 * @param ip - The IP address of the requester
 */
export async function recordFailedAttempt(
  email: string,
  ip: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  // Update IP-based counter
  const ipData = getIpAttempt(ip);
  ipData.count++;
  ipAttempts.set(ip, ipData);

  // Update database record
  try {
    const existing = await db.select()
      .from(accountLockouts)
      .where(eq(accountLockouts.email, normalizedEmail))
      .limit(1);

    // Find associated user ID if exists
    const user = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const userId = user.length > 0 ? user[0].id : null;

    if (existing.length > 0) {
      const newFailedAttempts = existing[0].failedAttempts + 1;
      
      // Determine if account should be locked
      let lockedUntil: Date | null = null;
      
      if (newFailedAttempts >= RATE_LIMIT_CONFIG.login.accountLockoutThreshold) {
        // Account lockout - requires admin to unlock (set to distant future)
        lockedUntil = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
      } else if (newFailedAttempts >= RATE_LIMIT_CONFIG.login.maxAttemptsPerEmail) {
        // Temporary block
        lockedUntil = new Date(now.getTime() + RATE_LIMIT_CONFIG.login.blockDurationMinutes * 60 * 1000);
      }

      await db.update(accountLockouts)
        .set({
          failedAttempts: newFailedAttempts,
          lockedUntil,
          lastAttemptAt: now,
          lastAttemptIp: ip,
          userId: userId || existing[0].userId,
          // Clear any previous unlock data
          unlockedBy: null,
          unlockedAt: null,
        })
        .where(eq(accountLockouts.email, normalizedEmail));
    } else {
      // Create new lockout record
      await db.insert(accountLockouts)
        .values({
          email: normalizedEmail,
          userId,
          failedAttempts: 1,
          lastAttemptAt: now,
          lastAttemptIp: ip,
        });
    }
  } catch (error) {
    console.error('Error recording failed attempt:', error);
  }
}

/**
 * Record a successful login (resets failed attempts)
 * 
 * @param email - The email that successfully logged in
 */
export async function recordSuccessfulLogin(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  try {
    await db.delete(accountLockouts)
      .where(eq(accountLockouts.email, normalizedEmail));
  } catch (error) {
    console.error('Error clearing lockout on successful login:', error);
  }
}

// =============================================================================
// Registration Rate Limiting
// =============================================================================

/**
 * Check if a registration attempt should be allowed
 * Uses extremely strict IP-based limiting to prevent user enumeration
 * 
 * @param ip - The IP address of the requester
 * @returns Whether the attempt is allowed
 */
export async function checkRegistrationRateLimit(ip: string): Promise<RateLimitResult> {
  const now = Date.now();
  const ipData = getIpAttempt(ip);

  // Check if currently blocked
  if (ipData.blockedUntil && now < ipData.blockedUntil) {
    return {
      allowed: false,
      reason: 'rate_limit',
      retryAfterSeconds: Math.ceil((ipData.blockedUntil - now) / 1000),
    };
  }

  // Check if limit exceeded
  if (ipData.count >= RATE_LIMIT_CONFIG.registration.maxAttemptsPerIpPerHour) {
    ipData.blockedUntil = now + RATE_LIMIT_CONFIG.registration.blockDurationMinutes * 60 * 1000;
    ipAttempts.set(ip, ipData);
    return {
      allowed: false,
      reason: 'rate_limit',
      retryAfterSeconds: RATE_LIMIT_CONFIG.registration.blockDurationMinutes * 60,
    };
  }

  const remainingAttempts = RATE_LIMIT_CONFIG.registration.maxAttemptsPerIpPerHour - ipData.count;
  return { allowed: true, remainingAttempts };
}

/**
 * Record a registration attempt (regardless of success/failure)
 * 
 * @param ip - The IP address of the requester
 */
export async function recordRegistrationAttempt(ip: string): Promise<void> {
  const ipData = getIpAttempt(ip);
  ipData.count++;
  ipAttempts.set(ip, ipData);
}

// =============================================================================
// Account Lockout Queries (for Admin)
// =============================================================================

/**
 * Check if an account is currently locked
 * 
 * @param email - The email to check
 * @returns Whether the account is locked
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();

  try {
    const lockout = await db.select({ lockedUntil: accountLockouts.lockedUntil })
      .from(accountLockouts)
      .where(eq(accountLockouts.email, normalizedEmail))
      .limit(1);

    if (lockout.length === 0 || !lockout[0].lockedUntil) {
      return false;
    }

    return new Date(lockout[0].lockedUntil).getTime() > now;
  } catch (error) {
    console.error('Error checking account lock status:', error);
    return false;
  }
}

/**
 * Get all currently locked accounts (for admin panel)
 * 
 * @returns List of locked account information
 */
export async function getLockedAccounts(): Promise<AccountLockoutInfo[]> {
  const now = new Date();

  try {
    const lockouts = await db.select({
      email: accountLockouts.email,
      failedAttempts: accountLockouts.failedAttempts,
      lockedUntil: accountLockouts.lockedUntil,
      lastAttemptAt: accountLockouts.lastAttemptAt,
      lastAttemptIp: accountLockouts.lastAttemptIp,
      userId: accountLockouts.userId,
    })
      .from(accountLockouts)
      .orderBy(accountLockouts.lastAttemptAt);

    // Filter to only return currently locked accounts
    return lockouts
      .filter(l => l.lockedUntil && new Date(l.lockedUntil) > now)
      .map(l => ({
        email: l.email,
        failedAttempts: l.failedAttempts,
        lockedUntil: l.lockedUntil?.toISOString() ?? null,
        lastAttemptAt: l.lastAttemptAt.toISOString(),
        lastAttemptIp: l.lastAttemptIp,
        userId: l.userId,
      }));
  } catch (error) {
    console.error('Error getting locked accounts:', error);
    return [];
  }
}

/**
 * Unlock an account (admin action)
 * 
 * @param email - The email to unlock
 * @param adminUserId - The admin performing the unlock
 * @returns Success status
 */
export async function unlockAccount(
  email: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  try {
    const result = await db.update(accountLockouts)
      .set({
        lockedUntil: null,
        failedAttempts: 0,
        unlockedBy: adminUserId,
        unlockedAt: now,
      })
      .where(eq(accountLockouts.email, normalizedEmail))
      .returning({ id: accountLockouts.id });

    if (result.length === 0) {
      return { success: false, error: 'Account lockout record not found' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error unlocking account:', error);
    return { success: false, error: 'Failed to unlock account' };
  }
}
