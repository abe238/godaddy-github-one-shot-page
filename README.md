# gg-deploy

I got tired of clicking through GoDaddy's UI every time I wanted to point a domain at GitHub Pages. This automates the whole thing: DNS records, CNAME file, Pages config, SSL verification.

Works from the command line. Works from Claude Code. Works from a browser UI.

## Quick Start

```bash
# Preview what will change (safe, no modifications)
npx gg-deploy plan abediaz.ai abe238/abediaz.ai

# Execute deployment
npx gg-deploy apply abediaz.ai abe238/abediaz.ai

# Check if everything's working
npx gg-deploy status abediaz.ai abe238/abediaz.ai
```

## What It Does

1. **Configures GoDaddy DNS** - Sets A records pointing to GitHub Pages IPs, adds www CNAME
2. **Creates CNAME file** - Adds the CNAME file to your repo so GitHub knows the custom domain
3. **Enables GitHub Pages** - Configures Pages with your custom domain
4. **Monitors SSL** - Checks certificate provisioning status

The whole flow takes about 60 seconds. DNS propagation takes longer; the 600s TTL means you might wait 10 minutes to an hour for full propagation.

## Setup

### GoDaddy API Credentials

1. Go to https://developer.godaddy.com/keys
2. Create a new API key (Production environment)
3. Save the key and secret

```bash
# Create .env file
cat > .env << 'EOF'
GODADDY_API_KEY=your-key-here
GODADDY_API_SECRET=your-secret-here
EOF
```

### GitHub CLI

Make sure you're authenticated with the GitHub CLI:

```bash
gh auth login
```

## Commands

### plan

Preview deployment without making changes. Safe to run anytime.

```bash
gg-deploy plan example.com user/repo
```

### apply

Execute the deployment. Configures DNS, creates CNAME, enables Pages.

```bash
gg-deploy apply example.com user/repo
```

### status

Check deployment health: DNS configuration, Pages status, SSL state.

```bash
gg-deploy status example.com user/repo
```

### mcp-serve

Start the MCP server for Claude Desktop/Code integration.

```bash
gg-deploy mcp-serve
```

## Claude Code / MCP Integration

This tool works as an MCP server, so Claude Code can deploy sites directly.

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

Then just tell Claude: "Deploy my site at example.com using abe238/example repo"

### Available MCP Tools

| Tool | Description | Safe |
|------|-------------|------|
| `deploy_site_plan` | Preview changes | Yes |
| `deploy_site_apply` | Execute deployment | No (confirmation required) |
| `deploy_site_status` | Health check | Yes |

## AI-Native Design

This CLI was built for AI agents from the start:

- **Structured JSON output**: `--output json` for machine-parseable responses
- **Self-describing**: `gg-deploy describe` outputs tool schema for agent discovery
- **Consistent exit codes**: 0=success, 1=validation error, 2=partial success, 3=failure
- **Safe commands marked**: `plan` and `status` can run without confirmation

```bash
# Example: JSON output for automation
gg-deploy status example.com user/repo --output json
```

## Real Example

I used this to deploy [abediaz.ai](https://abediaz.ai):

```bash
$ gg-deploy apply abediaz.ai abe238/abediaz.ai

=== Deploying ===

✔ Domain verified
✔ Repository verified
✔ DNS records configured
✔ CNAME file added
✔ GitHub Pages enabled
✔ Custom domain set

=== Deployment Complete ===

Site URL: https://abediaz.ai
```

## Requirements

- Node.js 18+
- GoDaddy account with API access
- GitHub CLI (`gh`) authenticated
- A domain registered on GoDaddy
- A GitHub repository with your site content

## How It Works

1. **DNS**: Sets four A records pointing to GitHub's Pages IPs (185.199.108-111.153) and a www CNAME pointing to your-username.github.io
2. **Repository**: Creates a CNAME file in your repo root containing your domain name
3. **Pages**: Enables GitHub Pages on the main branch with your custom domain
4. **SSL**: GitHub automatically provisions a Let's Encrypt certificate once DNS resolves

## Limitations

- Only works with GoDaddy (for now)
- Requires public repos or GitHub Pro for private repo Pages
- Can't configure subdomains other than www
- No Cloudflare/Namecheap support yet

## License

MIT

---

Built by [Abe Diaz](https://abediaz.ai) | [GitHub](https://github.com/abe238)
