# Claude Code Usage Monitor - Development Guide

A VSCode extension for real-time Claude Code usage monitoring with intelligent baseline tracking and Facade architecture pattern.

## Architecture Overview

### Facade Pattern Implementation
The extension uses a **Facade Pattern** with `extension.ts` as the central coordinator managing all core modules and data flow.

```
src/
├── extension.ts                   # 🏛️ Unified Facade + VSCode Entry Point
├── core/                          # ⚙️ Business Logic Layer (Independent)
│   ├── claudeDataParser.ts        # Data parsing (legacy + modern JSONL)
│   ├── blockCalculator.ts         # 5-hour session block algorithm
│   ├── usageBaselineCalculator.ts # Statistical baseline analysis
│   ├── usageCalculator.ts         # Token aggregation utilities
│   └── projectManager.ts          # Cross-platform path discovery
├── ui/                            # 🎨 UI Display Layer
│   └── statusBarFormatter.ts      # Pure formatting functions
├── types.ts                       # 📋 Shared type definitions
├── errorHandler.ts                # 🚨 Error handling utilities
└── windowCalculator.ts            # ⏰ Time calculation utilities
```

## Data Flow Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        FACADE PATTERN                      │
│                         extension.ts                       │
│              ️ Central Coordinator & VSCode Integration     │
└────────────────────┬───────────────────────────┬───────────┘
                     │                           │
          ┌─────────────────────┐      ┌─────────────────────┐
          │    CORE MODULES     │      │     UI LAYER        │
          │   (Independent)     │      │  (Pure Functions)   │
          └─────────────────────┘      └─────────────────────┘
                     │                           │
    ┌────────────────┼────────────────┐          │
    │                │                │          │
    ▼                ▼                ▼          ▼
┌─────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│~/.claude│─▶│claudeData   │─▶│blockCalc    │─▶│statusBar    │
│projects/│  │Parser       │  │ulator       │  │Formatter    │
│*.jsonl  │  │• Legacy     │  │• 5h windows │  │• Colors     │
└─────────┘  │• Modern     │  │• UTC align  │  │• Text       │
             │• Error safe │  │• Pure func  │  │• Tooltips   │
             └─────────────┘  └─────────────┘  └─────────────┘
                     │                │
                     ▼                ▼
             ┌─────────────┐  ┌─────────────┐
             │usageBaseline│  │usageCalc    │
             │Calculator   │  │ulator       │
             │• Statistics │  │• Token      │
             │• IQR method │  │  aggregation│
             │• Confidence │  │• Pure func  │
             └─────────────┘  └─────────────┘
```

## Key Implementation Features

### 🏗️ Module Independence
**Core Modules**: Zero interdependencies, called only by Facade
- ✅ `claudeDataParser.ts` - No external core dependencies
- ✅ `blockCalculator.ts` - Pure functions, no side effects
- ✅ `usageBaselineCalculator.ts` - Statistical analysis only
- ✅ `usageCalculator.ts` - Simple token aggregation
- ✅ `projectManager.ts` - Cross-platform path resolution

### 🎯 Facade Coordination
**extension.ts** manages the complete data pipeline:
```typescript
// Facade orchestrates: Data → Blocks → Baseline → UI
const parsedData = await parseAllUsageData();
const multiSessionBlock = createMultiSessionBlock(parsedData.records, new Date(), parsedData.error);
const status = await createUsageStatusFromMultiSession(multiSessionBlock);
```

### 📊 Statistical Baseline Algorithm
Instead of hardcoded rate limits, uses intelligent baseline calculation:
- **30-day Analysis**: Historical usage patterns from completed blocks
- **IQR Outlier Removal**: Statistical data cleaning
- **Confidence Scoring**: High/Medium/Low based on data quality
- **Active Block Exclusion**: Current session not included in baseline

### 🎨 UI Layer Separation
**statusBarFormatter.ts** provides pure formatting functions:
- Color-coded status: 🟢 <70% → 🟡 70-99% → 🔴 100%+
- Format: `$(terminal) 85% | 45K avg | Reset: 16:00`
- Comprehensive tooltips with usage breakdown

## Development Workflow

### Building & Testing
```bash
npm install           # Install dependencies
npm run compile       # Build TypeScript
npm run package       # Create VSIX file
F5                    # Debug in VSCode Extension Development Host
```

### Code Quality
- **JSDoc Documentation**: Comprehensive function and module documentation
- **TypeScript Strict**: Full type safety with strict mode
- **Pure Functions**: No side effects in core modules
- **Error Handling**: Graceful degradation with user feedback

### Directory Structure Benefits
- **Testability**: Independent modules easy to unit test
- **Maintainability**: Clear separation of concerns
- **Scalability**: New features added without affecting existing modules
- **Security**: No personal information in codebase

## Usage Monitoring

### Data Sources
- **Path**: `~/.claude/projects/*/` (auto-discovery)
- **Formats**: Legacy `usage.jsonl` + Modern `{UUID}.jsonl`
- **Tokens**: Input + Output only (excludes cache tokens)

### Session Blocks
- **Duration**: 5-hour rolling windows (Claude's algorithm)
- **Alignment**: UTC hour boundaries
- **Activity**: Shows current active block only
- **Reset**: Local timezone display

### Status Display
- **Update Frequency**: 60-second automatic refresh
- **Click Action**: Detailed usage information modal
- **Error States**: Informative messages with suggestions
- **Commands**: Manual refresh and detail view

## Platform Compatibility

- **Supported**: macOS, Linux
- **Unsupported**: Windows (Claude Code limitation)
- **VSCode**: 1.74.0+
- **Architecture**: Independent of Claude Code versions

This implementation provides efficient, maintainable Claude Code usage monitoring with a clean architecture pattern and intelligent baseline analysis.
