'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  investigateIp, 
  investigateIpMultiSource, 
  getUserApiAccess, 
  type InvestigateResult 
} from './actions';
import { RiskGauge } from '@/components/risk-gauge';
import { SourceBreakdown } from '@/components/source-breakdown';
import { 
  Search, 
  Globe, 
  Shield, 
  AlertTriangle, 
  Clock, 
  Loader2, 
  RefreshCw, 
  Database,
  Layers
} from 'lucide-react';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InvestigatePage() {
  const [ipAddress, setIpAddress] = useState('');
  const [result, setResult] = useState<InvestigateResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasApiAccess, setHasApiAccess] = useState(false);
  const [useMultiSource, setUseMultiSource] = useState(true);

  // Check user's API access on mount
  useEffect(() => {
    getUserApiAccess().then(setHasApiAccess);
  }, []);

  const handleSubmit = (e: React.FormEvent, forceRefresh: boolean = false) => {
    e.preventDefault();
    if (!ipAddress.trim()) return;

    startTransition(async () => {
      // Use multi-source lookup if user has API access and toggle is on
      if (hasApiAccess && useMultiSource && !forceRefresh) {
        const res = await investigateIpMultiSource(ipAddress);
        setResult(res);
      } else {
        const res = await investigateIp(ipAddress, forceRefresh);
        setResult(res);
      }
    });
  };

  const handleForceRefresh = () => {
    if (!result?.data?.ipAddress) return;
    
    startTransition(async () => {
      if (hasApiAccess && useMultiSource) {
        const res = await investigateIpMultiSource(result.data!.ipAddress);
        setResult(res);
      } else {
        const res = await investigateIp(result.data!.ipAddress, true);
        setResult(res);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Investigate IP</h1>
        <p className="text-sm text-muted-foreground">
          Check an IP address against multiple threat intelligence sources
        </p>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            IP Address Lookup
          </CardTitle>
          <CardDescription>
            Enter an IP address to check its abuse history and reputation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => handleSubmit(e, false)} className="flex gap-2">
            <Input
              type="text"
              placeholder="e.g., 8.8.8.8"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="flex-1 font-mono"
              disabled={isPending}
            />
            <Button type="submit" disabled={isPending || !ipAddress.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </form>
          
          {/* Multi-source toggle - only show for API users */}
          {hasApiAccess && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={useMultiSource ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUseMultiSource(!useMultiSource)}
                className="gap-2"
              >
                <Layers className="h-3 w-3" />
                {useMultiSource ? 'Multi-Source: ON' : 'Multi-Source: OFF'}
              </Button>
              <span className="text-xs text-muted-foreground">
                {useMultiSource 
                  ? 'Queries AbuseIPDB + AlienVault OTX'
                  : 'Queries AbuseIPDB only (uses cache when available)'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {result && !result.success && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{result.error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result Display */}
      {result?.success && result.data && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="font-mono">{result.data.ipAddress}</CardTitle>
                {/* Cache Indicator */}
                {result.fromCache ? (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                    <Database className="mr-1 h-3 w-3" />
                    Cached
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
                    Live
                  </Badge>
                )}
                {/* Multi-source indicator */}
                {result.sourcesData && (
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                    <Layers className="mr-1 h-3 w-3" />
                    Multi-Source
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Force Refresh Button - only show for users with API access */}
                {hasApiAccess && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleForceRefresh}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Refresh
                  </Button>
                )}
              </div>
            </div>
            <CardDescription>
              {result.fromCache 
                ? `Cached data from ${formatDate(result.cachedAt ?? null)}`
                : result.sourcesData 
                  ? 'Live analysis from AbuseIPDB + AlienVault OTX'
                  : 'Live analysis from AbuseIPDB'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Unified Risk Score - show if available */}
            {result.unifiedRisk && (
              <>
                <RiskGauge
                  score={result.unifiedRisk.score}
                  showBreakdown={true}
                  breakdown={result.unifiedRisk.breakdown}
                  sources={result.unifiedRisk.sources}
                  size="md"
                />
                <Separator />
              </>
            )}

            {/* Legacy single-source score display */}
            {!result.unifiedRisk && (
              <div className="flex items-center gap-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
                  result.data.abuseConfidenceScore > 75 
                    ? 'bg-destructive/10 text-destructive' 
                    : result.data.abuseConfidenceScore > 25 
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                  <span className="text-xl font-bold">{result.data.abuseConfidenceScore}%</span>
                </div>
                <div>
                  <div className="text-lg font-medium">Abuse Confidence Score</div>
                  <p className="text-sm text-muted-foreground">
                    Based on {result.data.totalReports} reports from the community
                  </p>
                </div>
              </div>
            )}

            {/* Source Breakdown Tabs - show if multi-source data available */}
            {result.sourcesData && (result.sourcesData.abuseipdb || result.sourcesData.otx) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3">Source Breakdown</h3>
                  <SourceBreakdown sourcesData={result.sourcesData} />
                </div>
              </>
            )}

            {/* Details Grid - show for non-multi-source results */}
            {!result.sourcesData && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Country</div>
                    <div className="text-sm text-muted-foreground">
                      {result.data.countryName} ({result.data.countryCode})
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Last Reported</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(result.data.lastReportedAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">ISP</div>
                    <div className="text-sm text-muted-foreground">
                      {result.data.isp || 'Unknown'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Usage Type</div>
                    <div className="text-sm text-muted-foreground">
                      {result.data.usageType || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Info */}
            <div className="flex flex-wrap gap-2">
              {result.data.isTor && (
                <Badge variant="destructive">Tor Exit Node</Badge>
              )}
              {result.data.isWhitelisted && (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">Whitelisted</Badge>
              )}
              {result.data.domain && (
                <Badge variant="outline">{result.data.domain}</Badge>
              )}
            </div>

            {/* Rate Limit Info (only shown for live requests) */}
            {!result.fromCache && result.rateLimit && (
              <div className="text-xs text-muted-foreground">
                API Rate Limit: {result.rateLimit.remaining} / {result.rateLimit.limit} requests remaining
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
