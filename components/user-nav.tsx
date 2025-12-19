'use client';

/**
 * User Navigation Component
 * 
 * Displays auth status in the header:
 * - Sign In button when not authenticated
 * - User greeting, role badge, and sign out when authenticated
 * - Admin panel link for ADMIN users
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogIn, LogOut, Shield, Zap, AlertCircle } from 'lucide-react';
import { signOutAction } from '@/app/auth/actions';

interface UserNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: 'ADMIN' | 'API_USER' | 'STANDARD_USER';
  } | null;
}

export function UserNav({ user }: UserNavProps) {
  const router = useRouter();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOutAction();
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error during sign out:', error);
      setSignOutError('Sign out failed');
      // Auto-clear error after 5 seconds
      setTimeout(() => setSignOutError(null), 5000);
    }
  }

  // Not authenticated - show Sign In button
  if (!user) {
    return (
      <Link href="/auth/login">
        <Button variant="outline" size="sm" className="gap-1.5">
          <LogIn className="w-3.5 h-3.5" />
          Sign In
        </Button>
      </Link>
    );
  }

  // Get display name
  const displayName = user.name || user.email?.split('@')[0] || 'User';

  return (
    <div className="flex items-center gap-3">
      {/* Role badges */}
      {user.role === 'ADMIN' && (
        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 gap-1">
          <Shield className="w-3 h-3" />
          Admin
        </Badge>
      )}
      
      {(user.role === 'API_USER' || user.role === 'ADMIN') && (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 gap-1">
          <Zap className="w-3 h-3" />
          API Access
        </Badge>
      )}

      {/* User greeting */}
      <span className="text-sm text-muted-foreground">
        Hello, <span className="text-foreground font-medium">{displayName}</span>
      </span>

      {/* Admin panel link */}
      {user.role === 'ADMIN' && (
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            Admin Panel
          </Button>
        </Link>
      )}

      {/* Sign out error - inline display */}
      {signOutError && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="w-3 h-3" />
          {signOutError}
        </span>
      )}

      {/* Sign out button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleSignOut}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="w-3.5 h-3.5" />
        Sign Out
      </Button>
    </div>
  );
}
