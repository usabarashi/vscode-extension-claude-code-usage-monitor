/**
 * Block Calculator - Core Module (Independent)
 * 
 * Calculates session blocks from Claude Code usage records using Claude's
 * official 5-hour rolling window algorithm. Implements pure functions with
 * no external dependencies for maximum testability.
 * 
 * **Algorithm Details:**
 * - Session windows are 5-hour blocks aligned to UTC hours
 * - New blocks start when >5 hours elapsed from block start OR last record
 * - Active sessions are those with recent activity within the 5-hour window
 * 
 * @module BlockCalculator
 */

import { SessionWindow, MultiSessionBlock, ClaudeUsageRecord, ParseError } from '../types';
import { calculateTokenUsage } from './usageCalculator';

/** Claude Code session duration in milliseconds (5 hours) */
const SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

/**
 * PURE FUNCTION: Creates a multi-session block from records and error information.
 * 
 * This is the main entry point for block calculation, called by the Facade (extension.ts)
 * with parsed data. Implements Claude's session windowing algorithm.
 * 
 * **Processing Flow:**
 * 1. Handle error cases with empty records
 * 2. Calculate current session block from records
 * 3. Determine active vs inactive sessions
 * 4. Return structured session information
 * 
 * @param {ClaudeUsageRecord[]} records - Raw usage records to process
 * @param {Date} currentTime - Current timestamp for activity calculation
 * @param {ParseError} [error] - Optional parsing error to propagate
 * @returns {MultiSessionBlock | null} Session block information or null if no data
 * 
 * @example
 * ```typescript
 * const block = createMultiSessionBlock(records, new Date());
 * if (block?.mostRestrictiveSession.isActive) {
 *   console.log(`Current usage: ${block.mostRestrictiveSession.totalTokens}`);
 * }
 * ```
 * 
 * @since 0.1.0
 */
export const createMultiSessionBlock = (
    records: ClaudeUsageRecord[], 
    currentTime: Date = new Date(),
    error?: ParseError
): MultiSessionBlock | null => {
    if (error && records.length === 0) {
        return {
            allSessions: [],
            activeSessions: [],
            mostRestrictiveSession: createEmptySession(currentTime),
            currentTime,
            error
        };
    }
    
    if (records.length === 0) {
        return null;
    }
    
    const currentSession = getCurrentSessionBlock(records, currentTime);
    
    const result = {
        allSessions: currentSession ? [currentSession] : [],
        activeSessions: currentSession?.isActive ? [currentSession] : [],
        mostRestrictiveSession: currentSession || createEmptySession(currentTime),
        currentTime
    };
    
    if (error) {
        return { ...result, error };
    }
    
    return result;
};/**
 * Floors timestamp to the nearest UTC hour.
 */
const floorToHour = (timestamp: Date): Date => {
    const floored = new Date(timestamp);
    floored.setUTCMinutes(0, 0, 0);
    return floored;
};/**
 * PURE FUNCTION: Calculates the current session block from usage records.
 */
const getCurrentSessionBlock = (
    records: ClaudeUsageRecord[], 
    currentTime: Date
): SessionWindow | null => {
    if (records.length === 0) {
        return null;
    }
    
    const sortedRecords = [...records].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    let currentSession: SessionWindow | null = null;
    const sessionBlocks: SessionWindow[] = [];
    let currentBlockStart: Date | null = null;
    let currentBlockRecords: ClaudeUsageRecord[] = [];
    
    for (const record of sortedRecords) {
        const recordTime = new Date(record.timestamp);
        
        if (!currentBlockStart) {
            currentBlockStart = floorToHour(recordTime);
            currentBlockRecords = [record];
        } else {
            const timeSinceBlockStart = recordTime.getTime() - currentBlockStart.getTime();
            const lastRecord = currentBlockRecords[currentBlockRecords.length - 1];
            const timeSinceLastRecord = lastRecord ? 
                recordTime.getTime() - new Date(lastRecord.timestamp).getTime() : 0;
            
            if (timeSinceBlockStart > SESSION_DURATION_MS || timeSinceLastRecord > SESSION_DURATION_MS) {
                const blockSession = createSessionFromBlock(currentBlockStart, currentBlockRecords, currentTime);
                sessionBlocks.push(blockSession);
                
                currentBlockStart = floorToHour(recordTime);
                currentBlockRecords = [record];
            } else {
                currentBlockRecords.push(record);
            }
        }
    }
    
    if (currentBlockStart && currentBlockRecords.length > 0) {
        const blockSession = createSessionFromBlock(currentBlockStart, currentBlockRecords, currentTime);
        sessionBlocks.push(blockSession);
    }
    
    for (let i = sessionBlocks.length - 1; i >= 0; i--) {
        const session = sessionBlocks[i];
        if (session && session.isActive) {
            return session;
        }
    }
    
    return sessionBlocks[sessionBlocks.length - 1] || null;
};/**
 * PURE FUNCTION: Creates a session window from a block of records.
 */
const createSessionFromBlock = (
    startTime: Date,
    records: ClaudeUsageRecord[],
    currentTime: Date
): SessionWindow => {
    const endTime = new Date(startTime.getTime() + SESSION_DURATION_MS);
    const lastRecord = records[records.length - 1];
    const actualEndTime = lastRecord ? new Date(lastRecord.timestamp) : startTime;
    
    const isActive = 
        (currentTime.getTime() - actualEndTime.getTime() < SESSION_DURATION_MS) && 
        (currentTime.getTime() < endTime.getTime());
    
    const tokenUsage = calculateTokenUsage(records);
    
    const timeUntilReset = Math.max(0, endTime.getTime() - currentTime.getTime());
    
    return {
        sessionId: startTime.toISOString(),
        startTime,
        endTime,
        firstRecordTime: records.length > 0 ? new Date(records[0].timestamp) : startTime,
        records,
        totalInputTokens: tokenUsage.totalInputTokens,
        totalOutputTokens: tokenUsage.totalOutputTokens,
        totalCacheCreationTokens: tokenUsage.totalCacheCreationTokens,
        totalCacheReadTokens: tokenUsage.totalCacheReadTokens,
        totalTokens: tokenUsage.totalTokens,
        requestCount: tokenUsage.requestCount,
        isActive,
        timeUntilReset
    };
};/**
 * PURE FUNCTION: Creates an empty session window.
 */
const createEmptySession = (currentTime: Date): SessionWindow => ({
    sessionId: 'empty',
    startTime: currentTime,
    endTime: currentTime,
    firstRecordTime: currentTime,
    records: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    totalTokens: 0,
    requestCount: 0,
    isActive: false,
    timeUntilReset: 0
});
