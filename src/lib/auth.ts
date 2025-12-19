/**
 * Auth.js v5 Configuration
 * 
 * Configures authentication with Credentials Provider for PostgreSQL.
 * Uses JWT strategy for serverless compatibility.
 * Includes RBAC role management and INITIAL_ADMIN_EMAIL auto-promotion.
 * 
 * Note: For Credentials provider with JWT strategy, we don't use the
 * Drizzle adapter since we handle user operations (registration, lookup)
 * manually through our own functions.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/db';
import { users, type UserRole } from '@/src/db/schema';

/**
 * Normalize email for consistent storage and lookup
 * Prevents duplicate/similar email attacks
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if an email should be auto-promoted to ADMIN
 * Uses INITIAL_ADMIN_EMAIL environment variable
 */
function shouldBeAdmin(email: string): boolean {
  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
  if (!initialAdminEmail) return false;
  return normalizeEmail(email) === normalizeEmail(initialAdminEmail);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // No adapter needed - we use JWT strategy and handle user ops manually
  session: {
    strategy: 'jwt', // Use JWT for serverless compatibility
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = normalizeEmail(credentials.email as string);
        const password = credentials.password as string;

        // Find user by normalized email
        const user = await db.select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (user.length === 0) {
          return null;
        }

        const foundUser = user[0];

        // Check if user is active
        if (!foundUser.isActive) {
          return null;
        }

        // Verify password
        if (!foundUser.hashedPassword) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, foundUser.hashedPassword);
        if (!passwordMatch) {
          return null;
        }

        return {
          id: foundUser.id,
          name: foundUser.name,
          email: foundUser.email,
          role: foundUser.role,
          isActive: foundUser.isActive,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign in, add role and isActive to token
      if (user) {
        token.id = user.id as string;
        token.role = user.role as UserRole;
        token.isActive = user.isActive as boolean;
      }
      return token;
    },
    async session({ session, token }) {
      // Add role and isActive to session from JWT
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
  },
});

/**
 * Register a new user with Credentials
 * 
 * @param name - User's display name
 * @param email - User's email address
 * @param password - Plain text password (will be hashed)
 * @returns The created user or error
 */
export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  try {
    const normalizedEmail = normalizeEmail(email);

    // Check if user already exists
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'A user with this email already exists' };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Determine role - ADMIN if matches INITIAL_ADMIN_EMAIL, otherwise STANDARD_USER
    const role: UserRole = shouldBeAdmin(normalizedEmail) ? 'ADMIN' : 'STANDARD_USER';

    // Create user
    const result = await db.insert(users)
      .values({
        name,
        email: normalizedEmail,
        hashedPassword,
        role,
        isActive: true,
      })
      .returning({ id: users.id });

    if (result.length === 0) {
      return { success: false, error: 'Failed to create user' };
    }

    return { success: true, userId: result[0].id };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
