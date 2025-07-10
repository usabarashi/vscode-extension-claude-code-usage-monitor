/**
 * Model Utilities - Core Module
 * 
 * Provides model accuracy ranking and comparison utilities based on pricing.
 * Lower-priced models are considered lower accuracy.
 * 
 * @module ModelUtils
 */

/** Model pricing in USD per 1M tokens (approximate) */
export const MODEL_PRICING = {
    'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku': { input: 0.25, output: 1.25 },
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    'default': { input: 3.00, output: 15.00 }
} as const;

/** Model accuracy ranks based on average token price (lower rank = lower accuracy) */
const MODEL_ACCURACY_RANKS: Record<string, number> = (() => {
    const ranks: Record<string, number> = {};
    
    // Calculate average price per token for ranking
    Object.entries(MODEL_PRICING).forEach(([model, pricing]) => {
        if (model !== 'default') {
            const avgPrice = (pricing.input + pricing.output) / 2;
            ranks[model] = avgPrice;
        }
    });
    
    return ranks;
})();

/**
 * Gets the accuracy rank of a model based on its pricing.
 * Lower values indicate lower accuracy (cheaper models).
 * 
 * @param model - The model identifier
 * @returns Accuracy rank (price-based), or default rank if unknown
 */
export const getModelAccuracyRank = (model: string): number => {
    return MODEL_ACCURACY_RANKS[model] || MODEL_ACCURACY_RANKS['default'] || 9.0;
};

/**
 * Finds the least accurate (cheapest) model from a list of models.
 * 
 * @param models - Array of model identifiers
 * @returns The least accurate model, or 'unknown' if empty
 */
export const getLeastAccurateModel = (models: string[]): string => {
    if (models.length === 0) {
        return 'unknown';
    }
    
    return models.reduce((leastAccurate, current) => {
        const currentRank = getModelAccuracyRank(current);
        const leastRank = getModelAccuracyRank(leastAccurate);
        return currentRank < leastRank ? current : leastAccurate;
    });
};

/**
 * Gets a short display name for a model.
 * 
 * @param model - Full model identifier
 * @returns Short display name
 */
export const getModelDisplayName = (model: string): string => {
    if (!model || model === 'unknown') {
        return 'unknown';
    }
    
    // Extract key part of model name
    if (model.includes('haiku')) {
        return 'haiku';
    } else if (model.includes('sonnet')) {
        return model.includes('3-5') ? 'sonnet-3.5' : 'sonnet';
    } else if (model.includes('opus')) {
        return 'opus';
    }
    
    // For other models, try to extract a meaningful short name
    const parts = model.split('-');
    return parts[parts.length - 1] || model;
};

/**
 * Finds the most used model from usage records based on request count.
 * 
 * @param records - Array of usage records with model information
 * @returns The most frequently used model, or 'unknown' if no records
 */
export const getMostUsedModel = (records: Array<{ model: string }>): string => {
    if (records.length === 0) {
        return 'unknown';
    }
    
    // Count occurrences of each model
    const modelCounts = new Map<string, number>();
    
    records.forEach(record => {
        const model = record.model || 'unknown';
        modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
    });
    
    // Find the model with the highest count
    let mostUsedModel = 'unknown';
    let maxCount = 0;
    
    modelCounts.forEach((count, model) => {
        if (count > maxCount) {
            maxCount = count;
            mostUsedModel = model;
        }
    });
    
    return mostUsedModel;
};