/**
 * Deconfliction Engine Unit Tests
 * 
 * Tests for unified risk score calculation with multiple threat intelligence sources
 */

import { describe, it, expect } from 'bun:test';
import { 
  calculateUnifiedRisk, 
  getRiskLevel, 
  getRiskColorClasses, 
  formatRiskScore 
} from '../deconfliction';

describe('Deconfliction Engine', () => {
  describe('calculateUnifiedRisk', () => {
    it('should calculate correct score with only AbuseIPDB data', () => {
      const result = calculateUnifiedRisk({ abuseScore: 100 });
      
      // 100 * 0.6 = 60
      expect(result.score).toBe(60);
      expect(result.breakdown.abuseipdb).toBe(60);
      expect(result.breakdown.otx).toBe(0);
      expect(result.sources).toEqual(['AbuseIPDB']);
      expect(result.level).toBe('high');
    });

    it('should calculate correct score with only OTX data', () => {
      const result = calculateUnifiedRisk({ otxPulseCount: 4 });
      
      // 4 * 10 = 40 (capped at 40)
      expect(result.score).toBe(40);
      expect(result.breakdown.abuseipdb).toBe(0);
      expect(result.breakdown.otx).toBe(40);
      expect(result.sources).toEqual(['OTX']);
      expect(result.level).toBe('medium');
    });

    it('should calculate correct score with both sources', () => {
      const result = calculateUnifiedRisk({ 
        abuseScore: 100, 
        otxPulseCount: 5 
      });
      
      // (100 * 0.6) + min(5 * 10, 40) = 60 + 40 = 100
      expect(result.score).toBe(100);
      expect(result.breakdown.abuseipdb).toBe(60);
      expect(result.breakdown.otx).toBe(40);
      expect(result.sources).toContain('AbuseIPDB');
      expect(result.sources).toContain('OTX');
      expect(result.level).toBe('critical');
    });

    it('should cap OTX contribution at 40', () => {
      const result = calculateUnifiedRisk({ otxPulseCount: 10 });
      
      // 10 * 10 = 100, but capped at 40
      expect(result.score).toBe(40);
      expect(result.breakdown.otx).toBe(40);
    });

    it('should handle low scores correctly', () => {
      const result = calculateUnifiedRisk({ 
        abuseScore: 10, 
        otxPulseCount: 1 
      });
      
      // (10 * 0.6) + (1 * 10) = 6 + 10 = 16
      expect(result.score).toBe(16);
      expect(result.level).toBe('low');
    });

    it('should handle zero abuse score', () => {
      const result = calculateUnifiedRisk({ abuseScore: 0 });
      
      expect(result.score).toBe(0);
      expect(result.sources).toEqual(['AbuseIPDB']);
      expect(result.level).toBe('low');
    });

    it('should handle zero pulse count', () => {
      const result = calculateUnifiedRisk({ otxPulseCount: 0 });
      
      expect(result.score).toBe(0);
      expect(result.sources).toEqual([]);  // Zero pulses don't count as a source
      expect(result.level).toBe('low');
    });

    it('should handle empty input', () => {
      const result = calculateUnifiedRisk({});
      
      expect(result.score).toBe(0);
      expect(result.sources).toEqual([]);
      expect(result.level).toBe('low');
    });

    it('should clamp abuse score to valid range', () => {
      const resultHigh = calculateUnifiedRisk({ abuseScore: 150 });
      expect(resultHigh.score).toBe(60); // 100 * 0.6
      
      const resultLow = calculateUnifiedRisk({ abuseScore: -10 });
      expect(resultLow.score).toBe(0);
    });

    it('should handle decimal abuse scores', () => {
      const result = calculateUnifiedRisk({ abuseScore: 75.5 });
      
      // 75.5 * 0.6 = 45.3, rounded to 45
      expect(result.score).toBe(45);
    });
  });

  describe('getRiskLevel', () => {
    it('should return "low" for scores 0-25', () => {
      expect(getRiskLevel(0)).toBe('low');
      expect(getRiskLevel(25)).toBe('low');
    });

    it('should return "medium" for scores 26-50', () => {
      expect(getRiskLevel(26)).toBe('medium');
      expect(getRiskLevel(50)).toBe('medium');
    });

    it('should return "high" for scores 51-75', () => {
      expect(getRiskLevel(51)).toBe('high');
      expect(getRiskLevel(75)).toBe('high');
    });

    it('should return "critical" for scores 76-100', () => {
      expect(getRiskLevel(76)).toBe('critical');
      expect(getRiskLevel(100)).toBe('critical');
    });
  });

  describe('getRiskColorClasses', () => {
    it('should return emerald colors for low risk', () => {
      const colors = getRiskColorClasses('low');
      expect(colors.text).toContain('emerald');
    });

    it('should return yellow colors for medium risk', () => {
      const colors = getRiskColorClasses('medium');
      expect(colors.text).toContain('yellow');
    });

    it('should return orange colors for high risk', () => {
      const colors = getRiskColorClasses('high');
      expect(colors.text).toContain('orange');
    });

    it('should return red colors for critical risk', () => {
      const colors = getRiskColorClasses('critical');
      expect(colors.text).toContain('red');
    });
  });

  describe('formatRiskScore', () => {
    it('should format score as percentage', () => {
      expect(formatRiskScore(75)).toBe('75%');
      expect(formatRiskScore(0)).toBe('0%');
      expect(formatRiskScore(100)).toBe('100%');
    });

    it('should round decimal scores', () => {
      expect(formatRiskScore(75.4)).toBe('75%');
      expect(formatRiskScore(75.6)).toBe('76%');
    });
  });
});
