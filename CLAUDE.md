# Claude Code Usage Monitor - Development Guide

## Overview

A VSCode extension for real-time Claude Code usage monitoring with automatic plan detection, local timezone support, and intelligent rate limit alerts.

## Architecture

### Module Structure
```
src/
├── types.ts                # Core type definitions
├── extension.ts            # VSCode integration & lifecycle
├── rateLimitManager.ts     # Rate limit calculation & display
├── blockCalculator.ts      # 5-hour rolling window algorithm
├── planConfig.ts           # Auto plan detection (Pro/Max5x/Max20x)
├── claudeDataParser.ts     # Data orchestration & validation
├── fileFormatParsers.ts    # Legacy/modern JSONL parsers
├── projectManager.ts       # Project directory discovery
├── usageAnalyzer.ts        # Usage filtering & analysis
├── costCalculator.ts       # Claude API pricing
└── errorHandler.ts         # Structured error handling
```

### Key Features
- **Automatic Plan Detection**: Pro/Max5x/Max20x based on usage patterns
- **Local Timezone Support**: Reset times in user's timezone
- **Dual Format Support**: Legacy `usage.jsonl` + modern `UUID.jsonl`
- **Functional Architecture**: TypeScript strict mode with immutable patterns
- **Zero Configuration**: No manual setup required

## Development Setup

### Prerequisites
```bash
# Node.js 18+ and npm
node --version  # v18+
npm --version   # v9+
```

### Installation
```bash
git clone https://github.com/usabarashi/vscode-extension-claude-code-usage.git
cd vscode-extension-claude-code-usage
npm install
```

### Development Workflow
```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-compile)
npm run watch

# Package extension
npm run package

# Debug in VSCode
# Press F5 to launch Extension Development Host
```

## CI/CD Pipeline

### GitHub Actions Workflows

#### Build Workflow (`.github/workflows/build.yml`)
**Triggers**: Push to main/develop, Pull Requests
```yaml
- TypeScript compilation verification
- VSIX package testing
- Artifacts saved only for main branch (30 days retention)
```

#### Release Workflow (`.github/workflows/release.yml`)
**Triggers**: Version tags (`v*.*.*`)
```yaml
- Automatic VSIX generation
- GitHub Releases creation
- Release notes auto-generation
- Permanent artifact storage
```

### Release Process
```bash
# 1. Version bump
npm version patch  # or minor/major

# 2. Push tags
git push origin --tags

# 3. GitHub Actions automatically:
#    - Builds VSIX file
#    - Creates GitHub Release
#    - Publishes downloadable artifacts
```

## Technical Specifications

### Plan Detection Algorithm
- **Pro Plan**: 500K tokens/5h → Auto-detected when usage ≤ 500K
- **Max 5x Plan**: 2.5M tokens/5h → Auto-detected when 500K < usage ≤ 2.5M
- **Max 20x Plan**: 10M tokens/5h → Auto-detected when usage > 2.5M

### Data Flow
1. **Project Discovery**: Scan `~/.claude/projects/*/`
2. **Format Detection**: Parse legacy/modern JSONL files
3. **Block Calculation**: 5-hour rolling window (local timezone)
4. **Plan Detection**: Automatic based on peak usage
5. **Status Display**: `$(terminal) Pro 6% | Reset: 16:00`

### Status Bar Integration
- **Format**: `{Plan} {Percentage}% | Reset: {LocalTime}`
- **Colors**: Green (0-70%) → Yellow (70-90%) → Red (90%+)
- **Update**: Every 60 seconds
- **Commands**: `claude-code-usage.showDetails`, `claude-code-usage.refresh`

## Testing

### Manual Testing
```bash
# 1. Install extension in VSCode
# 2. Use Claude Code to generate data
# 3. Verify status bar display
# 4. Test plan auto-detection
# 5. Validate timezone handling
```

### Compatibility Testing
- **Platform**: macOS, Linux (Windows not supported - Claude Code limitation)
- **VSCode**: 1.74.0+
- **Claude Plans**: Pro, Max 5x, Max 20x

## Deployment

### Distribution Methods
1. **GitHub Releases**: Automated VSIX distribution
2. **Manual Installation**: Download + "Install from VSIX"
3. **Development**: F5 debugging in Extension Development Host

### User Installation
```bash
# Users download from GitHub Releases
# Install via: Extensions → Install from VSIX → Select file
```

## Claude Code Integration

### Data Sources
- **Path**: `~/.claude/projects/*/`
- **Formats**: `usage.jsonl` (legacy) + `{UUID}.jsonl` (modern)
- **Tokens**: Input + Output only (excludes cache tokens)

### Platform Limitations
- **Supported**: macOS, Linux
- **Unsupported**: Windows (Claude Code not available)

This extension provides seamless Claude Code usage monitoring with zero configuration and intelligent automation.
