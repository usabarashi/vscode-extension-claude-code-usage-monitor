/**
 * Template Service - UI Layer
 * 
 * Loads and processes HTML templates for webview display.
 * 
 * @module TemplateService
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Template data interface for rendering.
 */
export interface TemplateData {
    currentUsage: string;
    usageLevel: string;
    baselineConfidence: string;
    resetTime: string;
    timeUntilReset: string;
    consumptionRate: string;
    burnRate?: string;
    topModel?: string;
    estimatedHighUsage?: string;
    estimatedDepletion?: string;
    statusClass: string;
    statusEmoji: string;
    statusText: string;
}

/**
 * Loads and processes HTML templates.
 */
export class TemplateService {
    private static templateCache = new Map<string, string>();

    /**
     * Loads a template file from disk.
     * @param templateName Name of the template file (without extension)
     * @param extensionPath Path to the extension root
     * @returns Template content or error message
     */
    private static loadTemplate(templateName: string, extensionPath: string): string {
        const cached = this.templateCache.get(templateName);
        if (cached) {
            return cached;
        }

        try {
            // Try multiple possible locations
            const possiblePaths = [
                path.join(extensionPath, 'src', 'templates', `${templateName}.html`),
                path.join(extensionPath, 'out', 'templates', `${templateName}.html`),
                path.join(extensionPath, 'templates', `${templateName}.html`)
            ];

            for (const templatePath of possiblePaths) {
                if (fs.existsSync(templatePath)) {
                    const content = fs.readFileSync(templatePath, 'utf-8');
                    this.templateCache.set(templateName, content);
                    return content;
                }
            }
            
            throw new Error(`Template not found in any location`);
        } catch (error) {
            console.error(`Failed to load template ${templateName}:`, error);
            throw error;
        }
    }

    /**
     * Renders a template with the provided data.
     * Supports simple variable substitution and conditional blocks.
     * @param template Template string
     * @param data Data to render
     * @returns Rendered HTML
     */
    private static render(template: string, data: TemplateData): string {
        // Replace variables
        let rendered = template;
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                rendered = rendered.replace(regex, value);
            }
        });

        // Handle conditional blocks
        rendered = rendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, key, content) => {
            const value = data[key as keyof TemplateData];
            return value ? content : '';
        });

        // Clean up any remaining undefined variables
        rendered = rendered.replace(/{{.*?}}/g, '');

        return rendered;
    }

    /**
     * Renders the usage details template with the provided data.
     * @param data Template data
     * @param extensionPath Path to the extension root
     * @returns Rendered HTML string
     */
    static renderUsageDetails(data: TemplateData, extensionPath: string): string {
        const template = this.loadTemplate('usageDetails', extensionPath);
        return this.render(template, data);
    }
}