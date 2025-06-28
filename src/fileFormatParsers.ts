/**
 * Claude Code File Format Parsers Module
 * 
 * Handles parsing of different Claude Code data file formats.
 * Supports both legacy (usage.jsonl) and modern (UUID.jsonl) formats.
 */

import * as fs from 'fs';
import { ClaudeUsageRecord } from './types';

/**
 * Parses legacy usage.jsonl files (old Claude Code format).
 * @param filePath - Path to the legacy usage file
 * @returns Array of parsed usage records
 */
export const parseLegacyUsageFile = (filePath: string): ClaudeUsageRecord[] => {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return fileContent
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    const data = JSON.parse(line);
                    return {
                        timestamp: data.timestamp,
                        input_tokens: data.input_tokens || 0,
                        output_tokens: data.output_tokens || 0,
                        cache_creation_tokens: data.cache_creation_tokens || 0,
                        cache_read_tokens: data.cache_read_tokens || 0,
                        model: data.model || 'unknown',
                        cost: data.cost || 0
                    };
                } catch (error) {
                    console.warn(`Failed to parse legacy line in ${filePath}:`, error);
                    return null;
                }
            })
            .filter((record): record is ClaudeUsageRecord => record !== null);
    } catch (error) {
        console.error(`Error reading legacy file ${filePath}:`, error);
        return [];
    }
};

/**
 * Parses modern session files (UUID.jsonl format).
 * @param filePath - Path to the session file
 * @param fileName - Name of the file (used for session ID)
 * @returns Array of parsed usage records
 */
export const parseModernSessionFile = (filePath: string, fileName: string): ClaudeUsageRecord[] => {
    const sessionId = fileName.replace('.jsonl', '');
    
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return fileContent
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    const data = JSON.parse(line);
                    
                    if (data.type === 'assistant' && data.message?.usage) {
                        const usage = data.message.usage;
                        return {
                            timestamp: data.timestamp,
                            input_tokens: usage.input_tokens || 0,
                            output_tokens: usage.output_tokens || 0,
                            cache_creation_tokens: usage.cache_creation_input_tokens || 0,
                            cache_read_tokens: usage.cache_read_input_tokens || 0,
                            model: data.message.model || 'unknown',
                            cost: 0,
                            sessionId: sessionId,
                            requestId: data.requestId || data.uuid
                        } as ClaudeUsageRecord;
                    }
                    return null;
                } catch (error) {
                    return null;
                }
            })
            .filter((record): record is ClaudeUsageRecord => record !== null);
    } catch (error) {
        console.error(`Error reading session file ${filePath}:`, error);
        return [];
    }
};

/**
 * Determines the format type of a data file.
 * @param fileName - Name of the file
 * @returns Format type: 'legacy' | 'modern' | 'unknown'
 */
export const detectFileFormat = (fileName: string): 'legacy' | 'modern' | 'unknown' => {
    if (fileName === 'usage.jsonl') {
        return 'legacy';
    }
    if (fileName.endsWith('.jsonl') && fileName !== 'usage.jsonl') {
        // UUID pattern check (basic validation)
        const baseName = fileName.replace('.jsonl', '');
        if (baseName.length >= 32 && /^[a-f0-9-]+$/i.test(baseName)) {
            return 'modern';
        }
    }
    return 'unknown';
};

/**
 * Validates if a file contains valid Claude Code usage data.
 * @param filePath - Path to the file to validate
 * @returns True if file appears to contain valid usage data
 */
export const validateUsageFile = (filePath: string): boolean => {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.trim().split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
            return false;
        }
        
        // Try to parse first few lines to validate format
        const sampleSize = Math.min(3, lines.length);
        let validLines = 0;
        
        for (let i = 0; i < sampleSize; i++) {
            try {
                const data = JSON.parse(lines[i]);
                // Check for presence of expected fields
                if (data.timestamp && (data.input_tokens !== undefined || data.message?.usage)) {
                    validLines++;
                }
            } catch {
                // Invalid JSON line
            }
        }
        
        return validLines > 0;
    } catch {
        return false;
    }
};

/**
 * Estimates the number of records in a usage file without full parsing.
 * @param filePath - Path to the file
 * @returns Estimated number of records
 */
export const estimateRecordCount = (filePath: string): number => {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return fileContent.trim().split('\n').filter(line => line.trim()).length;
    } catch {
        return 0;
    }
};