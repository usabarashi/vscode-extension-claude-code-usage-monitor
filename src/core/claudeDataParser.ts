/**
 * Claude Data Parser - Core Module (Independent)
 * 
 * Parses Claude Code usage data from both legacy and modern JSONL formats.
 * Handles multi-project environments and provides comprehensive error reporting.
 * 
 * **Supported Formats:**
 * - Legacy: `usage.jsonl` (older Claude Code versions)
 * - Modern: `{UUID}.jsonl` (current Claude Code sessions)
 * 
 * **Data Flow:**
 * 1. Discover all project directories
 * 2. Parse legacy and modern format files
 * 3. Aggregate usage records with metadata
 * 4. Provide detailed error reporting for debugging
 * 
 * @module ClaudeDataParser
 */

import * as fs from 'fs';
import * as path from 'path';
import { ClaudeUsageRecord, ParsedUsageData, ParseError } from '../types';
import { getClaudeProjectsPath } from './projectManager';

/**
 * PURE FUNCTION: Parses legacy usage.jsonl files (old Claude Code format).
 * 
 * Legacy files contain direct usage records in a simpler JSONL format
 * used by earlier versions of Claude Code.
 * 
 * @param {string} filePath - Absolute path to the legacy usage file
 * @returns {ClaudeUsageRecord[]} Array of parsed usage records
 * 
 * @example
 * ```typescript
 * const records = parseLegacyUsageFile('/path/to/usage.jsonl');
 * console.log(`Found ${records.length} legacy records`);
 * ```
 * 
 * @internal
 */
const parseLegacyUsageFile = (filePath: string): ClaudeUsageRecord[] => {
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
const parseSessionFile = (filePath: string, fileName: string): ClaudeUsageRecord[] => {
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
 * Parses all usage data from a project directory.
 * @param projectPath - Path to the project directory
 * @returns Array of all usage records from the project
 */
const parseProjectDirectory = (projectPath: string): ClaudeUsageRecord[] => {
    const records: ClaudeUsageRecord[] = [];
    
    try {
        const legacyUsageFile = path.join(projectPath, 'usage.jsonl');
        if (fs.existsSync(legacyUsageFile)) {
            records.push(...parseLegacyUsageFile(legacyUsageFile));
        }
        
        const files = fs.readdirSync(projectPath);
        const sessionRecords = files
            .filter(file => file.endsWith('.jsonl') && file !== 'usage.jsonl')
            .flatMap(file => parseSessionFile(path.join(projectPath, file), file));
        
        records.push(...sessionRecords);
    } catch (error) {
        console.error(`Error parsing project directory ${projectPath}:`, error);
    }
    
    return records;
};


/**
 * Parses all Claude Code usage data from the projects directory.
 * Handles both legacy (usage.jsonl) and modern (UUID.jsonl) formats.
 * Provides comprehensive error handling and reporting.
 * @returns Parsed usage data with optional error information
 */
export const parseAllUsageData = async (): Promise<ParsedUsageData & { error?: ParseError }> => {
    try {
        const claudePath = getClaudeProjectsPath();
        if (!fs.existsSync(claudePath)) {
            return {
                records: [],
                totalRecords: 0,
                dateRange: { earliest: new Date(), latest: new Date() },
                sessionIds: [],
                error: {
                    type: 'directory_not_found',
                    message: 'Claude Code data directory not found',
                    details: `Expected directory: ${claudePath}`,
                    suggestion: 'Please ensure Claude Code is installed and has been used at least once'
                }
            };
        }

        const projectDirs = fs.readdirSync(claudePath);
        
        if (projectDirs.length === 0) {
            return {
                records: [],
                totalRecords: 0,
                dateRange: { earliest: new Date(), latest: new Date() },
                sessionIds: [],
                error: {
                    type: 'data_format_error',
                    message: 'No Claude Code projects found',
                    details: 'The Claude projects directory exists but contains no project folders',
                    suggestion: 'Start using Claude Code to generate usage data'
                }
            };
        }

        const allRecords: ClaudeUsageRecord[] = [];
        let parseErrors = 0;
        let totalFiles = 0;

        for (const projectDir of projectDirs) {
            const projectPath = path.join(claudePath, projectDir);
            try {
                if (fs.statSync(projectPath).isDirectory()) {
                    const projectRecords = parseProjectDirectory(projectPath);
                    allRecords.push(...projectRecords);
                    
                    // Count files for error rate calculation
                    const files = fs.readdirSync(projectPath);
                    totalFiles += files.filter(f => f.endsWith('.jsonl')).length;
                }
            } catch (error) {
                parseErrors++;
                console.warn(`Failed to parse project directory ${projectDir}:`, error);
            }
        }

        // Check if we have a high error rate (might indicate format changes)
        const errorRate = totalFiles > 0 ? parseErrors / totalFiles : 0;
        
        if (allRecords.length === 0 && totalFiles > 0) {
            return {
                records: [],
                totalRecords: 0,
                dateRange: { earliest: new Date(), latest: new Date() },
                sessionIds: [],
                error: {
                    type: 'data_format_error',
                    message: 'Unable to parse any Claude Code usage data',
                    details: `Found ${totalFiles} data files but could not parse any records`,
                    suggestion: 'Claude Code data format may have changed. Please check for extension updates or report this issue'
                }
            };
        }

        if (errorRate > 0.5 && allRecords.length > 0) {
            console.warn(`High error rate detected: ${Math.round(errorRate * 100)}% of files failed to parse`);
        }

        const records = allRecords
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const sessionIds = [...new Set(allRecords.map(r => r.sessionId).filter((id): id is string => Boolean(id)))];

        const dateRange = records.length > 0 ? {
            earliest: new Date(records[0].timestamp),
            latest: new Date(records[records.length - 1].timestamp)
        } : {
            earliest: new Date(),
            latest: new Date()
        };

        const result = {
            records,
            totalRecords: records.length,
            dateRange,
            sessionIds
        };

        // Add warning if error rate is concerning but we still got some data
        if (errorRate > 0.3 && allRecords.length > 0) {
            return {
                ...result,
                error: {
                    type: 'data_format_error',
                    message: 'Partial parsing success with errors',
                    details: `${Math.round(errorRate * 100)}% of data files could not be parsed`,
                    suggestion: 'Some data may be missing. Consider updating the extension or reporting this issue'
                }
            };
        }

        return result;
    } catch (error) {
        console.error('Error parsing Claude usage data:', error);
        return {
            records: [],
            totalRecords: 0,
            dateRange: { earliest: new Date(), latest: new Date() },
            sessionIds: [],
            error: {
                type: 'unknown_error',
                message: 'Unexpected error while parsing Claude Code data',
                details: error instanceof Error ? error.message : String(error),
                suggestion: 'Please restart VSCode and try again. If the issue persists, report this error'
            }
        };
    }
};