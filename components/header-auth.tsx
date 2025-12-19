/**
 * Header Auth Section
 * 
 * Server component that fetches the session and renders UserNav
 */

import { auth } from '@/src/lib/auth';
import { UserNav } from './user-nav';

export async function HeaderAuth() {
  const session = await auth();

  return (
    <UserNav 
      user={session?.user ? {
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      } : null} 
    />
  );
}
