export type OutputFormat = 'human' | 'json';

export type ProviderName = 'godaddy' | 'cloudflare' | 'namecheap';

export interface DomainInfo {
  domain: string;
  status: string;
}

export interface DNSProvider {
  readonly name: ProviderName;
  listDomains(): Promise<DomainInfo[]>;
  getDNSRecords(domain: string): Promise<DNSRecord[]>;
  setGitHubPagesRecords(domain: string, githubUser: string): Promise<void>;
  verifyDomain(domain: string): Promise<boolean>;
}

export type DNSProviderErrorCode = 'AUTH_ERROR' | 'DOMAIN_NOT_FOUND' | 'RATE_LIMITED' | 'VALIDATION_ERROR' | 'NETWORK_ERROR';

export class DNSProviderError extends Error {
  constructor(
    public provider: ProviderName,
    public code: DNSProviderErrorCode,
    public humanMessage: string,
    public suggestion?: string,
    public retriable: boolean = false
  ) {
    super(`[${provider.toUpperCase()}] ${humanMessage}`);
    this.name = 'DNSProviderError';
  }
}

export interface CommandResult {
  status: 'success' | 'partial_success' | 'failure';
  completed_steps: string[];
  failed_steps: Array<{ step: string; error: string; retriable: boolean }>;
  resources_created: string[];
  resources_modified: string[];
  next_action: string | null;
  estimated_wait_seconds: number | null;
  rollback_available: boolean;
}

export interface DeployConfig {
  domain: string;
  repo: string;
  branch?: string;
  path?: string;
}

export interface DNSRecord {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  data: string;
  ttl: number;
}

export interface PlanResult {
  domain: string;
  repo: string;
  dns_changes: Array<{
    action: 'CREATE' | 'MODIFY' | 'DELETE';
    record: DNSRecord;
    current?: string;
  }>;
  github_changes: Array<{
    action: 'CREATE' | 'MODIFY';
    resource: string;
    details: string;
  }>;
  warnings: string[];
}

export interface StatusResult {
  domain: string;
  dns_configured: boolean;
  dns_records: DNSRecord[];
  github_pages_enabled: boolean;
  github_pages_url: string | null;
  ssl_status: 'pending' | 'active' | 'error' | 'unknown';
  health: 'healthy' | 'degraded' | 'error';
}

export interface Deployment {
  id: string;
  domain: string;
  repo: string;
  localPath: string;
  provider: ProviderName;
  createdAt: string;
  lastActivity: string;
}

export interface DeploymentsStore {
  version: 1;
  deployments: Deployment[];
}

export interface FileChange {
  path: string;
  action: 'create' | 'update' | 'delete';
  size?: number;
}

export interface PushResult {
  domain: string;
  repo: string;
  filesChanged: FileChange[];
  message: string;
  success: boolean;
}
