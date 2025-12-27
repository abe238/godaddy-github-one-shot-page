import type { DNSRecord, DNSProvider, DomainInfo, ProviderName } from '../types.js';
import { DNSProviderError } from '../types.js';
import { getCloudflareConfig } from '../config.js';

const API_BASE = 'https://api.cloudflare.com/client/v4';

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

interface CloudflareDNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
}

interface CloudflareResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
  result_info?: { page: number; per_page: number; total_pages: number; count: number };
}

export class CloudflareService implements DNSProvider {
  readonly name: ProviderName = 'cloudflare';
  private apiToken: string;
  private zoneCache = new Map<string, string>();

  constructor() {
    const config = getCloudflareConfig();
    if (!config) {
      throw new DNSProviderError(
        'cloudflare',
        'AUTH_ERROR',
        'Cloudflare not configured. Add API token in settings.',
        'Get API token from https://dash.cloudflare.com/profile/api-tokens'
      );
    }
    this.apiToken = config.apiToken;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
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

  private handleApiError(errors: Array<{ code: number; message: string }>, context: string): never {
    const error = errors[0] || { code: 0, message: 'Unknown error' };

    if (error.code === 6003 || error.code === 9109) {
      throw new DNSProviderError(
        'cloudflare',
        'AUTH_ERROR',
        'Invalid API token',
        'Check your API token at dash.cloudflare.com/profile/api-tokens',
        false
      );
    }

    if (error.code === 1001 || error.code === 1049) {
      throw new DNSProviderError(
        'cloudflare',
        'DOMAIN_NOT_FOUND',
        'Zone not found',
        'Verify the domain is added to your Cloudflare account',
        false
      );
    }

    if (error.code === 10000) {
      throw new DNSProviderError(
        'cloudflare',
        'RATE_LIMITED',
        'Rate limited by Cloudflare API',
        'Wait a moment and try again',
        true
      );
    }

    throw new DNSProviderError(
      'cloudflare',
      'NETWORK_ERROR',
      `Cloudflare API error: ${error.message} (${error.code}) - ${context}`,
      undefined,
      false
    );
  }

  async getZoneId(domain: string): Promise<string> {
    if (this.zoneCache.has(domain)) {
      return this.zoneCache.get(domain)!;
    }

    return this.withRetry(async () => {
      const res = await fetch(`${API_BASE}/zones?name=${domain}`, {
        headers: this.headers,
      });
      const data = await res.json() as CloudflareResponse<CloudflareZone[]>;

      if (!data.success) {
        this.handleApiError(data.errors, `getZoneId(${domain})`);
      }

      if (!data.result?.[0]?.id) {
        throw new DNSProviderError(
          'cloudflare',
          'DOMAIN_NOT_FOUND',
          `Domain ${domain} not found in Cloudflare`,
          'Add this domain to your Cloudflare account first',
          false
        );
      }

      const zoneId = data.result[0].id;
      this.zoneCache.set(domain, zoneId);
      return zoneId;
    });
  }

  async listDomains(): Promise<DomainInfo[]> {
    return this.withRetry(async () => {
      const allZones: CloudflareZone[] = [];
      let page = 1;

      while (true) {
        const res = await fetch(`${API_BASE}/zones?page=${page}&per_page=50`, {
          headers: this.headers,
        });
        const data = await res.json() as CloudflareResponse<CloudflareZone[]>;

        if (!data.success) {
          this.handleApiError(data.errors, 'listDomains');
        }

        allZones.push(...data.result);

        if (!data.result_info || page >= data.result_info.total_pages) {
          break;
        }
        page++;
      }

      return allZones.map(zone => ({
        domain: zone.name,
        status: zone.status.toUpperCase(),
      }));
    });
  }

  async getDNSRecords(domain: string): Promise<DNSRecord[]> {
    const zoneId = await this.getZoneId(domain);

    return this.withRetry(async () => {
      const res = await fetch(`${API_BASE}/zones/${zoneId}/dns_records`, {
        headers: this.headers,
      });
      const data = await res.json() as CloudflareResponse<CloudflareDNSRecord[]>;

      if (!data.success) {
        this.handleApiError(data.errors, `getDNSRecords(${domain})`);
      }

      return data.result
        .filter(r => ['A', 'CNAME', 'TXT'].includes(r.type))
        .map(r => ({
          type: r.type as 'A' | 'CNAME' | 'TXT',
          name: r.name === domain ? '@' : r.name.replace(`.${domain}`, ''),
          data: r.content,
          ttl: r.ttl,
        }));
    });
  }

  async setGitHubPagesRecords(domain: string, githubUser: string): Promise<void> {
    const zoneId = await this.getZoneId(domain);

    await this.withRetry(async () => {
      const existingRes = await fetch(`${API_BASE}/zones/${zoneId}/dns_records?type=A,CNAME`, {
        headers: this.headers,
      });
      const existingData = await existingRes.json() as CloudflareResponse<CloudflareDNSRecord[]>;

      if (!existingData.success) {
        this.handleApiError(existingData.errors, 'fetchExistingRecords');
      }

      const toDelete = existingData.result.filter(r =>
        (r.type === 'A' && r.name === domain) ||
        (r.type === 'CNAME' && r.name === `www.${domain}`)
      );

      for (const record of toDelete) {
        const delRes = await fetch(`${API_BASE}/zones/${zoneId}/dns_records/${record.id}`, {
          method: 'DELETE',
          headers: this.headers,
        });
        if (!delRes.ok) {
          const delData = await delRes.json() as CloudflareResponse<unknown>;
          if (!delData.success) {
            this.handleApiError(delData.errors, `deleteRecord(${record.id})`);
          }
        }
      }

      const githubIPs = [
        '185.199.108.153',
        '185.199.109.153',
        '185.199.110.153',
        '185.199.111.153',
      ];

      for (const ip of githubIPs) {
        const createRes = await fetch(`${API_BASE}/zones/${zoneId}/dns_records`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            type: 'A',
            name: '@',
            content: ip,
            ttl: 3600,
            proxied: false,
          }),
        });
        const createData = await createRes.json() as CloudflareResponse<CloudflareDNSRecord>;
        if (!createData.success) {
          this.handleApiError(createData.errors, `createARecord(${ip})`);
        }
      }

      const cnameRes = await fetch(`${API_BASE}/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          type: 'CNAME',
          name: 'www',
          content: `${githubUser}.github.io`,
          ttl: 3600,
          proxied: false,
        }),
      });
      const cnameData = await cnameRes.json() as CloudflareResponse<CloudflareDNSRecord>;
      if (!cnameData.success) {
        this.handleApiError(cnameData.errors, 'createCNAME');
      }
    });
  }

  async verifyDomain(domain: string): Promise<boolean> {
    try {
      const domains = await this.listDomains();
      return domains.some(d => d.domain === domain && d.status === 'ACTIVE');
    } catch {
      return false;
    }
  }
}
