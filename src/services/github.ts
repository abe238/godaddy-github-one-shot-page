import { execSync } from 'child_process';
import { getGitHubConfig } from '../config.js';

const GITHUB_API = 'https://api.github.com';

export class GitHubService {
  private token: string | null = null;

  private getToken(): string {
    if (this.token) return this.token;

    const config = getGitHubConfig();
    if (config?.token) {
      this.token = config.token;
      return this.token;
    }

    // Fall back to gh CLI token
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

  async enablePages(repo: string, branch = 'main', path = '/'): Promise<void> {
    try {
      await this.api(`/repos/${repo}/pages`, {
        method: 'POST',
        body: JSON.stringify({
          source: { branch, path },
        }),
      });
    } catch (e) {
      const msg = String(e);
      if (!msg.includes('already enabled') && !msg.includes('409') && !msg.includes('422')) throw e;
    }
  }

  async setCustomDomain(repo: string, domain: string): Promise<void> {
    await this.api(`/repos/${repo}/pages`, {
      method: 'PUT',
      body: JSON.stringify({ cname: domain }),
    });
  }

  async enableHttps(repo: string): Promise<void> {
    await this.api(`/repos/${repo}/pages`, {
      method: 'PUT',
      body: JSON.stringify({ https_enforced: true }),
    });
  }

  async getPagesStatus(repo: string): Promise<{
    url: string | null;
    status: string;
    cname: string | null;
    https_enforced: boolean;
  } | null> {
    try {
      return await this.api(`/repos/${repo}/pages`);
    } catch {
      return null;
    }
  }

  async addCnameFile(repo: string, domain: string): Promise<void> {
    const content = Buffer.from(domain).toString('base64');

    // Check if CNAME already exists
    let sha: string | undefined;
    try {
      const existing = await this.api<{ sha: string }>(`/repos/${repo}/contents/CNAME`);
      sha = existing.sha;
    } catch {
      // File doesn't exist, that's fine
    }

    try {
      await this.api(`/repos/${repo}/contents/CNAME`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Add custom domain: ${domain}`,
          content,
          ...(sha ? { sha } : {}),
        }),
      });
    } catch (e) {
      const msg = String(e);
      if (!msg.includes('sha') && !msg.includes('already exists')) throw e;
    }
  }

  async verifyRepo(repo: string): Promise<boolean> {
    try {
      await this.api(`/repos/${repo}`);
      return true;
    } catch {
      return false;
    }
  }

  async isRepoPublic(repo: string): Promise<boolean> {
    try {
      const result = await this.api<{ private: boolean }>(`/repos/${repo}`);
      return !result.private;
    } catch {
      return false;
    }
  }
}
