/**
 * Claude Code Project Manager Module
 * 
 * Handles Claude Code project directory management and file discovery.
 * Manages access to ~/.claude/projects/ and project-specific operations.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProjectInfo, ClaudeUsageRecord } from './types';
import { parseLegacyUsageFile, parseModernSessionFile, detectFileFormat, validateUsageFile } from './fileFormatParsers';

/** Path to Claude Code projects directory */
export const CLAUDE_PROJECTS_PATH = path.join(os.homedir(), '.claude', 'projects');

/**
 * Checks if Claude Code projects directory exists.
 * @returns True if the projects directory exists
 */
export const projectsDirectoryExists = (): boolean => {
    return fs.existsSync(CLAUDE_PROJECTS_PATH);
};

/**
 * Gets information about all Claude Code projects.
 * @returns Array of project information objects
 */
export const getAllProjects = (): ProjectInfo[] => {
    if (!projectsDirectoryExists()) {
        return [];
    }
    
    try {
        const projectDirs = fs.readdirSync(CLAUDE_PROJECTS_PATH);
        
        return projectDirs
            .map(projectDir => {
                const projectPath = path.join(CLAUDE_PROJECTS_PATH, projectDir);
                
                try {
                    if (!fs.statSync(projectPath).isDirectory()) {
                        return null;
                    }
                    
                    const files = fs.readdirSync(projectPath);
                    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
                    
                    const hasLegacyFormat = files.includes('usage.jsonl');
                    const sessionFiles = jsonlFiles.filter(f => f !== 'usage.jsonl');
                    const hasModernFormat = sessionFiles.length > 0;
                    
                    return {
                        path: projectPath,
                        name: projectDir,
                        hasLegacyFormat,
                        hasModernFormat,
                        sessionFiles
                    } as ProjectInfo;
                } catch (error) {
                    console.warn(`Failed to read project directory ${projectDir}:`, error);
                    return null;
                }
            })
            .filter((project): project is ProjectInfo => project !== null);
    } catch (error) {
        console.error('Error reading projects directory:', error);
        return [];
    }
};

/**
 * Parses all usage data from a specific project.
 * @param project - Project information object
 * @returns Array of usage records from the project
 */
export const parseProjectUsageData = (project: ProjectInfo): ClaudeUsageRecord[] => {
    const records: ClaudeUsageRecord[] = [];
    
    try {
        // Parse legacy format if exists
        if (project.hasLegacyFormat) {
            const legacyFile = path.join(project.path, 'usage.jsonl');
            if (validateUsageFile(legacyFile)) {
                records.push(...parseLegacyUsageFile(legacyFile));
            }
        }
        
        // Parse modern session files
        if (project.hasModernFormat) {
            for (const sessionFile of project.sessionFiles) {
                const sessionPath = path.join(project.path, sessionFile);
                if (validateUsageFile(sessionPath)) {
                    records.push(...parseModernSessionFile(sessionPath, sessionFile));
                }
            }
        }
    } catch (error) {
        console.error(`Error parsing project ${project.name}:`, error);
    }
    
    return records;
};

/**
 * Gets usage data from all Claude Code projects.
 * @returns Array of all usage records across all projects
 */
export const getAllProjectsUsageData = (): ClaudeUsageRecord[] => {
    const projects = getAllProjects();
    const allRecords: ClaudeUsageRecord[] = [];
    
    for (const project of projects) {
        const projectRecords = parseProjectUsageData(project);
        allRecords.push(...projectRecords);
    }
    
    return allRecords;
};

/**
 * Gets summary statistics about Claude Code projects.
 * @returns Object with project statistics
 */
export const getProjectsSummary = () => {
    const projects = getAllProjects();
    
    return {
        totalProjects: projects.length,
        projectsWithLegacyFormat: projects.filter(p => p.hasLegacyFormat).length,
        projectsWithModernFormat: projects.filter(p => p.hasModernFormat).length,
        totalSessionFiles: projects.reduce((sum, p) => sum + p.sessionFiles.length, 0),
        projects: projects.map(p => ({
            name: p.name,
            hasLegacyFormat: p.hasLegacyFormat,
            hasModernFormat: p.hasModernFormat,
            sessionCount: p.sessionFiles.length
        }))
    };
};

/**
 * Finds the most recently modified project.
 * @returns Project info for the most recently active project, or null if none found
 */
export const getMostRecentProject = (): ProjectInfo | null => {
    const projects = getAllProjects();
    
    if (projects.length === 0) {
        return null;
    }
    
    let mostRecent: ProjectInfo | null = null;
    let mostRecentTime = 0;
    
    for (const project of projects) {
        try {
            const stat = fs.statSync(project.path);
            if (stat.mtime.getTime() > mostRecentTime) {
                mostRecentTime = stat.mtime.getTime();
                mostRecent = project;
            }
        } catch (error) {
            console.warn(`Failed to get modification time for project ${project.name}:`, error);
        }
    }
    
    return mostRecent;
};

/**
 * Watches the projects directory for changes.
 * @param callback - Function to call when changes are detected
 * @returns Function to stop watching
 */
export const watchProjectsDirectory = (callback: () => void): (() => void) => {
    if (!projectsDirectoryExists()) {
        return () => {}; // No-op if directory doesn't exist
    }
    
    try {
        const watcher = fs.watch(CLAUDE_PROJECTS_PATH, { recursive: true }, () => {
            callback();
        });
        
        return () => watcher.close();
    } catch (error) {
        console.error('Failed to watch projects directory:', error);
        return () => {};
    }
};