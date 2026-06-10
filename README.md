<p align="center">
  <img src="media/icon.png" alt="DARTX Logo" width="128"/>
</p>

<h1 align="center">DARTX</h1>

<p align="center">
<strong>Stop wrestling with dependencies. Start coding.</strong>
</p>

<p align="center">
  DARTX is a smart, lightweight assistant that automatically detects and resolves dependency issues in Python and Node.js projects before they interrupt your workflow. It works silently in the background to save you time and prevent configuration headaches.
</p>

<p align="center">
  <!-- Placeholder for a GIF demonstrating the extension in action -->
  <img src="https://raw.githubusercontent.com/SuraviR10/Dependency_Manager/main/media/demo.gif" alt="DARTX Demo"/>
</p>

---

## Stop Wasting Time on Dependency Errors

Ever been slowed down by `ModuleNotFoundError`, `Cannot find module`, or cryptic environment issues? DARTX eliminates this friction. It identifies the root cause of dependency problems and offers instant, one-click solutions, letting you stay focused on building great software.

## Key Features

*   🤫 **Silent, Automatic Detection**: DARTX monitors your project for missing imports and dependency errors without ever getting in your way. No popups, no distractions.

*   🚀 **One-Click Fixes**: When an issue is found, a subtle notification gives you the option to install the missing package with a single click.

*   🩺 **Environment Doctor**: Diagnose your entire development environment—Python/Node.js versions, virtual environments, and PATH configurations—to find and fix underlying issues.

*   🧠 **Smart Recommendations**: DARTX knows that an `import cv2` error means you need to install `opencv-python`. It maintains a database of common mappings to provide accurate suggestions.

*   🛡️ **Safe and Secure**: All suggested packages are validated against their respective registries (PyPI, npm) to protect against typosquatting. Commands are sanitized to prevent injection attacks.

*   📊 **Health Dashboard**: Get an at-a-glance overview of your project's dependency health, including installed packages, conflicts, and unused dependencies.

## How It Works

1.  **Code as usual**: Write your Python or Node.js code.
2.  **Get a subtle alert**: If you import a missing package, DARTX shows a non-intrusive notification.
3.  **Click to fix**: Click "Install" on the notification. DARTX runs the correct command for you in the terminal.

That's it. You're back to coding.

## Supported Languages

*   **Python** (pip, venv, pyproject.toml, requirements.txt)
*   **Node.js** (npm, yarn, pnpm, package.json)

## Quick Start

1.  Install **DARTX** from the VS Code Marketplace.
2.  Open a Python or Node.js project.
3.  Start coding! DARTX will activate automatically when it's needed.

## Configuration

The extension works out-of-the-box with no configuration needed. However, you can customize behavior with VS Code settings:

```json
{
  // Ask for confirmation before installing a missing dependency.
  "dartx.confirmBeforeInstall": false,

  // Notification verbosity level: "detailed", "minimal", or "silent".
  "dartx.notifications": "detailed",

  // Automatically install missing dependencies when detected (requires one-time approval).
  "dartx.autoInstall": false
}
```

## How It Works

### Architecture

1. **Terminal Monitoring** - Listens to terminal output for error patterns
2. **Language Detection** - Identifies project type (Python/Node.js)
3. **Error Analysis** - Uses regex patterns to detect dependency issues
4. **Package Extraction** - Extracts package name from error message
5. **Command Generation** - Generates appropriate install commands
6. **UI Display** - Shows issues in a beautiful webview panel
7. **Safe Installation** - Executes commands with safety validation

### Error Detection Flow

```
Terminal Output
    ↓
[Terminal Monitor]
    ↓
[Error Analyzer] → Pattern Matching
    ↓
[Language Detector] → Language Detection
    ↓
[Dependency Parser] → Check if package exists
    ↓
[Issue Created] → Confidence Scoring
    ↓
[Webview Display] → Show UI Panel
    ↓
[Command Generator] → Generate install command
    ↓
[User Action] → Install or Copy Command
```

## Type System

The extension uses strict TypeScript typing for reliability:

```typescript
// Core types (see types/types.ts)
- SupportedLanguage enum (Python, NodeJS)
- IssueType enum (Missing, Conflict, Environment, NonDependency)
- DependencyIssue interface
- InstallCommand interface
- AnalysisResult interface
```

## Safety

The extension implements multiple safety layers:

✅ **Pattern Matching Only** - Doesn't execute unknown commands  
✅ **Command Validation** - Checks for injection attempts  
✅ **Confidence Scoring** - Only acts on high-confidence detections  
✅ **User Approval** - Requires explicit approval before installation  
✅ **Terminal Execution** - Runs commands visibly in user's terminal  

## Limitations

- Requires terminal output to contain error message (doesn't intercept VS Code's run output yet)
- Supports Python and Node.js (other languages in roadmap)
- Confidence scoring based on pattern matching (not AST analysis)
- Limited to common error patterns

## Troubleshooting

### Extension not detecting errors?

1. Make sure error is printed to terminal
2. Check that error message matches known patterns
3. Open Command Palette and run "Smart Dependency Assistant: Check Terminal"
4. Enable debug logs: `"smartDependencyAssistant.debug": true`

### Installation not working?

1. Verify package name is correct
2. Check you have internet connection
3. Try copying command and running manually
4. Check pip/npm installation locally

### Panel not showing?

1. Click on "Smart Dependency Panel" in the Activity Bar
2. Press `Ctrl+Shift+P` and search "Smart Dependency Assistant"
3. Reload VS Code window (F1 → Developer: Reload Window)

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

### Adding Support for New Languages

1. Add language to `SupportedLanguage` enum in `types/types.ts`
2. Add error patterns to `errorAnalyzer.ts`
3. Add install command logic to `installCommandGenerator.ts`
4. Update documentation

## Performance

- **Memory**: ~15-20MB base + dependencies
- **CPU**: Minimal impact (only analyzes terminal output when changed)
- **Startup**: <1 second extension activation

## License

MIT © 2024 Suravi R

## Support

- 📖 [Full Documentation](./docs)
- 🐛 [Report Issues](https://github.com/yourusername/smart-dependency-assistant/issues)
- 💬 [Discussions](https://github.com/yourusername/smart-dependency-assistant/discussions)

---

**Happy coding! Let DARTX handle your dependency issues!** 📦🚀

*Built with ❤️ by Suravi R*
