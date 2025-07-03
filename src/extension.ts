/**
 * Claude Code Usage Monitor - VSCode Extension Entry Point & Unified Facade
 *
 * This module serves as both the VSCode extension entry point and the central
 * Facade pattern implementation, coordinating all core modules and managing
 * the complete data flow from parsing to UI display.
 *
 * **Architecture Pattern: Facade**
 * - Coordinates: Data Parsing → Block Calculation → Baseline Analysis → UI Display
 * - Manages: VSCode integration, command registration, status bar updates
 * - Centralizes: Error handling, timing, and module communication
 *
 * **Key Features:**
 * - Real-time Claude Code usage monitoring
 * - Intelligent baseline-based percentage calculation
 * - 5-hour session window tracking
 * - Cross-platform directory discovery
 * - Comprehensive error handling and reporting
 *
 * **UI Integration:**
 * - Status bar display with color-coded usage levels
 * - Click-to-view detailed usage information
 * - Automatic 60-second refresh cycle
 * - Manual refresh command support
 *
 * @module Extension
 * @pattern Facade
 */

import * as vscode from 'vscode';
import { UsageStatus, MultiSessionBlock, ParseError } from './types';
import { createMultiSessionBlock } from './core/blockCalculator';
import { parseAllUsageData } from './core/claudeDataParser';
import { calculateUsageBaseline, formatBaselineDescription, getUsageLevel, calculateUsagePercentage } from './core/usageBaselineCalculator';
import { formatTimeUntilReset } from './windowCalculator';
import {
    getStatusBarText,
    getStatusBarColor,
    formatUsageDetails,
    formatTimeDetails
} from './ui/statusBarFormatter';

/** VSCode status bar item for displaying usage information */
let statusBarItem: vscode.StatusBarItem;

/** Timer for periodic status updates (every 60 seconds) */
let updateTimer: NodeJS.Timeout | undefined;


/**
 * VSCode Extension activation function - Entry point for the extension lifecycle.
 *
 * Sets up the complete monitoring system including status bar, commands, and
 * periodic updates. Registers all necessary VSCode integrations and starts
 * the monitoring process.
 *
 * **Initialization Steps:**
 * 1. Create and configure status bar item
 * 2. Register user commands (show details, refresh)
 * 3. Start 60-second periodic update timer
 * 4. Perform initial status update
 *
 * @param {vscode.ExtensionContext} context - VSCode extension context for managing subscriptions and lifecycle
 *
 * @example
 * ```typescript
 * // Called automatically by VSCode when extension activates
 * // User sees status bar: "$(terminal) 45% | 32K avg | Reset: 16:00"
 * ```
 */
export function activate(context: vscode.ExtensionContext) {
    // Create status bar item positioned on the right side
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'claude-code-usage.showDetails';
    context.subscriptions.push(statusBarItem);

    // Register command to show detailed usage information
    const showDetailsCommand = vscode.commands.registerCommand('claude-code-usage.showDetails', () => {
        showUsageDetails();
    });

    // Register command to manually refresh usage data
    const refreshCommand = vscode.commands.registerCommand('claude-code-usage.refresh', () => {
        updateStatusBar();
    });

    context.subscriptions.push(showDetailsCommand, refreshCommand);

    // Start periodic updates and initial display
    startPeriodicUpdates();
    updateStatusBar();
}

/**
 * 🏛️ FACADE FUNCTION: Gets current usage status with baseline calculation.
 *
 * This is the main coordination function that orchestrates all core modules
 * to provide unified usage information. Implements the Facade pattern by
 * hiding complex subsystem interactions behind a simple interface.
 *
 * **Module Coordination Flow:**
 * ```
 * parseAllUsageData() → createMultiSessionBlock() → createUsageStatusFromMultiSession()
 * ```
 *
 * **Error Handling:**
 * - Propagates parsing errors to UI layer
 * - Returns null for no-data scenarios
 * - Maintains error context throughout the flow
 *
 * @returns {Promise<UsageStatus | null>} Complete usage status or null if no data
 *
 * @example
 * ```typescript
 * const status = await getUsageStatus();
 * if (status) {
 *   console.log(`Usage: ${status.usagePercentage}%`);
 * }
 * ```
 */
async function getUsageStatus(): Promise<UsageStatus | null> {
    // Facade coordinates: data parsing → block calculation → baseline analysis
    const parsedData = await parseAllUsageData();
    const multiSessionBlock = createMultiSessionBlock(parsedData.records, new Date(), parsedData.error);

    if (!multiSessionBlock) {
        return null;
    }

    const status = await createUsageStatusFromMultiSession(multiSessionBlock);

    if (multiSessionBlock.error) {
        return { ...status, error: multiSessionBlock.error };
    }

    return status;
}

/**
 * 🏛️ FACADE FUNCTION: Creates comprehensive usage status with baseline calculation.
 *
 * Integrates multiple core modules to transform raw session data into actionable
 * usage information with intelligent baseline analysis and predictive metrics.
 *
 * **Processing Pipeline:**
 * 1. Extract current session data
 * 2. Calculate statistical baseline (excluding current session)
 * 3. Compute usage percentage and level
 * 4. Generate time-based predictions
 * 5. Create comprehensive status object
 *
 * **Key Calculations:**
 * - **Usage Percentage**: Current vs baseline (not hard limits)
 * - **Consumption Rate**: Tokens per minute for predictions
 * - **Depletion Estimate**: When critical threshold might be reached
 * - **Confidence Assessment**: Statistical reliability of baseline
 *
 * @param {MultiSessionBlock} multiSessionBlock - Processed session block data
 * @returns {Promise<UsageStatus>} Comprehensive usage status with predictions
 *
 * @example
 * ```typescript
 * const status = await createUsageStatusFromMultiSession(sessionBlock);
 * console.log(`Level: ${status.usageLevel}, Confidence: ${status.baselineConfidence}`);
 * ```
 */
async function createUsageStatusFromMultiSession(
    multiSessionBlock: MultiSessionBlock
): Promise<UsageStatus> {
    const session = multiSessionBlock.mostRestrictiveSession;
    const currentUsage = session.totalTokens;

    // Calculate usage baseline from historical data (excluding current active block)
    const parsedData = await parseAllUsageData();
    const baseline = calculateUsageBaseline(parsedData.records, session.sessionId);

    const usagePercentage = calculateUsagePercentage(currentUsage, baseline);
    const { level: usageLevel } = getUsageLevel(currentUsage, baseline);

    const resetTime = session.endTime;
    const timeUntilReset = session.timeUntilReset;
    const timeUntilResetFormatted = formatTimeUntilReset(timeUntilReset);

    const isHighUsage = currentUsage >= baseline.highUsageThreshold;
    const isCriticalUsage = currentUsage >= baseline.criticalUsageThreshold;

    const sessionDurationMs = session.endTime.getTime() - session.startTime.getTime();
    const sessionDurationMinutes = sessionDurationMs / (1000 * 60);
    const estimatedTokensPerMinute = sessionDurationMinutes > 0 ? currentUsage / sessionDurationMinutes : 0;

    let estimatedDepletionTime: Date | undefined;
    if (estimatedTokensPerMinute > 0 && currentUsage < baseline.criticalUsageThreshold) {
        const remainingTokens = baseline.criticalUsageThreshold - currentUsage;
        const minutesToDepletion = remainingTokens / estimatedTokensPerMinute;
        const depletionTime = new Date(Date.now() + minutesToDepletion * 60 * 1000);

        if (depletionTime <= resetTime) {
            estimatedDepletionTime = depletionTime;
        }
    }

    return {
        currentUsage,
        usageBaseline: baseline.highUsageThreshold,
        usagePercentage,
        resetTime,
        timeUntilReset,
        timeUntilResetFormatted,
        isHighUsage,
        isCriticalUsage,
        estimatedTokensPerMinute: Math.round(estimatedTokensPerMinute),
        estimatedDepletionTime,
        baselineDescription: formatBaselineDescription(baseline),
        usageLevel,
        baselineConfidence: baseline.confidence
    };
}

/**
 * Updates the status bar with current Claude Code usage information.
 * Handles three states: normal usage, no data, and error conditions.
 * Called automatically every 60 seconds and manually via refresh command.
 */
async function updateStatusBar() {
    try {
        const status = await getUsageStatus();

        if (status) {
            // Handle data parsing errors
            if (status.error) {
                statusBarItem.text = '$(warning) Data Issue';
                statusBarItem.color = '#ffaa00';
                statusBarItem.tooltip = createTooltip(status);
                statusBarItem.show();
                return;
            }

            // Display normal usage status with baseline percentage
            const text = getStatusBarText(status);
            const color = getStatusBarColor(status);

            statusBarItem.text = text;
            statusBarItem.color = color;
            statusBarItem.tooltip = createTooltip(status);
            statusBarItem.show();
        } else {
            // No active Claude Code usage detected
            statusBarItem.text = '$(terminal) No active block';
            statusBarItem.color = '#888888';
            statusBarItem.tooltip = 'No Claude Code block detected. Start using Claude Code to begin monitoring.';
            statusBarItem.show();
        }
    } catch (error) {
        // Handle unexpected errors
        console.error('Error updating status bar:', error);
        statusBarItem.text = '$(error) Data Error';
        statusBarItem.color = '#ff4444';
        statusBarItem.tooltip = 'Error reading Claude Code usage data. Click for details.';
        statusBarItem.show();
    }
}

/**
 * Creates tooltip text for the status bar item based on current usage status.
 * Provides detailed information about usage, baseline, timing, and errors.
 *
 * @param status Current usage status from rateLimitManager
 * @returns Formatted tooltip string for display
 */
function createTooltip(status: UsageStatus): string {
    // Show error information if data parsing failed
    if (status.error) {
        let tooltip = `Claude Code Usage Monitor\n\n`;
        tooltip += `⚠️ ${status.error.message}\n\n`;
        tooltip += `Details: ${status.error.details}\n`;
        if (status.error.suggestion) {
            tooltip += `\nSuggestion: ${status.error.suggestion}`;
        }
        tooltip += '\n\nClick for more information';
        return tooltip;
    }

    // Format normal usage information
    const usageDetails = formatUsageDetails(status);
    const timeDetails = formatTimeDetails(status);

    let tooltip = `Claude Code Usage Monitor\n\n`;
    tooltip += `Current Usage: ${usageDetails}\n`;
    tooltip += `Baseline: ${status.usageBaseline.toLocaleString()} tokens (~${status.baselineDescription})\n\n`;
    tooltip += `Reset Time: ${timeDetails['Reset Time']}\n`;
    tooltip += `Time Until Reset: ${timeDetails['Time Until Reset']}\n`;
    tooltip += `Consumption Rate: ${timeDetails['Tokens Per Minute']} tokens/min\n`;

    if (timeDetails['Estimated Depletion']) {
        tooltip += `Estimated Depletion: ${timeDetails['Estimated Depletion']}\n`;
    }

    // Add usage level indicator with emoji
    const statusEmoji = status.isCriticalUsage ? '🔴 CRITICAL: Very high usage!' :
        status.isHighUsage ? '🟡 WARNING: High usage' :
            '🟢 NORMAL: Typical usage level';

    return tooltip + `\n${statusEmoji}\n\nClick for detailed view`;
}

/**
 * Shows detailed usage information in a VSCode information message dialog.
 * Triggered when user clicks on the status bar item.
 * Displays comprehensive usage statistics, baseline information, and timing details.
 */
async function showUsageDetails() {
    try {
        const status = await getUsageStatus();

        // Handle case where no usage data is available
        if (!status) {
            vscode.window.showInformationMessage(
                'No active Claude Code usage detected. Start using Claude Code to see usage statistics.'
            );
            return;
        }

        // Don't show dialog for error states (tooltip already shows error info)
        if (status.error) {
            return;
        }

        // Format detailed usage information
        const usageDetails = formatUsageDetails(status);
        const timeDetails = formatTimeDetails(status);

        let message = `Claude Code Usage Details\n\nCurrent Usage: ${usageDetails}\nUsage Level: ${status.usageLevel}\nBaseline Confidence: ${status.baselineConfidence}\n\nReset Time: ${timeDetails['Reset Time']}\nTime Until Reset: ${timeDetails['Time Until Reset']}\nConsumption Rate: ${timeDetails['Tokens Per Minute']} tokens/min\n`;

        if (timeDetails['Estimated High Usage']) {
            message += `Estimated High Usage: ${timeDetails['Estimated High Usage']}\n`;
        }

        // Add status indicator with appropriate emoji
        const statusText = status.isCriticalUsage ? 'Status: 🔴 CRITICAL - Very high usage!' :
            status.isHighUsage ? 'Status: 🟡 WARNING - High usage' :
                'Status: 🟢 NORMAL - Typical usage level';

        vscode.window.showInformationMessage(message + `\n${statusText}`);
    } catch (error) {
        console.error('Error showing usage details:', error);
    }
}

/**
 * Starts periodic status bar updates every 60 seconds.
 * Ensures real-time monitoring of Claude Code usage patterns.
 */
function startPeriodicUpdates() {
    updateTimer = setInterval(updateStatusBar, 60000); // Update every 60 seconds
}

/**
 * Extension deactivation function called when the extension is deactivated.
 * Cleans up timers and disposes of VSCode UI resources.
 */
export function deactivate() {
    // Clear the periodic update timer
    if (updateTimer) {
        clearInterval(updateTimer);
    }

    // Dispose of the status bar item
    statusBarItem?.dispose();
}
