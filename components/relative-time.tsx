'use client';

import { useEffect, useState } from 'react';

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RelativeTime({ date }: { date: string | null }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Determine update frequency
    // If > 24 hours (showing days), no need to auto-update
    // If < 24 hours, update every minute to capture minute/hour changes
    if (!date) return;
    
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (diffMs > oneDayMs) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [date]);

  return <span>{formatRelativeTime(date)}</span>;
}
