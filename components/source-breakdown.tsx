'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, Tag, Users, Calendar, Shield, AlertTriangle } from 'lucide-react';
import type { SourcesData } from '@/src/db/schema';

interface SourceBreakdownProps {
  sourcesData?: SourcesData;
  defaultTab?: 'abuseipdb' | 'otx';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Tabbed source breakdown component showing data from each threat intelligence source
 */
export function SourceBreakdown({ sourcesData, defaultTab = 'abuseipdb' }: SourceBreakdownProps) {
  const hasAbuseIPDB = !!sourcesData?.abuseipdb;
  const hasOTX = !!sourcesData?.otx;

  if (!hasAbuseIPDB && !hasOTX) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No source data available
      </div>
    );
  }

  return (
    <Tabs defaultValue={hasAbuseIPDB ? defaultTab : 'otx'} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="abuseipdb" disabled={!hasAbuseIPDB}>
          <Shield className="mr-2 h-4 w-4" />
          AbuseIPDB
          {hasAbuseIPDB && sourcesData?.abuseipdb?.confidence !== undefined && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {sourcesData.abuseipdb.confidence}%
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="otx" disabled={!hasOTX}>
          <AlertTriangle className="mr-2 h-4 w-4" />
          AlienVault OTX
          {hasOTX && sourcesData?.otx?.pulseCount !== undefined && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {sourcesData.otx.pulseCount} pulses
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      {/* AbuseIPDB Tab */}
      <TabsContent value="abuseipdb" className="mt-4">
        {sourcesData?.abuseipdb && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Confidence Score</div>
                <div className="text-lg font-semibold">{sourcesData.abuseipdb.confidence}%</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Total Reports</div>
                <div className="text-lg font-semibold">{sourcesData.abuseipdb.reports}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Last Reported</div>
                <div className="text-sm">{formatDate(sourcesData.abuseipdb.lastReported)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">ISP</div>
                <div className="text-sm">{sourcesData.abuseipdb.isp || 'Unknown'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Usage Type</div>
                <div className="text-sm">{sourcesData.abuseipdb.usageType || 'Unknown'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Country</div>
                <div className="text-sm">
                  {sourcesData.abuseipdb.countryName || 'Unknown'} 
                  {sourcesData.abuseipdb.countryCode && ` (${sourcesData.abuseipdb.countryCode})`}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {sourcesData.abuseipdb.isTor && (
                <Badge variant="destructive">Tor Exit Node</Badge>
              )}
              {sourcesData.abuseipdb.isWhitelisted && (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
                  Whitelisted
                </Badge>
              )}
              {sourcesData.abuseipdb.domain && (
                <Badge variant="outline">{sourcesData.abuseipdb.domain}</Badge>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Data fetched: {formatDate(sourcesData.abuseipdb.fetchedAt)}
            </div>
          </div>
        )}
      </TabsContent>

      {/* OTX Tab */}
      <TabsContent value="otx" className="mt-4">
        {sourcesData?.otx && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Pulse Count</div>
                <div className="text-lg font-semibold">{sourcesData.otx.pulseCount}</div>
              </div>
              {sourcesData.otx.reputation !== undefined && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Reputation</div>
                  <div className="text-lg font-semibold">{sourcesData.otx.reputation}</div>
                </div>
              )}
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Country</div>
                <div className="text-sm">
                  {sourcesData.otx.countryName || 'Unknown'}
                  {sourcesData.otx.countryCode && ` (${sourcesData.otx.countryCode})`}
                </div>
              </div>
            </div>

            {/* Pulses */}
            {sourcesData.otx.pulses.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Related Pulses</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {sourcesData.otx.pulses.map((pulse) => (
                    <Card key={pulse.id} className="bg-muted/50">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="font-medium text-sm">{pulse.name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {pulse.author}
                              <Calendar className="h-3 w-3 ml-2" />
                              {formatDate(pulse.created)}
                            </div>
                            {pulse.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {pulse.tags.slice(0, 5).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs py-0">
                                    <Tag className="h-2 w-2 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                                {pulse.tags.length > 5 && (
                                  <Badge variant="outline" className="text-xs py-0">
                                    +{pulse.tags.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <a
                            href={`https://otx.alienvault.com/pulse/${pulse.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* References */}
            {sourcesData.otx.references.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">References</div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {sourcesData.otx.references.slice(0, 5).map((ref, idx) => (
                    <a
                      key={idx}
                      href={ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-500 hover:underline truncate"
                    >
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      {ref}
                    </a>
                  ))}
                  {sourcesData.otx.references.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      +{sourcesData.otx.references.length - 5} more references
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Data fetched: {formatDate(sourcesData.otx.fetchedAt)}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
