import { ClaudeUsageRecord, parseAllUsageData, filterRecordsByTimeRange } from './claudeDataParser';
import { calculateRecordCost } from './costCalculator';
import { RollingWindowBlock } from './types';


/** The duration of the rolling window in milliseconds (5 hours) */
const WINDOW_DURATION_MS = 5 * 60 * 60 * 1000;

/**
 * Floors a date to the start of the hour in local timezone.
 * @param date - The date to floor
 * @returns The floored date
 */
const floorToHour = (date: Date): Date => {
    const floored = new Date(date);
    // Use local timezone instead of UTC to match Claude Code reset behavior
    floored.setMinutes(0, 0, 0);
    return floored;
};

/**
 * Aggregates token usage from multiple Claude usage records.
 * Rate limits only apply to input + output tokens, excluding cache tokens.
 * @param records - Array of Claude usage records to aggregate
 * @returns Aggregated token usage statistics
 */
const aggregateTokenUsage = (records: ClaudeUsageRecord[]) => {
    const aggregated = records.reduce(
        (acc, record) => ({
            totalInputTokens: acc.totalInputTokens + record.input_tokens,
            totalOutputTokens: acc.totalOutputTokens + record.output_tokens,
            totalCacheCreationTokens: acc.totalCacheCreationTokens + record.cache_creation_tokens,
            totalCacheReadTokens: acc.totalCacheReadTokens + record.cache_read_tokens,
            totalCost: acc.totalCost + (record.cost || calculateRecordCost(record))
        }),
        {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCacheCreationTokens: 0,
            totalCacheReadTokens: 0,
            totalCost: 0
        }
    );

    return {
        ...aggregated,
        totalTokens: aggregated.totalInputTokens + aggregated.totalOutputTokens
    };
};

/**
 * Gets the current rolling window block based on recent Claude Code usage.
 * Implements the rolling window algorithm for rate limit calculation.
 * @returns The current rolling window block or null if no active block
 */
export const getCurrentRollingWindow = async (): Promise<RollingWindowBlock | null> => {
    const parsedData = await parseAllUsageData();
    
    // If there's a critical error, return it
    if (parsedData.error && parsedData.records.length === 0) {
        return {
            windowStartTime: new Date(),
            windowEndTime: new Date(),
            resetTime: new Date(),
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCacheCreationTokens: 0,
            totalCacheReadTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            requestCount: 0,
            isActive: false,
            timeUntilReset: 0,
            error: parsedData.error
        };
    }
    
    if (parsedData.records.length === 0) {
        return null;
    }

    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - WINDOW_DURATION_MS);
    
    let recentRecords = filterRecordsByTimeRange(parsedData.records, fiveHoursAgo, now);

    if (recentRecords.length === 0) {
        return null;
    }

    const currentBlock = findCurrentBlock(recentRecords, now);
    
    if (!currentBlock) {
        return null;
    }

    const aggregatedUsage = aggregateTokenUsage(currentBlock.records);

    const result = {
        windowStartTime: currentBlock.blockStartTime,
        windowEndTime: now,
        resetTime: currentBlock.resetTime,
        totalInputTokens: aggregatedUsage.totalInputTokens,
        totalOutputTokens: aggregatedUsage.totalOutputTokens,
        totalCacheCreationTokens: aggregatedUsage.totalCacheCreationTokens,
        totalCacheReadTokens: aggregatedUsage.totalCacheReadTokens,
        totalTokens: aggregatedUsage.totalTokens,
        totalCost: aggregatedUsage.totalCost,
        requestCount: currentBlock.records.length,
        isActive: currentBlock.isActive,
        timeUntilReset: currentBlock.timeUntilReset
    };

    // Add warning error if there were parsing issues
    if (parsedData.error) {
        return {
            ...result,
            error: parsedData.error
        };
    }

    return result;
};

/**
 * Finds the current active block of usage records.
 * Works backwards from the most recent record to determine block boundaries.
 * @param records - Array of usage records to analyze
 * @param now - Current timestamp
 * @returns Current block information or null if no active block
 */
const findCurrentBlock = (records: ClaudeUsageRecord[], now: Date) => {
    if (records.length === 0) return null;

    const sortedRecords = [...records].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Get the most recent activity time
    const lastActivityTime = new Date(sortedRecords[sortedRecords.length - 1].timestamp);
    
    const timeSinceLastActivity = now.getTime() - lastActivityTime.getTime();
    if (timeSinceLastActivity > WINDOW_DURATION_MS) {
        return null;
    }

    let blockStartTime: Date | null = null;
    let currentBlockRecords: ClaudeUsageRecord[] = [];
    
    // Start with the most recent record
    let currentTime = lastActivityTime;
    
    for (let i = sortedRecords.length - 1; i >= 0; i--) {
        const record = sortedRecords[i];
        const recordTime = new Date(record.timestamp);
        
        if (currentBlockRecords.length === 0) {
            currentBlockRecords.unshift(record);
            currentTime = recordTime;
            blockStartTime = floorToHour(recordTime);
            continue;
        }
        
        const gapDuration = currentTime.getTime() - recordTime.getTime();
        
        if (gapDuration > WINDOW_DURATION_MS) {
            break;
        }
        
        const potentialBlockStart = floorToHour(recordTime);
        const windowEnd = new Date(potentialBlockStart.getTime() + WINDOW_DURATION_MS);
        
        if (lastActivityTime > windowEnd) {
            break;
        }
        
        currentBlockRecords.unshift(record);
        currentTime = recordTime;
        blockStartTime = potentialBlockStart;
    }
    
    if (!blockStartTime || currentBlockRecords.length === 0) {
        return null;
    }

    const resetTime = new Date(blockStartTime.getTime() + WINDOW_DURATION_MS);
    
    const isActive = now < resetTime && timeSinceLastActivity < WINDOW_DURATION_MS;
    const timeUntilReset = Math.max(0, resetTime.getTime() - now.getTime());

    return {
        blockStartTime,
        resetTime,
        records: currentBlockRecords,
        isActive,
        timeUntilReset
    };
};

/**
 * Formats milliseconds into a human-readable time string.
 * @param milliseconds - Time in milliseconds
 * @returns Formatted time string (e.g., "2h 30m", "45m 12s", "30s")
 */
export const formatTimeUntilReset = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
};

/**
 * Calculates the token consumption rate for a rolling window block.
 * @param block - The rolling window block
 * @returns Token consumption rate in tokens per minute
 */
export const calculateConsumptionRate = (block: RollingWindowBlock): number => {
    if (!block.isActive) {
        return 0;
    }

    const windowDurationMinutes = (block.windowEndTime.getTime() - block.windowStartTime.getTime()) / (1000 * 60);
    
    if (windowDurationMinutes <= 0) {
        return 0;
    }

    return Math.round(block.totalTokens / windowDurationMinutes);
};

/**
 * Estimates when the rate limit will be depleted based on current consumption rate.
 * @param block - The current rolling window block
 * @param rateLimitTokens - The total rate limit in tokens
 * @returns Estimated depletion time or null if not applicable
 */
export const estimateDepletionTime = (block: RollingWindowBlock, rateLimitTokens: number): Date | null => {
    if (!block.isActive || block.totalTokens >= rateLimitTokens) {
        return null;
    }

    const consumptionRate = calculateConsumptionRate(block);
    
    if (consumptionRate <= 0) {
        return null;
    }

    const remainingTokens = rateLimitTokens - block.totalTokens;
    const minutesToDepletion = remainingTokens / consumptionRate;
    
    return new Date(block.windowEndTime.getTime() + minutesToDepletion * 60 * 1000);
};

/**
 * Gets rolling window history for a specified duration.
 * @returns Array of rolling window blocks
 * @throws Not implemented yet
 */
export const getRollingWindowHistory = async (): Promise<RollingWindowBlock[]> => {
    throw new Error('Method not implemented yet');
};