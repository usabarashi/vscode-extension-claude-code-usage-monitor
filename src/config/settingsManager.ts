/**
 * Settings Manager - Configuration Layer
 * @module SettingsManager
 */

import * as vscode from 'vscode';

/** Interface for extension configuration settings. */
export interface ExtensionSettings {
    /** Custom Rate Limit in tokens. Null for automatic detection. */
    customLimit: number | null;
}

/** Centralized settings manager that isolates VSCode API dependencies. */
export class SettingsManager {
    private static readonly CONFIG_SECTION = 'claude-code-usage';

    /**
     * Gets the custom rate limit setting.
     * 
     * @returns Custom limit in tokens or null for automatic detection
     */
    static getCustomLimit(): number | null {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        const customLimit = config.get<number | null>('customLimit');
        
        // Validate positive number or null
        if (customLimit !== null && customLimit !== undefined) {
            return customLimit > 0 ? customLimit : null;
        }
        
        return null;
    }

    /**
     * Gets all extension settings with type safety.
     * 
     * @returns Complete extension settings with defaults
     */
    static getAllSettings(): ExtensionSettings {
        return {
            customLimit: this.getCustomLimit()
        };
    }

    /**
     * Validates if a custom limit value is reasonable.
     * 
     * @param limit - Limit value to validate
     * @returns True if valid, false otherwise
     */
    static isValidCustomLimit(limit: number | null): boolean {
        if (limit === null) return true;
        
        // Reasonable range: 1K to 1M tokens
        return limit >= 1000 && limit <= 1_000_000;
    }

    /**
     * Gets configuration change event for reactive updates.
     * 
     * @returns VSCode configuration change event
     */
    static onConfigurationChanged(): vscode.Event<vscode.ConfigurationChangeEvent> {
        return vscode.workspace.onDidChangeConfiguration;
    }

    /**
     * Checks if configuration change affects this extension.
     * 
     * @param e - Configuration change event
     * @returns True if this extension's config changed
     */
    static isRelevantConfigChange(e: vscode.ConfigurationChangeEvent): boolean {
        return e.affectsConfiguration(this.CONFIG_SECTION);
    }
}