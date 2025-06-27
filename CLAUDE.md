# VSCode Extension: CC Usage Monitor

## Project Overview

A VSCode extension for real-time monitoring of Claude Code usage and rate limit information. This extension helps developers avoid work interruptions due to token limits and enables efficient utilization of Claude Code.

## Core Requirements

### Key Information to Display

1. **Rate Limit Reset Time**
   - Scheduled end time of the 5-hour window
   - Example: `Next Reset: 15:30`

2. **Usage Status to Rate Limit**
   - Current token usage / limit
   - Usage percentage display
   - Example: `450,000 / 500,000 tokens (90%)`

3. **Supplementary Information**
   - Time remaining until reset: `2 hours 15 minutes`
   - Remaining available tokens
   - Current consumption rate (tokens/minute)
   - Predicted depletion time at current pace

### Technical Requirements

- **Independent Implementation**: No dependency on ccusage CLI tool
- **Direct Data Access**: Read Claude Code local data (`~/.claude/projects/`)
- **Real-time Updates**: Live updates through file monitoring
- **Lightweight**: Performance-focused, avoiding external process execution

### UI Requirements

#### Status Bar Display
- Concise usage status: `⏰ 85% | Reset: 15:30`
- Color coding by warning level:
  - Green: 0-70% usage
  - Yellow: 70-90% usage
  - Red: 90-100% usage
- Click to open detailed panel

#### Detailed Webview Panel
- Progress bar visualization of usage
- Detailed session information
- Real-time usage graphs
- Hourly usage pattern display

## Understanding Claude Code Session System

### What is a Session
- Functions as a **5-hour rolling window**
- Session starts when the first message is sent
- Resets exactly 5 hours after session start
- Based on actual usage start time, not fixed clock times

### Rate Limit Mechanism
- Upper limit on total token usage during session period
- No new requests allowed until session end when limit is reached
- Limit values vary by model and plan

## Technical Specifications

### Data Source
- **Location**: JSONL files under `~/.claude/projects/`
- **Content**: Timestamps, token counts, cost information, model types
- **Format**: One JSON object per line per request

### Core Functions
1. **Session Detection**: Identify first request timestamp
2. **5-Hour Window Calculation**: Aggregate usage from 5 hours ago to now
3. **Rate Limit Calculation**: Calculate usage/limit ratio
4. **Reset Time Prediction**: Session start + 5 hours

### Update Frequency
- Status Bar: 1-minute intervals
- Webview Panel: 30-second intervals
- Immediate updates on usage change detection

## Development Priorities

1. **Phase 1: Data Foundation**
   - Claude Code data file reading functionality
   - Session detection and 5-hour window calculation engine
   - Rate limit status determination logic

2. **Phase 2: Basic UI**
   - Status bar display functionality
   - Basic command registration

3. **Phase 3: Advanced Features**
   - Webview detailed panel implementation
   - Real-time updates and file monitoring
   - Warning and notification features

## Expected Benefits

- **Prevention of Work Interruption**: Early warning before rate limit reached
- **Efficient Work Planning**: Visualization of remaining time and usage
- **Improved Development Experience**: Transparency in Claude Code usage