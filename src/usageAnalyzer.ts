/**
 * Claude Code Usage Analyzer Module
 * 
 * Provides analysis and filtering capabilities for Claude Code usage records.
 * Handles time-based filtering, session grouping, and token calculations.
 */

import { ClaudeUsageRecord, TokenUsageStats, ParsedUsageData } from './types';
import { calculateRecordCost } from './costCalculator';

/**
 * Gets the total token count for a usage record (all token types).
 * @param record - The usage record
 * @returns Total token count including all token types
 */
export const getTotalTokens = (record: ClaudeUsageRecord): number => 
    record.input_tokens + record.output_tokens + 
    record.cache_creation_tokens + record.cache_read_tokens;

/**
 * Gets rate limit relevant tokens (input + output only, excludes cache tokens).
 * @param record - The usage record
 * @returns Token count for rate limit calculations
 */
export const getRateLimitTokens = (record: ClaudeUsageRecord): number =>
    record.input_tokens + record.output_tokens;

/**
 * Filters usage records by time range.
 * @param records - Array of usage records
 * @param startTime - Start of time range (inclusive)
 * @param endTime - End of time range (inclusive)
 * @returns Filtered records within the time range
 */
export const filterRecordsByTimeRange = (
    records: ClaudeUsageRecord[], 
    startTime: Date, 
    endTime: Date
): ClaudeUsageRecord[] => 
    records.filter(record => {
        const recordTime = new Date(record.timestamp);
        return recordTime >= startTime && recordTime <= endTime;
    });

/**
 * Groups usage records by session ID.
 * @param records - Array of usage records
 * @returns Map of session ID to records array
 */
export const groupRecordsBySession = (records: ClaudeUsageRecord[]): Map<string, ClaudeUsageRecord[]> => 
    records.reduce((groups, record) => {
        const sessionKey = record.sessionId || 'unknown';
        const existing = groups.get(sessionKey) || [];
        groups.set(sessionKey, [...existing, record]);
        return groups;
    }, new Map<string, ClaudeUsageRecord[]>());

/**
 * Groups usage records by date (YYYY-MM-DD).
 * @param records - Array of usage records
 * @returns Map of date string to records array
 */
export const groupRecordsByDate = (records: ClaudeUsageRecord[]): Map<string, ClaudeUsageRecord[]> =>
    records.reduce((groups, record) => {
        const date = new Date(record.timestamp).toISOString().split('T')[0];
        const existing = groups.get(date) || [];
        groups.set(date, [...existing, record]);
        return groups;
    }, new Map<string, ClaudeUsageRecord[]>());

/**
 * Groups usage records by model.
 * @param records - Array of usage records
 * @returns Map of model name to records array
 */
export const groupRecordsByModel = (records: ClaudeUsageRecord[]): Map<string, ClaudeUsageRecord[]> =>
    records.reduce((groups, record) => {
        const model = record.model || 'unknown';
        const existing = groups.get(model) || [];
        groups.set(model, [...existing, record]);
        return groups;
    }, new Map<string, ClaudeUsageRecord[]>());

/**
 * Calculates token usage statistics for an array of records.
 * @param records - Array of usage records
 * @returns Token usage statistics
 */
export const calculateTokenUsageStats = (records: ClaudeUsageRecord[]): TokenUsageStats => {
    const stats = records.reduce(
        (acc, record) => ({
            totalInputTokens: acc.totalInputTokens + record.input_tokens,
            totalOutputTokens: acc.totalOutputTokens + record.output_tokens,
            totalCacheCreationTokens: acc.totalCacheCreationTokens + record.cache_creation_tokens,
            totalCacheReadTokens: acc.totalCacheReadTokens + record.cache_read_tokens,
            totalTokens: acc.totalTokens + getTotalTokens(record),
            rateLimitTokens: acc.rateLimitTokens + getRateLimitTokens(record)
        }),
        {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCacheCreationTokens: 0,
            totalCacheReadTokens: 0,
            totalTokens: 0,
            rateLimitTokens: 0
        }
    );

    return stats;
};

/**
 * Finds the earliest and latest timestamps in a set of records.
 * @param records - Array of usage records
 * @returns Object with earliest and latest dates
 */
export const getDateRange = (records: ClaudeUsageRecord[]): { earliest: Date; latest: Date } => {
    if (records.length === 0) {
        const now = new Date();
        return { earliest: now, latest: now };
    }

    const timestamps = records.map(r => new Date(r.timestamp).getTime());
    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));

    return { earliest, latest };
};

/**
 * Gets unique session IDs from usage records.
 * @param records - Array of usage records
 * @returns Array of unique session IDs
 */
export const getUniqueSessionIds = (records: ClaudeUsageRecord[]): string[] => {
    const sessionIds = records
        .map(r => r.sessionId)
        .filter((id): id is string => Boolean(id));
    
    return [...new Set(sessionIds)];
};

/**
 * Finds records within the last N hours.
 * @param records - Array of usage records
 * @param hours - Number of hours to look back
 * @returns Records within the specified time window
 */
export const getRecordsInLastHours = (records: ClaudeUsageRecord[], hours: number): ClaudeUsageRecord[] => {
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return filterRecordsByTimeRange(records, startTime, now);
};

/**
 * Sorts records by timestamp in chronological order.
 * @param records - Array of usage records
 * @returns Sorted records (earliest first)
 */
export const sortRecordsByTime = (records: ClaudeUsageRecord[]): ClaudeUsageRecord[] =>
    [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

/**
 * Creates a comprehensive analysis of usage data.
 * @param records - Array of usage records
 * @returns Parsed usage data with analysis
 */
export const analyzeUsageData = (records: ClaudeUsageRecord[]): ParsedUsageData => {
    // Ensure all records have cost calculated
    const processedRecords = records.map(record => ({
        ...record,
        cost: record.cost || calculateRecordCost(record)
    }));

    // Sort by timestamp
    const sortedRecords = sortRecordsByTime(processedRecords);
    
    // Get date range
    const dateRange = getDateRange(sortedRecords);
    
    // Get unique session IDs
    const sessionIds = getUniqueSessionIds(sortedRecords);

    return {
        records: sortedRecords,
        totalRecords: sortedRecords.length,
        dateRange,
        sessionIds
    };
};

/**
 * Calculates usage rate (tokens per minute) for a time period.
 * @param records - Array of usage records
 * @param startTime - Start of the time period
 * @param endTime - End of the time period
 * @returns Usage rate in tokens per minute
 */
export const calculateUsageRate = (
    records: ClaudeUsageRecord[], 
    startTime: Date, 
    endTime: Date
): number => {
    const stats = calculateTokenUsageStats(records);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    
    return durationMinutes > 0 ? Math.round(stats.rateLimitTokens / durationMinutes) : 0;
};