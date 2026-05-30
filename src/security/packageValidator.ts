/**
 * PackageValidator
 * Verifies package existence on PyPI / npm registry before installation.
 * Prevents executing install commands for non-existent packages.
 */

import * as https from 'https';
import { SupportedLanguage } from '../types/types';

export interface ValidationResult {
  exists: boolean;
  name: string;
  latestVersion?: string;
  error?: string;
}

export class PackageValidator {
  private cache = new Map<string, ValidationResult>();
  private readonly timeoutMs = 5000;

  /**
   * Verify a package exists in the appropriate registry.
   * Results are cached for the session to avoid redundant network calls.
   */
  public async verify(packageName: string, language: SupportedLanguage): Promise<ValidationResult> {
    const cacheKey = `${language}:${packageName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let result: ValidationResult;
    try {
      if (language === SupportedLanguage.Python) {
        result = await this.checkPyPI(packageName);
      } else if (language === SupportedLanguage.NodeJS) {
        result = await this.checkNpm(packageName);
      } else {
        // Unknown language — skip verification, allow install
        result = { exists: true, name: packageName };
      }
    } catch (err) {
      // Network failure — allow install rather than blocking on connectivity issues
      result = {
        exists: true,
        name: packageName,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  private checkPyPI(packageName: string): Promise<ValidationResult> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    return this.fetchJson(url).then(data => {
      const info = data['info'] as Record<string, unknown> | undefined;
      if (info && info['name']) {
        return {
          exists: true,
          name: info['name'] as string,
          latestVersion: info['version'] as string | undefined,
        };
      }
      return { exists: false, name: packageName };
    }).catch(() => ({ exists: false, name: packageName }));
  }

  private checkNpm(packageName: string): Promise<ValidationResult> {
    const encoded = packageName.startsWith('@')
      ? packageName.replace('/', '%2F')
      : encodeURIComponent(packageName);
    const url = `https://registry.npmjs.org/${encoded}`;
    return this.fetchJson(url).then(data => {
      if (data['name']) {
        const distTags = data['dist-tags'] as Record<string, string> | undefined;
        return {
          exists: true,
          name: data['name'] as string,
          latestVersion: distTags?.['latest'],
        };
      }
      return { exists: false, name: packageName };
    }).catch(() => ({ exists: false, name: packageName }));
  }

  private fetchJson(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: this.timeoutMs }, res => {
        if (res.statusCode === 404) {
          reject(new Error('404'));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>);
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
        res.on('error', reject);
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.on('error', reject);
    });
  }

  /** Clear the in-memory cache */
  public clearCache(): void {
    this.cache.clear();
  }
}
