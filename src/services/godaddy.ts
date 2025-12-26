import type { DNSRecord } from '../types.js';

const API_BASE = 'https://api.godaddy.com/v1';

export class GoDaddyService {
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    const key = process.env.GODADDY_API_KEY;
    const secret = process.env.GODADDY_API_SECRET;
    if (!key || !secret) {
      throw new Error('GODADDY_API_KEY and GODADDY_API_SECRET required in .env');
    }
    this.apiKey = key;
    this.apiSecret = secret;
  }

  private get headers() {
    return {
      Authorization: `sso-key ${this.apiKey}:${this.apiSecret}`,
      'Content-Type': 'application/json',
    };
  }

  async listDomains(): Promise<Array<{ domain: string; status: string }>> {
    const res = await fetch(`${API_BASE}/domains`, { headers: this.headers });
    if (!res.ok) throw new Error(`GoDaddy API error: ${res.status}`);
    return res.json();
  }

  async getDNSRecords(domain: string): Promise<DNSRecord[]> {
    const res = await fetch(`${API_BASE}/domains/${domain}/records`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`GoDaddy API error: ${res.status}`);
    return res.json();
  }

  async setGitHubPagesRecords(domain: string, githubUser: string): Promise<void> {
    const aRecords = [
      { data: '185.199.108.153', ttl: 600 },
      { data: '185.199.109.153', ttl: 600 },
      { data: '185.199.110.153', ttl: 600 },
      { data: '185.199.111.153', ttl: 600 },
    ];

    const aRes = await fetch(`${API_BASE}/domains/${domain}/records/A/@`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(aRecords),
    });
    if (!aRes.ok) throw new Error(`Failed to set A records: ${aRes.status}`);

    const cnameRes = await fetch(`${API_BASE}/domains/${domain}/records/CNAME/www`, {
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
