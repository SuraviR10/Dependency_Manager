# Changelog

All notable changes to Dependify are documented here.

## [0.1.0] - 2024-01-01

### Added
- Automatic detection of missing Python and Node.js dependencies from source code imports
- Real-time terminal output monitoring for `ModuleNotFoundError` and `Cannot find module` errors
- Language server diagnostic integration (Pylance, TypeScript) for pre-run detection
- One-click package installation via a dedicated Dependify terminal
- Copy-to-clipboard for generated install commands
- Project Health Dashboard with health score, missing/unused package lists
- Activity Timeline panel showing all commands, installs, and detected errors
- Auto virtual environment creation (`python -m venv .venv`) when enabled
- Auto `npm install` when `node_modules` is missing and setting is enabled
- Configurable settings: auto-install, confirm before install, scan delay, notification level, safe mode
- Command injection protection via allowlist-based command validation
- Content Security Policy on all webview panels
- Status bar indicator showing current Dependify state
- Output channel (`Dependify Logs`) for full activity log
