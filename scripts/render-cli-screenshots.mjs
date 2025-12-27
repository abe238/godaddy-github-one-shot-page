import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imgDir = join(__dirname, '..', 'img');

const cliHelp = `$ gg-deploy --help

Usage: gg-deploy [options] [command]

Free hosting deserves free tooling. Domain → GitHub Pages in 60 seconds.

Options:
  -V, --version                     output the version number
  -h, --help                        display help for command

Commands:
  plan <domain> <repo>    Preview deployment without making changes
  apply <domain> <repo>   Execute deployment (requires confirmation)
  status <domain> <repo>  Check deployment health
  describe                Output tool description for AI agents
  mcp-serve               Start MCP server for Claude integration
  ui                      Start local web interface
  update                  Check for updates`;

const cliPlan = `$ gg-deploy plan example.com abe238/mysite

╭───────────────────────────────────────────────────╮
│             🚀 Deployment Plan                    │
╰───────────────────────────────────────────────────╯

  Domain:    example.com
  Repo:      abe238/mysite
  Provider:  Cloudflare

  📋 DNS Changes:
    ✓ A record → 185.199.108.153
    ✓ A record → 185.199.109.153
    ✓ CNAME www → abe238.github.io

  📦 GitHub Pages:
    ✓ Enable Pages on repository
    ✓ Set custom domain
    ✓ Wait for SSL provisioning

  Run 'gg-deploy apply' to execute this plan.`;

function getTerminalHtml(content) {
  const escapedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1b26;
      padding: 0;
      font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
    }
    .terminal {
      background: linear-gradient(145deg, #1a1b26 0%, #24283b 100%);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-width: 720px;
      margin: 24px auto;
    }
    .titlebar {
      background: linear-gradient(180deg, #3b3f51 0%, #2e3347 100%);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn { width: 12px; height: 12px; border-radius: 50%; }
    .btn-close { background: #ff5f57; }
    .btn-min { background: #febc2e; }
    .btn-max { background: #28c840; }
    .title {
      flex: 1;
      text-align: center;
      color: #a9b1d6;
      font-size: 13px;
      margin-left: -60px;
    }
    .content {
      padding: 20px 24px;
      color: #c0caf5;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre;
    }
  </style>
</head>
<body>
  <div class="terminal">
    <div class="titlebar">
      <span class="btn btn-close"></span>
      <span class="btn btn-min"></span>
      <span class="btn btn-max"></span>
      <span class="title">gg-deploy — zsh</span>
    </div>
    <div class="content">${escapedContent}</div>
  </div>
</body>
</html>`;
}

async function renderTerminal(content, filename) {
  const html = getTerminalHtml(content);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });
  await page.setContent(html);
  await page.waitForTimeout(500);

  const terminal = await page.$('.terminal');
  await terminal.screenshot({ path: join(imgDir, filename) });
  console.log('✓ Captured:', filename);
  await browser.close();
}

async function main() {
  await renderTerminal(cliHelp, 'cli-help.png');
  await renderTerminal(cliPlan, 'cli-plan.png');
  console.log('Done! CLI screenshots saved to img/');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
