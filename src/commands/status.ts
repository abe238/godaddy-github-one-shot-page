import chalk from 'chalk';
import type { OutputFormat, StatusResult, CommandResult } from '../types.js';
import { DNSProviderError } from '../types.js';
import { DNSProviderFactory } from '../services/dns-factory.js';
import { GitHubService } from '../services/github.js';

export async function statusCommand(
  domain: string,
  repo: string,
  output: OutputFormat
): Promise<CommandResult> {
  const result: CommandResult = {
    status: 'success',
    completed_steps: [],
    failed_steps: [],
    resources_created: [],
    resources_modified: [],
    next_action: null,
    estimated_wait_seconds: null,
    rollback_available: false,
  };

  const status: StatusResult = {
    domain,
    dns_configured: false,
    dns_records: [],
    github_pages_enabled: false,
    github_pages_url: null,
    ssl_status: 'unknown',
    health: 'error',
  };

  try {
    const dns = DNSProviderFactory.create();
    const github = new GitHubService();

    const records = await dns.getDNSRecords(domain);
    status.dns_records = records.filter(
      (r) => r.type === 'A' || (r.type === 'CNAME' && r.name === 'www')
    );
    const hasGitHubA = records.some(
      (r) => r.type === 'A' && r.data.startsWith('185.199.')
    );
    const hasGitHubCname = records.some(
      (r) => r.type === 'CNAME' && r.data.includes('.github.io')
    );
    status.dns_configured = hasGitHubA && hasGitHubCname;
    result.completed_steps.push('check_dns');

    const pages = await github.getPagesStatus(repo);
    if (pages) {
      status.github_pages_enabled = true;
      status.github_pages_url = pages.url;
      status.ssl_status = pages.https_enforced ? 'active' : 'pending';
    }
    result.completed_steps.push('check_github');

    if (status.dns_configured && status.github_pages_enabled) {
      status.health = status.ssl_status === 'active' ? 'healthy' : 'degraded';
    } else if (status.dns_configured || status.github_pages_enabled) {
      status.health = 'degraded';
    }

    if (output === 'human') {
      console.log(chalk.blue('\n=== Status ===\n'));
      console.log(`Domain:   ${chalk.cyan(domain)}`);
      console.log(`Repo:     ${chalk.cyan(repo)}`);
      console.log(`Provider: ${chalk.cyan(dns.name)}\n`);

      const dnsIcon = status.dns_configured ? chalk.green('OK') : chalk.red('X');
      const ghIcon = status.github_pages_enabled ? chalk.green('OK') : chalk.red('X');
      const sslIcon = status.ssl_status === 'active' ? chalk.green('OK') :
                      status.ssl_status === 'pending' ? chalk.yellow('PENDING') : chalk.red('X');

      console.log(`DNS:    [${dnsIcon}] ${status.dns_configured ? 'Configured' : 'Not configured'}`);
      console.log(`Pages:  [${ghIcon}] ${status.github_pages_enabled ? 'Enabled' : 'Not enabled'}`);
      console.log(`SSL:    [${sslIcon}] ${status.ssl_status}`);
      console.log('');

      const healthColor = status.health === 'healthy' ? chalk.green :
                          status.health === 'degraded' ? chalk.yellow : chalk.red;
      console.log(`Health: ${healthColor(status.health.toUpperCase())}`);

      if (status.github_pages_url) {
        console.log(`\nURL: ${chalk.cyan(status.github_pages_url)}`);
      }
    } else {
      console.log(JSON.stringify({ ...result, status }, null, 2));
    }
  } catch (e) {
    result.status = 'failure';
    const isRetriable = e instanceof DNSProviderError ? e.retriable : true;
    const errorMsg = e instanceof Error ? e.message : String(e);
    const suggestion = e instanceof DNSProviderError ? e.suggestion : undefined;
    result.failed_steps.push({
      step: 'status',
      error: suggestion ? `${errorMsg} (${suggestion})` : errorMsg,
      retriable: isRetriable,
    });
    if (output === 'human' && suggestion) {
      console.log(chalk.yellow(`\nSuggestion: ${suggestion}`));
    }
  }

  return result;
}
