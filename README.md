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

- **85%**: Current usage relative to your typical patterns
- **45K avg**: Your average usage baseline (automatically calculated)
- **Reset: 16:00**: When the current 5-hour window resets (local time)
- **Colors**: 🟢 Green (<70%) → 🟡 Yellow (70-99%) → 🔴 Red (100%+)

Click the status bar for detailed information:
- Current token usage breakdown
- Usage level (Low/Normal/High/Critical)
- Baseline confidence and consumption rate
- Time until reset

## 🚀 Installation

### Option 1: Download Release
1. Go to [Releases](../../releases) and download the latest `.vsix` file
2. In VSCode: `Ctrl+Shift+P` → "Extensions: Install from VSIX"
3. Select the downloaded file
4. The extension starts working automatically

### Option 2: Build from Source
```bash
git clone https://github.com/usabarashi/vscode-extension-claude-code-usage-monitor.git
cd vscode-extension-claude-code-usage-monitor
npm install
npm run compile
npm run package
```
Then install the generated `.vsix` file in VSCode.

## 🧠 How It Works

### Smart Baseline Calculation
- Analyzes your past 30 days of Claude Code usage
- Groups usage into 5-hour blocks (matching Claude's rate limiting)
- Calculates statistical average with outlier removal
- Excludes current active session to prevent bias
- Provides confidence levels based on data quality

### Usage Monitoring
- Reads Claude Code usage data from `~/.claude/projects/`
- Supports both legacy and modern JSONL formats
- Tracks 5-hour session windows with UTC alignment
- Updates every 60 seconds for real-time accuracy
- Displays percentage relative to your personal baseline

## 🌍 Platform Support

- ✅ **macOS**: Fully supported
- ✅ **Linux**: Fully supported
- ❌ **Windows**: Not supported (Claude Code limitation)

**Requirements**:
- VSCode 1.74.0 or later
- Claude Code installed and used at least once
- Node.js (for building from source)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Note**: This is an unofficial extension not affiliated with Anthropic or Claude Code. It provides usage monitoring based on locally stored Claude Code usage data.
