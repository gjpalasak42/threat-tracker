/**
 * Deconfliction Engine
 * 
 * Calculates unified risk scores by combining data from multiple threat intelligence sources.
 * Uses a weighted algorithm to produce a single "deconflicted" score representing
 * overall threat confidence.
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Input data for unified risk calculation
 */
export interface IndicatorData {
  /** AbuseIPDB abuse confidence score (0-100) */
  abuseScore?: number;
  /** Number of OTX pulses the indicator appears in */
  otxPulseCount?: number;
}

/**
 * Result of unified risk calculation
 */
export interface UnifiedRiskResult {
  /** Final unified risk score (0-100) */
  score: number;
  /** Breakdown of contributing scores by source */
  breakdown: {
    abuseipdb: number;
    otx: number;
  };
  /** Sources that contributed data */
  sources: ('AbuseIPDB' | 'OTX')[];
  /** Risk level classification */
  level: 'low' | 'medium' | 'high' | 'critical';
}

// =============================================================================
// Constants
// =============================================================================

/** Weight for AbuseIPDB score (60%) */
const ABUSE_WEIGHT = 0.6;

/** Maximum contribution from OTX pulse count (40%) */
const OTX_MAX_CONTRIBUTION = 40;

/** Points per OTX pulse (10 points each, capped at OTX_MAX_CONTRIBUTION) */
const OTX_POINTS_PER_PULSE = 10;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Calculate unified risk score from multiple threat intelligence sources
 * 
 * Formula: FinalScore = (AbuseScore * 0.6) + (min(OTXPulses * 10, 40))
 * 
 * The logic ensures that:
 * - AbuseIPDB contributes up to 60 points (based on 0-100 score)
 * - OTX contributes up to 40 points (based on pulse presence)
 * - If both sources agree a threat is real, score trends toward 100
 * 
 * @param data - Indicator data from various sources
 * @returns Unified risk result with score, breakdown, and classification
 */
export function calculateUnifiedRisk(data: IndicatorData): UnifiedRiskResult {
  const sources: ('AbuseIPDB' | 'OTX')[] = [];
  
  // Calculate AbuseIPDB contribution
  let abuseContribution = 0;
  if (data.abuseScore !== undefined && data.abuseScore !== null) {
    // Clamp to valid range
    const clampedScore = Math.max(0, Math.min(100, data.abuseScore));
    abuseContribution = clampedScore * ABUSE_WEIGHT;
    sources.push('AbuseIPDB');
  }
  
  // Calculate OTX contribution
  let otxContribution = 0;
  if (data.otxPulseCount !== undefined && data.otxPulseCount !== null && data.otxPulseCount > 0) {
    // Each pulse adds 10 points, capped at 40
    otxContribution = Math.min(data.otxPulseCount * OTX_POINTS_PER_PULSE, OTX_MAX_CONTRIBUTION);
    sources.push('OTX');
  }
  
  // Calculate final score
  const finalScore = Math.round(abuseContribution + otxContribution);
  
  // Clamp final score to 0-100
  const clampedFinalScore = Math.max(0, Math.min(100, finalScore));
  
  return {
    score: clampedFinalScore,
    breakdown: {
      abuseipdb: Math.round(abuseContribution),
      otx: Math.round(otxContribution),
    },
    sources,
    level: getRiskLevel(clampedFinalScore),
  };
}

/**
 * Determine risk level classification based on score
 * 
 * @param score - Risk score (0-100)
 * @returns Risk level classification
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 76) return 'critical';
  if (score >= 51) return 'high';
  if (score >= 26) return 'medium';
  return 'low';
}

/**
 * Get color class for risk level (for UI styling)
 * 
 * @param level - Risk level
 * @returns Tailwind color classes
 */
export function getRiskColorClasses(level: 'low' | 'medium' | 'high' | 'critical'): {
  bg: string;
  text: string;
  border: string;
} {
  switch (level) {
    case 'critical':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-500',
        border: 'border-red-500/30',
      };
    case 'high':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-500',
        border: 'border-orange-500/30',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-500',
        border: 'border-yellow-500/30',
      };
    case 'low':
    default:
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-500',
        border: 'border-emerald-500/30',
      };
  }
}

/**
 * Format risk score for display with percentage
 * 
 * @param score - Risk score (0-100)
 * @returns Formatted string like "75%"
 */
export function formatRiskScore(score: number): string {
  return `${Math.round(score)}%`;
}
