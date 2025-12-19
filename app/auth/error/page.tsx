/**
 * Auth Error Page
 * 
 * Displays authentication errors in a user-friendly way
 */

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'Access denied. You do not have permission to sign in.',
  Verification: 'The sign in link is no longer valid. It may have been used already or expired.',
  AccountDeactivated: 'Your account has been deactivated. Please contact your administrator or support for assistance.',
  Default: 'An error occurred during authentication.',
};

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] || ERROR_MESSAGES.Default) : ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="w-full max-w-md border-destructive/30 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Authentication Error</CardTitle>
          <CardDescription className="text-destructive/80">
            {errorMessage}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center text-sm text-muted-foreground">
          <p>
            If this problem persists, please contact your system administrator.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Link href="/auth/login" className="w-full">
            <Button className="w-full">Try Again</Button>
          </Link>
          <Link href="/" className="w-full">
            <Button variant="outline" className="w-full">Go to Dashboard</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
