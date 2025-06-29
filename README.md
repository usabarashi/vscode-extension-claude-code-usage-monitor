# Claude Code Usage Monitor

A VSCode extension for monitoring Claude Code token usage with smart baseline tracking and real-time status display.

## ✨ What It Does

Keep track of your Claude Code usage directly in VSCode:
- **Real-time Monitoring**: See current usage percentage in the status bar
- **Smart Baseline**: Learn your typical usage patterns automatically
- **Usage Alerts**: Visual warnings when usage is higher than usual
- **Local Timezone**: Reset times displayed in your timezone
- **Zero Setup**: Works immediately after installation

## 📊 Status Bar Display

The extension shows your usage status in the VSCode status bar:

```
$(terminal) 85% | 45K avg | Reset: 16:00
```

- **Green (0-70%)**: Normal usage levels
- **Yellow (70-99%)**: Higher than typical usage
- **Red (100%+)**: Very high usage levels
- **No active block**: When session has expired

## 🚀 Installation

1. Install from VSCode Marketplace
2. Extension activates automatically
3. Start using Claude Code to see your usage

## 🔧 Recent Fixes

### Active Block Boundary Condition Fix
- **Issue**: Reset time boundary condition caused inactive blocks to display instead of "No active block"
- **Solution**: Fixed session detection logic to properly handle reset time boundaries
- **Result**: Accurate "No active block" display when session expires

## 📋 Requirements

- VSCode 1.74.0+
- Claude Code installed and configured
- macOS or Linux (Windows not supported by Claude Code)

## 🏗️ Architecture

Built with Facade pattern for clean module separation and intelligent baseline calculation using statistical analysis of historical usage patterns.