/**
 * Claude Code Plan Configuration Module
 * 
 * Handles different Claude Code plan types and their rate limits.
 * Based on official Anthropic documentation:
 * https://support.anthropic.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan
 */

export type ClaudePlan = 'pro' | 'max-5x' | 'max-20x';

/**
 * Rate limit configuration for different Claude Code plans.
 * Based on official documentation and estimated token usage:
 * - Pro: ~45 messages or 10-40 Claude Code prompts per 5 hours
 * - Max 5x: ~225 messages or 50-200 Claude Code prompts per 5 hours 
 * - Max 20x: ~900 messages or 200-800 Claude Code prompts per 5 hours
 * 
 * Token estimates based on average message/prompt token consumption.
 */
export const PLAN_RATE_LIMITS: Record<ClaudePlan, number> = {
    'pro': 500_000,        // 500K tokens per 5 hours (baseline)
    'max-5x': 2_500_000,   // 2.5M tokens per 5 hours (5x Pro)
    'max-20x': 10_000_000  // 10M tokens per 5 hours (20x Pro)
};

/**
 * Plan display names for user interface.
 */
export const PLAN_DISPLAY_NAMES: Record<ClaudePlan, string> = {
    'pro': 'Pro ($20/month)',
    'max-5x': 'Max 5x ($100/month)', 
    'max-20x': 'Max 20x ($200/month)'
};

/**
 * Gets the rate limit for a specific plan.
 * @param plan - The Claude Code plan type
 * @returns Rate limit in tokens per 5-hour window
 */
export const getPlanRateLimit = (plan: ClaudePlan): number => {
    return PLAN_RATE_LIMITS[plan];
};

/**
 * Gets the display name for a plan.
 * @param plan - The Claude Code plan type
 * @returns Human-readable plan name
 */
export const getPlanDisplayName = (plan: ClaudePlan): string => {
    return PLAN_DISPLAY_NAMES[plan];
};


/**
 * Automatically detects the Claude Code plan based on usage data.
 * Uses the highest usage in any 5-hour window to determine the plan tier.
 * @param maxUsageInWindow - Maximum token usage observed in any 5-hour window
 * @returns Detected Claude Code plan
 */
export const detectPlanFromUsage = (maxUsageInWindow: number): ClaudePlan => {
    // If usage exceeds Pro limit (500K), must be Max plan
    if (maxUsageInWindow > PLAN_RATE_LIMITS.pro) {
        // If usage exceeds Max 5x limit (2.5M), must be Max 20x
        if (maxUsageInWindow > PLAN_RATE_LIMITS['max-5x']) {
            return 'max-20x';
        }
        return 'max-5x';
    }
    
    // If usage is within Pro limit, could be any plan
    // Use a more sophisticated detection based on usage patterns
    
    // If usage is >80% of Pro limit, likely using a Max plan
    if (maxUsageInWindow > PLAN_RATE_LIMITS.pro * 0.8) {
        // Check if it's a sustained high usage (suggests Max plan)
        // For now, assume Pro plan if within limits
        return 'pro';
    }
    
    return 'pro';
};


/**
 * Formats rate limit for display (e.g., "500K", "2.5M").
 * @param tokens - Number of tokens
 * @returns Formatted string
 */
export const formatRateLimit = (tokens: number): string => {
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(1)}M`;
    } else if (tokens >= 1_000) {
        return `${(tokens / 1_000).toFixed(0)}K`;
    }
    return tokens.toString();
};

/**
 * Gets a short plan name for status bar display.
 * @param plan - The Claude Code plan
 * @returns Short plan name (e.g., "Pro", "Max5x", "Max20x")
 */
export const getShortPlanName = (plan: ClaudePlan): string => {
    switch (plan) {
        case 'pro': return 'Pro';
        case 'max-5x': return 'Max5x';
        case 'max-20x': return 'Max20x';
        default: return 'Pro';
    }
};