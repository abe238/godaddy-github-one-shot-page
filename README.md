# gg-deploy

Automates GoDaddy DNS + GitHub Pages deployment. DNS records, CNAME file, Pages config, SSL—all in one command.

Works from CLI, browser UI, or Claude Code.

## Quick Start

```bash
npx gg-deploy ui
# Opens http://localhost:3847
```

Or via CLI:
```bash
npx gg-deploy plan example.com user/repo    # Preview (safe)
npx gg-deploy apply example.com user/repo   # Deploy
npx gg-deploy status example.com user/repo  # Health check
```

## Requirements

- **Node.js 18+** — Check with `node --version`
- **GoDaddy account** with API access enabled
- **GitHub account** with a Personal Access Token
- **Domain on GoDaddy** you want to point to GitHub Pages
- **GitHub repo** with your site content (index.html or built site)

## Setup

Credentials are saved once to `~/.gg-deploy/config.json` and work across all projects.

### Option 1: Web UI (Recommended)

```bash
npx gg-deploy ui
```

The setup wizard walks you through:
1. Creating a GoDaddy API key
2. Creating a GitHub token
3. Testing and saving credentials

### Option 2: Manual Config

Create `~/.gg-deploy/config.json`:
```json
{
  "godaddy": {
    "apiKey": "YOUR_KEY",
    "apiSecret": "YOUR_SECRET",
    "environment": "production"
  },
  "github": {
    "token": "ghp_YOUR_TOKEN"
  }
}
```

### Getting Credentials

**GoDaddy API Key:**
1. Go to https://developer.godaddy.com/keys
2. Click "Create New API Key"
3. Select **Production** (not OTE/Test)
4. Copy Key and Secret immediately (secret shown only once)

**GitHub Token:**
1. Go to https://github.com/settings/tokens/new?description=gg-deploy&scopes=repo
2. Click "Generate token"
3. Copy the token (starts with `ghp_`)

## Web Interface

### Main Screen

| Element | Description |
|---------|-------------|
| **Domain field** | Your GoDaddy domain (e.g., `example.com`) |
| **Repository field** | GitHub repo as `username/repo` |
| **Deploy button** | Starts the deployment process |
| **Status badges** | Show GoDaddy/GitHub connection status |
| **Settings gear** | Opens credential management |

### Status Indicators

| Color | Meaning |
|-------|---------|
| Green (glowing) | Connected and verified |
| Yellow (pulsing) | Testing connection... |
| Red | Error (hover for details) |
| Gray | Not tested yet |

Hover over badges for detailed status. Click the refresh button to re-test connections.

### Settings Screen

- **API Key / Secret / Token fields** — Pre-filled with saved values (masked)
- **Eye icon** — Click to reveal value for copying
- **Status indicators** — Show live verification status
- **Test button** — Re-verify API connections
- **Update Settings** — Save changes

### Deployment Flow

1. Enter domain and repo
2. Click Deploy
3. Watch real-time progress:
   - Verify domain ownership
   - Check repository access
   - Configure DNS records
   - Add CNAME file
   - Enable GitHub Pages
   - Provision SSL certificate
4. Get your live URL

## CLI Commands

| Command | Description | Safe |
|---------|-------------|------|
| `plan <domain> <repo>` | Preview changes | Yes |
| `apply <domain> <repo>` | Execute deployment | No |
| `status <domain> <repo>` | Check health | Yes |
| `ui` | Launch web interface | Yes |
| `mcp-serve` | Start MCP server | Yes |
| `describe` | Output tool schema | Yes |

Add `--output json` for machine-readable output.

## Claude Code / MCP

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gg-deploy": {
      "command": "npx",
      "args": ["-y", "gg-deploy", "mcp-serve"]
    }
  }
}
```

Then tell Claude: "Deploy example.com using user/repo"

## Troubleshooting

### Node.js Issues

| Problem | Solution |
|---------|----------|
| `node: command not found` | Install Node.js from https://nodejs.org |
| `unsupported engine` | Upgrade to Node.js 18+ |
| `EACCES permission denied` | Don't use `sudo`. Fix npm permissions or use nvm |

### GoDaddy API Issues

| Problem | Solution |
|---------|----------|
| `401 Unauthorized` | Wrong API key/secret. Regenerate at developer.godaddy.com |
| `403 Forbidden` | API key is for OTE (test). Create a **Production** key |
| `404 Not Found` | Domain not in your GoDaddy account |
| `422 Invalid` | Domain locked or has pending transfers |
| Red status dot | Hover for error. Usually auth issue |

### GitHub API Issues

| Problem | Solution |
|---------|----------|
| `401 Bad credentials` | Token expired or invalid. Generate new one |
| `403 Forbidden` | Token missing `repo` scope. Regenerate with correct scope |
| `404 Not Found` | Repo doesn't exist or token can't access it |
| Private repo fails | Need GitHub Pro for private repo Pages |

### DNS Issues

| Problem | Solution |
|---------|----------|
| Site not loading | Wait 10-60 min for DNS propagation |
| Wrong IP showing | Clear DNS cache: `sudo dscacheutil -flushcache` (Mac) |
| SSL not working | GitHub needs DNS to resolve first. Check Pages settings |

### Config Issues

| Problem | Solution |
|---------|----------|
| "Not configured" | Check `~/.gg-deploy/config.json` exists |
| Can't find config | It's in your home directory: `ls -la ~/.gg-deploy/` |
| Permission denied | Run `chmod 600 ~/.gg-deploy/config.json` |

### UI Issues

| Problem | Solution |
|---------|----------|
| Port 3847 in use | Kill existing: `lsof -i :3847` then `kill <PID>` |
| Blank page | Clear browser cache or try incognito |
| Eye icon not working | Click reveals value if credentials are saved |

### Common Fixes

```bash
# Check if config exists
cat ~/.gg-deploy/config.json

# Verify Node version
node --version  # Should be 18+

# Test GoDaddy API manually
curl -H "Authorization: sso-key YOUR_KEY:YOUR_SECRET" \
  https://api.godaddy.com/v1/domains

# Test GitHub API manually
curl -H "Authorization: Bearer ghp_YOUR_TOKEN" \
  https://api.github.com/user
```

## How It Works

1. **DNS** — Sets A records to GitHub IPs (185.199.108-111.153) + www CNAME
2. **CNAME** — Creates CNAME file in repo with your domain
3. **Pages** — Enables GitHub Pages on main branch
4. **SSL** — GitHub auto-provisions Let's Encrypt certificate

Total time: ~60 seconds. DNS propagation: 10-60 minutes.

## Security

- Credentials stored in `~/.gg-deploy/config.json` (permission 600)
- Never committed to git
- Eye icon reveals values only locally
- API calls made directly to GoDaddy/GitHub (no proxy)

## Limitations

- GoDaddy only (no Cloudflare/Namecheap yet)
- Public repos or GitHub Pro required for Pages
- Only www subdomain supported
- One domain per deployment

## License

AGPL-3.0 — Free to use, modify, and distribute. Forks must remain open source.

---

Built by [Abe Diaz](https://abediaz.ai) | [GitHub](https://github.com/abe238)
