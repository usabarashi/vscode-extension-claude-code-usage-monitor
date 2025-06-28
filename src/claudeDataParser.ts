import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Represents a single Claude Code usage record.
 */
export interface ClaudeUsageRecord {
    timestamp: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    model: string;
    cost: number;
    sessionId?: string;
    requestId?: string;
}

/**
 * Represents the result of parsing all Claude Code usage data.
 */
export interface ParsedUsageData {
    records: ClaudeUsageRecord[];
    totalRecords: number;
    dateRange: {
        earliest: Date;
        latest: Date;
    };
    sessionIds: string[];
}

/** Path to Claude Code projects directory */
const CLAUDE_PROJECTS_PATH = path.join(os.homedir(), '.claude', 'projects');

/** Claude API pricing in USD per token */
const CLAUDE_PRICING = {
    input: 15 / 1_000_000,
    output: 75 / 1_000_000,
    cache_creation: 18.75 / 1_000_000,
    cache_read: 1.5 / 1_000_000
} as const;

/**
 * Calculates the cost of a Claude usage record based on token usage.
 * @param record - The usage record
 * @returns Cost in USD
 */
export const calculateCost = (record: ClaudeUsageRecord): number => (
    record.input_tokens * CLAUDE_PRICING.input +
    record.output_tokens * CLAUDE_PRICING.output +
    record.cache_creation_tokens * CLAUDE_PRICING.cache_creation +
    record.cache_read_tokens * CLAUDE_PRICING.cache_read
);

/**
 * Gets the total token count for a usage record (all token types).
 * @param record - The usage record
 * @returns Total token count
 */
export const getTotalTokens = (record: ClaudeUsageRecord): number => 
    record.input_tokens + record.output_tokens + 
    record.cache_creation_tokens + record.cache_read_tokens;

/**
 * Filters usage records by time range.
 * @param records - Array of usage records
 * @param startTime - Start of time range (inclusive)
 * @param endTime - End of time range (inclusive)
 * @returns Filtered records within the time range
 */
export const filterRecordsByTimeRange = (
    records: ClaudeUsageRecord[], 
    startTime: Date, 
    endTime: Date
): ClaudeUsageRecord[] => 
    records.filter(record => {
        const recordTime = new Date(record.timestamp);
        return recordTime >= startTime && recordTime <= endTime;
    });

/**
 * Groups usage records by session ID.
 * @param records - Array of usage records
 * @returns Map of session ID to records array
 */
export const groupRecordsBySession = (records: ClaudeUsageRecord[]): Map<string, ClaudeUsageRecord[]> => 
    records.reduce((groups, record) => {
        const sessionKey = record.sessionId || 'unknown';
        const existing = groups.get(sessionKey) || [];
        groups.set(sessionKey, [...existing, record]);
        return groups;
    }, new Map<string, ClaudeUsageRecord[]>());

/**
 * Parses legacy usage.jsonl files (old Claude Code format).
 * @param filePath - Path to the legacy usage file
 * @returns Array of parsed usage records
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
 * Represents an error that occurred during data parsing.
 * Provides structured error information for user-friendly error handling.
 */
export interface ParseError {
    type: 'directory_not_found' | 'file_access_error' | 'data_format_error' | 'unknown_error';
    message: string;
    details?: string;
    suggestion?: string;
}

/**
 * Parses all Claude Code usage data from the projects directory.
 * Handles both legacy (usage.jsonl) and modern (UUID.jsonl) formats.
 * Provides comprehensive error handling and reporting.
 * @returns Parsed usage data with optional error information
 */
export const parseAllUsageData = async (): Promise<ParsedUsageData & { error?: ParseError }> => {
    try {
        if (!fs.existsSync(CLAUDE_PROJECTS_PATH)) {
            return {
                records: [],
                totalRecords: 0,
                dateRange: { earliest: new Date(), latest: new Date() },
                sessionIds: [],
                error: {
                    type: 'directory_not_found',
                    message: 'Claude Code data directory not found',
                    details: `Expected directory: ${CLAUDE_PROJECTS_PATH}`,
                    suggestion: 'Please ensure Claude Code is installed and has been used at least once'
                }
            };
        }

        const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_PATH);
        
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
            const projectPath = path.join(CLAUDE_PROJECTS_PATH, projectDir);
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
            .map(record => ({ ...record, cost: record.cost || calculateCost(record) }))
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