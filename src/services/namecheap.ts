import type { DNSRecord, DNSProvider, DomainInfo, ProviderName } from '../types.js';
import { DNSProviderError } from '../types.js';
import { getNamecheapConfig } from '../config.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const API_BASE = 'https://api.namecheap.com/xml.response';

interface NamecheapHost {
  HostId: string;
  Name: string;
  Type: string;
  Address: string;
  TTL: string;
}

export class NamecheapService implements DNSProvider {
  readonly name: ProviderName = 'namecheap';
  private apiUser: string;
  private apiKey: string;
  private clientIP: string;

  constructor() {
    const config = getNamecheapConfig();
    if (!config) {
      throw new DNSProviderError(
        'namecheap',
        'AUTH_ERROR',
        'Namecheap not configured. Add API credentials in settings.',
        'Enable API access at https://ap.www.namecheap.com/settings/tools/apiaccess/'
      );
    }
    this.apiUser = config.apiUser;
    this.apiKey = config.apiKey;
    this.clientIP = config.clientIP;
  }

  private splitDomain(domain: string): { sld: string; tld: string } {
    const parts = domain.split('.');
    if (parts.length < 2) {
      throw new DNSProviderError(
        'namecheap',
        'VALIDATION_ERROR',
        `Invalid domain format: ${domain}`,
        'Domain must be in format example.com or example.co.uk'
      );
    }

    const knownMultiPartTlds = ['co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp', 'org.uk', 'net.au'];
    const lastTwo = parts.slice(-2).join('.');

    if (knownMultiPartTlds.includes(lastTwo) && parts.length >= 3) {
      return {
        sld: parts.slice(0, -2).join('.'),
        tld: lastTwo,
      };
    }

    return {
      sld: parts.slice(0, -1).join('.'),
      tld: parts[parts.length - 1],
    };
  }

  private buildUrl(command: string, params: Record<string, string> = {}): string {
    const baseParams = {
      ApiUser: this.apiUser,
      ApiKey: this.apiKey,
      UserName: this.apiUser,
      ClientIp: this.clientIP,
      Command: command,
    };
    const allParams = { ...baseParams, ...params };
    const queryString = Object.entries(allParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return `${API_BASE}?${queryString}`;
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

  private parseXmlSimple(xml: string, tag: string): string[] {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi');
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  private parseXmlAttribute(xml: string, tag: string, attr: string): string[] {
    const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`, 'gi');
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  private parseHosts(xml: string): NamecheapHost[] {
    const hosts: NamecheapHost[] = [];
    const hostRegex = /<host[^>]*HostId="([^"]*)"[^>]*Name="([^"]*)"[^>]*Type="([^"]*)"[^>]*Address="([^"]*)"[^>]*TTL="([^"]*)"[^>]*\/>/gi;
    let match;
    while ((match = hostRegex.exec(xml)) !== null) {
      hosts.push({
        HostId: match[1],
        Name: match[2],
        Type: match[3],
        Address: match[4],
        TTL: match[5],
      });
    }
    return hosts;
  }

  private checkApiErrors(xml: string): void {
    if (xml.includes('Status="ERROR"')) {
      const errors = this.parseXmlSimple(xml, 'Error');
      const errorNum = this.parseXmlAttribute(xml, 'Error', 'Number')[0] || '0';
      const errorCode = parseInt(errorNum, 10);

      if (errorCode === 1011150) {
        throw new DNSProviderError(
          'namecheap',
          'AUTH_ERROR',
          'IP address not whitelisted',
          `Add ${this.clientIP} to your Namecheap API whitelist at ap.www.namecheap.com/settings/tools/apiaccess/`,
          false
        );
      }

      if (errorCode === 500000 || errorCode === 500001) {
        throw new DNSProviderError(
          'namecheap',
          'RATE_LIMITED',
          'Rate limited by Namecheap API',
          'Wait a moment and try again',
          true
        );
      }

      if (errorCode === 2030166) {
        throw new DNSProviderError(
          'namecheap',
          'DOMAIN_NOT_FOUND',
          'Domain not found in your Namecheap account',
          'Verify the domain is registered with Namecheap',
          false
        );
      }

      throw new DNSProviderError(
        'namecheap',
        'NETWORK_ERROR',
        `Namecheap API error: ${errors[0] || 'Unknown error'} (${errorCode})`,
        undefined,
        false
      );
    }
  }

  private async backupRecords(domain: string, records: DNSRecord[]): Promise<string> {
    const backupDir = join(homedir(), '.gg-deploy', 'backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `${domain}-${timestamp}.json`);
    writeFileSync(backupPath, JSON.stringify(records, null, 2), { mode: 0o600 });
    return backupPath;
  }

  private isGitHubPagesRecord(record: DNSRecord): boolean {
    const githubIPs = [
      '185.199.108.153',
      '185.199.109.153',
      '185.199.110.153',
      '185.199.111.153',
    ];

    if (record.type === 'A' && record.name === '@') {
      return githubIPs.includes(record.data);
    }

    if (record.type === 'CNAME' && record.name === 'www') {
      return record.data.endsWith('.github.io');
    }

    return false;
  }

  async listDomains(): Promise<DomainInfo[]> {
    return this.withRetry(async () => {
      const url = this.buildUrl('namecheap.domains.getList');
      const res = await fetch(url);
      const xml = await res.text();

      this.checkApiErrors(xml);

      const domains = this.parseXmlAttribute(xml, 'Domain', 'Name');
      return domains.map(domain => ({
        domain,
        status: 'ACTIVE',
      }));
    });
  }

  async getDNSRecords(domain: string): Promise<DNSRecord[]> {
    const { sld, tld } = this.splitDomain(domain);

    return this.withRetry(async () => {
      const url = this.buildUrl('namecheap.domains.dns.getHosts', { SLD: sld, TLD: tld });
      const res = await fetch(url);
      const xml = await res.text();

      this.checkApiErrors(xml);

      const hosts = this.parseHosts(xml);
      return hosts
        .filter(h => ['A', 'CNAME', 'TXT'].includes(h.Type))
        .map(h => ({
          type: h.Type as 'A' | 'CNAME' | 'TXT',
          name: h.Name,
          data: h.Address,
          ttl: parseInt(h.TTL, 10) || 1800,
        }));
    });
  }

  async setGitHubPagesRecords(domain: string, githubUser: string): Promise<void> {
    const { sld, tld } = this.splitDomain(domain);

    await this.withRetry(async () => {
      const existing = await this.getDNSRecords(domain);
      const backupPath = await this.backupRecords(domain, existing);
      console.log(`📁 Backup saved to ${backupPath}`);

      const preserved = existing.filter(r => !this.isGitHubPagesRecord(r));

      const newRecords: DNSRecord[] = [
        ...preserved,
        { type: 'A', name: '@', data: '185.199.108.153', ttl: 1800 },
        { type: 'A', name: '@', data: '185.199.109.153', ttl: 1800 },
        { type: 'A', name: '@', data: '185.199.110.153', ttl: 1800 },
        { type: 'A', name: '@', data: '185.199.111.153', ttl: 1800 },
        { type: 'CNAME', name: 'www', data: `${githubUser}.github.io`, ttl: 1800 },
      ];

      const params: Record<string, string> = { SLD: sld, TLD: tld };
      newRecords.forEach((r, i) => {
        const idx = i + 1;
        params[`HostName${idx}`] = r.name;
        params[`RecordType${idx}`] = r.type;
        params[`Address${idx}`] = r.data;
        params[`TTL${idx}`] = r.ttl.toString();
      });

      const url = this.buildUrl('namecheap.domains.dns.setHosts', params);
      const res = await fetch(url);
      const xml = await res.text();

      this.checkApiErrors(xml);
    });
  }

  async verifyDomain(domain: string): Promise<boolean> {
    try {
      const domains = await this.listDomains();
      return domains.some(d => d.domain.toLowerCase() === domain.toLowerCase());
    } catch {
      return false;
    }
  }
}
