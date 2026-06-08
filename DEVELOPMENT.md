<p align="center">
  <img src="media/icon.png" alt="DARTX Logo" width="128"/>
</p>

# DARTX — Development Guide

A comprehensive guide to understanding, modifying, and extending the DARTX extension.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module Breakdown](#module-breakdown)
3. [Data Flow](#data-flow)
4. [Design Patterns](#design-patterns)
5. [Adding Features](#adding-features)
6. [Testing Guide](#testing-guide)
7. [Debugging](#debugging)
8. [Performance](#performance)

---

## Architecture Overview

### High-Level Design

The extension follows a **modular, layered architecture**:

```
┌─────────────────────────────────────┐
│         VS Code Extension API       │
├─────────────────────────────────────┤
│         Extension.ts (Orchestrator) │
├──────────────┬──────────────┬───────┤
│   Terminal   │   Commands   │   UI  │
│   Monitor    │   Registry   │ Panels│
├──────────────┼──────────────┼───────┤
│   Error      │   Command    │Webview│
│   Analyzer   │   Generator  │Provide│
├──────────────┼──────────────┴───────┤
│  Language    │  Dependency   Helpers│
│  Detector    │  Parser              │
└──────────────┴──────────────────────┘
```

### Core Principles

**1. Separation of Concerns**
- Each module has a single responsibility
- Modules don't directly call each other; coordination happens through `extension.ts`

**2. Type Safety**
- Strict TypeScript with `noImplicitAny: true`
- All interfaces defined in `types.ts`
- No `any` types used

**3. Extensibility**
- Easy to add new error patterns
- Easy to add support for new languages
- Plugin-style architecture

**4. Safety First**
- No automatic command execution
- Command validation before running
- Confidence scoring for high-precision detection

---

## Module Breakdown

### 1. **extension.ts** (Orchestrator)

**Responsibility**: Central coordinator that ties all modules together

**Key Functions**:
- `activate()` - Extension initialization
- `setupTerminalListener()` - Terminal monitoring setup
- `setupCommandHandlers()` - Command registration
- `setupWebviewHandlers()` - UI event handling
- `processTerminalOutput()` - Error analysis pipeline
- `handleInstallCommand()` - Installation execution

**Flow**:
```
Extension activated → Initialize modules → Register listeners → Start monitoring
```

### 2. **analyzer/errorAnalyzer.ts**

**Responsibility**: Detect and analyze dependency-related errors

**Key Classes**:
```typescript
class ErrorAnalyzer {
  analyzeError(errorText: string): AnalysisResult
  isProbablyDependencyRelated(errorText: string): boolean
  private initializeErrorPatterns(): void
  private createIssueFromPattern(): DependencyIssue
}
```

**How It Works**:
1. Takes raw error text from terminal
2. Tries to match against predefined regex patterns
3. Extracts package name and issue type
4. Calculates confidence score
5. Returns `DependencyIssue` object

**Pattern Structure**:
```typescript
interface ErrorPattern {
  language: SupportedLanguage;          // Python, NodeJS
  pattern: RegExp;                      // Regex to match
  issueType: IssueType;                 // Type of issue
  packageExtractGroup?: number;         // Regex group for package name
  extractor?: (match) => object;        // Custom extractor function
}
```

**Example Pattern** (Python ModuleNotFoundError):
```typescript
{
  language: SupportedLanguage.Python,
  pattern: /ModuleNotFoundError:\s*No module named ['"`]?([a-zA-Z0-9_\-\.]+)/i,
  issueType: IssueType.MissingDependency,
  packageExtractGroup: 1,
}
```

**Confidence Calculation**:
- Pattern matched: 40 points
- Valid package name: 35 points
- Package in config: 25 points
- **Total**: 0-100 score

### 3. **analyzer/languageDetector.ts**

**Responsibility**: Detect programming language of the project

**Detection Strategy** (in order):
1. Check for config files:
   - `package.json` → Node.js
   - `requirements.txt` → Python
   - `setup.py` → Python
   - `pyproject.toml` → Python
   - `Pipfile` → Python

2. Fallback: Check file extensions
   - Count `.py` vs `.js`/`.ts` files
   - Return most common

3. Default: `SupportedLanguage.Unknown`

**Caching**: Results cached after first detection

### 4. **analyzer/dependencyParser.ts**

**Responsibility**: Extract installed dependencies from config files

**Supported Formats**:
- **Node.js**: `package.json` (dependencies + devDependencies)
- **Python**: `requirements.txt` (simple format: `package==version`)

**Key Methods**:
```typescript
parseDependencies(language): ParsedDependencies
isPackageInstalled(packageName, language): boolean
getPackageVersion(packageName, language): string | null
getInstalledPackageCount(language): number
```

**Why It Matters**: 
- Helps confirm if issue is really a missing dependency
- Improves confidence scoring
- Could be extended for version conflict detection

### 5. **terminal/terminalMonitor.ts**

**Responsibility**: Monitor terminal output for errors

**Features**:
- Tracks multiple terminals simultaneously
- Buffers output (keeps last 5000 chars)
- Supports debug console monitoring
- Creates pseudo-terminals for advanced scenarios

**Limitations**:
- VS Code API doesn't expose terminal output directly
- Currently relies on `processOutput()` being called manually
- Could be improved with custom terminal wrapper

### 6. **commands/installCommandGenerator.ts**

**Responsibility**: Generate platform-aware install commands

**Generates**:
- Primary command (most common)
- Alternative commands (pip3, conda, yarn, etc.)
- Platform-specific variations (Windows: `py` vs `python`)

**Safety**:
```typescript
isCommandSafe(command: string): boolean
// Checks for injection attempts, validates package managers
```

**Example Output**:
```
Primary: pip install numpy
Alternatives:
  - pip3 install numpy
  - python -m pip install numpy
  - conda install numpy
```

### 7. **commands/commandRegistry.ts**

**Responsibility**: Register and manage VS Code commands

**Commands Registered**:
- `dartx.openPanel` - Open the issue panel
- `dartx.installDependency` - Install a package
- `dartx.copyCommand` - Copy command to clipboard

**Execution Methods**:
- `executeInTerminal()` - Sends command to active terminal
- `showInstallConfirmation()` - Shows dialog to user
- `showIssueQuickPick()` - Shows quick-pick menu

### 8. **ui/webviewProvider.ts**

**Responsibility**: Manage webview UI panel

**Features**:
- Beautiful, responsive HTML/CSS/JS UI
- Dark mode support
- Real-time status updates
- Confidence indicators
- Copy-to-clipboard functionality

**HTML Structure**:
```
Issue Header (with severity badge)
├── Explanation Card
├── Error Details Card
├── Installation Command Card
├── Confidence Indicator
├── Status Indicator
├── Action Buttons
└── Language/Time Info
```

**Communication**:
- Webview → Extension: Messages via `vscode.postMessage()`
- Extension → Webview: Messages via `webview.postMessage()`

**Styling**:
- Uses VS Code theme colors (CSS variables)
- Responsive design with flexbox
- Smooth animations and transitions

### 9. **ui/notificationManager.ts**

**Responsibility**: Handle user-facing notifications

**Methods**:
```typescript
showInfo(message): Promise
showWarning(message): Promise
showError(message): Promise
showProgress(title, task): Promise
showStatusMessage(message, duration): void
```

### 10. **utils/helpers.ts**

**Responsibility**: Utility functions used across modules

**Key Functions**:
```typescript
generateId()                           // UUID for issues
isValidPackageName(name)               // Validate package names
extractPackageFromError(error)         // Extract package from error text
normalizePackageName(name, lang)       // Normalize to standard format
calculateConfidence(...)               // Calculate confidence score
sanitizeInput(input)                   // Prevent injection
formatErrorForDisplay(error)           // Truncate and format
getLanguageDisplayName(language)       // Human-readable language names
getPackageManager(language)            // Get package manager for language
```

---

## Data Flow

### Complete Error Detection Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER RUNS CODE IN TERMINAL                              │
│    $ python main.py                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. TERMINAL OUTPUTS ERROR                                  │
│    ModuleNotFoundError: No module named 'numpy'            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ (manual processTerminalOutput() call)
┌─────────────────────────────────────────────────────────────┐
│ 3. ERROR ANALYZER                                          │
│    - Detect language (Python)                              │
│    - Match error pattern                                   │
│    - Extract package: 'numpy'                              │
│    - Calculate confidence: 95%                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. CREATE ISSUE                                            │
│    DependencyIssue {                                       │
│      id: 'abc123',                                         │
│      packageName: 'numpy',                                 │
│      language: Python,                                    │
│      type: MissingDependency,                              │
│      confidence: 95,                                       │
│      ...                                                   │
│    }                                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌─────────┐  ┌──────────┐  ┌─────────┐
    │Notify   │  │Generate  │  │Display  │
    │User     │  │Command   │  │Webview  │
    └────┬────┘  └──────┬───┘  └────┬────┘
         │              │            │
         │        pip install numpy  │
         │                           │
         └───────────────┬───────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
    ┌──────────────┐          ┌──────────────────┐
    │ User copies  │          │ User clicks      │
    │ command      │          │ "Install"        │
    └──────┬───────┘          └────────┬─────────┘
           │                          │
           │                    ▼
           │            ┌──────────────────────┐
           │            │ Execute in terminal  │
           │            │ Track progress       │
           │            │ Show result          │
           │            └──────────────────────┘
           │
           └─── Manual execution by user
```

### State Management

```
┌──────────────────────────────────────┐
│    Current Issue (DependencyIssue)   │
│    Stored in: WebviewProvider        │
│    Updated by: ErrorAnalyzer         │
│    Displayed in: Webview UI          │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Installation Status                  │
│ States: idle | installing | success | error
│ Displayed with progress indicator    │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Terminal Output Buffer               │
│ Stored in: TerminalMonitor           │
│ Capacity: 5000 chars per terminal    │
│ Purpose: Context for analysis        │
└──────────────────────────────────────┘
```

---

## Design Patterns

### 1. **Observer Pattern** (Event Listeners)

```typescript
// Terminal Monitor calls callbacks when errors detected
terminalMonitor.onError((output) => {
  processTerminalOutput(output);
});

// Webview notifies extension of user actions
webviewProvider.onInstall((issue) => {
  handleInstallCommand(issue);
});
```

### 2. **Factory Pattern** (Command Generation)

```typescript
class InstallCommandGenerator {
  generateCommand(issue): InstallCommand {
    switch (issue.language) {
      case Python: return this.generatePythonCommand(...)
      case NodeJS: return this.generateNodeJsCommand(...)
    }
  }
}
```

### 3. **Strategy Pattern** (Language Detection)

```typescript
class LanguageDetector {
  private detectByConfigFile(): SupportedLanguage
  private detectByFileExtension(): SupportedLanguage
  private detectByLanguageMetadata(): SupportedLanguage
  // Tries each strategy in order
}
```

### 4. **Singleton Pattern** (Module Initialization)

```typescript
// In extension.ts
let errorAnalyzer: ErrorAnalyzer;      // Single instance
let commandGenerator: InstallCommandGenerator;

export function activate(context) {
  errorAnalyzer = new ErrorAnalyzer(...);  // Create once
  // ... rest of initialization
}
```

### 5. **Adapter Pattern** (VS Code API Wrapper)

```typescript
class NotificationManager {
  // Adapts VS Code's notification API to our interface
  showInfo(message) { return vscode.window.showInformationMessage(...) }
  showWarning(message) { return vscode.window.showWarningMessage(...) }
}
```

---

## Adding Features

### Adding Support for a New Language

**Steps**:

1. **Add to enum** (`types.ts`):
```typescript
export enum SupportedLanguage {
  Python = 'python',
  NodeJS = 'nodejs',
  Ruby = 'ruby',  // NEW
}
```

2. **Update language detector** (`languageDetector.ts`):
```typescript
private detectByFileExtension(): LanguageDetectionResult {
  // ... existing code ...
  
  for (const file of files) {
    if (file.endsWith('.rb')) {
      rubyCount++;
    }
  }
  
  if (rubyCount > pythonCount && rubyCount > nodeCount) {
    return { language: SupportedLanguage.Ruby, ... };
  }
}
```

3. **Add error patterns** (`errorAnalyzer.ts`):
```typescript
private initializeErrorPatterns(): void {
  // ... existing patterns ...
  
  // Ruby patterns
  this.errorPatterns.push({
    language: SupportedLanguage.Ruby,
    pattern: /cannot load such file -- '([a-zA-Z0-9_\-]+)'/i,
    issueType: IssueType.MissingDependency,
    packageExtractGroup: 1,
  });
}
```

4. **Add command generation** (`installCommandGenerator.ts`):
```typescript
private generateRubyCommand(packageName: string): InstallCommand {
  return {
    language: SupportedLanguage.Ruby,
    packageName,
    command: `gem install ${packageName}`,
    commandDisplay: `gem install ${packageName}`,
    alternatives: [`bundle add ${packageName}`],
  };
}
```

5. **Update case statement**:
```typescript
switch (issue.language) {
  case SupportedLanguage.Ruby:
    return this.generateRubyCommand(packageName);
  // ... other cases ...
}
```

6. **Update dependency parser** (if needed):
```typescript
public parseDependencies(language: SupportedLanguage): ParsedDependencies {
  switch (language) {
    case SupportedLanguage.Ruby:
      return this.parseRubyDependencies();
    // ... other cases ...
  }
}

private parseRubyDependencies(): ParsedDependencies {
  // Parse Gemfile.lock or Gemfile
}
```

7. **Add tests** (`src/test/suite/`):
```typescript
test('Should detect Ruby LoadError', () => {
  const error = "cannot load such file -- 'rails'";
  const result = analyzer.analyzeError(error);
  
  assert.strictEqual(result.issue?.language, SupportedLanguage.Ruby);
});
```

### Adding New Error Patterns

**Example**: Detect a new Python error type

```typescript
// In errorAnalyzer.ts initializeErrorPatterns()

this.errorPatterns.push({
  language: SupportedLanguage.Python,
  pattern: /ImportError:\s*cannot import name ['"`]?([a-zA-Z0-9_\.]+)['"`]?/i,
  issueType: IssueType.MissingDependency,
  packageExtractGroup: 1,
  extractor: (match) => ({
    packageName: match[1],
    message: `Cannot import ${match[1]}`,
  }),
});
```

**Testing the pattern**:

```typescript
test('Should detect Python import error', () => {
  const error = "ImportError: cannot import name 'something'";
  const result = analyzer.analyzeError(error);
  
  assert.strictEqual(result.detected, true);
  assert.strictEqual(result.issue?.packageName, 'something');
});
```

---

## Testing Guide

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

### Test Structure

```
src/test/
├── index.ts                 # Test runner
└── suite/
    ├── errorAnalyzer.test.ts
    ├── languageDetector.test.ts
    ├── installCommandGenerator.test.ts
    └── helpers.test.ts
```

### Writing a New Test

```typescript
import * as assert from 'assert';
import { YourClass } from '../../path/to/class';

suite('YourClass Tests', () => {
  let instance: YourClass;

  setup(() => {
    // Setup before each test
    instance = new YourClass();
  });

  teardown(() => {
    // Cleanup after each test
  });

  test('Should do something', () => {
    const result = instance.method();
    assert.strictEqual(result, expectedValue);
  });

  test('Should handle edge cases', () => {
    assert.throws(() => {
      instance.invalidMethod();
    });
  });
});
```

### Test Coverage Goals

- **Analyzers**: 90%+ (critical path)
- **Generators**: 85%+ (safety critical)
- **UI**: 60%+ (integration tested manually)
- **Helpers**: 95%+ (pure functions)

---

## Debugging

### Debug Mode

```bash
# Start debugging
F5 (in VS Code with extension open)
```

### Debug Configuration

The project includes a `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Extension Debug",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "npm: compile"
    }
  ]
}
```

### Logging

```typescript
// Standard console logging
console.log('[Module] Log message');
console.error('[Module] Error message');

// With context
console.log(`[Extension] Processing: ${packageName} for ${language}`);
```

### Debugging in Extension Host

1. Open extension in debug mode (F5)
2. Set breakpoints in TypeScript files
3. Trigger the error to debug
4. Use Debug Console to inspect variables

### Common Issues

**Issue**: Extension doesn't activate
- Check `activationEvents` in `package.json`
- Ensure `export function activate()` exists in `extension.ts`

**Issue**: Webview not showing
- Check webview view ID matches
- Verify `registerWebviewViewProvider()` called
- Check browser console for errors

**Issue**: Commands not executing
- Verify command ID in `package.json` matches registration
- Check command parameters are passed correctly

---

## Performance

### Optimization Tips

1. **Pattern Matching**:
   - Order patterns by frequency (most common first)
   - Use non-capturing groups `(?:)` where possible
   - Cache compiled regexes

2. **Language Detection**:
   - Results are cached after first detection
   - File system access is kept to minimum
   - Directory traversal limited to 3 levels

3. **Terminal Monitoring**:
   - Output buffer limited to 5000 chars
   - Only processes on demand (not continuously)
   - Disposable listeners cleaned up on deactivation

4. **Memory Management**:
   - Clear buffers when terminals close
   - Dispose event listeners properly
   - Avoid storing large error histories

### Benchmarks

- Language detection: <100ms
- Error analysis: <50ms
- Command generation: <10ms
- Webview render: <200ms

---

## Contributing Guidelines

1. **Code Style**:
   - Follow existing patterns
   - Use meaningful variable names
   - Add JSDoc comments for public methods
   - Max line length: 100 characters

2. **Commits**:
   - Descriptive commit messages
   - Link to issues when applicable
   - Keep commits atomic

3. **Pull Requests**:
   - Update tests for new features
   - Update README if behavior changes
   - Get code review before merge

---

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [VS Code Theme Colors](https://code.visualstudio.com/api/references/theme-color)

---

**Happy Developing! 🚀**
