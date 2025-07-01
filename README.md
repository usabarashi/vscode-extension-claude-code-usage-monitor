# Claude Code Usage Monitor

A VSCode extension that provides accurate Claude Code usage monitoring with intelligent rate limit estimation.

## ✨ What It Does

**Real-time usage tracking** in your VSCode status bar:
- **Accurate rate limits**: Shows how close you are to actual Claude Code limits
- **Smart estimation**: Automatically detects your personal rate limits from usage history
- **Early warnings**: Get notified before hitting limits, not after
- **Zero setup**: Works immediately after installation

## 📊 Status Bar Display

**Simple, essential information**:

```
$(terminal) 75% | ~35K | 15:00
```

- **75%**: Current usage vs your estimated rate limit
- **~35K**: Your detected rate limit (not a generic guess)
- **15:00**: When your current 5-hour session resets
- **Colors**: 🟢 Green (safe) → 🟡 Yellow (approaching) → 🔴 Red (at limit)

### Detailed View (Click Status Bar)
- **Burn rate**: How fast you're consuming tokens
- **Trend analysis**: Whether usage is increasing or decreasing  
- **Time predictions**: When you might hit limits
- **Cost tracking**: Estimated costs by model type

## 🎯 Key Improvements

### Accurate Rate Limit Detection
**Problem solved**: No more "12% usage but limit reached" surprises.

**How it works**:
1. **Historical analysis**: Learns from your actual usage patterns
2. **Smart detection**: Identifies when you've hit limits before
3. **Dynamic margins**: Adjusts safety buffer based on confidence
4. **User override**: Option to set your known limit manually

### Better Predictions
- **Sample data**: 34,887 tokens used → limit warning
- **Our estimate**: ~33K tokens (95% accuracy)
- **Old estimate**: ~26K tokens (76% accuracy)

## ⚙️ Configuration

**Optional**: Override automatic detection with your known limit:

```json
{
  "claude-code-usage.customLimit": 50000
}
```

**Default**: Automatic detection from your usage history (recommended).

## 🚀 Installation

### From Release (Recommended)
1. Download the latest `.vsix` file from [Releases](../../releases)
2. In VSCode: `Ctrl+Shift+P` → "Extensions: Install from VSIX"
3. Select the downloaded file
4. Extension starts monitoring automatically

### Build from Source
```bash
git clone https://github.com/usabarashi/vscode-extension-claude-code-usage-monitor.git
cd vscode-extension-claude-code-usage-monitor
npm install && npm run compile && npm run package
```

Install the generated `.vsix` file in VSCode.

## 🔧 How It Works

### Intelligent Rate Limit Estimation
1. **Your data**: Analyzes your Claude Code usage from last 30 days
2. **Pattern detection**: Finds sessions where you likely hit limits
3. **Statistical backup**: Uses your 90th percentile usage if no patterns found
4. **Safety margins**: Applies 5-12% buffer based on data confidence

### Real-time Monitoring
- **Data source**: Reads from `~/.claude/projects/` (where Claude Code stores usage)
- **Session tracking**: Monitors 5-hour windows (Claude's actual limit system)
- **Live updates**: Refreshes every 60 seconds
- **Format support**: Works with all Claude Code data formats

## 🌍 Compatibility

- ✅ **macOS**: Fully supported
- ✅ **Linux**: Fully supported  
- ❌ **Windows**: Not supported (Claude Code stores data differently)

**Requirements**:
- VSCode 1.74.0+
- Claude Code installed and used at least once
- Sufficient usage history for accurate estimation (works better after a few days)

## ❓ Troubleshooting

**"No active block" showing?**
- Use Claude Code for a few interactions first
- Check that Claude Code is storing data in `~/.claude/projects/`

**Percentage seems wrong?**
- Extension learns from your usage patterns - give it a few days
- Set `claude-code-usage.customLimit` if you know your exact limit

**Want more details?**
- Click the status bar item for detailed breakdown
- Check VSCode Developer Console for debug information

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Note**: This is an unofficial extension not affiliated with Anthropic or Claude Code. It monitors usage based on locally stored Claude Code data and provides estimations for planning purposes.