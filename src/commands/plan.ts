import chalk from 'chalk';
import type { OutputFormat, PlanResult, CommandResult } from '../types.js';
import { GoDaddyService } from '../services/godaddy.js';
import { GitHubService } from '../services/github.js';

export async function planCommand(
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

  const plan: PlanResult = {
    domain,
    repo,
    dns_changes: [],
    github_changes: [],
    warnings: [],
  };

  try {
    const godaddy = new GoDaddyService();
    const github = new GitHubService();

    if (output === 'human') {
      console.log(chalk.blue('\n=== Deployment Plan ===\n'));
      console.log(`Domain: ${chalk.cyan(domain)}`);
      console.log(`Repo:   ${chalk.cyan(repo)}\n`);
    }

    const domainExists = await godaddy.verifyDomain(domain);
    if (!domainExists) {
      result.status = 'failure';
      result.failed_steps.push({
        step: 'verify_domain',
        error: `Domain ${domain} not found or not active in GoDaddy`,
        retriable: false,
      });
      return result;
    }
    result.completed_steps.push('verify_domain');

    const repoExists = await github.verifyRepo(repo);
    if (!repoExists) {
      result.status = 'failure';
      result.failed_steps.push({
        step: 'verify_repo',
        error: `Repository ${repo} not found or no access`,
        retriable: false,
      });
      return result;
    }
    result.completed_steps.push('verify_repo');

    const isPublic = await github.isRepoPublic(repo);
    if (!isPublic) {
      plan.warnings.push('Repository is private. GitHub Pages requires public repos (or GitHub Pro).');
    }

    const githubUser = repo.split('/')[0];

    plan.dns_changes = [
      { action: 'CREATE', record: { type: 'A', name: '@', data: '185.199.108.153', ttl: 600 } },
      { action: 'CREATE', record: { type: 'A', name: '@', data: '185.199.109.153', ttl: 600 } },
      { action: 'CREATE', record: { type: 'A', name: '@', data: '185.199.110.153', ttl: 600 } },
      { action: 'CREATE', record: { type: 'A', name: '@', data: '185.199.111.153', ttl: 600 } },
      { action: 'CREATE', record: { type: 'CNAME', name: 'www', data: `${githubUser}.github.io`, ttl: 600 } },
    ];

    plan.github_changes = [
      { action: 'CREATE', resource: 'CNAME file', details: `Add CNAME with ${domain}` },
      { action: 'MODIFY', resource: 'GitHub Pages', details: 'Enable Pages with custom domain' },
    ];

    if (output === 'human') {
      console.log(chalk.yellow('DNS Changes:'));
      for (const change of plan.dns_changes) {
        const icon = change.action === 'CREATE' ? '+' : change.action === 'DELETE' ? '-' : '~';
        console.log(`  ${chalk.green(icon)} ${change.record.type} ${change.record.name} → ${change.record.data}`);
      }
      console.log();
      console.log(chalk.yellow('GitHub Changes:'));
      for (const change of plan.github_changes) {
        const icon = change.action === 'CREATE' ? '+' : '~';
        console.log(`  ${chalk.green(icon)} ${change.resource}: ${change.details}`);
      }
      if (plan.warnings.length) {
        console.log();
        console.log(chalk.red('Warnings:'));
        for (const w of plan.warnings) console.log(`  ! ${w}`);
      }
      console.log();
      console.log(chalk.dim('Run with "apply" to execute this plan.'));
    } else {
      console.log(JSON.stringify({ ...result, plan }, null, 2));
    }

    result.next_action = 'apply';
    result.estimated_wait_seconds = 300;
  } catch (e) {
    result.status = 'failure';
    result.failed_steps.push({
      step: 'plan',
      error: e instanceof Error ? e.message : String(e),
      retriable: true,
    });
  }

  return result;
}
