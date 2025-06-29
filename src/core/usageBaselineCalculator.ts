/**
 * Usage Baseline Calculator - Core Module (Independent)
 * 
 * Calculates typical usage patterns instead of strict rate limits using
 * statistical analysis of historical data. Provides intelligent baselines
 * for monitoring relative usage levels.
 * 
 * **Statistical Methods:**
 * - IQR outlier removal for data cleaning
 * - Standard deviation for threshold calculation
 * - Percentile analysis for usage distribution
 * - Confidence scoring based on data quality
 * 
 * **Key Concepts:**
 * - **Baseline**: Average usage pattern, not strict limits
 * - **Thresholds**: Statistical boundaries for warnings
 * - **Confidence**: Data quality assessment
 * 
 * @module UsageBaselineCalculator
 */

import { ClaudeUsageRecord } from '../types';

/**
 * Statistical usage baseline interface with comprehensive metrics.
 * 
 * Represents analyzed usage patterns derived from historical data,
 * providing both descriptive statistics and actionable thresholds.
 * 
 * @interface UsageBaseline
 */
export interface UsageBaseline {
    /** Statistical mean of token usage across sessions */
    averageUsage: number;
    
    /** Middle value when usage data is sorted (50th percentile) */
    medianUsage: number;
    
    /** Measure of data variability around the mean */
    standardDeviation: number;
    
    /** 75th percentile of usage distribution */
    percentile75: number;
    
    /** 90th percentile of usage distribution */
    percentile90: number;
    
    /** Warning threshold (mean + 1 std dev, ~84th percentile) */
    highUsageThreshold: number;
    
    /** Critical threshold (mean + 2 std dev, ~97th percentile) */
    criticalUsageThreshold: number;
    
    /** Number of sessions included in analysis */
    totalSessions: number;
    
    /** Statistical method used for calculation */
    analysisMethod: string;
    
    /** Confidence level in the baseline accuracy */
    confidence: 'high' | 'medium' | 'low';
}

/**
 * PURE FUNCTION: Calculates usage baseline from historical patterns.
 * 
 * Performs comprehensive statistical analysis of historical usage data to
 * establish intelligent baselines for monitoring. Uses advanced techniques
 * including outlier removal and confidence assessment.
 * 
 * **Algorithm Steps:**
 * 1. Filter recent records (30 days)
 * 2. Group into 5-hour session blocks
 * 3. Remove outliers using IQR method
 * 4. Calculate statistical measures
 * 5. Determine confidence level
 * 
 * **Exclusions:**
 * - Current active block (prevents bias)
 * - Sessions with <1000 tokens (insufficient data)
 * - Statistical outliers (>1.5 IQR from quartiles)
 * 
 * @param {ClaudeUsageRecord[]} records - Historical usage records
 * @param {string} [currentActiveBlockId] - ID of current session to exclude
 * @returns {UsageBaseline} Comprehensive baseline analysis
 * 
 * @example
 * ```typescript
 * const baseline = calculateUsageBaseline(records, 'current-session-id');
 * console.log(`Average usage: ${baseline.averageUsage} tokens`);
 * console.log(`Confidence: ${baseline.confidence}`);
 * ```
 * 
 * @since 0.1.0
 */
export const calculateUsageBaseline = (records: ClaudeUsageRecord[], currentActiveBlockId?: string): UsageBaseline => {
    if (records.length === 0) {
        return createDefaultBaseline();
    }

    // Use simpler approach - just filter records by time and calculate from completed blocks
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentRecords = records.filter(record => {
        const recordTime = new Date(record.timestamp);
        return recordTime >= thirtyDaysAgo;
    });
    
    if (recentRecords.length === 0) {
        return createDefaultBaseline();
    }
    
    // Group by 5-hour blocks and calculate usage
    const blockUsages: number[] = [];
    const blockSize = 5 * 60 * 60 * 1000; // 5 hours
    
    const sortedRecords = recentRecords.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    let currentBlockStart = new Date(sortedRecords[0].timestamp);
    currentBlockStart.setUTCMinutes(0, 0, 0); // Floor to hour
    let currentBlockTokens = 0;
    let currentBlockId = currentBlockStart.toISOString();
    
    for (const record of sortedRecords) {
        const recordTime = new Date(record.timestamp);
        const timeSinceBlockStart = recordTime.getTime() - currentBlockStart.getTime();
        
        if (timeSinceBlockStart > blockSize) {
            if (currentBlockTokens > 1000 && currentBlockId !== currentActiveBlockId) {
                blockUsages.push(currentBlockTokens);
            }
            
            // Start new block
            currentBlockStart = new Date(recordTime);
            currentBlockStart.setUTCMinutes(0, 0, 0);
            currentBlockId = currentBlockStart.toISOString();
            currentBlockTokens = record.input_tokens + record.output_tokens;
        } else {
            currentBlockTokens += record.input_tokens + record.output_tokens;
        }
    }
    
    // Add final block
    if (currentBlockTokens > 1000 && currentBlockId !== currentActiveBlockId) {
        blockUsages.push(currentBlockTokens);
    }
    
    const activeBlocks = blockUsages;
    
    if (activeBlocks.length < 3) {
        return createDefaultBaseline();
    }

    const tokenUsages = activeBlocks;
    
    // Remove outliers using IQR method
    const cleanedUsages = removeOutliers(tokenUsages);
    
    if (cleanedUsages.length < 3) {
        return createDefaultBaseline();
    }

    // Calculate statistical measures
    const sortedUsages = [...cleanedUsages].sort((a, b) => a - b);
    const averageUsage = Math.round(cleanedUsages.reduce((sum, usage) => sum + usage, 0) / cleanedUsages.length);
    const medianUsage = calculateMedian(sortedUsages);
    const standardDeviation = calculateStandardDeviation(cleanedUsages, averageUsage);
    
    // Calculate percentiles
    const percentile75 = calculatePercentile(sortedUsages, 75);
    const percentile90 = calculatePercentile(sortedUsages, 90);
    
    // Set thresholds based on statistical distribution
    const highUsageThreshold = Math.round(averageUsage + standardDeviation); // ~84th percentile
    const criticalUsageThreshold = Math.round(averageUsage + 2 * standardDeviation); // ~97th percentile
    
    // Determine confidence based on data quality
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (activeBlocks.length >= 20 && standardDeviation < averageUsage * 0.5) {
        confidence = 'high';
    } else if (activeBlocks.length < 10 || standardDeviation > averageUsage) {
        confidence = 'low';
    }

    return {
        averageUsage,
        medianUsage,
        standardDeviation: Math.round(standardDeviation),
        percentile75,
        percentile90,
        highUsageThreshold,
        criticalUsageThreshold,
        totalSessions: activeBlocks.length,
        analysisMethod: 'statistical_baseline',
        confidence
    };
};

/**
 * Removes outliers using IQR method.
 */
const removeOutliers = (values: number[]): number[] => {
    if (values.length < 4) return values;
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = calculatePercentile(sorted, 25);
    const q3 = calculatePercentile(sorted, 75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return values.filter(value => value >= lowerBound && value <= upperBound);
};

/**
 * Calculates median value.
 */
const calculateMedian = (sortedValues: number[]): number => {
    const mid = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
        return Math.round((sortedValues[mid - 1] + sortedValues[mid]) / 2);
    }
    return sortedValues[mid];
};

/**
 * Calculates standard deviation.
 */
const calculateStandardDeviation = (values: number[], mean: number): number => {
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / values.length;
    return Math.sqrt(variance);
};

/**
 * Calculates percentile value.
 */
const calculatePercentile = (sortedValues: number[], percentile: number): number => {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
        return sortedValues[lower];
    }
    
    const weight = index - lower;
    return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
};

/**
 * Creates default baseline for insufficient data.
 */
const createDefaultBaseline = (): UsageBaseline => ({
    averageUsage: 30_000,
    medianUsage: 25_000,
    standardDeviation: 15_000,
    percentile75: 40_000,
    percentile90: 55_000,
    highUsageThreshold: 45_000,
    criticalUsageThreshold: 60_000,
    totalSessions: 0,
    analysisMethod: 'default_fallback',
    confidence: 'low'
});

/**
 * Formats baseline description for display.
 */
export const formatBaselineDescription = (baseline: UsageBaseline): string => {
    const avgK = (baseline.averageUsage / 1000).toFixed(0);
    return `Avg ~${avgK}K`;
};

/**
 * Gets usage level description.
 */
export const getUsageLevel = (currentUsage: number, baseline: UsageBaseline): {
    level: 'low' | 'normal' | 'high' | 'critical';
    description: string;
} => {
    if (currentUsage >= baseline.criticalUsageThreshold) {
        return { level: 'critical', description: 'Very High Usage' };
    } else if (currentUsage >= baseline.highUsageThreshold) {
        return { level: 'high', description: 'High Usage' };
    } else if (currentUsage >= baseline.averageUsage * 0.5) {
        return { level: 'normal', description: 'Normal Usage' };
    } else {
        return { level: 'low', description: 'Low Usage' };
    }
};

/**
 * Calculates usage percentage relative to high threshold.
 */
export const calculateUsagePercentage = (currentUsage: number, baseline: UsageBaseline): number => {
    // Use high usage threshold as 100% reference point, allow exceeding 100%
    return Math.round((currentUsage / baseline.highUsageThreshold) * 100);
};