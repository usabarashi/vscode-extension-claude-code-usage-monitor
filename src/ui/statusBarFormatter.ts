/**
 * Status Bar Formatter - UI Display Layer
 *
 * Provides pure formatting functions for VSCode status bar display.
 * Handles visual representation of usage data with no business logic.
 * Separated from core modules for clean UI/business logic separation.
 *
 * **Formatting Strategy:**
 * - Consistent visual format across all displays
 * - Color-coded usage levels for quick recognition
 * - Compact status bar text with comprehensive tooltips
 * - Localized time formatting for user timezone
 *
 * **Color Scheme:**
 * - 🟢 Green: <70% usage (normal)
 * - 🟡 Yellow: 70-99% usage (warning)
 * - 🔴 Red: 100%+ usage (critical)
 *
 * @module StatusBarFormatter
 * @layer UI
 */

import { UsageStatus } from '../types';

/**
 * Creates a compact, informative status bar display that shows current
 * usage percentage, baseline reference, and reset time in user's timezone.
 *
 * **Format Specification:**
 * ```
 * $(terminal) {percentage}% | {baseline}K avg | Reset: {time}
 * ```
 *
 * **Examples:**
 * - `$(terminal) 45% | 32K avg | Reset: 16:00`
 * - `$(terminal) 120% | 50K avg | Reset: 21:30`
 *
 * @param {UsageStatus} status - Complete usage status information
 * @returns {string} Formatted status bar text
 *
 * @example
 * ```typescript
 * const text = getStatusBarText(status);
 * statusBarItem.text = text; // "$(terminal) 85% | 45K avg | Reset: 16:00"
 * ```
 *
 * @since 0.1.0
 */
export const getStatusBarText = (status: UsageStatus): string => {
    const percentage = status.usagePercentage;
    const baseline = (status.usageBaseline / 1000).toFixed(0); // Convert to K

    const resetTime = status.resetTime.toLocaleTimeString(undefined, {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });

    return `$(terminal) ${percentage}% | ${baseline}K avg | Reset: ${resetTime}`;
};

/**
 * Provides visual feedback through color coding to help users quickly
 * assess their current usage status without reading the detailed numbers.
 *
 * **Color Mapping:**
 * - **Green (`#00aa00`)**: <70% usage - Normal operation
 * - **Yellow (`#ffaa00`)**: 70-99% usage - Approaching limits
 * - **Red (`#ff4444`)**: 100%+ usage - Exceeding typical patterns
 *
 * **Design Rationale:**
 * Uses percentage-based thresholds rather than absolute token counts
 * for more accurate representation of user's personal usage patterns.
 *
 * @param {UsageStatus} status - Usage status with percentage information
 * @returns {string} Hex color code for status bar styling
 *
 * @example
 * ```typescript
 * const color = getStatusBarColor(status);
 * statusBarItem.color = color; // "#ff4444" for high usage
 * ```
 *
 * @since 0.1.0
 */
export const getStatusBarColor = (status: UsageStatus): string => {
    // Use percentage-based color for more accurate representation
    if (status.usagePercentage >= 100) {
        return '#ff4444'; // Red for 100%+ usage
    } else if (status.usagePercentage >= 70) {
        return '#ffaa00'; // Yellow for 70-99% usage
    } else {
        return '#00aa00'; // Green for <70% usage
    }
};

/**
 * Creates human-readable usage details with proper number formatting
 * and contextual percentage information for detailed views.
 *
 * **Format**: `{tokens:formatted} tokens ({percentage}% of block)`
 *
 * @param {UsageStatus} status - Usage status with token counts
 * @returns {string} Formatted usage details string
 *
 * @example
 * ```typescript
 * const details = formatUsageDetails(status);
 * console.log(details); // "45,230 tokens (85% of block)"
 * ```
 *
 * @since 0.1.0
 */
export const formatUsageDetails = (status: UsageStatus): string => {
    const formattedUsage = status.currentUsage.toLocaleString();
    return `${formattedUsage} tokens (${status.usagePercentage}% of block)`;
};

/**
 * Creates a structured object with all time-based metrics including reset times,
 * countdowns, consumption rates, and predictive estimations for tooltip display.
 *
 * **Returned Fields:**
 * - `Reset Time`: Localized reset timestamp
 * - `Time Until Reset`: Human-readable countdown
 * - `Tokens Per Minute`: Current consumption rate
 * - `Estimated High Usage`: Predicted high usage time (if applicable)
 *
 * @param {UsageStatus} status - Complete usage status with timing data
 * @returns {Object<string, string>} Dictionary of formatted time details
 *
 * @example
 * ```typescript
 * const timeDetails = formatTimeDetails(status);
 * console.log(timeDetails['Reset Time']); // "1/15/2024, 4:00:00 PM"
 * console.log(timeDetails['Tokens Per Minute']); // "125"
 * ```
 *
 * @since 0.1.0
 */
export const formatTimeDetails = (status: UsageStatus): { [key: string]: string } => {
    const resetTime = status.resetTime.toLocaleString();
    const timeUntilReset = status.timeUntilResetFormatted;

    const details: { [key: string]: string } = {
        'Reset Time': resetTime,
        'Time Until Reset': timeUntilReset,
        'Tokens Per Minute': status.estimatedTokensPerMinute.toString()
    };

    if (status.estimatedDepletionTime) {
        details['Estimated High Usage'] = status.estimatedDepletionTime.toLocaleString();
    }

    return details;
};
