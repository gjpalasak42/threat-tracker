/**
 * Next.js Middleware
 * 
 * Protects routes based on authentication status and user roles.
 * 
 * Route protection:
 * - /admin/*: Requires ADMIN role
 * - /investigate/*: Requires authenticated user (STANDARD_USER+)
 * - /api/sync/*: Requires authenticated user
 * - /auth/*: Accessible to all (for login/signup)
 * - /: Public (dashboard snapshot)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/src/lib/auth';
import { hasPermission } from '@/src/lib/auth-guards';
import type { UserRole } from '@/src/db/schema';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get session
  const session = await auth();

  // Define route protection rules
  const protectedRoutes = [
    { path: '/admin', requiredRole: 'ADMIN' },
    { path: '/investigate', requiredRole: 'STANDARD_USER' },
    { path: '/api/sync', requiredRole: 'STANDARD_USER' },
  ];

  // Check if current path matches any protected route
  for (const route of protectedRoutes) {
    if (pathname.startsWith(route.path)) {
      // Not authenticated - redirect to login
      if (!session?.user) {
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Check if user is active; inactive users are redirected with a specific error
      if (!session.user.isActive) {
        const errorUrl = new URL('/auth/error', request.url);
        errorUrl.searchParams.set('error', 'AccountDeactivated');
        errorUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(errorUrl);
      }

      // Check role using hierarchy-aware permission check
      const userRole = session.user.role as UserRole;
      const requiredRole = route.requiredRole as UserRole;
      if (!hasPermission(userRole, requiredRole)) {
        // User is authenticated but lacks required permissions
        return NextResponse.redirect(new URL('/auth/error?error=AccessDenied', request.url));
      }
    }
  }

  // Allow the request to continue
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all protected routes
    '/admin/:path*',
    '/investigate/:path*',
    '/api/sync/:path*',
  ],
};
