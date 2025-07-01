/**
 * Usage Baseline Calculator - Core Module
 * 
 * Calculates statistical baselines from historical usage data using IQR outlier removal,
 * standard deviation analysis, and confidence scoring.
 * 
 * @module UsageBaselineCalculator
 */

import { ClaudeUsageRecord } from '../types';

/**
 * Statistical usage baseline with metrics and thresholds.
 */
export interface UsageBaseline {
    averageUsage: number;
    medianUsage: number;
    standardDeviation: number;
    percentile75: number;
    percentile90: number;
    highUsageThreshold: number;
    criticalUsageThreshold: number;
    totalSessions: number;
    analysisMethod: string;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculates statistical baseline from historical usage data.
 * 
 * Filters last 30 days, groups into 5-hour blocks, removes outliers using IQR,
 * and calculates statistical measures with confidence assessment.
 * 
 * @param records Historical usage records
 * @param currentActiveBlockId Optional current session ID to exclude
 * @returns Statistical baseline analysis
 */
export const calculateUsageBaseline = (records: ClaudeUsageRecord[], currentActiveBlockId?: string): UsageBaseline => {
    if (records.length === 0) {
        return createDefaultBaseline();
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentRecords = records.filter(record => {
        const recordTime = new Date(record.timestamp);
        return recordTime >= thirtyDaysAgo;
    });

    if (recentRecords.length === 0) {
        return createDefaultBaseline();
    }

    const blockUsages: number[] = [];
    const blockSize = 5 * 60 * 60 * 1000;

    const sortedRecords = recentRecords.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentBlockStart = new Date(sortedRecords[0].timestamp);
    currentBlockStart.setUTCMinutes(0, 0, 0);
    let currentBlockTokens = 0;
    let currentBlockId = currentBlockStart.toISOString();

    for (const record of sortedRecords) {
        const recordTime = new Date(record.timestamp);
        const timeSinceBlockStart = recordTime.getTime() - currentBlockStart.getTime();

        if (timeSinceBlockStart > blockSize) {
            if (currentBlockTokens > 1000 && currentBlockId !== currentActiveBlockId) {
                blockUsages.push(currentBlockTokens);
            }

            currentBlockStart = new Date(recordTime);
            currentBlockStart.setUTCMinutes(0, 0, 0);
            currentBlockId = currentBlockStart.toISOString();
            currentBlockTokens = record.input_tokens + record.output_tokens;
        } else {
            currentBlockTokens += record.input_tokens + record.output_tokens;
        }
    }

    if (currentBlockTokens > 1000 && currentBlockId !== currentActiveBlockId) {
        blockUsages.push(currentBlockTokens);
    }

    const activeBlocks = blockUsages;

    if (activeBlocks.length < 3) {
        return createDefaultBaseline();
    }

    const tokenUsages = activeBlocks;

    const cleanedUsages = removeOutliers(tokenUsages);

    if (cleanedUsages.length < 3) {
        return createDefaultBaseline();
    }

    const sortedUsages = [...cleanedUsages].sort((a, b) => a - b);
    const averageUsage = Math.round(cleanedUsages.reduce((sum, usage) => sum + usage, 0) / cleanedUsages.length);
    const medianUsage = calculateMedian(sortedUsages);
    const standardDeviation = calculateStandardDeviation(cleanedUsages, averageUsage);

    const percentile75 = calculatePercentile(sortedUsages, 75);
    const percentile90 = calculatePercentile(sortedUsages, 90);

    const highUsageThreshold = Math.round(averageUsage + standardDeviation);
    const criticalUsageThreshold = Math.round(averageUsage + 2 * standardDeviation);
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

/** Removes outliers using IQR method. */
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

/** Calculates median value. */
const calculateMedian = (sortedValues: number[]): number => {
    const mid = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
        return Math.round((sortedValues[mid - 1] + sortedValues[mid]) / 2);
    }
    return sortedValues[mid];
};

/** Calculates standard deviation. */
const calculateStandardDeviation = (values: number[], mean: number): number => {
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / values.length;
    return Math.sqrt(variance);
};

/** Calculates percentile value. */
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

/** Creates default baseline for insufficient data. */
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

/** Formats baseline description for display. */
export const formatBaselineDescription = (baseline: UsageBaseline): string => {
    const avgK = (baseline.averageUsage / 1000).toFixed(0);
    return `Avg ~${avgK}K`;
};

/** Gets usage level description. */
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

/** @deprecated Use calculateUsagePercentageWithLimit for consistent calculation */
export const calculateUsagePercentage = (currentUsage: number, baseline: UsageBaseline): number => {
    return Math.round((currentUsage / baseline.highUsageThreshold) * 100);
};

/**
 * Calculates usage percentage relative to rate limit estimate.
 * @param currentUsage Current token usage
 * @param rateLimitEstimate Estimated or configured rate limit
 * @returns Usage percentage (0-100+, allows exceeding 100%)
 */
export const calculateUsagePercentageWithLimit = (
    currentUsage: number, 
    rateLimitEstimate: number
): number => {
    if (rateLimitEstimate <= 0) {
        return 0;
    }
    return Math.round((currentUsage / rateLimitEstimate) * 100);
};

