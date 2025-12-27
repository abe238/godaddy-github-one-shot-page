import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { getGitHubConfig } from '../config.js';
import type { FileChange } from '../types.js';

const GITHUB_API = 'https://api.github.com';

const DEFAULT_IGNORES = [
  '.git',
  '.git/',
  'node_modules',
  'node_modules/',
  '.DS_Store',
  '*.log',
  '.env',
  '.env.*',
  'CNAME',
];

const MAX_FILE_SIZE_CONTENTS_API = 1 * 1024 * 1024; // 1MB - use Contents API (fast)
const MAX_FILE_SIZE_BLOB_API = 50 * 1024 * 1024; // 50MB - use Git Data API (slower but handles larger)
const MAX_FILE_SIZE_ABSOLUTE = 100 * 1024 * 1024; // 100MB - GitHub's hard limit
const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB - warn user about large files

interface RemoteFile {
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

export class GitHubFilesService {
  private token: string | null = null;

  private getToken(): string {
    if (this.token) return this.token;

    const config = getGitHubConfig();
    if (config?.token) {
      this.token = config.token;
      return this.token;
    }

    try {
      this.token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
      return this.token;
    } catch {
      throw new Error('GitHub not configured. Add token in settings or run: gh auth login');
    }
  }

  private async api<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const res = await fetch(`${GITHUB_API}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`GitHub API error: ${res.status} ${error}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  private loadIgnorePatterns(localPath: string): string[] {
    const patterns = [...DEFAULT_IGNORES];

    const ggIgnorePath = join(localPath, '.gg-ignore');
    if (existsSync(ggIgnorePath)) {
      const content = readFileSync(ggIgnorePath, 'utf-8');
      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
      patterns.push(...lines);
    }

    const gitIgnorePath = join(localPath, '.gitignore');
    if (existsSync(gitIgnorePath)) {
      const content = readFileSync(gitIgnorePath, 'utf-8');
      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
      patterns.push(...lines);
    }

    return patterns;
  }

  private isIgnored(filePath: string, patterns: string[]): boolean {
    const normalized = filePath.replace(/\\/g, '/');

    for (const pattern of patterns) {
      if (pattern.endsWith('/')) {
        const dir = pattern.slice(0, -1);
        if (normalized === dir || normalized.startsWith(dir + '/')) return true;
      } else if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1);
        if (normalized.endsWith(ext)) return true;
      } else if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(normalized)) return true;
      } else {
        if (normalized === pattern || normalized.startsWith(pattern + '/')) return true;
        if (normalized.split('/').includes(pattern)) return true;
      }
    }
    return false;
  }

  private scanLocalFiles(
    localPath: string,
    patterns: string[],
    onLargeFile?: (path: string, size: number, action: 'skip' | 'warn') => void
  ): Map<string, { content: Buffer; size: number; isBinary: boolean }> {
    const files = new Map<string, { content: Buffer; size: number; isBinary: boolean }>();

    const scan = (dir: string) => {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const relativePath = relative(localPath, fullPath);

        if (this.isIgnored(relativePath, patterns)) continue;

        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (stat.isFile()) {
          // Skip files over absolute limit
          if (stat.size > MAX_FILE_SIZE_ABSOLUTE) {
            onLargeFile?.(relativePath, stat.size, 'skip');
            continue;
          }

          // Warn about large files
          if (stat.size > WARN_FILE_SIZE) {
            onLargeFile?.(relativePath, stat.size, 'warn');
          }

          try {
            const content = readFileSync(fullPath);
            const isBinary = this.isBinaryFile(content);
            files.set(relativePath, { content, size: stat.size, isBinary });
          } catch {
            // Unreadable file, skip
          }
        }
      }
    };

    scan(localPath);
    return files;
  }

  private isBinaryFile(content: Buffer): boolean {
    // Check first 8000 bytes for null bytes (binary indicator)
    const sample = content.subarray(0, Math.min(8000, content.length));
    return sample.includes(0);
  }

  async getRemoteFiles(repo: string, path = ''): Promise<RemoteFile[]> {
    const allFiles: RemoteFile[] = [];

    const fetchDir = async (dirPath: string) => {
      try {
        const endpoint = dirPath
          ? `/repos/${repo}/contents/${encodeURIComponent(dirPath)}`
          : `/repos/${repo}/contents`;

        const contents = await this.api<Array<{
          path: string;
          sha: string;
          size: number;
          type: 'file' | 'dir';
        }>>(endpoint);

        for (const item of contents) {
          if (item.type === 'file') {
            allFiles.push({
              path: item.path,
              sha: item.sha,
              size: item.size,
              type: 'file',
            });
          } else if (item.type === 'dir') {
            await fetchDir(item.path);
          }
        }
      } catch {
        // Directory doesn't exist or is empty
      }
    };

    await fetchDir(path);
    return allFiles;
  }

  async getFileSha(repo: string, path: string): Promise<string | null> {
    try {
      const file = await this.api<{ sha: string }>(`/repos/${repo}/contents/${encodeURIComponent(path)}`);
      return file.sha;
    } catch {
      return null;
    }
  }

  async uploadFile(
    repo: string,
    path: string,
    content: Buffer,
    message: string,
    sha?: string
  ): Promise<void> {
    const base64 = content.toString('base64');
    await this.api(`/repos/${repo}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: base64,
        ...(sha ? { sha } : {}),
      }),
    });
  }

  async uploadLargeFile(
    repo: string,
    path: string,
    content: Buffer,
    message: string,
    branch = 'main'
  ): Promise<void> {
    // Step 1: Create a blob
    const blobRes = await this.api<{ sha: string }>(`/repos/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: content.toString('base64'),
        encoding: 'base64',
      }),
    });

    // Step 2: Get the current commit SHA
    const refRes = await this.api<{ object: { sha: string } }>(`/repos/${repo}/git/ref/heads/${branch}`);
    const commitSha = refRes.object.sha;

    // Step 3: Get the current tree
    const commitRes = await this.api<{ tree: { sha: string } }>(`/repos/${repo}/git/commits/${commitSha}`);
    const treeSha = commitRes.tree.sha;

    // Step 4: Create a new tree with the file
    const newTreeRes = await this.api<{ sha: string }>(`/repos/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: treeSha,
        tree: [{
          path,
          mode: '100644',
          type: 'blob',
          sha: blobRes.sha,
        }],
      }),
    });

    // Step 5: Create a new commit
    const newCommitRes = await this.api<{ sha: string }>(`/repos/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: newTreeRes.sha,
        parents: [commitSha],
      }),
    });

    // Step 6: Update the reference
    await this.api(`/repos/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({
        sha: newCommitRes.sha,
      }),
    });
  }

  async syncFiles(
    repo: string,
    localPath: string,
    commitMessage: string,
    onProgress?: (file: string, action: 'create' | 'update' | 'skip-large' | 'warn-large') => void
  ): Promise<FileChange[]> {
    const patterns = this.loadIgnorePatterns(localPath);
    const localFiles = this.scanLocalFiles(localPath, patterns, (path, size, action) => {
      if (action === 'skip') {
        onProgress?.(path, 'skip-large');
      } else {
        onProgress?.(path, 'warn-large');
      }
    });
    const remoteFiles = await this.getRemoteFiles(repo);

    const remoteMap = new Map<string, RemoteFile>();
    for (const rf of remoteFiles) {
      remoteMap.set(rf.path, rf);
    }

    const changes: FileChange[] = [];

    for (const [path, { content, size }] of localFiles) {
      const remote = remoteMap.get(path);
      const localSha = this.computeGitBlobSha(content);

      if (!remote) {
        onProgress?.(path, 'create');
        if (size > MAX_FILE_SIZE_CONTENTS_API) {
          await this.uploadLargeFile(repo, path, content, `${commitMessage} (add ${path})`);
        } else {
          await this.uploadFile(repo, path, content, `${commitMessage} (add ${path})`);
        }
        changes.push({ path, action: 'create', size });
      } else if (localSha !== remote.sha) {
        onProgress?.(path, 'update');
        if (size > MAX_FILE_SIZE_CONTENTS_API) {
          await this.uploadLargeFile(repo, path, content, `${commitMessage} (update ${path})`);
        } else {
          await this.uploadFile(repo, path, content, `${commitMessage} (update ${path})`, remote.sha);
        }
        changes.push({ path, action: 'update', size });
      }
    }

    return changes;
  }

  private computeGitBlobSha(content: Buffer): string {
    const { createHash } = require('crypto');
    const header = `blob ${content.length}\0`;
    const blob = Buffer.concat([Buffer.from(header), content]);
    return createHash('sha1').update(blob).digest('hex');
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
