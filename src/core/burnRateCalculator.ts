/**
 * Burn Rate Calculator - Core Module
 * 
 * Calculates token consumption rates, trends, and predictions with cost estimation.
 * 
 * @module BurnRateCalculator
 */

import { ClaudeUsageRecord, BurnRateAnalysis, ModelUsageBreakdown } from '../types';
import { MODEL_PRICING } from './modelUtils';

/** Time windows for analysis in milliseconds */
const TIME_WINDOWS = {
    FIFTEEN_MIN: 15 * 60 * 1000,
    THIRTY_MIN: 30 * 60 * 1000,
    SIXTY_MIN: 60 * 60 * 1000,
    TWO_HOURS: 2 * 60 * 60 * 1000
} as const;

/**
 * Calculates burn rate analysis with trends and predictions.
 * 
 * @param records - Session usage records (sorted by time)
 * @param currentTime - Current timestamp for calculations
 * @param currentUsage - Current total token usage in session
 * @param highThreshold - High usage threshold for predictions
 * @param baselineUsage - Baseline usage level for predictions
 * @returns Comprehensive burn rate analysis
 */
export const calculateBurnRate = (
    records: ClaudeUsageRecord[],
    currentTime: Date,
    currentUsage: number,
    highThreshold: number,
    baselineUsage: number
): BurnRateAnalysis => {
    if (records.length === 0) {
        return createEmptyBurnRateAnalysis();
    }

    // Filter records to last 2 hours for burn rate calculation
    const analysisStartTime = new Date(currentTime.getTime() - TIME_WINDOWS.TWO_HOURS);
    const recentRecords = records
        .filter(record => new Date(record.timestamp) >= analysisStartTime)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (recentRecords.length === 0) {
        return createEmptyBurnRateAnalysis();
    }

    // Calculate time-windowed activity
    const recentActivity = calculateRecentActivity(recentRecords, currentTime);

    // Calculate burn rate with weighted recent activity
    const burnRateData = calculateWeightedBurnRate(recentRecords, currentTime);

    // Analyze trend
    const trend = analyzeTrend(recentRecords, currentTime);

    // Generate predictions
    const predictions = generatePredictions(
        burnRateData.tokensPerMinute,
        currentUsage,
        highThreshold,
        baselineUsage,
        currentTime,
        trend
    );

    // Calculate model breakdown
    const modelBreakdown = calculateModelBreakdown(recentRecords);

    return {
        tokensPerMinute: burnRateData.tokensPerMinute,
        tokensPerHour: burnRateData.tokensPerHour,
        averageRequestSize: burnRateData.averageRequestSize,
        recentActivity,
        predictions,
        trend,
        modelBreakdown
    };
};

/**
 * Calculates activity levels in different time windows.
 */
const calculateRecentActivity = (
    records: ClaudeUsageRecord[],
    currentTime: Date
): { last15min: number; last30min: number; last60min: number } => {
    const windows = [TIME_WINDOWS.FIFTEEN_MIN, TIME_WINDOWS.THIRTY_MIN, TIME_WINDOWS.SIXTY_MIN];
    const activity = windows.map(windowMs => {
        const windowStart = new Date(currentTime.getTime() - windowMs);
        return records
            .filter(record => new Date(record.timestamp) >= windowStart)
            .reduce((sum, record) => sum + record.input_tokens + record.output_tokens, 0);
    });

    return {
        last15min: activity[0],
        last30min: activity[1],
        last60min: activity[2]
    };
};

/**
 * Calculates weighted burn rate with recent activity bias.
 */
const calculateWeightedBurnRate = (
    records: ClaudeUsageRecord[],
    currentTime: Date
): { tokensPerMinute: number; tokensPerHour: number; averageRequestSize: number } => {
    if (records.length === 0) {
        return { tokensPerMinute: 0, tokensPerHour: 0, averageRequestSize: 0 };
    }

    const firstRecord = records[0];
    const lastRecord = records[records.length - 1];
    const timeSpanMs = new Date(lastRecord.timestamp).getTime() - new Date(firstRecord.timestamp).getTime();
    
    if (timeSpanMs <= 0) {
        return { tokensPerMinute: 0, tokensPerHour: 0, averageRequestSize: 0 };
    }

    const totalTokens = records.reduce((sum, record) => sum + record.input_tokens + record.output_tokens, 0);
    const timeSpanMinutes = timeSpanMs / (1000 * 60);
    
    // Calculate weighted average with recent bias
    const weights = records.map((_, index) => Math.pow(1.5, index)); // Exponential weighting
    const weightedSum = records.reduce((sum, record, index) => 
        sum + (record.input_tokens + record.output_tokens) * weights[index], 0);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    const weightedTokensPerMinute = totalWeight > 0 ? (weightedSum / totalWeight) * (records.length / timeSpanMinutes) : 0;
    const tokensPerMinute = Math.max(0, Math.round(weightedTokensPerMinute));
    const tokensPerHour = tokensPerMinute * 60;
    const averageRequestSize = Math.round(totalTokens / records.length);

    return { tokensPerMinute, tokensPerHour, averageRequestSize };
};

/**
 * Analyzes usage trend using simple linear regression.
 */
const analyzeTrend = (
    records: ClaudeUsageRecord[],
    currentTime: Date
): 'increasing' | 'decreasing' | 'stable' => {
    if (records.length < 3) {
        return 'stable';
    }

    // Use 30-minute windows to calculate trend
    const windowSizeMs = 10 * 60 * 1000; // 10 minutes
    const windows: { timestamp: number; tokens: number }[] = [];
    
    const startTime = new Date(records[0].timestamp).getTime();
    const endTime = currentTime.getTime();
    
    for (let time = startTime; time < endTime; time += windowSizeMs) {
        const windowEnd = time + windowSizeMs;
        const windowTokens = records
            .filter(record => {
                const recordTime = new Date(record.timestamp).getTime();
                return recordTime >= time && recordTime < windowEnd;
            })
            .reduce((sum, record) => sum + record.input_tokens + record.output_tokens, 0);
        
        if (windowTokens > 0) {
            windows.push({ timestamp: time, tokens: windowTokens });
        }
    }

    if (windows.length < 3) {
        return 'stable';
    }

    // Simple linear regression
    const n = windows.length;
    const sumX = windows.reduce((sum, w, i) => sum + i, 0);
    const sumY = windows.reduce((sum, w) => sum + w.tokens, 0);
    const sumXY = windows.reduce((sum, w, i) => sum + i * w.tokens, 0);
    const sumX2 = windows.reduce((sum, w, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    const threshold = Math.abs(slope) > 100 ? 100 : 50; // Adjust sensitivity
    
    if (slope > threshold) {
        return 'increasing';
    } else if (slope < -threshold) {
        return 'decreasing';
    } else {
        return 'stable';
    }
};

/**
 * Generates time-based predictions.
 */
const generatePredictions = (
    tokensPerMinute: number,
    currentUsage: number,
    highThreshold: number,
    baselineUsage: number,
    currentTime: Date,
    trend: 'increasing' | 'decreasing' | 'stable'
): BurnRateAnalysis['predictions'] => {
    if (tokensPerMinute <= 0) {
        return { confidence: 'low' };
    }

    // Adjust prediction based on trend
    let adjustedRate = tokensPerMinute;
    if (trend === 'increasing') {
        adjustedRate *= 1.2; // 20% increase for growing trend
    } else if (trend === 'decreasing') {
        adjustedRate *= 0.8; // 20% decrease for declining trend
    }

    const predictions: BurnRateAnalysis['predictions'] = { confidence: 'medium' };

    // Time to reach high threshold
    if (currentUsage < highThreshold) {
        const tokensToHigh = highThreshold - currentUsage;
        const minutesToHigh = tokensToHigh / adjustedRate;
        if (minutesToHigh > 0 && minutesToHigh < 300) { // Max 5 hours prediction
            predictions.timeToHighThreshold = new Date(currentTime.getTime() + minutesToHigh * 60 * 1000);
        }
    }

    // Time to reach baseline
    if (currentUsage < baselineUsage) {
        const tokensToBaseline = baselineUsage - currentUsage;
        const minutesToBaseline = tokensToBaseline / adjustedRate;
        if (minutesToBaseline > 0 && minutesToBaseline < 300) {
            predictions.timeToBaseline = new Date(currentTime.getTime() + minutesToBaseline * 60 * 1000);
        }
    }

    // Estimate session depletion (assume ~35K tokens for max plan)
    const estimatedLimit = Math.max(highThreshold * 2, 35000);
    if (currentUsage < estimatedLimit) {
        const tokensToLimit = estimatedLimit - currentUsage;
        const minutesToLimit = tokensToLimit / adjustedRate;
        if (minutesToLimit > 0 && minutesToLimit < 300) {
            predictions.estimatedDepletionTime = new Date(currentTime.getTime() + minutesToLimit * 60 * 1000);
        }
    }

    // Determine confidence based on data quality and trend stability
    if (tokensPerMinute > 10 && trend !== 'stable') {
        predictions.confidence = 'high';
    } else if (tokensPerMinute < 5 || trend === 'stable') {
        predictions.confidence = 'low';
    }

    return predictions;
};

/**
 * Calculates model-specific usage breakdown with cost estimates.
 */
const calculateModelBreakdown = (records: ClaudeUsageRecord[]): ModelUsageBreakdown[] => {
    const modelStats = new Map<string, {
        inputTokens: number;
        outputTokens: number;
        requests: number;
    }>();

    // Aggregate by model
    records.forEach(record => {
        const model = record.model || 'unknown';
        const existing = modelStats.get(model) || { inputTokens: 0, outputTokens: 0, requests: 0 };
        
        modelStats.set(model, {
            inputTokens: existing.inputTokens + record.input_tokens,
            outputTokens: existing.outputTokens + record.output_tokens,
            requests: existing.requests + 1
        });
    });

    const totalTokens = records.reduce((sum, record) => sum + record.input_tokens + record.output_tokens, 0);

    // Convert to breakdown format
    return Array.from(modelStats.entries()).map(([model, stats]) => {
        const tokens = stats.inputTokens + stats.outputTokens;
        const percentage = Math.round((tokens / totalTokens) * 100);
        const avgTokensPerRequest = Math.round(tokens / stats.requests);

        // Calculate estimated cost
        const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING.default;
        const inputCost = (stats.inputTokens / 1_000_000) * pricing.input;
        const outputCost = (stats.outputTokens / 1_000_000) * pricing.output;
        const estimatedCost = Math.round((inputCost + outputCost) * 100) / 100; // Round to cents

        return {
            model,
            tokens,
            requests: stats.requests,
            avgTokensPerRequest,
            percentage,
            estimatedCost
        };
    }).sort((a, b) => b.tokens - a.tokens); // Sort by token usage descending
};

/**
 * Creates empty burn rate analysis for no data scenarios.
 */
const createEmptyBurnRateAnalysis = (): BurnRateAnalysis => ({
    tokensPerMinute: 0,
    tokensPerHour: 0,
    averageRequestSize: 0,
    recentActivity: {
        last15min: 0,
        last30min: 0,
        last60min: 0
    },
    predictions: {
        confidence: 'low'
    },
    trend: 'stable'
});

/**
 * Formats burn rate for display.
 */
export const formatBurnRate = (burnRate: BurnRateAnalysis): string => {
    if (burnRate.tokensPerMinute === 0) {
        return 'No activity';
    }
    
    const rate = burnRate.tokensPerMinute;
    if (rate >= 1000) {
        return `${(rate / 1000).toFixed(1)}K/min`;
    } else {
        return `${rate}/min`;
    }
};

/**
 * Formats prediction time for display.
 */
export const formatPredictionTime = (date: Date | undefined, currentTime: Date): string | undefined => {
    if (!date) return undefined;
    
    const diffMs = date.getTime() - currentTime.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
        return `${diffMinutes}min`;
    } else {
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
    }
};