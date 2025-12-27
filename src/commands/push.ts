import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import type { OutputFormat, PushResult, Deployment } from '../types.js';
import { getDeployment, getDeploymentByPath, updateDeploymentActivity, listDeployments } from '../config.js';
import { GitHubFilesService } from '../services/github-files.js';

function resolveDeployment(domainOrPath?: string): Deployment | null {
  if (domainOrPath) {
    const byDomain = getDeployment(domainOrPath);
    if (byDomain) return byDomain;
  }

  const cwd = process.cwd();
  const byPath = getDeploymentByPath(cwd);
  if (byPath) return byPath;

  const deployments = listDeployments();
  for (const d of deployments) {
    if (cwd.startsWith(d.localPath)) return d;
  }

  return null;
}

export async function pushCommand(
  domainOrMessage?: string,
  messageArg?: string,
  output: OutputFormat = 'human'
): Promise<PushResult> {
  const result: PushResult = {
    domain: '',
    repo: '',
    filesChanged: [],
    message: '',
    success: false,
  };

  const spinner = output === 'human' ? ora() : null;
  const log = (msg: string) => output === 'human' && console.log(msg);

  let domain: string | undefined;
  let message: string;

  if (messageArg) {
    domain = domainOrMessage;
    message = messageArg;
  } else if (domainOrMessage) {
    const maybeDeployment = getDeployment(domainOrMessage);
    if (maybeDeployment) {
      domain = domainOrMessage;
      message = 'GitHub Pages Push by gg-deploy';
    } else {
      message = domainOrMessage;
    }
  } else {
    message = 'GitHub Pages Push by gg-deploy';
  }

  const deployment = resolveDeployment(domain);

  if (!deployment) {
    const errMsg = domain
      ? `No deployment found for domain: ${domain}`
      : 'No deployment found for current directory. Run `gg-deploy list` to see tracked deployments.';
    log(chalk.red(`\nError: ${errMsg}\n`));
    if (output === 'json') {
      console.log(JSON.stringify({ error: errMsg, ...result }, null, 2));
    }
    return result;
  }

  result.domain = deployment.domain;
  result.repo = deployment.repo;
  result.message = message;

  log('');
  log(chalk.green('✓') + ` Detected deployment: ${chalk.bold(deployment.domain)} → ${chalk.cyan(deployment.repo)}`);

  if (!existsSync(deployment.localPath)) {
    const errMsg = `Local path no longer exists: ${deployment.localPath}`;
    log(chalk.red(`\nError: ${errMsg}`));
    log(chalk.dim('Run `gg-deploy forget ' + deployment.domain + '` to remove this deployment.\n'));
    if (output === 'json') {
      console.log(JSON.stringify({ error: errMsg, ...result }, null, 2));
    }
    return result;
  }

  log(chalk.dim(`  Scanning ${deployment.localPath}...`));

  try {
    const github = new GitHubFilesService();

    spinner?.start('Syncing files to GitHub...');

    const skippedLarge: string[] = [];
    const warnedLarge: string[] = [];

    const changes = await github.syncFiles(
      deployment.repo,
      deployment.localPath,
      message,
      (file, action) => {
        if (action === 'skip-large') {
          skippedLarge.push(file);
        } else if (action === 'warn-large') {
          warnedLarge.push(file);
        } else if (spinner) {
          spinner.text = `${action === 'create' ? 'Adding' : 'Updating'} ${file}...`;
        }
      }
    );

    if (skippedLarge.length > 0) {
      log('');
      log(chalk.yellow('⚠ Skipped files over 100MB (GitHub limit):'));
      for (const f of skippedLarge) {
        log(chalk.dim(`  - ${f}`));
      }
      log(chalk.dim('  Tip: Use Git LFS for files over 100MB'));
    }

    if (warnedLarge.length > 0 && output === 'human') {
      log('');
      log(chalk.dim(`Note: ${warnedLarge.length} large file(s) uploaded via Git Data API`));
    }

    spinner?.stop();

    result.filesChanged = changes;
    result.success = true;

    if (changes.length === 0) {
      log('');
      log(chalk.yellow('No changes detected.') + chalk.dim(' All files are up to date.'));
      log('');
    } else {
      log('');
      log(chalk.green('✓') + ` Found ${changes.length} change${changes.length > 1 ? 's' : ''}:`);
      for (const c of changes) {
        const icon = c.action === 'create' ? chalk.green('+') : chalk.yellow('~');
        log(`  ${icon} ${c.path} ${chalk.dim(`(${c.action})`)}`);
      }
      log('');
      log(chalk.green('✓') + ` Pushed ${changes.length} file${changes.length > 1 ? 's' : ''} with message: "${message}"`);
      log('');
      log(chalk.dim(`Site will update in ~1 minute: https://${deployment.domain}`));
      log('');
    }

    updateDeploymentActivity(deployment.domain);
  } catch (e) {
    spinner?.fail('Push failed');
    const errMsg = e instanceof Error ? e.message : String(e);
    log(chalk.red(`\nError: ${errMsg}\n`));
    if (output === 'json') {
      console.log(JSON.stringify({ error: errMsg, ...result }, null, 2));
    }
    return result;
  }

  if (output === 'json') {
    console.log(JSON.stringify(result, null, 2));
  }

  return result;
}
