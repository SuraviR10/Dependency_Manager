/**
 * Terminal Monitor
 * Monitors VS Code terminal output for error patterns
 * Captures and analyzes terminal events
 */

import * as vscode from 'vscode';
import { ErrorAnalyzer } from '../analyzer/errorAnalyzer';

export class TerminalMonitor {
  private terminals: Map<vscode.Terminal, string> = new Map(); // terminal -> accumulated output
  private subscriptions: vscode.Disposable[] = [];
  private errorAnalyzer: ErrorAnalyzer;
  private maxBufferSize = 5000; // Keep last 5000 chars per terminal
  private onErrorDetected: ((output: string) => void) | null = null;

  constructor(errorAnalyzer: ErrorAnalyzer) {
    this.errorAnalyzer = errorAnalyzer;
  }

  /**
   * Start monitoring all terminals
   */
  public startMonitoring(): void {
    // Monitor existing terminals
    for (const terminal of vscode.window.terminals) {
      this.attachToTerminal(terminal);
    }

    // Monitor new terminal creation
    this.subscriptions.push(
      vscode.window.onDidOpenTerminal((terminal) => {
        this.attachToTerminal(terminal);
      }),
      vscode.window.onDidCloseTerminal((terminal) => {
        this.detachFromTerminal(terminal);
      })
    );

    console.log('[TerminalMonitor] Started monitoring terminals');
  }

  /**
   * Stop all monitoring
   */
  public stopMonitoring(): void {
    this.subscriptions.forEach((disposable) => {
      disposable.dispose();
    });
    this.subscriptions = [];
    this.terminals.clear();
    console.log('[TerminalMonitor] Stopped monitoring terminals');
  }

  /**
   * Attach to a specific terminal
   */
  private attachToTerminal(terminal: vscode.Terminal): void {
    if (this.terminals.has(terminal)) {
      return; // Already attached
    }

    this.terminals.set(terminal, '');
    console.log(`[TerminalMonitor] Attached to terminal: ${terminal.name}`);

    // Note: VS Code doesn't provide direct terminal output events
    // We'll use the approach of monitoring via extension commands or polling
    // This is a limitation of the VS Code API
  }

  /**
   * Detach from a terminal
   */
  private detachFromTerminal(terminal: vscode.Terminal): void {
    this.terminals.delete(terminal);
    console.log(`[TerminalMonitor] Detached from terminal: ${terminal.name}`);
  }

  /**
   * Register callback for when error is detected
   */
  public onError(callback: (output: string) => void): void {
    this.onErrorDetected = callback;
  }

  /**
   * Manual method to process terminal output
   * This is called when we detect errors from other sources
   */
  public processOutput(output: string, terminal?: vscode.Terminal): void {
    if (!output || output.length === 0) {
      return;
    }

    // Store in buffer if terminal provided
    if (terminal && this.terminals.has(terminal)) {
      let current = this.terminals.get(terminal) || '';
      current = (current + '\n' + output).slice(-this.maxBufferSize);
      this.terminals.set(terminal, current);
    }

    // Analyze the output
    const analysisResult = this.errorAnalyzer.analyzeError(output);

    if (analysisResult.detected && analysisResult.issue) {
      console.log(`[TerminalMonitor] Error detected: ${analysisResult.issue.packageName}`);

      // Call registered callback
      if (this.onErrorDetected) {
        this.onErrorDetected(output);
      }
    }
  }

  /**
   * Get accumulated output from a terminal
   */
  public getTerminalOutput(terminal: vscode.Terminal): string {
    return this.terminals.get(terminal) || '';
  }

  /**
   * Clear terminal buffer
   */
  public clearTerminalBuffer(terminal: vscode.Terminal): void {
    this.terminals.set(terminal, '');
  }

  /**
   * Get all monitored terminals
   */
  public getMonitoredTerminals(): vscode.Terminal[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Alternative approach: Use debug console to capture output
   * This requires the extension to hook into debug sessions
   */
  public startDebugConsoleMonitoring(): vscode.Disposable {
    // Listen for debug console output
    const debugConsoleListener = vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
      if (event.event === 'output' || event.event === 'stderr' || event.event === 'stdout') {
        const output = event.body?.output || event.body?.text || '';
        this.processOutput(output);
      }
    });

    return debugConsoleListener;
  }

  /**
   * Create a pseudo-terminal to intercept output
   * Advanced feature for more reliable monitoring
   */
  public createIntermediateTerminal(_originalTerminal?: vscode.Terminal): vscode.Terminal {
    const pty: vscode.Pseudoterminal = {
      onDidWrite: new vscode.EventEmitter<string>().event,
      onDidClose: new vscode.EventEmitter<void>().event,
      onDidOverrideDimensions: new vscode.EventEmitter<vscode.TerminalDimensions>().event,

      open: () => {
        console.log('[TerminalMonitor] Pseudo-terminal opened');
      },

      close: () => {
        console.log('[TerminalMonitor] Pseudo-terminal closed');
      },

      handleInput: (_data: string) => {
        // Forward input to original terminal or process
      },

      setDimensions: (_dimensions: vscode.TerminalDimensions) => {
        // Handle dimension changes
      },
    };

    const terminal = vscode.window.createTerminal({
      name: 'Smart Dependency Assistant',
      pty,
    });

    return terminal;
  }
}
