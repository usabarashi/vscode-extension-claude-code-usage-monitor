/**
 * Claude API Cost Calculator Module
 * 
 * Handles all Claude API pricing calculations based on token usage.
 * Encapsulates Claude's pricing model and cost computation logic.
 */

import { ClaudeUsageRecord } from './types';

/** Claude API pricing in USD per token (as of current pricing model) */
export const CLAUDE_PRICING = {
    input: 15 / 1_000_000,
    output: 75 / 1_000_000,
    cache_creation: 18.75 / 1_000_000,
    cache_read: 1.5 / 1_000_000
} as const;

/**
 * Calculates the cost of a Claude usage record based on token usage and current pricing.
 * @param record - The usage record containing token counts
 * @returns Cost in USD
 */
export const calculateRecordCost = (record: ClaudeUsageRecord): number => (
    record.input_tokens * CLAUDE_PRICING.input +
    record.output_tokens * CLAUDE_PRICING.output +
    record.cache_creation_tokens * CLAUDE_PRICING.cache_creation +
    record.cache_read_tokens * CLAUDE_PRICING.cache_read
);

/**
 * Calculates the total cost for multiple usage records.
 * @param records - Array of usage records
 * @returns Total cost in USD
 */
export const calculateTotalCost = (records: ClaudeUsageRecord[]): number =>
    records.reduce((total, record) => total + (record.cost || calculateRecordCost(record)), 0);

/**
 * Calculates cost breakdown by token type for a usage record.
 * @param record - The usage record
 * @returns Object with cost breakdown by token type
 */
export const calculateCostBreakdown = (record: ClaudeUsageRecord) => ({
    inputCost: record.input_tokens * CLAUDE_PRICING.input,
    outputCost: record.output_tokens * CLAUDE_PRICING.output,
    cacheCreationCost: record.cache_creation_tokens * CLAUDE_PRICING.cache_creation,
    cacheReadCost: record.cache_read_tokens * CLAUDE_PRICING.cache_read,
    totalCost: calculateRecordCost(record)
});

/**
 * Estimates cost for projected token usage.
 * @param inputTokens - Projected input tokens
 * @param outputTokens - Projected output tokens
 * @param cacheCreationTokens - Projected cache creation tokens
 * @param cacheReadTokens - Projected cache read tokens
 * @returns Estimated cost in USD
 */
export const estimateCost = (
    inputTokens: number = 0,
    outputTokens: number = 0,
    cacheCreationTokens: number = 0,
    cacheReadTokens: number = 0
): number => (
    inputTokens * CLAUDE_PRICING.input +
    outputTokens * CLAUDE_PRICING.output +
    cacheCreationTokens * CLAUDE_PRICING.cache_creation +
    cacheReadTokens * CLAUDE_PRICING.cache_read
);

/**
 * Formats cost as a currency string.
 * @param cost - Cost in USD
 * @returns Formatted currency string (e.g., "$0.12")
 */
export const formatCost = (cost: number): string => 
    new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    }).format(cost);