'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getRiskLevel, getRiskColorClasses, formatRiskScore } from '@/src/lib/deconfliction';

interface RiskGaugeProps {
  score: number;
  showLabel?: boolean;
  showBreakdown?: boolean;
  breakdown?: {
    abuseipdb: number;
    otx: number;
  };
  sources?: string[];
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Visual risk gauge component showing unified risk score
 * with color-coded progress bar and optional breakdown
 */
export function RiskGauge({
  score,
  showLabel = true,
  showBreakdown = false,
  breakdown,
  sources = [],
  size = 'md',
}: RiskGaugeProps) {
  const level = getRiskLevel(score);
  const colors = getRiskColorClasses(level);
  
  const levelLabels = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical',
  };

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  const scoreSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full ${colors.bg}`}>
            <span className={`${scoreSizeClasses[size]} font-bold ${colors.text}`}>
              {formatRiskScore(score)}
            </span>
          </div>
          {showLabel && (
            <div>
              <div className="text-sm font-medium">Unified Risk Score</div>
              <Badge 
                variant="outline" 
                className={`${colors.bg} ${colors.text} ${colors.border}`}
              >
                {levelLabels[level]}
              </Badge>
            </div>
          )}
        </div>
        
        {sources.length > 0 && (
          <div className="flex gap-1">
            {sources.map((source) => (
              <Badge key={source} variant="secondary" className="text-xs">
                {source}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Progress 
        value={score} 
        className={`${sizeClasses[size]} ${colors.bg}`}
      />

      {showBreakdown && breakdown && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>AbuseIPDB: {breakdown.abuseipdb} pts</span>
          <span>OTX: {breakdown.otx} pts</span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact risk indicator for table rows
 */
export function RiskIndicator({ score }: { score: number }) {
  const level = getRiskLevel(score);
  const colors = getRiskColorClasses(level);
  
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${colors.bg.replace('/10', '')}`} />
      <span className={`font-mono text-sm ${colors.text}`}>
        {formatRiskScore(score)}
      </span>
    </div>
  );
}
