import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const commands = [
  {
    name: 'help',
    content: `$ gg-deploy --help

Usage: gg-deploy [options] [command]

Free hosting deserves free tooling. Domain → GitHub Pages in 60 seconds.

Options:
  -V, --version                      output the version number
  -h, --help                         display help for command

Commands:
  plan <domain> <repo>               Preview deployment (safe)
  apply <domain> <repo>              Execute deployment
  status <domain> <repo>             Check deployment health
  list                               List tracked deployments
  push [domain] [message]            Push local files (git-free)
  forget <domain>                    Remove from tracking
  mcp-serve                          Start MCP server for AI agents
  ui                                 Start local web interface
  update                             Check for updates`
  },
  {
    name: 'list',
    content: `$ gg-deploy list

╭─ Tracked Deployments ─────────────────────────────────────╮
│                                                           │
│  myblog.com → user/blog                                   │
│  └─ /Users/me/projects/myblog                             │
│     Last activity: 2 hours ago                            │
│                                                           │
│  portfolio.dev → user/portfolio                           │
│  └─ /Users/me/projects/portfolio                          │
│     Last activity: 3 days ago                             │
│                                                           │
╰───────────────────────────────────────────────────────────╯`
  },
  {
    name: 'push',
    content: `$ gg-deploy push "Updated homepage"

✓ Detected deployment: myblog.com → user/blog
  Scanning /Users/me/projects/myblog...

✓ Found 3 changes:
  + index.html (create)
  ~ styles.css (update)
  ~ about.html (update)

✓ Pushed 3 files with message: "Updated homepage"

Site will update in ~1 minute: https://myblog.com`
  }
];

const html = (content) => `
<!DOCTYPE html>
<html>
<head>
<style>
body {
  background: linear-gradient(135deg, #1a1b26 0%, #24283b 100%);
  padding: 40px;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
.terminal {
  background: #1a1b26;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
  max-width: 700px;
  overflow: hidden;
}
.header {
  background: linear-gradient(180deg, #3b4261 0%, #2d3250 100%);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot { width: 12px; height: 12px; border-radius: 50%; }
.red { background: #ff5f56; }
.yellow { background: #ffbd2e; }
.green { background: #27c93f; }
.title {
  flex: 1;
  text-align: center;
  color: #787c99;
  font-family: -apple-system, sans-serif;
  font-size: 13px;
}
.body {
  padding: 20px 24px;
  color: #a9b1d6;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}
</style>
</head>
<body>
<div class="terminal">
<div class="header">
<div class="dot red"></div>
<div class="dot yellow"></div>
<div class="dot green"></div>
<div class="title">gg-deploy</div>
</div>
<div class="body">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
</div>
</body>
</html>`;

async function capture() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 800 });

  for (const cmd of commands) {
    await page.setContent(html(cmd.content));
    await page.screenshot({
      path: `img/cli-${cmd.name}-v2.png`,
      fullPage: false,
      clip: { x: 0, y: 0, width: 900, height: 600 }
    });
    console.log(`Created: img/cli-${cmd.name}-v2.png`);
  }

  await browser.close();
}

capture().catch(console.error);
