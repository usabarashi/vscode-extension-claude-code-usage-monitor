# Claude Code Usage Monitor - Development Guide

VSCode extension for real-time Claude Code usage monitoring with intelligent rate limit estimation.

## Architecture Overview

### Clean Architecture Pattern
```
extension.ts (VSCode Integration)
├── config/ (Configuration Layer)
├── services/ (Service Layer) 
├── ui/ (Presentation Layer)
├── core/ (Business Logic Layer)
└── utils/ (Utility Layer)
```

### Directory Structure
```
src/
├── extension.ts              # VSCode entry point + facade coordination
├── config/
│   └── settingsManager.ts    # VSCode settings management
├── services/
│   ├── usageMonitorFacade.ts # Service orchestration (Facade pattern)
│   └── rateLimitEstimationService.ts # Rate limit estimation logic
├── core/                     # Independent business logic
│   ├── claudeDataParser.ts   # Parse Claude usage files
│   ├── blockCalculator.ts    # 5-hour session algorithm
│   ├── usageBaselineCalculator.ts # Statistical baseline analysis
│   ├── rateLimitDetector.ts  # Historical limit detection
│   └── burnRateCalculator.ts # Consumption prediction + cost analysis
├── ui/
│   └── statusBarFormatter.ts # Status bar display formatting
├── utils/
│   └── timeUtils.ts          # Time calculation utilities
└── types.ts                  # Shared type definitions
```

## Key Features

### Status Bar Display
**Format**: `$(terminal) {percentage}% | {rate_limit} | {time}`
**Example**: `$(terminal) 75% | ~45K | 15:00`

- **Usage percentage**: Current usage vs rate limit estimate
- **Rate limit estimate**: Intelligent prediction (~45K format)
- **Reset time**: When current 5-hour session resets (24h format)
- **Colors**: 🟢 Green (<70%) → 🟡 Yellow (70-99%) → 🔴 Red (100%+)

### Rate Limit Estimation
**Hybrid Approach with Improved Accuracy**:
1. **User-configured limit** (100% trust)
2. **Historical pattern detection** (80-90% trust, dynamic safety margins)
3. **Enhanced statistical fallback** (60% trust, 90th percentile + adjusted thresholds)

```typescript
// Dynamic safety margins based on detection confidence
const safetyMargin = sampleCount >= 5 
    ? (confidence === 'high' ? 0.95 : 0.92)  // 5-8% margin
    : (confidence === 'high' ? 0.92 : 0.88); // 8-12% margin
```

### Burn Rate Analysis
- Real-time token consumption rates (tokens/minute)
- Trend detection via linear regression (increasing/decreasing/stable)
- Time-windowed activity tracking (15min/30min/60min)
- Depletion predictions with confidence scoring
- Model-specific cost estimation and breakdown

### User Configuration
```json
{
  "claude-code-usage.customLimit": 50000  // Optional rate limit override
}
```

## Implementation Details

### Data Pipeline
```typescript
// Orchestrated by UsageMonitorFacade
const parsedData = await parseAllUsageData();
const multiSessionBlock = createMultiSessionBlock(parsedData.records, new Date());
const rateLimitEstimate = RateLimitEstimationService.calculateRateLimitEstimate(
    baseline, records, customLimit
);
const status = await createUsageStatus(multiSessionBlock, parsedData, rateLimitEstimate);
```

### Dependency Management
- **No circular dependencies**: All core modules are independent
- **Clean separation**: VSCode API access isolated to config layer
- **Facade coordination**: Complex operations orchestrated by service layer
- **Type safety**: Comprehensive TypeScript with strict mode

### Data Sources
- **Path**: `~/.claude/projects/*/` (auto-discovery)
- **Formats**: Legacy `usage.jsonl` + Modern `{UUID}.jsonl`
- **Tokens**: Input + Output (excludes cache)
- **Sessions**: 5-hour rolling windows with UTC alignment

## Development

### Build & Test
```bash
npm install && npm run compile
F5  # Debug in VSCode Extension Host
```

### Platform Support
- **Supported**: macOS, Linux
- **Requirements**: VSCode 1.74.0+, Claude Code installed
- **Tested**: Claude Code v1.0.33+ (may work with other versions)

## Code Quality

### Architecture Principles
- **Single Responsibility**: Each module has one clear purpose
- **Dependency Inversion**: High-level modules don't depend on low-level details
- **Clean Architecture**: Strict layer boundaries with downward dependencies
- **Facade Pattern**: Complex subsystem coordination through simple interface

### Development Standards
- TypeScript strict mode with comprehensive JSDoc
- Pure functions in core modules (no side effects)
- Independent modules for easy testing and maintenance
- Graceful error handling with user-friendly messages

### Performance Optimizations
- **Data parsing**: Single pass through usage files (66% reduction vs original)
- **Rate limit calculation**: Cached results, single computation per cycle
- **Memory efficiency**: Stateless services, minimal object creation
- **UI updates**: 60-second refresh cycle with efficient data processing