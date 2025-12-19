import type { UserRole } from '@/src/db/schema';
import 'next-auth';

declare module 'next-auth' {
  /**
   * Extended User interface with RBAC fields
   */
  interface User {
    id: string;
    role: UserRole;
    isActive: boolean;
  }

  /**
   * Extended Session interface with user role info
   */
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      isActive: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extended JWT interface with role and active status
   */
  interface JWT {
    id: string;
    role: UserRole;
    isActive: boolean;
  }
}
