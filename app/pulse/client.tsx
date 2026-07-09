'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThreatTable } from '@/components/threat-table';
import type { ThreatLog } from '@/src/db/schema';
import { Activity, Wifi, WifiOff } from 'lucide-react';

type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface PulsePageClientProps {
  initialThreats: ThreatLog[];
}

export function PulsePageClient({ initialThreats }: PulsePageClientProps) {
  const [threats, setThreats] = useState<ThreatLog[]>(initialThreats);
  const [sseStatus, setSseStatus] = useState<SSEStatus>('connecting');
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to SSE endpoint
    const eventSource = new EventSource('/api/threats/stream');
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      setSseStatus('connected');
    });

    eventSource.addEventListener('threat', (event) => {
      try {
        const newThreat = JSON.parse(event.data) as ThreatLog;
        
        // Prepend new threat to the list
        setThreats((prev) => [newThreat, ...prev.slice(0, 49)]);
        
        // Add flash effect
        setFlashIds((prev) => new Set(prev).add(newThreat.id));
        
        // Remove flash after animation
        setTimeout(() => {
          setFlashIds((prev) => {
            const next = new Set(prev);
            next.delete(newThreat.id);
            return next;
          });
        }, 2000);
      } catch (error) {
        console.error('Failed to parse threat event:', error);
      }
    });

    eventSource.addEventListener('heartbeat', () => {
      // Keep alive, status already connected
    });

    eventSource.onerror = () => {
      setSseStatus('disconnected');
      // Keep EventSource open so the browser can use its built-in retry loop.
      // A later `connected` event restores the live state automatically.
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  const getStatusBadge = () => {
    switch (sseStatus) {
      case 'connected':
        return (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
            <Wifi className="mr-1 h-3 w-3" />
            Live
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="secondary">
            <Wifi className="mr-1 h-3 w-3 animate-pulse" />
            Connecting...
          </Badge>
        );
      case 'disconnected':
      case 'error':
        return (
          <Badge variant="destructive">
            <WifiOff className="mr-1 h-3 w-3" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intelligence Pulse</h1>
          <p className="text-sm text-muted-foreground">
            Real-time threat feed from background sync operations
          </p>
        </div>
        {getStatusBadge()}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Feed
          </CardTitle>
          <CardDescription>
            New threats appear here automatically when detected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThreatTable threats={threats} showFlash={true} flashIds={flashIds} />
        </CardContent>
      </Card>
    </div>
  );
}
