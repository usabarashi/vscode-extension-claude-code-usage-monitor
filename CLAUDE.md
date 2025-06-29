# Claude Code Usage Monitor - Development Guide

VSCode extension for real-time Claude Code usage monitoring with intelligent baseline tracking.

## Architecture Overview

### Facade Pattern
`extension.ts` coordinates all modules via Facade pattern:

```
Data Parsing → Block Calculation → Baseline Analysis → UI Display
```

### Directory Structure
```
src/
├── extension.ts          # Facade + VSCode entry point
├── core/                 # Independent business logic
│   ├── claudeDataParser.ts
│   ├── blockCalculator.ts
│   └── usageBaselineCalculator.ts
├── ui/
│   └── statusBarFormatter.ts
└── types.ts
```

## Key Features

### Module Independence
Core modules have zero interdependencies, called only by Facade:
- `claudeDataParser.ts` - Parses Claude data files
- `blockCalculator.ts` - 5-hour session block algorithm
- `usageBaselineCalculator.ts` - Statistical baseline analysis

### Statistical Baseline
Intelligent usage monitoring instead of hardcoded limits:
- 30-day historical analysis with IQR outlier removal
- Confidence scoring (High/Medium/Low)
- Active block exclusion prevents bias

### Data Pipeline
```typescript
const parsedData = await parseAllUsageData();
const multiSessionBlock = createMultiSessionBlock(parsedData.records, new Date());
const status = await createUsageStatusFromMultiSession(multiSessionBlock);
```

## Development

### Build & Test
```bash
npm install && npm run compile
F5  # Debug in VSCode Extension Host
```

### Code Standards
- TypeScript strict mode with comprehensive JSDoc
- Pure functions in core modules (no side effects)
- Independent modules for easy testing
- Graceful error handling

## Implementation Details

### Data Sources
- Path: `~/.claude/projects/*/` (auto-discovery)
- Formats: Legacy `usage.jsonl` + Modern `{UUID}.jsonl`
- Tokens: Input + Output (excludes cache)

### Session Monitoring
- 5-hour rolling windows (Claude's algorithm)
- UTC alignment with local timezone display
- 60-second refresh cycle
- Active block detection with boundary conditions

### Platform Support
- Supported: macOS, Linux
- VSCode 1.74.0+
- Claude Code: Tested with v1.0.33 (may work with other versions)
