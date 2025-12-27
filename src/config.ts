import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';

import type { ProviderName, Deployment, DeploymentsStore } from './types.js';

export interface GoDaddyConfig {
  apiKey: string;
  apiSecret: string;
  environment: 'production' | 'ote';
}

export interface CloudflareConfig {
  apiToken: string;
}

export interface NamecheapConfig {
  apiUser: string;
  apiKey: string;
  clientIP: string;
}

export interface GitHubConfig {
  token: string;
}

export interface AppConfig {
  dnsProvider?: ProviderName;
  godaddy?: GoDaddyConfig;
  cloudflare?: CloudflareConfig;
  namecheap?: NamecheapConfig;
  github?: GitHubConfig;
}

const CONFIG_DIR = join(homedir(), '.gg-deploy');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function readConfig(): AppConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as AppConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: AppConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  try {
    chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // Ignore chmod errors on Windows
  }
}

export function getGoDaddyConfig(): GoDaddyConfig | null {
  const config = readConfig();
  if (config.godaddy?.apiKey && config.godaddy?.apiSecret) {
    return config.godaddy;
  }
  // Fall back to environment variables
  const apiKey = process.env.GODADDY_API_KEY;
  const apiSecret = process.env.GODADDY_API_SECRET;
  if (apiKey && apiSecret) {
    return {
      apiKey,
      apiSecret,
      environment: 'production',
    };
  }
  return null;
}

export function getGitHubConfig(): GitHubConfig | null {
  const config = readConfig();
  if (config.github?.token) {
    return config.github;
  }
  return null;
}

export function getCloudflareConfig(): CloudflareConfig | null {
  const config = readConfig();
  if (config.cloudflare?.apiToken) {
    return config.cloudflare;
  }
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (apiToken) {
    return { apiToken };
  }
  return null;
}

export function getNamecheapConfig(): NamecheapConfig | null {
  const config = readConfig();
  if (config.namecheap?.apiUser && config.namecheap?.apiKey && config.namecheap?.clientIP) {
    return config.namecheap;
  }
  const apiUser = process.env.NAMECHEAP_API_USER;
  const apiKey = process.env.NAMECHEAP_API_KEY;
  const clientIP = process.env.NAMECHEAP_CLIENT_IP;
  if (apiUser && apiKey && clientIP) {
    return { apiUser, apiKey, clientIP };
  }
  return null;
}

export function saveGoDaddyConfig(apiKey: string, apiSecret: string, environment: 'production' | 'ote' = 'production'): void {
  const config = readConfig();
  config.godaddy = { apiKey, apiSecret, environment };
  writeConfig(config);
}

export function saveGitHubConfig(token: string): void {
  const config = readConfig();
  config.github = { token };
  writeConfig(config);
}

export function saveCloudflareConfig(apiToken: string): void {
  const config = readConfig();
  config.cloudflare = { apiToken };
  writeConfig(config);
}

export function saveNamecheapConfig(apiUser: string, apiKey: string, clientIP: string): void {
  const config = readConfig();
  config.namecheap = { apiUser, apiKey, clientIP };
  writeConfig(config);
}

export function clearConfig(): void {
  writeConfig({});
}

export interface AuthStatus {
  godaddy: {
    configured: boolean;
    keyPreview?: string;
  };
  github: {
    configured: boolean;
    tokenPreview?: string;
  };
}

export function getAuthStatus(): AuthStatus {
  const godaddy = getGoDaddyConfig();
  const github = getGitHubConfig();

  return {
    godaddy: {
      configured: !!godaddy,
      keyPreview: godaddy ? `${godaddy.apiKey.slice(0, 4)}...${godaddy.apiKey.slice(-4)}` : undefined,
    },
    github: {
      configured: !!github,
      tokenPreview: github ? `${github.token.slice(0, 4)}...${github.token.slice(-4)}` : undefined,
    },
  };
}

// ============================================================================
// Deployment History Storage (separate from credentials for security)
// ============================================================================

const DEPLOYMENTS_FILE = join(CONFIG_DIR, 'deployments.json');

/**
 * Normalizes a domain input by removing protocol, www prefix, trailing slashes, and lowercasing.
 * Handles variations like: https://example.com/, http://www.example.com, EXAMPLE.COM/
 */
export function normalizeDomain(input: string): string {
  let domain = input.trim().toLowerCase();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove www. prefix
  domain = domain.replace(/^www\./, '');

  // Remove trailing slashes and paths
  domain = domain.replace(/\/.*$/, '');

  // Remove port if present
  domain = domain.replace(/:\d+$/, '');

  return domain;
}

function generateId(): string {
  return randomBytes(8).toString('hex');
}

export function getDeploymentsPath(): string {
  return DEPLOYMENTS_FILE;
}

export function readDeployments(): DeploymentsStore {
  if (!existsSync(DEPLOYMENTS_FILE)) {
    return { version: 1, deployments: [] };
  }
  try {
    const content = readFileSync(DEPLOYMENTS_FILE, 'utf-8');
    const data = JSON.parse(content) as DeploymentsStore;
    if (!data.version || !Array.isArray(data.deployments)) {
      return { version: 1, deployments: [] };
    }
    return data;
  } catch {
    return { version: 1, deployments: [] };
  }
}

export function writeDeployments(store: DeploymentsStore): void {
  ensureConfigDir();
  writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(store, null, 2), { mode: 0o644 });
}

export function addDeployment(
  domain: string,
  repo: string,
  localPath: string,
  provider: ProviderName
): Deployment {
  const store = readDeployments();
  const normalizedDomain = normalizeDomain(domain);
  const existing = store.deployments.find(d => normalizeDomain(d.domain) === normalizedDomain);

  if (existing) {
    existing.repo = repo;
    existing.localPath = localPath;
    existing.provider = provider;
    existing.lastActivity = new Date().toISOString();
    writeDeployments(store);
    return existing;
  }

  const deployment: Deployment = {
    id: generateId(),
    domain: normalizedDomain,
    repo,
    localPath,
    provider,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };

  store.deployments.push(deployment);
  writeDeployments(store);
  return deployment;
}

export function getDeployment(domain: string): Deployment | null {
  const store = readDeployments();
  const normalized = normalizeDomain(domain);
  return store.deployments.find(d => normalizeDomain(d.domain) === normalized) || null;
}

export function getDeploymentByPath(localPath: string): Deployment | null {
  const store = readDeployments();
  return store.deployments.find(d => d.localPath === localPath) || null;
}

export function updateDeploymentActivity(domain: string): void {
  const store = readDeployments();
  const normalized = normalizeDomain(domain);
  const deployment = store.deployments.find(d => normalizeDomain(d.domain) === normalized);
  if (deployment) {
    deployment.lastActivity = new Date().toISOString();
    writeDeployments(store);
  }
}

export function removeDeployment(domain: string): boolean {
  const store = readDeployments();
  const normalized = normalizeDomain(domain);
  const index = store.deployments.findIndex(d => normalizeDomain(d.domain) === normalized);
  if (index === -1) return false;
  store.deployments.splice(index, 1);
  writeDeployments(store);
  return true;
}

export function listDeployments(): Deployment[] {
  const store = readDeployments();
  return store.deployments.sort((a, b) =>
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
}
