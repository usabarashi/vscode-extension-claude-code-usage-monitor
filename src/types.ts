export interface ClaudeUsageRecord {
    timestamp: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    model: string;
    sessionId?: string;
    requestId?: string;
}

export interface ParsedUsageData {
    records: ClaudeUsageRecord[];
    totalRecords: number;
    dateRange: {
        earliest: Date;
        latest: Date;
    };
    sessionIds: string[];
}

export interface ParseError {
    type: 'directory_not_found' | 'file_access_error' | 'data_format_error' | 'unknown_error';
    message: string;
    details?: string;
    suggestion?: string;
}

export interface SessionWindow {
    sessionId: string;
    startTime: Date;
    endTime: Date;
    firstRecordTime: Date;
    records: ClaudeUsageRecord[];
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheCreationTokens: number;
    totalCacheReadTokens: number;
    totalTokens: number;
    requestCount: number;
    isActive: boolean;
    timeUntilReset: number;
    mostUsedModel?: string;
}

export interface MultiSessionBlock {
    allSessions: SessionWindow[];
    activeSessions: SessionWindow[];
    mostRestrictiveSession: SessionWindow;
    currentTime: Date;
    error?: ParseError;
}

export interface UsageStatus {
    currentUsage: number;
    usageBaseline: number;
    usagePercentage: number;
    resetTime: Date;
    timeUntilReset: number;
    timeUntilResetFormatted: string;
    isHighUsage: boolean;
    isCriticalUsage: boolean;
    estimatedTokensPerMinute: number;
    estimatedDepletionTime?: Date;
    baselineDescription: string;
    usageLevel: 'low' | 'normal' | 'high' | 'critical';
    baselineConfidence: 'high' | 'medium' | 'low';
    burnRate?: BurnRateAnalysis;
    currentModel?: string;
    error?: ParseError;
}

export interface BurnRateAnalysis {
    tokensPerMinute: number;
    tokensPerHour: number;
    averageRequestSize: number;
    recentActivity: {
        last15min: number;
        last30min: number;
        last60min: number;
    };
    predictions: {
        estimatedDepletionTime?: Date;
        timeToHighThreshold?: Date;
        timeToBaseline?: Date;
        confidence: 'high' | 'medium' | 'low';
    };
    trend: 'increasing' | 'decreasing' | 'stable';
    modelBreakdown?: ModelUsageBreakdown[];
}

export interface ModelUsageBreakdown {
    model: string;
    tokens: number;
    requests: number;
    avgTokensPerRequest: number;
    percentage: number;
    estimatedCost?: number;
}