'use client';

/**
 * Admin Panel Page
 * 
 * User management and system configuration for administrators
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getAllUsers, 
  updateUserRole, 
  toggleUserActive,
  getSystemConfig,
  updateKillSwitch,
  type UserListItem,
  type SystemConfigItem,
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
import { Shield, Users, Settings, AlertTriangle, RefreshCw } from 'lucide-react';

type UserRole = 'ADMIN' | 'API_USER' | 'STANDARD_USER';

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [config, setConfig] = useState<SystemConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingConfig, setUpdatingConfig] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [usersResult, configResult] = await Promise.all([
        getAllUsers(),
        getSystemConfig(),
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
    } catch {
      setError('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          <p className="text-muted-foreground">Manage users and system settings</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            Dismiss
          </Button>
        </div>
      )}

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
