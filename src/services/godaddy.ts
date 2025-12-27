import type { DNSRecord, DNSProvider, DomainInfo, ProviderName } from '../types.js';
import { DNSProviderError } from '../types.js';
import { getGoDaddyConfig } from '../config.js';

const API_BASE_PROD = 'https://api.godaddy.com/v1';
const API_BASE_OTE = 'https://api.ote-godaddy.com/v1';

export class GoDaddyService implements DNSProvider {
  readonly name: ProviderName = 'godaddy';
  private apiKey: string;
  private apiSecret: string;
  private apiBase: string;

  constructor() {
    const config = getGoDaddyConfig();
    if (!config) {
      throw new DNSProviderError(
        'godaddy',
        'AUTH_ERROR',
        'GoDaddy not configured. Add API credentials in settings.',
        'Get API keys from https://developer.godaddy.com/keys'
      );
    }
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.apiBase = config.environment === 'ote' ? API_BASE_OTE : API_BASE_PROD;
  }

  private get headers() {
    return {
      Authorization: `sso-key ${this.apiKey}:${this.apiSecret}`,
      'Content-Type': 'application/json',
    };
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isRetriable = error instanceof DNSProviderError && error.retriable;
        if (isRetriable && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unexpected: retry loop completed without return or throw');
  }

  private handleApiError(status: number, context: string): never {
    switch (status) {
      case 401:
        throw new DNSProviderError(
          'godaddy',
          'AUTH_ERROR',
          'Invalid API credentials',
          'Check your API key and secret at developer.godaddy.com',
          false
        );
      case 403:
        throw new DNSProviderError(
          'godaddy',
          'AUTH_ERROR',
          'Access denied. Account may need 10+ domains for API access.',
          'GoDaddy requires 10+ domains for API access. Consider using Cloudflare instead.',
          false
        );
      case 404:
        throw new DNSProviderError(
          'godaddy',
          'DOMAIN_NOT_FOUND',
          `Domain not found in your GoDaddy account`,
          'Verify the domain is registered and active in your GoDaddy account',
          false
        );
      case 422:
        throw new DNSProviderError(
          'godaddy',
          'VALIDATION_ERROR',
          `Invalid request: ${context}`,
          'Check that the domain is not locked or has pending transfers',
          false
        );
      case 429:
        throw new DNSProviderError(
          'godaddy',
          'RATE_LIMITED',
          'Rate limited by GoDaddy API',
          'Wait a moment and try again',
          true
        );
      default:
        throw new DNSProviderError(
          'godaddy',
          'NETWORK_ERROR',
          `GoDaddy API error: ${status} - ${context}`,
          undefined,
          status >= 500
        );
    }
  }

  async listDomains(): Promise<DomainInfo[]> {
    return this.withRetry(async () => {
      const res = await fetch(`${this.apiBase}/domains`, { headers: this.headers });
      if (!res.ok) this.handleApiError(res.status, 'listDomains');
      return res.json() as Promise<DomainInfo[]>;
    });
  }

  async getDNSRecords(domain: string): Promise<DNSRecord[]> {
    return this.withRetry(async () => {
      const res = await fetch(`${this.apiBase}/domains/${domain}/records`, {
        headers: this.headers,
      });
      if (!res.ok) this.handleApiError(res.status, `getDNSRecords(${domain})`);
      return res.json() as Promise<DNSRecord[]>;
    });
  }

  async setGitHubPagesRecords(domain: string, githubUser: string): Promise<void> {
    await this.withRetry(async () => {
      const aRecords = [
        { data: '185.199.108.153', ttl: 600 },
        { data: '185.199.109.153', ttl: 600 },
        { data: '185.199.110.153', ttl: 600 },
        { data: '185.199.111.153', ttl: 600 },
      ];

      const aRes = await fetch(`${this.apiBase}/domains/${domain}/records/A/@`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(aRecords),
      });
      if (!aRes.ok) this.handleApiError(aRes.status, 'setARecords');

      const cnameRes = await fetch(`${this.apiBase}/domains/${domain}/records/CNAME/www`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify([{ data: `${githubUser}.github.io`, ttl: 600 }]),
      });
      if (!cnameRes.ok) this.handleApiError(cnameRes.status, 'setCNAME');
    });
  }

  async verifyDomain(domain: string): Promise<boolean> {
    try {
      const domains = await this.listDomains();
      return domains.some((d) => d.domain === domain && d.status === 'ACTIVE');
    } catch {
      return false;
    }
  }
}
