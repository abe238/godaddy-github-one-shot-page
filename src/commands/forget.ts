import chalk from 'chalk';
import type { OutputFormat, CommandResult } from '../types.js';
import { removeDeployment, getDeployment } from '../config.js';

export async function forgetCommand(
  domain: string,
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

  const log = (msg: string) => output === 'human' && console.log(msg);

  const deployment = getDeployment(domain);

  if (!deployment) {
    result.status = 'failure';
    result.failed_steps.push({
      step: 'find_deployment',
      error: `No tracked deployment found for: ${domain}`,
      retriable: false,
    });
    log(chalk.red(`\nError: No tracked deployment found for: ${domain}`));
    log(chalk.dim('Run `gg-deploy list` to see tracked deployments.\n'));
    if (output === 'json') {
      console.log(JSON.stringify(result, null, 2));
    }
    return result;
  }

  const removed = removeDeployment(domain);

  if (removed) {
    result.completed_steps.push('remove_deployment');
    result.resources_modified.push(`Removed tracking for ${domain}`);
    log('');
    log(chalk.green('✓') + ` Removed ${chalk.bold(domain)} from tracked deployments`);
    log('');
    log(chalk.yellow('⚠ Important: This only removes local tracking.'));
    log('');
    log(chalk.white('Your site is still live! To fully decommission:'));
    log('');
    log(chalk.dim('  1. Delete DNS records at your provider:'));
    log(chalk.dim('     - 4 A records pointing to 185.199.108-111.153'));
    log(chalk.dim('     - CNAME record for www'));
    log('');
    log(chalk.dim('  2. Disable GitHub Pages:'));
    log(chalk.dim('     - Go to repo Settings → Pages → Source: None'));
    log('');
    log(chalk.dim('  3. Delete CNAME file from repository (optional)'));
    log('');
  } else {
    result.status = 'failure';
    result.failed_steps.push({
      step: 'remove_deployment',
      error: 'Failed to remove deployment',
      retriable: true,
    });
    log(chalk.red(`\nError: Failed to remove deployment for: ${domain}\n`));
  }

  if (output === 'json') {
    console.log(JSON.stringify(result, null, 2));
  }

  return result;
}
