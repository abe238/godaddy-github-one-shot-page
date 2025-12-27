import chalk from 'chalk';
import ora from 'ora';
import type { OutputFormat, CommandResult } from '../types.js';
import { DNSProviderError } from '../types.js';
import { DNSProviderFactory } from '../services/dns-factory.js';
import { GitHubService } from '../services/github.js';

export async function applyCommand(
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
    rollback_available: true,
  };

  const spinner = output === 'human' ? ora() : null;
  const log = (msg: string) => output === 'human' && console.log(msg);

  try {
    const dns = DNSProviderFactory.create();
    const github = new GitHubService();
    const githubUser = repo.split('/')[0];

    log(chalk.blue('\n=== Deploying ===\n'));
    log(chalk.dim(`Provider: ${dns.name}\n`));

    spinner?.start('Verifying domain ownership...');
    const domainExists = await dns.verifyDomain(domain);
    if (!domainExists) throw new Error(`Domain ${domain} not found in ${dns.name} account`);
    spinner?.succeed('Domain verified');
    result.completed_steps.push('verify_domain');

    spinner?.start('Verifying repository access...');
    const repoExists = await github.verifyRepo(repo);
    if (!repoExists) throw new Error(`Repository ${repo} not accessible`);
    spinner?.succeed('Repository verified');
    result.completed_steps.push('verify_repo');

    spinner?.start('Configuring DNS records...');
    await dns.setGitHubPagesRecords(domain, githubUser);
    spinner?.succeed('DNS records configured');
    result.completed_steps.push('configure_dns');
    result.resources_created.push(`A records for ${domain}`);
    result.resources_created.push(`CNAME www.${domain}`);

    spinner?.start('Adding CNAME file to repository...');
    await github.addCnameFile(repo, domain);
    spinner?.succeed('CNAME file added');
    result.completed_steps.push('add_cname');
    result.resources_created.push('CNAME file');

    spinner?.start('Enabling GitHub Pages...');
    await github.enablePages(repo);
    spinner?.succeed('GitHub Pages enabled');
    result.completed_steps.push('enable_pages');
    result.resources_modified.push('GitHub Pages settings');

    spinner?.start('Setting custom domain...');
    await github.setCustomDomain(repo, domain);
    spinner?.succeed('Custom domain set');
    result.completed_steps.push('set_custom_domain');

    log('');
    log(chalk.green('=== Deployment Complete ==='));
    log('');
    log(`Site URL: ${chalk.cyan(`https://${domain}`)}`);
    log('');
    log(chalk.dim('DNS propagation may take 1-48 hours.'));
    log(chalk.dim('HTTPS will be enabled automatically once DNS resolves.'));
    log('');
    log(chalk.dim(`Check status: gg-deploy status ${domain} ${repo}`));

    result.next_action = 'wait_for_dns';
    result.estimated_wait_seconds = 3600;
  } catch (e) {
    spinner?.fail('Deployment failed');
    result.status = result.completed_steps.length > 0 ? 'partial_success' : 'failure';
    const isRetriable = e instanceof DNSProviderError ? e.retriable : true;
    const errorMsg = e instanceof Error ? e.message : String(e);
    const suggestion = e instanceof DNSProviderError ? e.suggestion : undefined;
    result.failed_steps.push({
      step: 'apply',
      error: suggestion ? `${errorMsg} (${suggestion})` : errorMsg,
      retriable: isRetriable,
    });
    if (output === 'human' && suggestion) {
      console.log(chalk.yellow(`\nSuggestion: ${suggestion}`));
    }
  }

  if (output === 'json') {
    console.log(JSON.stringify(result, null, 2));
  }

  return result;
}
