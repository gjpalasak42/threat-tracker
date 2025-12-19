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

      // Check if user is active
      if (!session.user.isActive) {
        return NextResponse.redirect(new URL('/auth/error?error=AccessDenied', request.url));
      }

      // Check role for admin routes
      if (route.requiredRole === 'ADMIN' && session.user.role !== 'ADMIN') {
        // User is authenticated but not admin - show access denied
        return NextResponse.redirect(new URL('/auth/error?error=AccessDenied', request.url));
      }

      // For STANDARD_USER routes, any authenticated user can access
      // (role hierarchy handled in server actions)
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
