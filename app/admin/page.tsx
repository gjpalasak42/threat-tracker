'use client';

/**
 * Admin Panel Page
 * 
 * User management, system configuration, and threat intelligence controls
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getAllUsers, 
  updateUserRole, 
  toggleUserActive,
  getSystemConfig,
  updateKillSwitch,
  getThreatIntelStatus,
  triggerAbuseIPDBSync,
  triggerOTXSync,
  getLockedAccountsAdmin,
  unlockAccountAdmin,
  type UserListItem,
  type SystemConfigItem,
  type SyncStatusInfo,
  type TriggerSyncResult,
  type AccountLockoutInfo,
} from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Shield, 
  Users, 
  Settings, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  XCircle,
  Clock,
  Download,
  Loader2,
  Lock,
  Unlock
} from 'lucide-react';

type UserRole = 'ADMIN' | 'API_USER' | 'STANDARD_USER';

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [config, setConfig] = useState<SystemConfigItem[]>([]);
  const [threatIntelSources, setThreatIntelSources] = useState<SyncStatusInfo[]>([]);
  const [lockedAccounts, setLockedAccounts] = useState<AccountLockoutInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingConfig, setUpdatingConfig] = useState<string | null>(null);
  const [syncingSource, setSyncingSource] = useState<string | null>(null);
  const [unlockingEmail, setUnlockingEmail] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [usersResult, configResult, threatIntelResult, lockoutsResult] = await Promise.all([
        getAllUsers(),
        getSystemConfig(),
        getThreatIntelStatus(),
        getLockedAccountsAdmin(),
      ]);

      if (!usersResult.success) {
        if (usersResult.code === 401 || usersResult.code === 403) {
          router.push('/auth/login');
          return;
        }
        setError(usersResult.error);
        return;
      }

      if (!configResult.success) {
        setError(configResult.error);
        return;
      }

      setUsers(usersResult.users);
      setConfig(configResult.config);
      
      if (threatIntelResult.success) {
        setThreatIntelSources(threatIntelResult.sources);
      }
      
      if (lockoutsResult.success) {
        setLockedAccounts(lockoutsResult.lockouts);
      }
    } catch {
      setError('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage]);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdatingUserId(userId);
    const result = await updateUserRole(userId, newRole);
    
    if (result.success) {
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
    } else {
      setError(result.error || 'Failed to update role');
    }
    setUpdatingUserId(null);
  }

  async function handleActiveToggle(userId: string, isActive: boolean) {
    setUpdatingUserId(userId);
    const result = await toggleUserActive(userId, isActive);
    
    if (result.success) {
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, isActive } : u
      ));
    } else {
      setError(result.error || 'Failed to update status');
    }
    setUpdatingUserId(null);
  }

  async function handleKillSwitchToggle(key: string, value: boolean) {
    setUpdatingConfig(key);
    const result = await updateKillSwitch(key, value);
    
    if (result.success) {
      setConfig(prev => prev.map(c => 
        c.key === key ? { ...c, value } : c
      ));
    } else {
      setError(result.error || 'Failed to update configuration');
    }
    setUpdatingConfig(null);
  }

  async function handleSync(source: 'AbuseIPDB' | 'OTX') {
    setSyncingSource(source);
    setError(null);
    
    let result: TriggerSyncResult;
    
    if (source === 'AbuseIPDB') {
      result = await triggerAbuseIPDBSync();
    } else {
      result = await triggerOTXSync();
    }
    
    if (result.success) {
      setSuccessMessage(
        `${source} sync completed: ${result.inserted ?? 0} inserted, ${result.updated ?? 0} updated`
      );
      // Refresh threat intel status
      const statusResult = await getThreatIntelStatus();
      if (statusResult.success) {
        setThreatIntelSources(statusResult.sources);
      }
    } else {
      setError(result.error || `${source} sync failed`);
    }
    
    setSyncingSource(null);
  }

  async function handleUnlockAccount(email: string) {
    setUnlockingEmail(email);
    setError(null);
    
    const result = await unlockAccountAdmin(email);
    
    if (result.success) {
      setSuccessMessage(`Account ${email} has been unlocked`);
      // Remove from local state
      setLockedAccounts(prev => prev.filter(l => l.email !== email));
    } else {
      setError(result.error || 'Failed to unlock account');
    }
    
    setUnlockingEmail(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users, system settings, and threat intelligence</p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-2 p-4 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            Dismiss
          </Button>
        </div>
      )}

      {/* Account Lockouts */}
      {lockedAccounts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-amber-500">Account Lockouts</CardTitle>
              <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-500 border-amber-500/30">
                {lockedAccounts.length}
              </Badge>
            </div>
            <CardDescription>
              Accounts locked due to failed login attempts. Unlock to allow users to attempt login again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Failed Attempts</TableHead>
                  <TableHead>Locked Until</TableHead>
                  <TableHead>Last Attempt IP</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lockedAccounts.map((lockout) => (
                  <TableRow key={lockout.email}>
                    <TableCell className="font-medium">{lockout.email}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{lockout.failedAttempts}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lockout.lockedUntil ? formatRelativeTime(lockout.lockedUntil) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {lockout.lastAttemptIp || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlockAccount(lockout.email)}
                        disabled={unlockingEmail === lockout.email}
                        className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                      >
                        {unlockingEmail === lockout.email ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            Unlocking...
                          </>
                        ) : (
                          <>
                            <Unlock className="w-4 h-4 mr-1" />
                            Unlock
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Threat Intelligence Sources */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Threat Intelligence Sources</CardTitle>
          </div>
          <CardDescription>
            Monitor and manually trigger bulk sync from external threat intelligence providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {threatIntelSources.map((source) => (
              <div 
                key={source.source}
                className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    source.enabled ? 'bg-emerald-500/10' : 'bg-muted'
                  }`}>
                    {source.enabled ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{source.source}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        {source.indicatorCount.toLocaleString()} indicators
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(source.lastSync)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!source.enabled && (
                    <Badge variant="secondary" className="text-xs">
                      API key not configured
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(source.source)}
                    disabled={!source.enabled || syncingSource !== null}
                  >
                    {syncingSource === source.source ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        Sync Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
            
            {threatIntelSources.length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                No threat intelligence sources configured
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Kill Switches */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <CardTitle>System Controls</CardTitle>
          </div>
          <CardDescription>
            Kill switches for emergency system controls (DDoS protection)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {config.map((item) => (
              <div 
                key={item.key}
                className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
              >
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-sm text-muted-foreground">{item.key}</p>
                </div>
                <Button
                  variant={item.value ? 'default' : 'destructive'}
                  size="sm"
                  onClick={() => handleKillSwitchToggle(item.key, !item.value)}
                  disabled={updatingConfig === item.key}
                >
                  {updatingConfig === item.key ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    item.value ? 'Enabled' : 'Disabled'
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <CardTitle>User Management</CardTitle>
          </div>
          <CardDescription>
            Manage user roles and account status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.name || 'No name'}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                      disabled={updatingUserId === user.id}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="API_USER">API User</SelectItem>
                        <SelectItem value="STANDARD_USER">Standard</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={user.isActive 
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleActiveToggle(user.id, !user.isActive)}
                      disabled={updatingUserId === user.id}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
