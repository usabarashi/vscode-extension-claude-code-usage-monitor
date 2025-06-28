/**
 * Error Handler Module
 * 
 * Centralized error handling and user-friendly error reporting.
 * Provides structured error creation and management for Claude Code operations.
 */

import { ParseError } from './types';

/**
 * Creates a structured error for directory not found scenarios.
 * @param directoryPath - Path that was not found
 * @returns ParseError object with user-friendly information
 */
export const createDirectoryNotFoundError = (directoryPath: string): ParseError => ({
    type: 'directory_not_found',
    message: 'Claude Code data directory not found',
    details: `Expected directory: ${directoryPath}`,
    suggestion: 'Please ensure Claude Code is installed and has been used at least once'
});

/**
 * Creates a structured error for file access issues.
 * @param filePath - Path that couldn't be accessed
 * @param originalError - The original error that occurred
 * @returns ParseError object with user-friendly information
 */
export const createFileAccessError = (filePath: string, originalError?: Error): ParseError => ({
    type: 'file_access_error',
    message: 'Unable to access Claude Code data file',
    details: `File: ${filePath}${originalError ? ` | Error: ${originalError.message}` : ''}`,
    suggestion: 'Check file permissions and ensure Claude Code is not currently running'
});

/**
 * Creates a structured error for data format issues.
 * @param message - Specific error message
 * @param details - Additional details about the error
 * @param suggestion - Suggestion for resolving the issue
 * @returns ParseError object
 */
export const createDataFormatError = (
    message: string, 
    details?: string, 
    suggestion?: string
): ParseError => ({
    type: 'data_format_error',
    message,
    details,
    suggestion: suggestion || 'Claude Code data format may have changed. Please check for extension updates or report this issue'
});

/**
 * Creates a structured error for unknown/unexpected issues.
 * @param originalError - The original error that occurred
 * @returns ParseError object
 */
export const createUnknownError = (originalError: Error): ParseError => ({
    type: 'unknown_error',
    message: 'Unexpected error while processing Claude Code data',
    details: originalError.message,
    suggestion: 'Please restart VSCode and try again. If the issue persists, report this error'
});

/**
 * Creates an error for when no projects are found.
 * @returns ParseError object
 */
export const createNoProjectsError = (): ParseError => ({
    type: 'data_format_error',
    message: 'No Claude Code projects found',
    details: 'The Claude projects directory exists but contains no project folders',
    suggestion: 'Start using Claude Code to generate usage data'
});

/**
 * Creates an error for when parsing fails completely.
 * @param totalFiles - Number of files that were attempted to be parsed
 * @returns ParseError object
 */
export const createParsingFailedError = (totalFiles: number): ParseError => ({
    type: 'data_format_error',
    message: 'Unable to parse any Claude Code usage data',
    details: `Found ${totalFiles} data files but could not parse any records`,
    suggestion: 'Claude Code data format may have changed. Please check for extension updates or report this issue'
});

/**
 * Creates a warning error for partial parsing success.
 * @param errorRate - Rate of parsing errors (0-1)
 * @returns ParseError object
 */
export const createPartialParsingError = (errorRate: number): ParseError => ({
    type: 'data_format_error',
    message: 'Partial parsing success with errors',
    details: `${Math.round(errorRate * 100)}% of data files could not be parsed`,
    suggestion: 'Some data may be missing. Consider updating the extension or reporting this issue'
});

/**
 * Determines if an error rate is concerning and requires user notification.
 * @param errorRate - Rate of parsing errors (0-1)
 * @param totalRecords - Total number of records successfully parsed
 * @returns True if the error rate warrants user notification
 */
export const shouldReportErrorRate = (errorRate: number, totalRecords: number): boolean => {
    // Report if no records parsed and files exist
    if (totalRecords === 0 && errorRate > 0) {
        return true;
    }
    
    // Report if error rate is above 30% and we have some data
    if (errorRate > 0.3 && totalRecords > 0) {
        return true;
    }
    
    return false;
};

/**
 * Logs an error with appropriate level based on error type.
 * @param error - ParseError to log
 * @param context - Additional context for logging
 */
export const logError = (error: ParseError, context?: string): void => {
    const prefix = context ? `[${context}]` : '';
    
    switch (error.type) {
        case 'directory_not_found':
            console.warn(`${prefix} Directory not found:`, error.message, error.details);
            break;
        case 'file_access_error':
            console.error(`${prefix} File access error:`, error.message, error.details);
            break;
        case 'data_format_error':
            console.warn(`${prefix} Data format issue:`, error.message, error.details);
            break;
        case 'unknown_error':
            console.error(`${prefix} Unexpected error:`, error.message, error.details);
            break;
        default:
            console.error(`${prefix} Unknown error type:`, error);
    }
};

/**
 * Handles errors during file parsing operations.
 * @param error - The caught error
 * @param filePath - Path of the file being parsed
 * @param context - Additional context
 * @returns ParseError object or null if error should be ignored
 */
export const handleParsingError = (
    error: unknown, 
    filePath: string, 
    context: string = 'parsing'
): ParseError | null => {
    if (error instanceof Error) {
        // Check for common error types
        if ((error as any).code === 'ENOENT') {
            return createFileAccessError(filePath, error);
        }
        if ((error as any).code === 'EACCES' || (error as any).code === 'EPERM') {
            return createFileAccessError(filePath, error);
        }
        if (error.name === 'SyntaxError') {
            return createDataFormatError(
                'Invalid JSON in data file',
                `File: ${filePath} | ${error.message}`,
                'File may be corrupted or in an unsupported format'
            );
        }
        
        // Generic error
        logError(createUnknownError(error), context);
        return createUnknownError(error);
    }
    
    // Non-Error objects
    const genericError = new Error(String(error));
    logError(createUnknownError(genericError), context);
    return createUnknownError(genericError);
};

/**
 * Creates a user-friendly error message for display in UI.
 * @param error - ParseError object
 * @returns Formatted error message
 */
export const formatErrorForUser = (error: ParseError): string => {
    let message = `${error.message}`;
    
    if (error.details) {
        message += `\n\nDetails: ${error.details}`;
    }
    
    if (error.suggestion) {
        message += `\n\nSuggestion: ${error.suggestion}`;
    }
    
    return message;
};