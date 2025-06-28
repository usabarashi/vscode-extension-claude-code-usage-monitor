/**
 * Core Type Definitions for Claude Code Usage Monitoring
 * 
 * Centralizes all TypeScript interfaces and types used across the extension.
 * Represents the domain model of Claude Code usage tracking.
 */

/**
 * Represents a single Claude Code usage record.
 * This is the fundamental unit of usage data from Claude Code.
 */
export interface ClaudeUsageRecord {
    timestamp: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    model: string;
    cost: number;
    sessionId?: string;
    requestId?: string;
}

/**
 * Represents the result of parsing all Claude Code usage data.
 * Aggregates usage records with metadata about the parsing operation.
 */
export interface ParsedUsageData {
    records: ClaudeUsageRecord[];
    totalRecords: number;
    dateRange: {
        earliest: Date;
        latest: Date;
    };
    sessionIds: string[];
}

/**
 * Represents an error that occurred during data parsing.
 * Provides structured error information for user-friendly error handling.
 */
export interface ParseError {
    type: 'directory_not_found' | 'file_access_error' | 'data_format_error' | 'unknown_error';
    message: string;
    details?: string;
    suggestion?: string;
}

/**
 * Represents a rolling window block for Claude Code usage tracking.
 * Implements the 5-hour rolling window rate limit calculation.
 */
export interface RollingWindowBlock {
    windowStartTime: Date;
    windowEndTime: Date;
    resetTime: Date;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheCreationTokens: number;
    totalCacheReadTokens: number;
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    isActive: boolean;
    timeUntilReset: number;
    error?: ParseError;
}

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
    error?: ParseError;
}

/**
 * Represents cost breakdown by token type.
 */
export interface CostBreakdown {
    inputCost: number;
    outputCost: number;
    cacheCreationCost: number;
    cacheReadCost: number;
    totalCost: number;
}

/**
 * Represents a Claude Code project directory.
 */
export interface ProjectInfo {
    path: string;
    name: string;
    hasLegacyFormat: boolean;
    hasModernFormat: boolean;
    sessionFiles: string[];
}

/**
 * Represents token usage statistics.
 */
export interface TokenUsageStats {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheCreationTokens: number;
    totalCacheReadTokens: number;
    totalTokens: number;
    rateLimitTokens: number; // Only input + output tokens
}