'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ThreatLog } from '@/src/db/schema';

interface ThreatTableProps {
  threats: ThreatLog[];
  showFlash?: boolean;
  flashIds?: Set<string>;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSeverityVariant(severity: number): 'default' | 'destructive' | 'secondary' {
  if (severity > 75) return 'destructive';
  if (severity > 50) return 'default';
  return 'secondary';
}

export function ThreatTable({ threats, showFlash = false, flashIds = new Set() }: ThreatTableProps) {
  if (threats.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No threats found
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Indicator</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {threats.map((threat) => (
          <TableRow
            key={threat.id}
            className={
              showFlash && flashIds.has(threat.id)
                ? 'animate-pulse bg-emerald-500/10'
                : ''
            }
          >
            <TableCell className="font-mono">{threat.indicator}</TableCell>
            <TableCell>
              <Badge variant="outline" className="uppercase text-[10px]">
                {threat.type}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={getSeverityVariant(threat.severity)}>
                {threat.severity}%
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{threat.source}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(threat.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
