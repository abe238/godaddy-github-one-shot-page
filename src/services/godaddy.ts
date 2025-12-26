import type { DNSRecord } from '../types.js';
import { getGoDaddyConfig } from '../config.js';

const API_BASE_PROD = 'https://api.godaddy.com/v1';
const API_BASE_OTE = 'https://api.ote-godaddy.com/v1';

export class GoDaddyService {
  private apiKey: string;
  private apiSecret: string;
  private apiBase: string;

  constructor() {
    const config = getGoDaddyConfig();
    if (!config) {
      throw new Error('GoDaddy not configured. Add API credentials in settings.');
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

  async listDomains(): Promise<Array<{ domain: string; status: string }>> {
    const res = await fetch(`${this.apiBase}/domains`, { headers: this.headers });
    if (!res.ok) throw new Error(`GoDaddy API error: ${res.status}`);
    return res.json() as Promise<Array<{ domain: string; status: string }>>;
  }

  async getDNSRecords(domain: string): Promise<DNSRecord[]> {
    const res = await fetch(`${this.apiBase}/domains/${domain}/records`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`GoDaddy API error: ${res.status}`);
    return res.json() as Promise<DNSRecord[]>;
  }

  async setGitHubPagesRecords(domain: string, githubUser: string): Promise<void> {
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
    if (!aRes.ok) throw new Error(`Failed to set A records: ${aRes.status}`);

    const cnameRes = await fetch(`${this.apiBase}/domains/${domain}/records/CNAME/www`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify([{ data: `${githubUser}.github.io`, ttl: 600 }]),
    });
    if (!cnameRes.ok) throw new Error(`Failed to set CNAME: ${cnameRes.status}`);
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
