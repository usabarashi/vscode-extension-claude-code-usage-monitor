/**
 * Claude Code Usage Monitor - VSCode Extension Entry Point
 * @module Extension
 */

import * as vscode from 'vscode';
import { UsageStatus } from './types';
import { SettingsManager } from './config/settingsManager';
import { UsageMonitorFacade, UsageStatusResult } from './services/usageMonitorFacade';
import {
    getStatusBarText,
    getStatusBarColor,
    formatUsageDetails,
    formatTimeDetails
} from './ui/statusBarFormatter';

let statusBarItem: vscode.StatusBarItem;
let updateTimer: NodeJS.Timeout | undefined;
const usageMonitorFacade = new UsageMonitorFacade();


/**
 * Activates the VSCode extension.
 * @param context VSCode extension context
 */
export function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'claude-code-usage.showDetails';
    context.subscriptions.push(statusBarItem);

    const showDetailsCommand = vscode.commands.registerCommand('claude-code-usage.showDetails', () => {
        showUsageDetails();
    });

    const refreshCommand = vscode.commands.registerCommand('claude-code-usage.refresh', () => {
        updateStatusBar();
    });

    context.subscriptions.push(showDetailsCommand, refreshCommand);

    startPeriodicUpdates();
    updateStatusBar();
}

/**
 * Gets current usage status.
 * @returns Usage status result or null if no data
 */
async function getUsageStatus(): Promise<UsageStatusResult | null> {
    const customLimit = SettingsManager.getCustomLimit();
    return await usageMonitorFacade.getUsageStatus(customLimit);
}


/**
 * Updates the status bar with current usage information.
 */
async function updateStatusBar() {
    try {
        const result = await getUsageStatus();

        if (result) {
            const { status, parsedData, rateLimitEstimate } = result;
            
            if (status.error) {
                statusBarItem.text = '$(warning) Data Issue';
                statusBarItem.color = '#ffaa00';
                statusBarItem.tooltip = createTooltip(status);
                statusBarItem.show();
                return;
            }

            const text = getStatusBarText(status, rateLimitEstimate);
            const color = getStatusBarColor(status);

            statusBarItem.text = text;
            statusBarItem.color = color;
            statusBarItem.tooltip = createTooltip(status, rateLimitEstimate);
            statusBarItem.show();
        } else {
            statusBarItem.text = '$(terminal) No active block';
            statusBarItem.color = '#888888';
            statusBarItem.tooltip = 'No Claude Code block detected. Start using Claude Code to begin monitoring.';
            statusBarItem.show();
        }
    } catch (error) {
        console.error('Error updating status bar:', error);
        statusBarItem.text = '$(error) Data Error';
        statusBarItem.color = '#ff4444';
        statusBarItem.tooltip = 'Error reading Claude Code usage data. Click for details.';
        statusBarItem.show();
    }
}

/**
 * Creates tooltip text for the status bar item.
 * @param status Current usage status
 * @param rateLimitEstimate Optional rate limit estimate
 * @returns Formatted tooltip string
 */
function createTooltip(status: UsageStatus, rateLimitEstimate?: number): string {
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

    const usageDetails = formatUsageDetails(status);
    const timeDetails = formatTimeDetails(status);

    let tooltip = `Claude Code Usage Monitor\n\n`;
    tooltip += `Current Usage: ${usageDetails}\n`;
    
    if (rateLimitEstimate) {
        tooltip += `Rate Limit Estimate: ${rateLimitEstimate.toLocaleString()} tokens\n`;
    }
    
    tooltip += `Baseline: ${status.usageBaseline.toLocaleString()} tokens (~${status.baselineDescription})\n\n`;
    tooltip += `Reset Time: ${timeDetails['Reset Time']}\n`;
    tooltip += `Time Until Reset: ${timeDetails['Time Until Reset']}\n`;
    tooltip += `Consumption Rate: ${timeDetails['Tokens Per Minute']} tokens/min\n`;

    if (timeDetails['Estimated Depletion']) {
        tooltip += `Estimated Depletion: ${timeDetails['Estimated Depletion']}\n`;
    }

    const statusEmoji = status.isCriticalUsage ? '🔴 CRITICAL: Very high usage!' :
        status.isHighUsage ? '🟡 WARNING: High usage' :
            '🟢 NORMAL: Typical usage level';

    return tooltip + `\n${statusEmoji}\n\nClick for detailed view`;
}

/**
 * Shows detailed usage information in a dialog.
 */
async function showUsageDetails() {
    try {
        const result = await getUsageStatus();

        if (!result) {
            vscode.window.showInformationMessage(
                'No active Claude Code usage detected. Start using Claude Code to see usage statistics.'
            );
            return;
        }

        const { status, parsedData, rateLimitEstimate } = result;

        if (status.error) {
            return;
        }

        const usageDetails = formatUsageDetails(status);
        const timeDetails = formatTimeDetails(status);

        let message = `Claude Code Usage Details\n\nCurrent Usage: ${usageDetails}\nUsage Level: ${status.usageLevel}\nBaseline Confidence: ${status.baselineConfidence}\n\nReset Time: ${timeDetails['Reset Time']}\nTime Until Reset: ${timeDetails['Time Until Reset']}\nConsumption Rate: ${timeDetails['Tokens Per Minute']} tokens/min\n`;

        if (timeDetails['Estimated High Usage']) {
            message += `Estimated High Usage: ${timeDetails['Estimated High Usage']}\n`;
        }

        const statusText = status.usagePercentage >= 100 ? 'Status: 🔴 CRITICAL - Exceeded rate limit!' :
            status.isCriticalUsage ? 'Status: 🔴 CRITICAL - Very high usage!' :
            status.isHighUsage ? 'Status: 🟡 WARNING - High usage' :
                'Status: 🟢 NORMAL - Typical usage level';

        vscode.window.showInformationMessage(message + `\n${statusText}`);
    } catch (error) {
        console.error('Error showing usage details:', error);
    }
}

/**
 * Starts periodic status bar updates every 60 seconds.
 */
function startPeriodicUpdates() {
    updateTimer = setInterval(updateStatusBar, 60000);
}

/**
 * Deactivates the extension and cleans up resources.
 */
export function deactivate() {
    if (updateTimer) {
        clearInterval(updateTimer);
    }
    statusBarItem?.dispose();
}
