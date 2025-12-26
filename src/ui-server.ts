import { createServer, IncomingMessage } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { planCommand } from './commands/plan.js';
import { applyCommand } from './commands/apply.js';
import { statusCommand } from './commands/status.js';
import {
  getAuthStatus,
  saveGoDaddyConfig,
  saveGitHubConfig,
  getConfigPath,
  getGoDaddyConfig,
  getGitHubConfig,
} from './config.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const UI_DIR = join(__dirname, '..', 'ui', 'dist');
const PORT = 3847;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

export async function startUiServer() {
  if (!existsSync(UI_DIR)) {
    console.error('UI not built. Run: cd ui && npm install && npm run build');
    process.exit(1);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (path === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (path === '/api/auth-status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getAuthStatus()));
      return;
    }

    if (path === '/api/config/values') {
      const gdConfig = getGoDaddyConfig();
      const ghConfig = getGitHubConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        godaddy: gdConfig ? { apiKey: gdConfig.apiKey, apiSecret: gdConfig.apiSecret } : null,
        github: ghConfig ? { token: ghConfig.token } : null,
      }));
      return;
    }

    if (path === '/api/test-connection') {
      const result = {
        godaddy: { configured: false, verified: false, error: null as string | null },
        github: { configured: false, verified: false, error: null as string | null, user: null as string | null },
      };

      const gdConfig = getGoDaddyConfig();
      if (gdConfig) {
        result.godaddy.configured = true;
        try {
          const gdRes = await fetch('https://api.godaddy.com/v1/domains?limit=1', {
            headers: {
              Authorization: `sso-key ${gdConfig.apiKey}:${gdConfig.apiSecret}`,
            },
          });
          if (gdRes.ok) {
            result.godaddy.verified = true;
          } else {
            result.godaddy.error = `API returned ${gdRes.status}`;
          }
        } catch (e) {
          result.godaddy.error = String(e);
        }
      }

      const ghConfig = getGitHubConfig();
      if (ghConfig) {
        result.github.configured = true;
        try {
          const ghRes = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${ghConfig.token}`,
              Accept: 'application/vnd.github+json',
            },
          });
          if (ghRes.ok) {
            const userData = await ghRes.json() as { login: string };
            result.github.verified = true;
            result.github.user = userData.login;
          } else {
            result.github.error = `API returned ${ghRes.status}`;
          }
        } catch (e) {
          result.github.error = String(e);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (path === '/api/config' && req.method === 'POST') {
      const body = await parseBody(req);
      const data = JSON.parse(body);

      try {
        if (data.godaddy) {
          saveGoDaddyConfig(
            data.godaddy.apiKey,
            data.godaddy.apiSecret,
            data.godaddy.environment || 'production'
          );
        }
        if (data.github) {
          saveGitHubConfig(data.github.token);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, configPath: getConfigPath() }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
      return;
    }

    if (path === '/api/plan' && req.method === 'POST') {
      const body = await parseBody(req);
      const { domain, repo } = JSON.parse(body);
      const result = await planCommand(domain, repo, 'json');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (path === '/api/apply' && req.method === 'POST') {
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const body = await parseBody(req);
      const { domain, repo } = JSON.parse(body);

      const steps = [
        { id: 'verify', title: 'Verify domain' },
        { id: 'repo', title: 'Check repository' },
        { id: 'dns', title: 'Configure DNS' },
        { id: 'cname', title: 'Add CNAME' },
        { id: 'pages', title: 'Enable Pages' },
        { id: 'ssl', title: 'SSL certificate' },
      ];

      const send = (data: object) => {
        res.write(JSON.stringify(data) + '\n');
      };

      try {
        for (let i = 0; i < steps.length; i++) {
          send({ step: steps[i].id, status: 'active' });
          await new Promise(r => setTimeout(r, 300));
        }

        const result = await applyCommand(domain, repo, 'json');

        for (const step of steps) {
          send({ step: step.id, status: 'done', detail: 'Complete' });
        }

        send({ complete: true, status: result.status, url: `https://${domain}` });
      } catch (e) {
        send({ complete: true, status: 'error', error: String(e) });
      }

      res.end();
      return;
    }

    if (path === '/api/status' && req.method === 'POST') {
      const body = await parseBody(req);
      const { domain, repo } = JSON.parse(body);
      const result = await statusCommand(domain, repo, 'json');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    let filePath = join(UI_DIR, path === '/' ? 'index.html' : path);
    if (!existsSync(filePath)) {
      filePath = join(UI_DIR, 'index.html');
    }

    try {
      const content = readFileSync(filePath);
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, () => {
    console.log(`\n  gg-deploy UI running at:\n`);
    console.log(`  \x1b[36mhttp://localhost:${PORT}\x1b[0m\n`);
    console.log(`  Press Ctrl+C to stop\n`);
  });
}
