/**
 * Rate Limit Estimation Service - Service Layer
 * @module RateLimitEstimationService
 */

import { ClaudeUsageRecord } from '../types';
import { UsageBaseline } from '../core/usageBaselineCalculator';
import { detectRateLimit } from '../core/rateLimitDetector';

/** Service for estimating rate limits using multiple detection methods. */
export class RateLimitEstimationService {
    
    /**
     * Estimates Rate Limit using hybrid approach.
     * @param baseline Statistical baseline from user's history
     * @param records Historical usage records for limit detection
     * @param customLimit Optional user-configured limit from VSCode settings
     * @returns Estimated Rate Limit in tokens
     */
    static calculateRateLimitEstimate(
        baseline: UsageBaseline, 
        records: ClaudeUsageRecord[],
        customLimit?: number
    ): number {
        if (customLimit && customLimit > 0) {
            return customLimit;
        }

        const detection = detectRateLimit(records);
        if (detection.detectedLimit && detection.confidence !== 'low' && detection.sampleCount >= 3) {
            let safetyMargin: number;
            
            if (detection.sampleCount >= 5) {
                safetyMargin = detection.confidence === 'high' ? 0.95 : 0.92;
            } else if (detection.sampleCount >= 3) {
                safetyMargin = detection.confidence === 'high' ? 0.92 : 0.88;
            } else {
                safetyMargin = 0.85;
            }
            
            return Math.round(detection.detectedLimit * safetyMargin);
        }

        const statisticalOptions = [
            baseline.percentile90,
            baseline.criticalUsageThreshold * 0.8,
            baseline.percentile75 * 1.2
        ];
        
        const improvedStatistical = Math.max(
            Math.max(...statisticalOptions),
            25_000
        );
        
        return Math.round(improvedStatistical);
    }

    /**
     * Formats Rate Limit estimate for display with K suffix.
     * @param rateLimitEstimate Rate limit in tokens
     * @returns Formatted string (e.g., "~45K", "~35K")
     */
    static formatRateLimitEstimate(rateLimitEstimate: number): string {
        const limitInK = Math.round(rateLimitEstimate / 1000);
        return `~${limitInK}K`;
    }

    /**
     * Gets detection method description for debugging/logging.
     * 
     * @param baseline Statistical baseline
     * @param records Historical records  
     * @param customLimit User configured limit
     * @returns Human-readable description of detection method used
     */
    static getDetectionMethodDescription(
        baseline: UsageBaseline,
        records: ClaudeUsageRecord[],
        customLimit?: number
    ): string {
        if (customLimit && customLimit > 0) {
            return `User-configured: ${customLimit.toLocaleString()} tokens`;
        }

        const detection = detectRateLimit(records);
        if (detection.detectedLimit && detection.confidence !== 'low' && detection.sampleCount >= 3) {
            const safetyMargin = detection.sampleCount >= 5 
                ? (detection.confidence === 'high' ? 0.95 : 0.92)
                : (detection.confidence === 'high' ? 0.92 : 0.88);
            const adjustedLimit = Math.round(detection.detectedLimit * safetyMargin);
            const limitK = Math.round(adjustedLimit / 1000);
            return `Historical detection: ~${limitK}K tokens (${detection.confidence} confidence, ${detection.sampleCount} samples, ${Math.round(safetyMargin * 100)}% margin)`;
        }

        const statisticalOptions = [
            baseline.percentile90,
            baseline.criticalUsageThreshold * 0.8,
            baseline.percentile75 * 1.2
        ];
        const improvedStatistical = Math.max(Math.max(...statisticalOptions), 25_000);
        const fallbackK = Math.round(improvedStatistical / 1000);
        return `Statistical fallback: ~${fallbackK}K tokens (90th percentile or adjusted critical threshold)`;
    }
}