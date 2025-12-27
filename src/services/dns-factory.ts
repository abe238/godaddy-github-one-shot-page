import type { DNSProvider, ProviderName } from '../types.js';
import { readConfig, getGoDaddyConfig, getCloudflareConfig, getNamecheapConfig } from '../config.js';
import { GoDaddyService } from './godaddy.js';
import { CloudflareService } from './cloudflare.js';
import { NamecheapService } from './namecheap.js';

export function detectProvider(): ProviderName | null {
  const config = readConfig();

  if (config.dnsProvider) {
    return config.dnsProvider;
  }

  const providers: ProviderName[] = [];
  if (getGoDaddyConfig()) providers.push('godaddy');
  if (getCloudflareConfig()) providers.push('cloudflare');
  if (getNamecheapConfig()) providers.push('namecheap');

  if (providers.length === 0) {
    return null;
  }

  if (providers.length === 1) {
    return providers[0];
  }

  throw new Error(
    `Multiple DNS providers configured: ${providers.join(', ')}. ` +
    `Please specify "dnsProvider" in ~/.gg-deploy/config.json`
  );
}

export function createProvider(providerName?: ProviderName): DNSProvider {
  const name = providerName ?? detectProvider();

  if (!name) {
    throw new Error(
      'No DNS provider configured. Add credentials for GoDaddy, Cloudflare, or Namecheap in settings.'
    );
  }

  switch (name) {
    case 'godaddy':
      return new GoDaddyService();
    case 'cloudflare':
      return new CloudflareService();
    case 'namecheap':
      return new NamecheapService();
    default:
      throw new Error(`Unknown DNS provider: ${name}`);
  }
}

export const DNSProviderFactory = {
  detect: detectProvider,
  create: createProvider,
};
