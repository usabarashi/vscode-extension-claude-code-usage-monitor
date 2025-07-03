/**
 * Rate Limit Detector - Core Module
 * @module RateLimitDetector
 */

import { ClaudeUsageRecord } from '../types';

export interface RateLimitDetection {
    detectedLimit: number | null;
    confidence: 'high' | 'medium' | 'low';
    sampleCount: number;
    detectionMethod: string;
    candidateLimits: number[];
}

/**
 * Detects rate limit from historical usage patterns.
 * @param records Historical usage records
 * @returns Rate limit detection result
 */
export const detectRateLimit = (records: ClaudeUsageRecord[]): RateLimitDetection => {
    if (records.length === 0) {
        return createEmptyDetection();
    }

    const sessions = groupInto5HourSessions(records);
    const limitCandidates = findLimitCandidates(sessions);
    
    if (limitCandidates.length === 0) {
        return createEmptyDetection();
    }

    return analyzeLimitCandidates(limitCandidates);
};

/** Groups usage records into 5-hour session blocks. */
const groupInto5HourSessions = (records: ClaudeUsageRecord[]): SessionAnalysis[] => {
    const sortedRecords = [...records].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const sessions: SessionAnalysis[] = [];
    const sessionDuration = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

    let currentSession: ClaudeUsageRecord[] = [];
    let sessionStartTime: Date | null = null;

    for (const record of sortedRecords) {
        const recordTime = new Date(record.timestamp);

        if (!sessionStartTime) {
            sessionStartTime = new Date(recordTime);
            sessionStartTime.setUTCMinutes(0, 0, 0);
            currentSession = [record];
        } else {
            const timeSinceStart = recordTime.getTime() - sessionStartTime.getTime();
            const lastRecord = currentSession[currentSession.length - 1];
            const timeSinceLastRecord = lastRecord ? 
                recordTime.getTime() - new Date(lastRecord.timestamp).getTime() : 0;

            if (timeSinceStart <= sessionDuration && timeSinceLastRecord <= sessionDuration) {
                currentSession.push(record);
            } else {
                if (currentSession.length > 0) {
                    sessions.push(analyzeSession(currentSession, sessionStartTime));
                }
                
                sessionStartTime = new Date(recordTime);
                sessionStartTime.setUTCMinutes(0, 0, 0);
                currentSession = [record];
            }
        }
    }

    if (currentSession.length > 0 && sessionStartTime) {
        sessions.push(analyzeSession(currentSession, sessionStartTime));
    }

    return sessions;
};

interface SessionAnalysis {
    startTime: Date;
    endTime: Date;
    records: ClaudeUsageRecord[];
    totalTokens: number;
    duration: number;
    lastActivityTime: Date;
    hasLongGapAfter: boolean;
    isLikelyLimitHit: boolean;
}

/** Analyzes a single session for rate limit indicators. */
const analyzeSession = (records: ClaudeUsageRecord[], startTime: Date): SessionAnalysis => {
    const lastRecord = records[records.length - 1];
    const lastActivityTime = new Date(lastRecord.timestamp);
    const totalTokens = records.reduce((sum, r) => sum + r.input_tokens + r.output_tokens, 0);
    const duration = lastActivityTime.getTime() - startTime.getTime();

    return {
        startTime,
        endTime: new Date(startTime.getTime() + 5 * 60 * 60 * 1000),
        records,
        totalTokens,
        duration,
        lastActivityTime,
        hasLongGapAfter: false,
        isLikelyLimitHit: false
    };
};

/** Finds sessions that likely hit rate limits. */
const findLimitCandidates = (sessions: SessionAnalysis[]): number[] => {
    const limitCandidates: number[] = [];

    for (let i = 0; i < sessions.length - 1; i++) {
        const currentSession = sessions[i];
        const nextSession = sessions[i + 1];
        
        const gapDuration = nextSession.startTime.getTime() - currentSession.lastActivityTime.getTime();
        currentSession.hasLongGapAfter = gapDuration > 60 * 60 * 1000;
    }

    const lastSession = sessions[sessions.length - 1];
    if (lastSession) {
        const timeSinceLastActivity = Date.now() - lastSession.lastActivityTime.getTime();
        lastSession.hasLongGapAfter = timeSinceLastActivity > 60 * 60 * 1000;
    }

    for (const session of sessions) {
        const hasHighUsage = session.totalTokens >= 10000;
        const hasSignificantDuration = session.duration >= 3 * 60 * 60 * 1000;
        const isReasonableLimit = session.totalTokens >= 15000 && session.totalTokens <= 200000;
        
        session.isLikelyLimitHit = hasHighUsage && 
            (session.hasLongGapAfter || hasSignificantDuration) && 
            isReasonableLimit;

        if (session.isLikelyLimitHit) {
            limitCandidates.push(session.totalTokens);
        }
    }

    return limitCandidates;
};

/** Analyzes limit candidates to determine most likely actual limit. */
const analyzeLimitCandidates = (candidates: number[]): RateLimitDetection => {
    if (candidates.length === 0) {
        return createEmptyDetection();
    }

    const sortedCandidates = [...candidates].sort((a, b) => a - b);
    const clusters = findClusters(sortedCandidates);
    const largestCluster = clusters.reduce((max, cluster) => 
        cluster.values.length > max.values.length ? cluster : max
    );

    const detectedLimit = Math.min(...largestCluster.values);
    const conservativeLimit = Math.round(detectedLimit * 0.85);
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (candidates.length >= 5 && largestCluster.values.length >= 3) {
        confidence = 'high';
    } else if (candidates.length >= 3 && largestCluster.values.length >= 2) {
        confidence = 'medium';
    }

    return {
        detectedLimit: conservativeLimit,
        confidence,
        sampleCount: candidates.length,
        detectionMethod: 'session_gap_analysis',
        candidateLimits: sortedCandidates
    };
};

interface Cluster {
    center: number;
    values: number[];
}

/** Simple clustering to group similar limit values. */
const findClusters = (values: number[]): Cluster[] => {
    if (values.length === 0) return [];
    
    const clusters: Cluster[] = [];
    const tolerance = 5000;

    for (const value of values) {
        let belongsToCluster = false;
        
        for (const cluster of clusters) {
            if (Math.abs(value - cluster.center) <= tolerance) {
                cluster.values.push(value);
                cluster.center = Math.round(
                    cluster.values.reduce((sum, v) => sum + v, 0) / cluster.values.length
                );
                belongsToCluster = true;
                break;
            }
        }

        if (!belongsToCluster) {
            clusters.push({
                center: value,
                values: [value]
            });
        }
    }

    return clusters.sort((a, b) => b.values.length - a.values.length);
};

/** Creates empty detection result. */
const createEmptyDetection = (): RateLimitDetection => ({
    detectedLimit: null,
    confidence: 'low',
    sampleCount: 0,
    detectionMethod: 'no_data',
    candidateLimits: []
});

/** Formats detection result for logging/debugging. */
export const formatDetectionResult = (detection: RateLimitDetection): string => {
    if (!detection.detectedLimit) {
        return 'No rate limit detected';
    }

    const limitK = (detection.detectedLimit / 1000).toFixed(0);
    return `Detected: ~${limitK}K tokens (${detection.confidence} confidence, ${detection.sampleCount} samples)`;
};