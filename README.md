# Claude Code Usage Monitor

A VSCode extension that monitors your Claude Code usage and rate limits in real-time with automatic plan detection.

## ✨ Features

- **Real-time Monitoring**: Track your Claude Code token usage as you work
- **Automatic Plan Detection**: Auto-detects Pro, Max 5x, or Max 20x plans
- **Local Timezone Support**: Reset times shown in your local timezone
- **Rate Limit Alerts**: Visual warnings when approaching rate limits
- **Smart Status Bar**: Shows plan, usage percentage, and reset time
- **No Configuration**: Works automatically without manual setup

## 🎯 What You'll See

The extension adds a status bar item showing:
```
🖥️ Pro 6% | Reset: 16:00
```

- **Pro**: Your detected Claude Code plan (Pro/Max5x/Max20x)
- **6%**: Current usage percentage of your rate limit
- **Reset: 16:00**: When your rate limit window resets (local time)
- **Color coding**: 🟢 Green (safe) → 🟡 Yellow (warning) → 🔴 Red (critical)

## 🚀 Installation

Since this extension is not published on the VS Code Marketplace, install it directly from GitHub:

### Option 1: Download VSIX (Recommended)
1. Go to the [Releases page](../../releases)
2. Download the latest `.vsix` file
3. In VS Code, press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "Extensions: Install from VSIX"
5. Select the downloaded `.vsix` file

### Option 2: Build from Source
1. Clone this repository:
   ```bash
   git clone https://github.com/usabarashi/vscode-extension-claude-code-usage.git
   cd vscode-extension-claude-code-usage
   ```

2. Install dependencies and compile:
   ```bash
   npm install
   npm run compile
   ```

3. Package the extension:
   ```bash
   npx vsce package
   ```

4. Install the generated `.vsix` file in VS Code

## 🌍 Platform Support

**Supported Platforms:**
- ✅ **macOS**: Full support
- ✅ **Linux**: Full support
- ❌ **Windows**: Not supported (Claude Code is not available on Windows)

**Note**: Claude Code itself is only available on macOS and Linux. This extension cannot work on Windows as Claude Code doesn't run on that platform.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Note**: This extension is unofficial and not affiliated with Anthropic or Claude Code.
