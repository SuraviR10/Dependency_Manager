# Quick Start Guide

Get the Smart Dependency Assistant extension up and running in 5 minutes.

## Prerequisites

- Node.js 18+ ([download](https://nodejs.org))
- npm or yarn
- VS Code 1.85+ ([download](https://code.visualstudio.com))

## Setup (5 minutes)

### 1. Clone/Create Project

```bash
# If you don't have the project yet
mkdir smart-dependency-assistant
cd smart-dependency-assistant
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

### Option 1: Debug Mode (Recommended for Development)

```bash
# In VS Code:
Press F5
```

This will:
1. Compile your code
2. Open a new VS Code window with the extension loaded
3. Enable debugging with breakpoints

### Option 2: Manual Testing

```bash
# In a terminal:
npm run watch
```

Then in VS Code:
- Press `Ctrl+Shift+D` to open Debug view
- Click "Run Extension" (or press F5)

## Testing the Extension

### Run Tests

```bash
npm test
```

### Test a Specific Module

```bash
npm test -- --grep "ErrorAnalyzer"
```

## Development Workflow

### 1. Make Changes

Edit any TypeScript file in `src/`

### 2. Watch for Changes

```bash
npm run watch
```

### 3. Test in Debug Mode

- Press F5 to open debug window
- Changes will auto-reload
- Set breakpoints by clicking line numbers

### 4. View Output

Open the Debug Console to see:
```
✅ Smart Dependency Assistant activated
✅ All modules initialized
[Extension] Processing terminal output...
```

## Quick Test Scenarios

### Test Python Error Detection

1. Press F5 to open debug window
2. Create a test file `test.py`:
```python
import numpy
```

3. Run it in the terminal:
```bash
python test.py
```

4. You should see:
   - Notification about missing dependency
   - Smart Dependency Panel appears
   - Suggests: `pip install numpy`

### Test Node.js Error Detection

1. Create a test `test.js`:
```javascript
const express = require('express');
```

2. Run it:
```bash
node test.js
```

3. You should see the same workflow with `npm install express`

## Troubleshooting

### TypeScript Compilation Errors

```bash
npm run compile
# Check the error messages
# Usually related to tsconfig.json or missing types
```

### Extension Not Activating

- Check `Output` panel (View → Output → select "Smart Dependency Assistant")
- Look for `✅ Smart Dependency Assistant activated` message
- Verify `activationEvents` in `package.json`

### Tests Failing

```bash
npm test
# Shows which test failed
# Check src/test/suite/*.test.ts for details
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run compile` | Compile TypeScript → JavaScript |
| `npm run watch` | Watch files and recompile on changes |
| `npm run esbuild` | Bundle for production |
| `npm run lint` | Check code style |
| `npm test` | Run test suite |
| `npm run vscode:prepublish` | Build for publishing |

## VS Code Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F5` | Start debugging |
| `Ctrl+Shift+D` | Debug view |
| `Ctrl+Shift+Y` | Debug console |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+` | Terminal |
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
