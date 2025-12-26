# godaddy-github-one-shot-page

AI-native CLI for GoDaddy + GitHub Pages one-shot deployment. Human-friendly. Agent-native.

## Installation

```bash
npm install -g godaddy-github-one-shot-page
```

Or run directly:

```bash
npx godaddy-github-one-shot-page plan example.com user/repo
```

## Setup

1. Get GoDaddy API credentials from https://developer.godaddy.com/keys
2. Create `.env` file:

```bash
GODADDY_API_KEY=your-key
GODADDY_API_SECRET=your-secret
```

3. Authenticate with GitHub CLI:

```bash
gh auth login
```

## Usage

### Plan (Preview Changes)

```bash
gg-deploy plan example.com user/repo
```

### Apply (Execute Deployment)

```bash
gg-deploy apply example.com user/repo
```

### Check Status

```bash
gg-deploy status example.com user/repo
```

### JSON Output (for AI agents)

```bash
gg-deploy plan example.com user/repo --output json
```

## AI Agent Integration

This tool is designed to be used by AI coding agents. Key features:

- **Structured JSON output** with `--output json`
- **Safe commands** (`plan`, `status`) can be called without confirmation
- **Self-describing** via `gg-deploy describe`
- **Consistent exit codes**: 0=success, 1=validation, 2=partial, 3=failure

### MCP Integration (Coming Soon)

```bash
gg-deploy mcp-serve
```

## What It Does

1. **Configures GoDaddy DNS** - Sets A records and CNAME for GitHub Pages
2. **Adds CNAME file** - Creates CNAME file in your repo
3. **Enables GitHub Pages** - Configures Pages with custom domain
4. **Monitors SSL** - Tracks HTTPS certificate provisioning

## License

MIT
