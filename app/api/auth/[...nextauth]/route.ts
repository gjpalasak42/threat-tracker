/**
 * Auth.js API Route Handler
 * 
 * Handles all authentication routes (/api/auth/*)
 */

import { handlers } from '@/src/lib/auth';

export const { GET, POST } = handlers;
