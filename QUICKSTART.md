<p align="center">
  <img src="media/icon.png" alt="DARTX Logo" width="128"/>
</p>

# Quick Start Guide

Get the DARTX extension up and running in 5 minutes.

## Prerequisites

- Node.js 18+ ([download](https://nodejs.org))
- npm or yarn
- VS Code 1.85+ ([download](https://code.visualstudio.com))

## Setup (5 minutes)

### 1. Clone/Create Project

```bash
# If you don't have the project yet
mkdir dartx
cd dartx
git clone <repository-url> .
# or copy the files to this directory
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages including TypeScript, ESLint, and test runners.

### 3. Compile TypeScript

```bash
npm run compile
```

This compiles all TypeScript files to JavaScript in the `out/` directory.

## Running the Extension

### Option 1: Debug Mode (Recommended for Development) ⭐

This is the easiest way to test the extension in a separate VS Code window:

**Step 1**: Open the Dependency project folder in VS Code
```bash
code ./Dependency
```

**Step 2**: Press `F5` (or Ctrl+Shift+D → Click "Run Extension")

This will:
- Compile the TypeScript code automatically
- Open a new VS Code window with the extension loaded
- Enable breakpoint debugging
- Show console output from the extension

**Step 3**: Test the extension in the debug window:
- Open a Python/JavaScript file
- Write code with missing imports
- Watch the extension detect issues
- Check the "Dependency Activity" panel in the sidebar

**Step 4**: Stop debugging by closing the debug window

### Option 2: Watch Mode (For Continuous Development)

If you want to make changes and test them quickly:

```bash
npm run watch
```

Then press F5 to open the debug window. The extension will automatically reload when you save files.

### Option 3: Package & Install Locally

To test the extension in your main VS Code:

```bash
npm run esbuild
# or for production build:
npm run vscode:prepublish
```

Then:
1. Open VS Code Extensions
2. Click three dots → "Install from VSIX..."
3. Navigate to `out/extension.js`
4. Install and test

## Testing the Activity Panel

When you run the extension (F5), you'll see a new sidebar panel:

**In the Debug Window:**
1. Open the Explorer view (or Activity Bar)
2. Look for **"Dependency Activity"** panel at the bottom
3. You should see:
   - 📊 Summary (commands, dependencies installed, errors fixed, storage used)
   - 🏥 Project Health (status indicator with metrics)
   - 📅 Activity Timeline (real-time activity log with timestamps)

**Trigger Activity:**
- Write code with missing imports → See "Error Detected" activity
- Watch auto-install happen → See "Dependency Installed" activity
- See all commands in real-time

## Apply Extension to Your Other Projects

### Method 1: Quick Test (Using Current Build)

```bash
# In your other project folder:
cd /path/to/other/project

# Copy the extension files
cp -r /path/to/Dependency/out .vscode/extension

# Create a symlink (advanced)
ln -s /path/to/Dependency .vscode/extensions/smart-dependency-assistant
```

### Method 2: Install via VSIX (Recommended)

**Step 1**: Build the extension as VSIX
```bash
cd /path/to/Dependency
npm run vscode:prepublish
```

**Step 2**: In VS Code
- Go to Extensions (Ctrl+Shift+X)
- Click **View** → **Command Palette** → "Install from VSIX"
- Select the `.vsix` file created in the `out/` folder

**Step 3**: The extension is now installed globally and works on any project

### Method 3: Clone & Debug Multiple Projects

Create a setup script in each project:

```bash
#!/bin/bash
# In each project folder, create .vscode/settings.json
cat > .vscode/settings.json << 'EOF'
{
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "javascript.validate.enable": true
}
EOF

# Then open debug mode pointing to the main extension:
code . --extensionDir /path/to/Dependency/out
```

## Step-by-Step: Running & Testing on New Project

### Example: Test on a Python Project

```bash
# 1. Create test project
mkdir test-python-project
cd test-python-project

# 2. Create test file
cat > main.py << 'EOF'
import pandas
import numpy

df = pandas.DataFrame()
print(df)
EOF

# 3. Open in VS Code with the extension
code . --extensionDir /path/to/Dependency/out
```

**Expected Result:**
- Panel shows "Smart Dependency Assistant"
- "Dependency Activity" shows activity timeline
- Missing imports detected for pandas and numpy
- Extension auto-installs or suggests installation

### Example: Test on a Node.js Project

```bash
# 1. Create test project
mkdir test-node-project
cd test-node-project
npm init -y

# 2. Create test file
cat > app.js << 'EOF'
const express = require('express');
const axios = require('axios');

const app = express();
app.listen(3000);
EOF

# 3. Open in VS Code with extension
code . --extensionDir /path/to/Dependency/out
```

**Expected Result:**
- Activity panel shows real-time dependency detection
- Missing packages (express, axios) are detected
- Commands appear in activity timeline

## Full Development Loop

### For the Main Dependency Project:
```bash
# Terminal 1: Watch for changes
npm run watch

# Terminal 2: Run tests
npm test

# Then press F5 in VS Code to debug
```

### For Testing on Other Projects:
1. Make changes to extension code
2. Changes auto-compile (watch mode)
3. Debug window auto-reloads
4. Test in debug window immediately
5. No need to rebuild or reinstall each time

## Verify Everything Works

### Pre-Flight Checklist ✅

Before running the extension, verify:

```bash
# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run compile

# 3. Run tests (optional but recommended)
npm test
```

### First Run Verification

When you press **F5** and the debug window opens:

- [ ] Extension activates (see "✅ Smart Dependency Assistant activated" in console)
- [ ] "Smart Dependency Assistant" panel appears in Explorer
- [ ] "Dependency Activity" panel appears below it
- [ ] Activity panel shows: 📊 Summary, 🏥 Project Health, 📅 Activity Timeline
- [ ] Initial startup activity logged ("🚀 Smart Dependency Assistant Ready")

### Quick Test in Debug Window

1. **Python Test**:
   ```python
   import pandas  # This package doesn't exist
   ```
   Expected: Extension detects missing import, shows in Activity panel

2. **JavaScript Test**:
   ```javascript
   const express = require('express');  // Missing
   ```
   Expected: Extension detects and logs in Activity panel

3. **Check Activity Panel**:
   - Should show timeline of detected errors
   - Should show command execution attempts
   - Should display project health status

## Development Workflow

### Make Changes & Test Immediately

```bash
# Terminal 1: Compile and watch for changes
npm run watch

# Terminal 2: Run tests continuously
npm test

# VS Code: Press F5 to start debug mode
# Changes auto-reload in debug window!
```

### Debugging Tips

- Set breakpoints by clicking line numbers in VS Code editor
- Open Debug Console (Ctrl+Shift+Y) to see logs
- Press F10 to step over, F11 to step into
- View variables in the Variables panel while paused

### View Extension Logs

In the debug window:
1. Open Output panel (View → Output)
2. Select "Smart Dependency Assistant" from dropdown
3. See all console.log() output from the extension

## Testing on Different Projects

### Quick Multi-Project Testing

```bash
# Terminal 1: In Dependency folder, watch for changes
cd ~/Dependency
npm run watch

# Terminal 2: Test on another project with debug
cd ~/MyOtherProject
code . --extensionDir ~/Dependency/out
```

### Share Extension with Team

After testing, package it:

```bash
# In Dependency folder
npm run vscode:prepublish

# Creates: Dependency.vsix (can be shared)
# Install in another VS Code with:
# Extensions → Install from VSIX
```

## Troubleshooting

### TypeScript Compilation Errors

```bash
npm run compile
# Check error messages - usually tsconfig.json issues
```

### Extension Not Activating

- Check Output panel for "✅ Smart Dependency Assistant activated"
- Verify `activationEvents` in `package.json` includes `onStartupFinished`
- Try pressing Ctrl+Shift+P and running "Developer: Reload Window"

### Activity Panel Not Showing

- Ensure debug window opened successfully (F5)
- Check that `smartActivityPanel` is in package.json `views.explorer`
- Clear VS Code cache: `~/.config/Code/Backups`

### Tests Failing

```bash
npm test
# Shows which test failed with stack trace
# Check src/test/suite/*.test.ts
```

## Common Commands Reference

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run compile` | Compile TypeScript → JavaScript |
| `npm run watch` | Auto-compile on file changes |
| `npm run esbuild` | Bundle for development |
| `npm run vscode:prepublish` | Build for production/publishing |
| `npm run lint` | Check code style with ESLint |
| `npm test` | Run all tests |
| `npm test -- --grep "Pattern"` | Run specific test |

## VS Code Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F5` | Start/stop debugging |
| `Ctrl+Shift+D` | Open Debug panel |
| `Ctrl+Shift+Y` | Open Debug console (see logs) |
| `F10` | Step over |
| `F11` | Step into |
| `Shift+F11` | Step out |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+` ` | Toggle integrated terminal |

## Next Steps

1. ✅ Run `npm install` and `npm run compile`
2. ✅ Press F5 to open debug window
3. ✅ Test in the debug window with Python/JavaScript code
4. ✅ Check "Dependency Activity" panel for real-time updates
5. ✅ Make changes to code and see them reload automatically
6. ✅ Test on other projects using VSIX or --extensionDir flag
7. ✅ Share feedback and iterate!
| `Ctrl+H` | Find and replace |

## Project Structure

```
smart-dependency-assistant/
├── src/
│   ├── extension.ts              ← Main entry point
│   ├── analyzer/                 ← Error detection
│   ├── commands/                 ← Command handling
│   ├── terminal/                 ← Terminal monitoring
│   ├── ui/                       ← Webview UI
│   ├── types/                    ← Type definitions
│   └── utils/                    ← Helper functions
├── out/                          ← Compiled JavaScript
├── package.json                  ← Dependencies & scripts
├── tsconfig.json                 ← TypeScript config
├── README.md                     ← User documentation
├── DEVELOPMENT.md                ← Developer guide
└── QUICKSTART.md                 ← This file
```

## Next Steps

1. **Read DEVELOPMENT.md** for architecture overview
2. **Explore src/extension.ts** to understand the flow
3. **Add error patterns** for new languages
4. **Write tests** for new features
5. **Check the README.md** for user-facing documentation

## Resources

- **VS Code API Docs**: https://code.visualstudio.com/api
- **TypeScript Docs**: https://www.typescriptlang.org
- **Extension Examples**: https://github.com/microsoft/vscode-extension-samples

## Getting Help

### Debug Checklist

- [ ] Node.js 18+ installed? (`node --version`)
- [ ] Dependencies installed? (`npm install`)
- [ ] Code compiled? (`npm run compile`)
- [ ] No TypeScript errors? (`npm run lint`)
- [ ] Tests passing? (`npm test`)

### Common Issues & Fixes

**Problem**: `Cannot find module 'vscode'`
```bash
npm install
npm run compile
```

**Problem**: Extension loads but doesn't work
```bash
# Check debug output
# Look for error messages in Output panel
# Enable debug logging in extension.ts
```

**Problem**: Tests fail after changes
```bash
npm run compile
npm test
```

## Tips for Development

1. **Use VS Code's built-in debug features**
   - Set breakpoints by clicking line numbers
   - Inspect variables in Debug Console
   - Watch expressions for monitoring values

2. **Check the Output panel**
   - View → Output → Smart Dependency Assistant
   - Shows all console.log() calls from extension

3. **Use the Debug Console**
   - Type commands to inspect state
   - Example: `Object.keys(errorAnalyzer)`

4. **Reload extension frequently**
   - Press Ctrl+R in debug window to reload
   - Or close and re-open debug window (F5)

5. **Keep tests updated**
   - Write tests before implementing features
   - Ensures code quality and prevents regressions

---

**You're all set!** 🚀

Now start developing. Happy coding!
