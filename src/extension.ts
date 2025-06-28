import * as vscode from 'vscode';
import { 
    getRateLimitStatus, 
    getStatusBarText, 
    getStatusBarColor, 
    formatUsageDetails, 
    formatTimeDetails, 
    shouldShowCriticalWarning, 
    getWarningMessage,
    RateLimitStatus 
} from './rateLimitManager';

/** VSCode status bar item for displaying usage information */
let statusBarItem: vscode.StatusBarItem;
/** Timer for periodic status updates */
let updateTimer: NodeJS.Timeout | undefined;


/**
 * Activates the Claude Code Usage Monitor extension.
 * Sets up status bar item, commands, and periodic updates.
 * @param context - VSCode extension context
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
 * Updates the status bar with current Claude Code usage information.
 * Handles errors gracefully and displays appropriate status indicators.
 */
async function updateStatusBar() {
    try {
        // Use auto-detection instead of manual plan configuration
        const status = await getRateLimitStatus();
        
        if (status) {
            if (status.error) {
                statusBarItem.text = '$(warning) Data Issue';
                statusBarItem.color = '#ffaa00';
                statusBarItem.tooltip = createTooltip(status);
                statusBarItem.show();
                return;
            }

            const text = getStatusBarText(status);
            const color = getStatusBarColor(status);
            
            statusBarItem.text = text;
            statusBarItem.color = color;
            statusBarItem.tooltip = createTooltip(status);
            statusBarItem.show();

            if (shouldShowCriticalWarning(status)) {
                vscode.window.showWarningMessage(getWarningMessage(status));
            }
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
 * Creates a detailed tooltip for the status bar item.
 * @param status - The rate limit status object
 * @returns Formatted tooltip string with usage details, reset time, and status indicators
 */
function createTooltip(status: RateLimitStatus): string {
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
    
    const remainingTokens = status.usageLimit - status.currentUsage;
    const remainingPercentage = Math.round((remainingTokens / status.usageLimit) * 100);
    
    let tooltip = `Claude Code Usage Monitor\n\n`;
    tooltip += `Current Usage: ${usageDetails}\n`;
    tooltip += `Remaining: ${remainingTokens.toLocaleString()} tokens (${remainingPercentage}%)\n\n`;
    tooltip += `Reset Time: ${timeDetails['Reset Time']}\n`;
    tooltip += `Time Until Reset: ${timeDetails['Time Until Reset']}\n`;
    tooltip += `Consumption Rate: ${timeDetails['Tokens Per Minute']} tokens/min\n`;
    
    if (timeDetails['Estimated Depletion']) {
        tooltip += `Estimated Depletion: ${timeDetails['Estimated Depletion']}\n`;
    }
    
    // Rate limit status
    if (status.isAtLimit) {
        tooltip += `\n🔴 CRITICAL: At rate limit!`;
    } else if (status.isNearLimit) {
        tooltip += `\n🟡 WARNING: Near rate limit`;
    } else {
        tooltip += `\n🟢 SAFE: Usage within limits`;
    }
    
    tooltip += '\n\nClick for detailed view';
    
    return tooltip;
}

/**
 * Shows detailed usage information in a VSCode information dialog.
 * Handles errors with actionable user feedback.
 */
async function showUsageDetails() {
    try {
        // Use auto-detection instead of manual plan configuration
        const status = await getRateLimitStatus();
        
        if (status) {
            if (status.error) {
                const errorActions = ['View Logs', 'Retry'];
                const selectedAction = await vscode.window.showErrorMessage(
                    `Claude Code Data Error: ${status.error.message}`,
                    {
                        detail: `${status.error.details}\n\n${status.error.suggestion || 'Please check the extension logs for more information.'}`,
                        modal: true
                    },
                    ...errorActions
                );
                
                if (selectedAction === 'View Logs') {
                    vscode.commands.executeCommand('workbench.action.toggleDevTools');
                } else if (selectedAction === 'Retry') {
                    updateStatusBar();
                }
                return;
            }

            const usageDetails = formatUsageDetails(status);
            const timeDetails = formatTimeDetails(status);
            
            const remainingTokens = status.usageLimit - status.currentUsage;
            const remainingPercentage = Math.round((remainingTokens / status.usageLimit) * 100);
            const detectedPlan = status.detectedPlan;
            
            let message = `Claude Code Usage Details\n\n`;
            message += `Plan: ${detectedPlan} (Auto-detected)\n`;
            message += `Current Usage: ${usageDetails}\n`;
            message += `Remaining: ${remainingTokens.toLocaleString()} tokens (${remainingPercentage}%)\n\n`;
            message += `Reset Time: ${timeDetails['Reset Time']}\n`;
            message += `Time Until Reset: ${timeDetails['Time Until Reset']}\n`;
            message += `Consumption Rate: ${timeDetails['Tokens Per Minute']} tokens/min\n`;
            
            if (timeDetails['Estimated Depletion']) {
                message += `Estimated Depletion: ${timeDetails['Estimated Depletion']}\n`;
            }
            
            message += '\n';
            if (status.isAtLimit) {
                message += `Status: 🔴 CRITICAL - At rate limit!`;
            } else if (status.isNearLimit) {
                message += `Status: 🟡 WARNING - Near rate limit (${status.usagePercentage}%)`;
            } else {
                message += `Status: 🟢 SAFE - Usage within limits (${status.usagePercentage}%)`;
            }

            vscode.window.showInformationMessage(message, { modal: false });
        } else {
            vscode.window.showInformationMessage(
                'No active Claude Code block detected.\n\nStart using Claude Code to begin monitoring your usage and rate limits.',
                { modal: false }
            );
        }
    } catch (error) {
        console.error('Error showing usage details:', error);
        const errorActions = ['View Logs', 'Report Issue'];
        const selectedAction = await vscode.window.showErrorMessage(
            'Error reading Claude Code usage data',
            {
                detail: 'Unable to access Claude Code usage information. This might indicate a data format change or installation issue.',
                modal: true
            },
            ...errorActions
        );
        
        if (selectedAction === 'View Logs') {
            vscode.commands.executeCommand('workbench.action.toggleDevTools');
        } else if (selectedAction === 'Report Issue') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/vscode-extension-ccusage/issues'));
        }
    }
}

/**
 * Starts periodic updates of the status bar (every minute).
 */
function startPeriodicUpdates() {
    updateTimer = setInterval(() => {
        updateStatusBar();
    }, 60000);
}

/**
 * Deactivates the extension and cleans up resources.
 */
export function deactivate() {
    if (updateTimer) {
        clearInterval(updateTimer);
    }
    
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}