export const WINDOW_DURATION_MS = 5 * 60 * 60 * 1000;

export const floorToHour = (date: Date): Date => {
    const floored = new Date(date);
    floored.setUTCMinutes(0, 0, 0);
    return floored;
};

export const formatTimeUntilReset = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
};