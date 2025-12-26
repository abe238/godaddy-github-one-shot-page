import { execSync } from 'child_process';

export class GitHubService {
  private runGh(args: string): string {
    return execSync(`gh ${args}`, { encoding: 'utf-8' }).trim();
  }

  async enablePages(repo: string, branch = 'main', path = '/'): Promise<void> {
    try {
      this.runGh(`api repos/${repo}/pages -X POST -f source='{"branch":"${branch}","path":"${path}"}'`);
    } catch (e) {
      const msg = String(e);
      if (!msg.includes('already enabled')) throw e;
    }
  }

  async setCustomDomain(repo: string, domain: string): Promise<void> {
    this.runGh(`api repos/${repo}/pages -X PUT -f cname="${domain}"`);
  }

  async enableHttps(repo: string): Promise<void> {
    this.runGh(`api repos/${repo}/pages -X PUT -F https_enforced=true`);
  }

  async getPagesStatus(repo: string): Promise<{
    url: string | null;
    status: string;
    cname: string | null;
    https_enforced: boolean;
  } | null> {
    try {
      const result = this.runGh(`api repos/${repo}/pages --jq '{url,status,cname,https_enforced}'`);
      return JSON.parse(result);
    } catch {
      return null;
    }
  }

  async addCnameFile(repo: string, domain: string): Promise<void> {
    try {
      const content = Buffer.from(domain).toString('base64');
      this.runGh(`api repos/${repo}/contents/CNAME -X PUT -f message="Add custom domain: ${domain}" -f content="${content}"`);
    } catch (e) {
      const msg = String(e);
      if (!msg.includes('sha') && !msg.includes('already exists')) throw e;
    }
  }

  async verifyRepo(repo: string): Promise<boolean> {
    try {
      this.runGh(`repo view ${repo} --json name`);
      return true;
    } catch {
      return false;
    }
  }

  async isRepoPublic(repo: string): Promise<boolean> {
    try {
      const result = this.runGh(`repo view ${repo} --json visibility --jq .visibility`);
      return result === 'public';
    } catch {
      return false;
    }
  }
}
