import { ParseError, RollingWindowBlock } from './types';
import { getCurrentRollingWindow, formatTimeUntilReset } from './blockCalculator';
import { getPlanRateLimit, getShortPlanName, detectPlanFromUsage } from './planConfig';

/**
 * Represents the current rate limit status for Claude Code usage.
 */
export interface RateLimitStatus {
    currentUsage: number;
    usageLimit: number;
    usagePercentage: number;
    resetTime: Date;
    timeUntilReset: number;
    timeUntilResetFormatted: string;
    isNearLimit: boolean;
    isAtLimit: boolean;
    estimatedTokensPerMinute: number;
    estimatedDepletionTime?: Date;
    detectedPlan: string;
    error?: ParseError;
}



/**
 * Creates a rate limit status object from block data.
 * @param block - The rolling window block data
 * @param tokenLimit - Optional token limit to override auto-detection
 * @returns The rate limit status
 */
const createRateLimitStatus = (
    block: RollingWindowBlock,
    tokenLimit?: number
): RateLimitStatus => {
    const currentUsage = block.totalTokens;
    
    // Auto-detect plan if no token limit provided
    const detectedPlan = detectPlanFromUsage(currentUsage);
    const actualTokenLimit = tokenLimit || getPlanRateLimit(detectedPlan);
    
    const usagePercentage = Math.round((currentUsage / actualTokenLimit) * 100);
    
    const resetTime = block.resetTime;
    const timeUntilReset = block.timeUntilReset;
    const timeUntilResetFormatted = formatTimeUntilReset(timeUntilReset);
    
    const isNearLimit = usagePercentage >= 70;
    const isAtLimit = usagePercentage >= 90;
    
    const blockDurationMs = block.windowEndTime.getTime() - block.windowStartTime.getTime();
    const blockDurationMinutes = blockDurationMs / (1000 * 60);
    const estimatedTokensPerMinute = blockDurationMinutes > 0 ? currentUsage / blockDurationMinutes : 0;
    
    let estimatedDepletionTime: Date | undefined;
    if (estimatedTokensPerMinute > 0 && currentUsage < actualTokenLimit) {
        const remainingTokens = actualTokenLimit - currentUsage;
        const minutesToDepletion = remainingTokens / estimatedTokensPerMinute;
        const depletionTime = new Date(Date.now() + minutesToDepletion * 60 * 1000);
        
        if (depletionTime <= resetTime) {
            estimatedDepletionTime = depletionTime;
        }
    }

    return {
        currentUsage,
        usageLimit: actualTokenLimit,
        usagePercentage,
        resetTime,
        timeUntilReset,
        timeUntilResetFormatted,
        isNearLimit,
        isAtLimit,
        estimatedTokensPerMinute: Math.round(estimatedTokensPerMinute),
        estimatedDepletionTime,
        detectedPlan: getShortPlanName(detectedPlan)
    };
};

/**
 * Gets the current rate limit status based on Claude Code usage.
 * Auto-detects the plan if no token limit is provided.
 * @param tokenLimit - Optional token limit to override auto-detection
 * @returns The current rate limit status or null if no active block
 */
export const getRateLimitStatus = async (tokenLimit?: number): Promise<RateLimitStatus | null> => {
    const rollingWindow = await getCurrentRollingWindow();
    
    if (!rollingWindow) {
        return null;
    }

    const status = createRateLimitStatus(rollingWindow, tokenLimit);
    
    // If there's an error, add it to the status
    if (rollingWindow.error) {
        return {
            ...status,
            error: rollingWindow.error
        };
    }

    return status;
};

/**
 * Generates status bar text from rate limit status.
 * @param status - The rate limit status
 * @returns Formatted status bar text with plan, usage percentage and reset time
 */
export const getStatusBarText = (status: RateLimitStatus): string => {
    const plan = status.detectedPlan;
    const percentage = status.usagePercentage;
    
    // Display reset time in local timezone
    const resetTime = status.resetTime.toLocaleTimeString(undefined, { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit'
    });
    
    return `$(terminal) ${plan} ${percentage}% | Reset: ${resetTime}`;
};


/**
 * Gets the appropriate color for the status bar based on usage level.
 * @param status - The rate limit status
 * @returns Hex color code
 */
export const getStatusBarColor = (status: RateLimitStatus): string => {
    if (status.isAtLimit) {
        return '#ff4444';
    } else if (status.isNearLimit) {
        return '#ffaa00';
    } else {
        return '#00aa00';
    }
};

/**
 * Formats detailed usage information for display.
 * @param status - The rate limit status
 * @returns Formatted usage details string
 */
export const formatUsageDetails = (status: RateLimitStatus): string => {
    const formattedUsage = status.currentUsage.toLocaleString();
    const formattedLimit = status.usageLimit.toLocaleString();
    
    return `${formattedUsage} / ${formattedLimit} tokens (${status.usagePercentage}%)`;
};

/**
 * Formats time-related details for display.
 * @param status - The rate limit status
 * @returns Object with formatted time details
 */
export const formatTimeDetails = (status: RateLimitStatus): { [key: string]: string } => {
    // Display reset time in local timezone
    const resetTime = status.resetTime.toLocaleString();
    const timeUntilReset = status.timeUntilResetFormatted;
    
    const details: { [key: string]: string } = {
        'Reset Time': resetTime,
        'Time Until Reset': timeUntilReset,
        'Tokens Per Minute': status.estimatedTokensPerMinute.toString()
    };

    if (status.estimatedDepletionTime) {
        // Display estimated depletion time in local timezone
        details['Estimated Depletion'] = status.estimatedDepletionTime.toLocaleString();
    }

    return details;
};

/**
 * Determines if a warning should be shown based on usage level.
 * @param status - The rate limit status
 * @returns True if near limit (>=70%)
 */
export const shouldShowWarning = (status: RateLimitStatus): boolean => status.isNearLimit;

/**
 * Determines if a critical warning should be shown based on usage level.
 * @param status - The rate limit status
 * @returns True if at limit (>=90%)
 */
export const shouldShowCriticalWarning = (status: RateLimitStatus): boolean => status.isAtLimit;

/**
 * Gets the appropriate warning message based on usage level.
 * @param status - The rate limit status
 * @returns Warning message string or empty string if no warning needed
 */
export const getWarningMessage = (status: RateLimitStatus): string => {
    if (status.isAtLimit) {
        return `$(alert) Critical: ${status.usagePercentage}% of rate limit used. Reset in ${status.timeUntilResetFormatted}`;
    } else if (status.isNearLimit) {
        return `$(warning) Warning: ${status.usagePercentage}% of rate limit used. Reset in ${status.timeUntilResetFormatted}`;
    }
    return '';
};

