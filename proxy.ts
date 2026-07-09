/**
 * Next.js request proxy for route protection.
 *
 * Route protection:
 * - /admin/*: Requires ADMIN role
 * - /investigate/*: Requires authenticated user (STANDARD_USER+)
 * - /api/sync/*: Uses its own CRON_SECRET token auth
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/src/lib/auth';
import { hasPermission } from '@/src/lib/auth-guards';
import type { UserRole } from '@/src/db/schema';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await auth();

  const protectedRoutes = [
    { path: '/admin', requiredRole: 'ADMIN' },
    { path: '/investigate', requiredRole: 'STANDARD_USER' },
  ] as const;

  for (const route of protectedRoutes) {
    if (!pathname.startsWith(route.path)) continue;

    if (!session?.user) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!session.user.isActive) {
      const errorUrl = new URL('/auth/error', request.url);
      errorUrl.searchParams.set('error', 'AccountDeactivated');
      errorUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(errorUrl);
    }

    if (!hasPermission(session.user.role as UserRole, route.requiredRole as UserRole)) {
      return NextResponse.redirect(new URL('/auth/error?error=AccessDenied', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/investigate/:path*'],
};
