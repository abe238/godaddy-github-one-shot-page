import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import type { ProviderName } from './types.js';

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
