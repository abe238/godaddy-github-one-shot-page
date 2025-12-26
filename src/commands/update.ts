import chalk from 'chalk';
import {
  checkForUpdates,
  CURRENT_VERSION,
  detectSurfaceType,
  getPlatformInfo,
  getBinaryDownloadUrl
} from '../lib/update-checker.js';

export async function updateCommand(): Promise<void> {
  console.log(chalk.bold('\n🔍 Checking for updates...\n'));

  const isBinary = detectSurfaceType() === 'binary';
  let spinner: { start: () => void; stop: () => void; fail: (msg: string) => void } | null = null;

  if (!isBinary) {
    const ora = await import('ora');
    spinner = ora.default('Fetching latest version info...').start();
  } else {
    console.log('- Fetching latest version info...');
  }

  try {
    const update = await checkForUpdates();
    spinner?.stop();

    const surface = detectSurfaceType();
    const { os, arch } = getPlatformInfo();

    console.log(chalk.bold('Current version: ') + chalk.cyan(CURRENT_VERSION));
    console.log(chalk.bold('Installation:    ') + chalk.gray(formatSurface(surface)));
    console.log(chalk.bold('Platform:        ') + chalk.gray(`${os}-${arch}`));
    console.log('');

    if (!update) {
      console.log(chalk.green('✓ You are running the latest version!'));
      return;
    }

    console.log(chalk.yellow('⚡ Update available!'));
    console.log('');
    console.log(chalk.bold('Latest version:  ') + chalk.green.bold(update.latestVersion));
    console.log(chalk.bold('Release URL:     ') + chalk.blue.underline(update.releaseUrl));
    console.log('');

    // Show upgrade instructions based on surface type
    console.log(chalk.bold.white('How to update:'));
    console.log('');

    switch (surface) {
      case 'npm-global':
        console.log(chalk.white('  Run:'));
        console.log(chalk.cyan('    npm update -g gg-deploy'));
        break;

      case 'npm-local':
        console.log(chalk.white('  Run:'));
        console.log(chalk.cyan('    npm update gg-deploy'));
        break;

      case 'npx':
        console.log(chalk.white('  Just use the latest version with npx:'));
        console.log(chalk.cyan(`    npx gg-deploy@${update.latestVersion} <command>`));
        console.log('');
        console.log(chalk.gray('  Or install globally for faster startup:'));
        console.log(chalk.gray('    npm install -g gg-deploy'));
        break;

      case 'binary': {
        const downloadUrl = getBinaryDownloadUrl(update.latestVersion);
        console.log(chalk.white('  Download the latest binary:'));
        console.log(chalk.blue.underline(`    ${downloadUrl}`));
        console.log('');

        if (os === 'macos' || os === 'linux') {
          console.log(chalk.white('  Quick install (macOS/Linux):'));
          console.log(chalk.cyan(`    curl -L ${downloadUrl} | tar xz`));
          console.log(chalk.cyan('    sudo mv gg-deploy-* /usr/local/bin/gg-deploy'));
        } else if (os === 'win') {
          console.log(chalk.white('  Quick install (Windows):'));
          console.log(chalk.cyan('    1. Download the .zip file'));
          console.log(chalk.cyan('    2. Extract and move to a folder in your PATH'));
        }
        break;
      }

      default:
        console.log(chalk.white('  Install via npm:'));
        console.log(chalk.cyan('    npm install -g gg-deploy@latest'));
        console.log('');
        console.log(chalk.white('  Or download binary from:'));
        console.log(chalk.blue.underline(`    https://github.com/abe238/gg-deploy/releases/tag/v${update.latestVersion}`));
    }

    console.log('');

    // Show release notes preview if available
    if (update.releaseNotes) {
      console.log(chalk.bold.white('What\'s new:'));
      console.log(chalk.gray('─'.repeat(50)));
      const notes = update.releaseNotes.split('\n').slice(0, 5).join('\n');
      console.log(chalk.gray(notes));
      console.log(chalk.gray('─'.repeat(50)));
    }

  } catch (error) {
    if (spinner) {
      spinner.fail('Failed to check for updates');
    } else {
      console.log(chalk.red('✗ Failed to check for updates'));
    }
    console.log(chalk.red('Error: Could not connect to GitHub API'));
    console.log(chalk.gray('Check your internet connection and try again.'));
    console.log('');
    console.log(chalk.white('You can also check manually:'));
    console.log(chalk.blue.underline('  https://github.com/abe238/gg-deploy/releases'));
  }
}

function formatSurface(surface: string): string {
  switch (surface) {
    case 'npm-global': return 'npm (global)';
    case 'npm-local': return 'npm (local)';
    case 'npx': return 'npx';
    case 'binary': return 'standalone binary';
    default: return 'unknown';
  }
}
