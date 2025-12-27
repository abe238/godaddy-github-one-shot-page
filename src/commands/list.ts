import chalk from 'chalk';
import type { OutputFormat, Deployment } from '../types.js';
import { listDeployments } from '../config.js';

function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

export async function listCommand(output: OutputFormat): Promise<Deployment[]> {
  const deployments = listDeployments();

  if (output === 'json') {
    console.log(JSON.stringify(deployments, null, 2));
    return deployments;
  }

  if (deployments.length === 0) {
    console.log(chalk.dim('\nNo tracked deployments yet.'));
    console.log(chalk.dim('Run `gg-deploy apply <domain> <repo>` to create your first deployment.\n'));
    return deployments;
  }

  console.log('');
  console.log(chalk.cyan('╭─ Tracked Deployments ─────────────────────────────────────╮'));

  for (const d of deployments) {
    console.log(chalk.cyan('│') + '                                                           ' + chalk.cyan('│'));
    console.log(
      chalk.cyan('│') + '  ' +
      chalk.bold.white(d.domain) + chalk.dim(' → ') + chalk.green(d.repo) +
      ' '.repeat(Math.max(0, 47 - d.domain.length - d.repo.length)) +
      chalk.cyan('│')
    );
    console.log(
      chalk.cyan('│') + '  ' + chalk.dim('└─ ') + chalk.gray(d.localPath.length > 45 ? '...' + d.localPath.slice(-42) : d.localPath) +
      ' '.repeat(Math.max(0, 52 - Math.min(d.localPath.length, 45))) +
      chalk.cyan('│')
    );
    console.log(
      chalk.cyan('│') + '     ' + chalk.dim(`Last activity: ${formatTimeAgo(d.lastActivity)}`) +
      ' '.repeat(Math.max(0, 42 - formatTimeAgo(d.lastActivity).length)) +
      chalk.cyan('│')
    );
  }

  console.log(chalk.cyan('│') + '                                                           ' + chalk.cyan('│'));
  console.log(chalk.cyan('╰───────────────────────────────────────────────────────────╯'));
  console.log('');

  return deployments;
}
