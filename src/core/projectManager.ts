/**
 * Project Manager - Core Module (Independent)
 * 
 * Manages Claude Code project directory discovery across different platforms.
 * Provides cross-platform compatible path resolution for Claude Code data.
 * 
 * @module ProjectManager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Discovers and returns the Claude Code projects directory path.
 * 
 * This function searches for the Claude Code projects directory across multiple
 * potential home directory locations to ensure compatibility with different
 * operating systems and user configurations.
 * 
 * **Search Strategy:**
 * 1. Checks `os.homedir()` (primary Node.js method)
 * 2. Checks `process.env.HOME` (Unix/Linux/macOS)
 * 3. Checks `process.env.USERPROFILE` (Windows)
 * 4. Falls back to `os.homedir()` if no existing directory found
 * 
 * **Directory Structure:**
 * ```
 * ~/.claude/projects/
 * ├── project-1/
 * │   ├── usage.jsonl (legacy format)
 * │   └── uuid.jsonl (modern format)
 * └── project-2/
 *     └── uuid.jsonl
 * ```
 * 
 * @returns {string} Absolute path to Claude Code projects directory
 * 
 * @example
 * ```typescript
 * const projectsPath = getClaudeProjectsPath();
 * console.log(projectsPath); // "/Users/username/.claude/projects"
 * ```
 * 
 * @since 0.1.0
 */
export const getClaudeProjectsPath = (): string => {
    // Define potential home directory sources in order of preference
    const potentialHomes = [
        os.homedir(),           // Primary Node.js method (cross-platform)
        process.env.HOME,       // Unix/Linux/macOS environment variable
        process.env.USERPROFILE // Windows environment variable
    ].filter(Boolean) as string[];
    
    // Search for existing Claude projects directory
    for (const homeDir of potentialHomes) {
        const claudePath = path.join(homeDir, '.claude', 'projects');
        
        // Return first existing directory found
        if (fs.existsSync(claudePath)) {
            return claudePath;
        }
    }
    
    // Fallback: return default path even if directory doesn't exist
    // This allows the application to provide helpful error messages
    const defaultPath = path.join(os.homedir(), '.claude', 'projects');
    return defaultPath;
};