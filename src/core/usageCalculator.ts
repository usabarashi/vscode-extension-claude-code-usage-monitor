/**
 * Usage Calculator - Core Module (Independent)
 * 
 * Provides token usage calculation and aggregation functionality.
 * Processes Claude Code usage records to generate comprehensive usage statistics.
 * 
 * @module UsageCalculator
 */

import { ClaudeUsageRecord } from '../types';

/**
 * Comprehensive token usage statistics interface.
 * 
 * Represents aggregated token consumption across different token types
 * used by Claude Code interactions.
 * 
 * @interface TokenUsageStats
 */
export interface TokenUsageStats {
    /** Total input tokens consumed across all requests */
    totalInputTokens: number;
    
    /** Total output tokens generated across all requests */
    totalOutputTokens: number;
    
    /** Total cache creation tokens used for prompt caching */
    totalCacheCreationTokens: number;
    
    /** Total cache read tokens used when accessing cached prompts */
    totalCacheReadTokens: number;
    
    /** Combined total of input and output tokens (excludes cache tokens) */
    totalTokens: number;
    
    /** Total number of API requests made */
    requestCount: number;
}

/**
 * PURE FUNCTION: Calculates comprehensive token usage statistics from Claude usage records.
 * 
 * Aggregates token consumption across multiple usage records to provide
 * detailed statistics for monitoring and rate limit calculations.
 * 
 * **Token Types Processed:**
 * - **Input Tokens**: User prompts and context
 * - **Output Tokens**: Claude's responses
 * - **Cache Creation Tokens**: Tokens used for creating prompt cache
 * - **Cache Read Tokens**: Tokens used when reading from prompt cache
 * 
 * **Note**: Cache tokens are tracked separately and NOT included in `totalTokens`
 * as they typically have different rate limit implications.
 * 
 * @param {ClaudeUsageRecord[]} records - Array of Claude usage records to aggregate
 * @returns {TokenUsageStats} Comprehensive token usage statistics
 * 
 * @example
 * ```typescript
 * const records = [
 *   { input_tokens: 100, output_tokens: 50, cache_creation_tokens: 0, cache_read_tokens: 0 },
 *   { input_tokens: 200, output_tokens: 75, cache_creation_tokens: 10, cache_read_tokens: 5 }
 * ];
 * 
 * const stats = calculateTokenUsage(records);
 * console.log(stats.totalTokens); // 425 (input + output only)
 * console.log(stats.requestCount); // 2
 * ```
 * 
 * @since 0.1.0
 */
export const calculateTokenUsage = (records: ClaudeUsageRecord[]): TokenUsageStats => {
    // Aggregate all token types using reduce for efficient single-pass calculation
    const aggregated = records.reduce(
        (acc, record) => ({
            totalInputTokens: acc.totalInputTokens + record.input_tokens,
            totalOutputTokens: acc.totalOutputTokens + record.output_tokens,
            totalCacheCreationTokens: acc.totalCacheCreationTokens + record.cache_creation_tokens,
            totalCacheReadTokens: acc.totalCacheReadTokens + record.cache_read_tokens
        }),
        {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCacheCreationTokens: 0,
            totalCacheReadTokens: 0
        }
    );

    return {
        ...aggregated,
        // totalTokens excludes cache tokens per rate limiting conventions
        totalTokens: aggregated.totalInputTokens + aggregated.totalOutputTokens,
        requestCount: records.length
    };
};