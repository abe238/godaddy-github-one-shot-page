import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';

const CURRENT_VERSION = '2.5.0';
const GITHUB_REPO = 'abe238/gg-deploy';
const CACHE_DIR = join(homedir(), '.gg-deploy');
const CACHE_FILE = join(CACHE_DIR, 'update-cache.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCache {
  lastCheck: number;
  latestVersion: string | null;
  releaseUrl: string | null;
  releaseNotes: string | null;
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string | null;
  updateCommand: string;
  downloadUrl: string | null;
}

type SurfaceType = 'npm-global' | 'npm-local' | 'npx' | 'binary' | 'unknown';

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

function detectSurfaceType(): SurfaceType {
  // Check if running as pkg binary
  if ((process as unknown as { pkg?: unknown }).pkg) {
    return 'binary';
  }

  // Check if running via npx (has npm_execpath with npx)
  if (process.env.npm_execpath?.includes('npx')) {
    return 'npx';
  }

  // Check if globally installed
  if (process.env.npm_config_global === 'true') {
    return 'npm-global';
  }

  // Check common global paths
  const execPath = process.argv[1] || '';
  if (execPath.includes('/lib/node_modules/') ||
      execPath.includes('\\node_modules\\') ||
      execPath.includes('/usr/local/bin/') ||
      execPath.includes('/opt/homebrew/')) {
    return 'npm-global';
  }

  // If in a node_modules, likely local
  if (execPath.includes('node_modules')) {
    return 'npm-local';
  }

  return 'unknown';
}

function getPlatformInfo(): { os: string; arch: string } {
  const os = process.platform === 'darwin' ? 'macos' :
             process.platform === 'win32' ? 'win' :
             process.platform === 'linux' ? 'linux' : process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return { os, arch };
}

function getUpdateCommand(surface: SurfaceType, version: string): string {
  switch (surface) {
    case 'npm-global':
      return 'npm update -g gg-deploy';
    case 'npm-local':
      return 'npm update gg-deploy';
    case 'npx':
      return `npx gg-deploy@${version}`;
    case 'binary': {
      const { os, arch } = getPlatformInfo();
      return `gg-deploy update  # or download from GitHub releases`;
    }
    default:
      return 'npm install -g gg-deploy@latest';
  }
}

function getBinaryDownloadUrl(version: string): string | null {
  const { os, arch } = getPlatformInfo();
  const ext = os === 'win' ? 'zip' : 'tar.gz';
  return `https://github.com/${GITHUB_REPO}/releases/download/v${version}/gg-deploy-${version}-${os}-${arch}.${ext}`;
}

function readCache(): UpdateCache | null {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Cache corrupted or unreadable
  }
  return null;
}

function writeCache(cache: UpdateCache): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // Can't write cache, ignore
  }
}

function fetchWithCurl(url: string): string | null {
  try {
    const result = execSync(
      `curl -sL -H "Accept: application/vnd.github.v3+json" -H "User-Agent: gg-deploy/${CURRENT_VERSION}" "${url}"`,
      { timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result;
  } catch {
    return null;
  }
}

async function fetchLatestRelease(): Promise<{ version: string; url: string; notes: string | null } | null> {
  try {
    const data = fetchWithCurl(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!data) return null;

    const json = JSON.parse(data) as { tag_name: string; html_url: string; body: string };
    return {
      version: json.tag_name.replace(/^v/, ''),
      url: json.html_url,
      notes: json.body?.split('\n').slice(0, 3).join('\n') || null
    };
  } catch {
    return null;
  }
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const cache = readCache();
  const now = Date.now();

  // Return cached result if recent
  if (cache && (now - cache.lastCheck) < CHECK_INTERVAL_MS) {
    if (cache.latestVersion && compareVersions(cache.latestVersion, CURRENT_VERSION) > 0) {
      const surface = detectSurfaceType();
      return {
        currentVersion: CURRENT_VERSION,
        latestVersion: cache.latestVersion,
        releaseUrl: cache.releaseUrl || `https://github.com/${GITHUB_REPO}/releases`,
        releaseNotes: cache.releaseNotes,
        updateCommand: getUpdateCommand(surface, cache.latestVersion),
        downloadUrl: surface === 'binary' ? getBinaryDownloadUrl(cache.latestVersion) : null
      };
    }
    return null;
  }

  // Fetch fresh data (non-blocking for CLI, result used on NEXT run)
  const release = await fetchLatestRelease();

  // Update cache
  const newCache: UpdateCache = {
    lastCheck: now,
    latestVersion: release?.version || null,
    releaseUrl: release?.url || null,
    releaseNotes: release?.notes || null
  };
  writeCache(newCache);

  // Return update info if newer version exists
  if (release && compareVersions(release.version, CURRENT_VERSION) > 0) {
    const surface = detectSurfaceType();
    return {
      currentVersion: CURRENT_VERSION,
      latestVersion: release.version,
      releaseUrl: release.url,
      releaseNotes: release.notes,
      updateCommand: getUpdateCommand(surface, release.version),
      downloadUrl: surface === 'binary' ? getBinaryDownloadUrl(release.version) : null
    };
  }

  return null;
}

export function printUpdateNotification(update: UpdateInfo): void {
  console.log('');
  console.log(chalk.yellow('╭─────────────────────────────────────────────────────╮'));
  console.log(chalk.yellow('│') + chalk.bold.cyan(' 💡 Update available: ') +
              chalk.gray(update.currentVersion) + chalk.white(' → ') +
              chalk.green.bold(update.latestVersion) +
              chalk.yellow('              │'));
  console.log(chalk.yellow('│') + chalk.white(`    Run: ${chalk.cyan(update.updateCommand)}`) +
              ' '.repeat(Math.max(0, 36 - update.updateCommand.length)) + chalk.yellow('│'));
  console.log(chalk.yellow('╰─────────────────────────────────────────────────────╯'));
}

export function printUpdateNotificationCompact(update: UpdateInfo): void {
  console.log('');
  console.log(chalk.yellow('💡') + chalk.gray(` Update available: ${update.currentVersion} → `) +
              chalk.green.bold(update.latestVersion) +
              chalk.gray(` • Run: `) + chalk.cyan(update.updateCommand));
}

export async function checkAndNotify(compact = true): Promise<void> {
  try {
    const update = await checkForUpdates();
    if (update) {
      if (compact) {
        printUpdateNotificationCompact(update);
      } else {
        printUpdateNotification(update);
      }
    }
  } catch {
    // Silently ignore update check failures
  }
}

export { CURRENT_VERSION, detectSurfaceType, getPlatformInfo, getBinaryDownloadUrl };
