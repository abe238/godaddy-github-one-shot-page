export type OutputFormat = 'human' | 'json';

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
