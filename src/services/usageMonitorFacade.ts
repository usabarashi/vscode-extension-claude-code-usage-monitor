/**
 * Usage Monitor Facade - Service Layer
 * @module UsageMonitorFacade
 */

import { UsageStatus, MultiSessionBlock } from '../types';
import { createMultiSessionBlock } from '../core/blockCalculator';
import { parseAllUsageData } from '../core/claudeDataParser';
import { 
    calculateUsageBaseline, 
    formatBaselineDescription, 
    getUsageLevel, 
    calculateUsagePercentageWithLimit
} from '../core/usageBaselineCalculator';
import { RateLimitEstimationService } from './rateLimitEstimationService';
import { calculateBurnRate } from '../core/burnRateCalculator';
import { formatTimeUntilReset } from '../utils/timeUtils';

/** Result interface for usage status operations. */
export interface UsageStatusResult {
    status: UsageStatus;
    parsedData: any;
    rateLimitEstimate: number;
    baseline: any;
}

/** Facade service that orchestrates usage monitoring operations. */
export class UsageMonitorFacade {
    
    /**
     * Gets complete usage status with all analysis data.
     * @param customLimit Optional user-configured rate limit
     * @returns Complete usage analysis result or null if no data
     */
    async getUsageStatus(customLimit?: number | null): Promise<UsageStatusResult | null> {
        const parsedData = await parseAllUsageData();
        const multiSessionBlock = createMultiSessionBlock(parsedData.records, new Date(), parsedData.error);

        if (!multiSessionBlock) {
            return null;
        }

        const baseline = calculateUsageBaseline(parsedData.records);
        const rateLimitEstimate = RateLimitEstimationService.calculateRateLimitEstimate(baseline, parsedData.records, customLimit || undefined);

        const status = await this.createUsageStatus(multiSessionBlock, parsedData, rateLimitEstimate, baseline);

        if (multiSessionBlock.error) {
            return {
                status: { ...status, error: multiSessionBlock.error },
                parsedData,
                rateLimitEstimate,
                baseline
            };
        }

        return { status, parsedData, rateLimitEstimate, baseline };
    }

    /**
     * Creates comprehensive usage status from session data.
     * @param multiSessionBlock Processed session block data
     * @param parsedData Raw parsed usage data
     * @param rateLimitEstimate Calculated rate limit
     * @param baseline Statistical baseline analysis
     * @returns Complete usage status with predictions
     */
    private async createUsageStatus(
        multiSessionBlock: MultiSessionBlock,
        parsedData: any,
        rateLimitEstimate: number,
        baseline: any
    ): Promise<UsageStatus> {
        const session = multiSessionBlock.mostRestrictiveSession;
        const currentUsage = session.totalTokens;

        const usagePercentage = calculateUsagePercentageWithLimit(currentUsage, rateLimitEstimate);
        const { level: usageLevel } = getUsageLevel(currentUsage, baseline);

        const resetTime = session.endTime;
        const timeUntilReset = session.timeUntilReset;
        const timeUntilResetFormatted = formatTimeUntilReset(timeUntilReset);

        const isHighUsage = currentUsage >= baseline.highUsageThreshold;
        const isCriticalUsage = currentUsage >= baseline.criticalUsageThreshold;

        const burnRate = calculateBurnRate(
            session.records,
            new Date(),
            currentUsage,
            baseline.highUsageThreshold,
            baseline.averageUsage
        );

        const legacyConsumptionRate = this.calculateLegacyConsumptionRate(session, currentUsage);

        const estimatedDepletionTime = this.calculateDepletionTime(
            burnRate,
            legacyConsumptionRate,
            currentUsage,
            baseline.criticalUsageThreshold,
            resetTime
        );

        return {
            currentUsage,
            usageBaseline: baseline.highUsageThreshold,
            usagePercentage,
            resetTime,
            timeUntilReset,
            timeUntilResetFormatted,
            isHighUsage,
            isCriticalUsage,
            estimatedTokensPerMinute: Math.max(Math.round(legacyConsumptionRate), burnRate.tokensPerMinute),
            estimatedDepletionTime,
            baselineDescription: formatBaselineDescription(baseline),
            usageLevel,
            baselineConfidence: baseline.confidence,
            burnRate,
            currentModel: session.mostUsedModel
        };
    }

    /**
     * Calculates legacy consumption rate for backward compatibility.
     * @param session Current session data
     * @param currentUsage Current token usage
     * @returns Tokens per minute consumption rate
     */
    private calculateLegacyConsumptionRate(session: any, currentUsage: number): number {
        const sessionDurationMs = session.endTime.getTime() - session.startTime.getTime();
        const sessionDurationMinutes = sessionDurationMs / (1000 * 60);
        return sessionDurationMinutes > 0 ? currentUsage / sessionDurationMinutes : 0;
    }

    /**
     * Calculates estimated depletion time using burn rate or legacy method.
     * @param burnRate Advanced burn rate analysis
     * @param legacyRate Legacy consumption rate
     * @param currentUsage Current token usage
     * @param criticalThreshold Critical usage threshold
     * @param resetTime Session reset time
     * @returns Estimated depletion time or undefined
     */
    private calculateDepletionTime(
        burnRate: any,
        legacyRate: number,
        currentUsage: number,
        criticalThreshold: number,
        resetTime: Date
    ): Date | undefined {
        if (burnRate.predictions.estimatedDepletionTime) {
            return burnRate.predictions.estimatedDepletionTime;
        }

        if (legacyRate > 0 && currentUsage < criticalThreshold) {
            const remainingTokens = criticalThreshold - currentUsage;
            const minutesToDepletion = remainingTokens / legacyRate;
            const depletionTime = new Date(Date.now() + minutesToDepletion * 60 * 1000);

            if (depletionTime <= resetTime) {
                return depletionTime;
            }
        }

        return undefined;
    }
}