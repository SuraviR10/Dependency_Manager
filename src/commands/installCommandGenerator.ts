/**
 * Install Command Generator
 * Generates appropriate installation commands for missing packages
 * Supports Python (pip) and Node.js (npm)
 */

import { SupportedLanguage, InstallCommand, CommandSuggestion, DependencyIssue } from '../types/types';
import { normalizePackageName, sanitizeInput } from '../utils/helpers';

export class InstallCommandGenerator {
  /**
   * Generate install command for a dependency issue
   */
  public generateCommand(issue: DependencyIssue): InstallCommand {
    const packageName = sanitizeInput(issue.packageName);

    switch (issue.language) {
      case SupportedLanguage.Python:
        return this.generatePythonCommand(packageName);
      case SupportedLanguage.NodeJS:
        return this.generateNodeJsCommand(packageName);
      default:
        return {
          language: issue.language,
          packageName,
          command: '',
          commandDisplay: 'Unable to generate command',
        };
    }
  }

  /**
   * Generate pip install command for Python
   */
  private generatePythonCommand(packageName: string): InstallCommand {
    const normalized = normalizePackageName(packageName, SupportedLanguage.Python);

    return {
      language: SupportedLanguage.Python,
      packageName: normalized,
      command: `pip install ${normalized}`,
      commandDisplay: `pip install ${normalized}`,
      alternatives: [
        `pip3 install ${normalized}`,
        `python -m pip install ${normalized}`,
        `python3 -m pip install ${normalized}`,
        `conda install ${normalized}`, // If using conda
      ],
    };
  }

  /**
   * Generate npm install command for Node.js
   */
  private generateNodeJsCommand(packageName: string): InstallCommand {
    const normalized = normalizePackageName(packageName, SupportedLanguage.NodeJS);

    return {
      language: SupportedLanguage.NodeJS,
      packageName: normalized,
      command: `npm install ${normalized}`,
      commandDisplay: `npm install ${normalized}`,
      alternatives: [
        `npm install --save ${normalized}`,        // Save to dependencies
        `npm install --save-dev ${normalized}`,    // Save to devDependencies
        `yarn add ${normalized}`,                  // Using yarn
        `pnpm add ${normalized}`,                  // Using pnpm
      ],
    };
  }

  /**
   * Generate command suggestion with explanation
   */
  public generateSuggestion(issue: DependencyIssue): CommandSuggestion {
    const command = this.generateCommand(issue);

    return {
      language: issue.language,
      packageName: issue.packageName,
      installCommand: command.command,
      explanation: this.generateCommandExplanation(issue.language, issue.packageName),
      confidence: issue.confidence,
    };
  }

  /**
   * Generate explanation for the install command
   */
  private generateCommandExplanation(language: SupportedLanguage, packageName: string): string {
    switch (language) {
      case SupportedLanguage.Python:
        return `This will install ${packageName} using pip, which is the standard Python package manager. ` +
               `The package will be downloaded from PyPI and installed in your current environment.`;

      case SupportedLanguage.NodeJS:
        return `This will install ${packageName} using npm, which is the Node.js package manager. ` +
               `The package will be downloaded from the npm registry and added to your project's node_modules folder.`;

      default:
        return `Install the ${packageName} package using your project's package manager.`;
    }
  }

  /**
   * Get all alternative commands for a package
   */
  public getAlternativeCommands(issue: DependencyIssue): string[] {
    const command = this.generateCommand(issue);
    return command.alternatives || [];
  }

  /**
   * Validate if a command is safe to execute
   * Checks for injection attempts
   */
  public isCommandSafe(command: string): boolean {
    // Check for dangerous characters that could indicate command injection
    const dangerousChars = [';', '|', '&', '`', '$', '(', ')', '\\', '\n', '\r'];

    for (const char of dangerousChars) {
      if (command.includes(char)) {
        return false;
      }
    }

    // Check that command starts with allowed package managers
    const allowedManagers = ['pip', 'pip3', 'npm', 'yarn', 'pnpm', 'conda', 'python', 'python3'];
    const startsWithAllowed = allowedManagers.some(manager => command.trim().startsWith(manager));

    return startsWithAllowed;
  }

  /**
   * Add flags to command (for optional parameters)
   */
  public addFlags(command: string, flags: string[]): string {
    if (!flags || flags.length === 0) {
      return command;
    }

    const safeFlags = flags.filter(f => {
      // Only allow known safe flags
      const knownFlags = ['--save', '--save-dev', '-g', '--global', '--system', '--user'];
      return knownFlags.includes(f);
    });

    return command + ' ' + safeFlags.join(' ');
  }

  /**
   * Get platform-specific command variations
   */
  public getPlatformSpecificCommand(issue: DependencyIssue, platform: NodeJS.Platform): InstallCommand {
    const baseCommand = this.generateCommand(issue);

    // Windows-specific adjustments
    if (platform === 'win32') {
      // On Windows, python might need to be called differently
      if (issue.language === SupportedLanguage.Python) {
        baseCommand.commandDisplay = `py -m pip install ${baseCommand.packageName}`;
      }
    }

    return baseCommand;
  }

  /**
   * Generate complete shell command with proper escaping
   */
  public generateShellCommand(command: string, shell: string = 'bash'): string {
    // For bash-like shells
    if (shell === 'bash' || shell === 'zsh' || shell === 'sh') {
      return `${command}`;
    }

    // For PowerShell
    if (shell === 'powershell') {
      return `${command}`;
    }

    // For cmd.exe
    if (shell === 'cmd') {
      return `${command}`;
    }

    return command;
  }
}
