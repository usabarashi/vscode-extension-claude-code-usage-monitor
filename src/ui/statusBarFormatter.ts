/**
 * Status Bar Formatter - UI Display Layer
 * @module StatusBarFormatter
 */

import { UsageStatus } from '../types';
import { formatBurnRate, formatPredictionTime } from '../core/burnRateCalculator';
import { RateLimitEstimationService } from '../services/rateLimitEstimationService';
import { getModelDisplayName } from '../core/modelUtils';

/**
 * Creates status bar text with usage percentage, rate limit, and reset time.
 * @param status Usage status information
 * @param rateLimitEstimate Estimated Rate Limit in tokens
 * @returns Formatted status bar text
 */
export const getStatusBarText = (status: UsageStatus, rateLimitEstimate: number): string => {
    const percentage = status.usagePercentage;
    const rateLimitFormatted = RateLimitEstimationService.formatRateLimitEstimate(rateLimitEstimate);

    const resetTime = status.resetTime.toLocaleTimeString(undefined, {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });

    const modelDisplay = status.currentModel ? getModelDisplayName(status.currentModel) : '';
    
    if (modelDisplay) {
        return `$(terminal) ${modelDisplay} | ${percentage}% | ${rateLimitFormatted} | ${resetTime}`;
    } else {
        return `$(terminal) ${percentage}% | ${rateLimitFormatted} | ${resetTime}`;
    }
};

/**
 * Returns color based on usage percentage.
 * @param status Usage status with percentage information
 * @returns Hex color code for status bar styling
 */
export const getStatusBarColor = (status: UsageStatus): string => {
    if (status.usagePercentage >= 100) {
        return '#ff4444';
    } else if (status.usagePercentage >= 70) {
        return '#ffaa00';
    } else {
        return '#00aa00';
    }
};

/**
 * Formats usage details as "X,XXX tokens (XX% of block)"
 * @param status Usage status with token counts
 * @returns Formatted usage details string
 */
export const formatUsageDetails = (status: UsageStatus): string => {
    const formattedUsage = status.currentUsage.toLocaleString();
    return `${formattedUsage} tokens (${status.usagePercentage}% of block)`;
};

/**
 * Creates structured time and burn rate details for tooltip display.
 * @param status Complete usage status with timing data
 * @returns Dictionary of formatted time details
 */
export const formatTimeDetails = (status: UsageStatus): { [key: string]: string } => {
    const resetTime = status.resetTime.toLocaleString(undefined, {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    const timeUntilReset = status.timeUntilResetFormatted;

    const consumptionRateFormatted = status.estimatedTokensPerMinute >= 1000 
        ? `${(status.estimatedTokensPerMinute / 1000).toFixed(1)}K` 
        : status.estimatedTokensPerMinute.toString();

    const details: { [key: string]: string } = {
        'Reset Time': resetTime,
        'Time Until Reset': timeUntilReset,
        'Tokens Per Minute': consumptionRateFormatted
    };

    if (status.burnRate && status.burnRate.tokensPerMinute > 0) {
        const burnRate = status.burnRate;
        details['Burn Rate'] = formatBurnRate(burnRate);
        details['Trend'] = burnRate.trend;
        
        if (burnRate.recentActivity.last15min > 0) {
            details['Last 15min'] = `${(burnRate.recentActivity.last15min / 1000).toFixed(1)}K tokens`;
        }
        
        const currentTime = new Date();
        if (burnRate.predictions.timeToHighThreshold) {
            const timeToHigh = formatPredictionTime(burnRate.predictions.timeToHighThreshold, currentTime);
            if (timeToHigh) {
                details['Time to High Usage'] = timeToHigh;
            }
        }
        
        if (burnRate.predictions.estimatedDepletionTime) {
            const timeToDepletion = formatPredictionTime(burnRate.predictions.estimatedDepletionTime, currentTime);
            if (timeToDepletion) {
                details['Estimated Depletion'] = timeToDepletion;
            }
        }
        
        if (burnRate.modelBreakdown?.[0]) {
            const topModel = burnRate.modelBreakdown[0];
            details['Top Model'] = `${topModel.model} (${topModel.percentage}%)`;
            if (topModel.estimatedCost && topModel.estimatedCost > 0) {
                details['Estimated Cost'] = `$${topModel.estimatedCost.toFixed(3)}`;
            }
        }
    }

    if (status.estimatedDepletionTime && !details['Estimated Depletion']) {
        details['Estimated High Usage'] = status.estimatedDepletionTime.toLocaleString();
    }

    return details;
};
