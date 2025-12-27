#!/usr/bin/env node
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { planCommand } from './commands/plan.js';
import { applyCommand } from './commands/apply.js';
import { statusCommand } from './commands/status.js';
import { CURRENT_VERSION } from './lib/update-checker.js';

const server = new Server(
  { name: 'gg-deploy', version: CURRENT_VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'deploy_site_plan',
      description: 'Preview DNS + GitHub Pages deployment without making changes. Supports GoDaddy, Cloudflare, and Namecheap. Safe to call anytime.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Domain name (e.g., example.com)' },
          repo: { type: 'string', description: 'GitHub repo (e.g., user/repo)' },
        },
        required: ['domain', 'repo'],
      },
    },
    {
      name: 'deploy_site_apply',
      description: 'Execute DNS + GitHub Pages deployment. Configures DNS A records, CNAME, and enables GitHub Pages with custom domain. Supports GoDaddy, Cloudflare, and Namecheap.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Domain name (e.g., example.com)' },
          repo: { type: 'string', description: 'GitHub repo (e.g., user/repo)' },
        },
        required: ['domain', 'repo'],
      },
    },
    {
      name: 'deploy_site_status',
      description: 'Check deployment health: DNS configuration, GitHub Pages status, SSL certificate state. Supports GoDaddy, Cloudflare, and Namecheap. Safe to call anytime.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Domain name (e.g., example.com)' },
          repo: { type: 'string', description: 'GitHub repo (e.g., user/repo)' },
        },
        required: ['domain', 'repo'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const domain = args?.domain as string;
  const repo = args?.repo as string;

  if (!domain || !repo) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'domain and repo are required' }) }],
      isError: true,
    };
  }

  try {
    let result;
    switch (name) {
      case 'deploy_site_plan':
        result = await planCommand(domain, repo, 'json');
        break;
      case 'deploy_site_apply':
        result = await applyCommand(domain, repo, 'json');
        break;
      case 'deploy_site_status':
        result = await statusCommand(domain, repo, 'json');
        break;
      default:
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
          isError: true,
        };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
      isError: true,
    };
  }
});

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1]?.endsWith('mcp-server.js') || process.argv[1]?.endsWith('mcp-server.ts')) {
  startMcpServer().catch(console.error);
}
