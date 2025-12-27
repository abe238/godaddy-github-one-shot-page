#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { planCommand } from './commands/plan.js';
import { applyCommand } from './commands/apply.js';
import { statusCommand } from './commands/status.js';
import { listCommand } from './commands/list.js';
import { pushCommand } from './commands/push.js';
import { forgetCommand } from './commands/forget.js';
import { updateCommand } from './commands/update.js';
import { startMcpServer } from './mcp-server.js';
import { startUiServer } from './ui-server.js';
import { checkAndNotify, CURRENT_VERSION } from './lib/update-checker.js';
import type { OutputFormat } from './types.js';

const program = new Command();

program
  .name('gg-deploy')
  .description('Free hosting deserves free tooling. Domain → GitHub Pages in 60 seconds.')
  .version(CURRENT_VERSION);

program
  .command('plan')
  .description('Preview deployment without making changes (safe for AI agents)')
  .argument('<domain>', 'Domain name (e.g., example.com)')
  .argument('<repo>', 'GitHub repo (e.g., user/repo)')
  .option('-o, --output <format>', 'Output format: human or json', 'human')
  .action(async (domain: string, repo: string, opts: { output: string }) => {
    const output = opts.output as OutputFormat;
    const result = await planCommand(domain, repo, output);
    if (output === 'human') await checkAndNotify();
    process.exit(result.status === 'success' ? 0 : 1);
  });

program
  .command('apply')
  .description('Execute deployment (requires confirmation for AI agents)')
  .argument('<domain>', 'Domain name (e.g., example.com)')
  .argument('<repo>', 'GitHub repo (e.g., user/repo)')
  .option('-o, --output <format>', 'Output format: human or json', 'human')
  .action(async (domain: string, repo: string, opts: { output: string }) => {
    const output = opts.output as OutputFormat;
    const result = await applyCommand(domain, repo, output);
    if (output === 'human') await checkAndNotify();
    const exitCode = result.status === 'success' ? 0 :
                     result.status === 'partial_success' ? 2 : 3;
    process.exit(exitCode);
  });

program
  .command('status')
  .description('Check deployment health (safe for AI agents)')
  .argument('<domain>', 'Domain name (e.g., example.com)')
  .argument('<repo>', 'GitHub repo (e.g., user/repo)')
  .option('-o, --output <format>', 'Output format: human or json', 'human')
  .action(async (domain: string, repo: string, opts: { output: string }) => {
    const output = opts.output as OutputFormat;
    const result = await statusCommand(domain, repo, output);
    if (output === 'human') await checkAndNotify();
    process.exit(result.status === 'success' ? 0 : 1);
  });

program
  .command('list')
  .description('List all tracked deployments')
  .option('-o, --output <format>', 'Output format: human or json', 'human')
  .action(async (opts: { output: string }) => {
    const output = opts.output as OutputFormat;
    await listCommand(output);
    if (output === 'human') await checkAndNotify();
  });

program
  .command('push')
  .description('Push local file changes to a tracked deployment (git-free)')
  .argument('[domain]', 'Domain to push to (auto-detects from current directory)')
  .argument('[message]', 'Commit message', 'GitHub Pages Push by gg-deploy')
  .option('-o, --output <format>', 'Output format: human or json', 'human')
  .action(async (domain: string | undefined, message: string | undefined, opts: { output: string }) => {
    const output = opts.output as OutputFormat;
    const result = await pushCommand(domain, message, output);
    if (output === 'human') await checkAndNotify();
    process.exit(result.success ? 0 : 1);
  });

program
  .command('forget')
  .description('Remove a deployment from tracking (does not affect live site)')
  .argument('<domain>', 'Domain to forget')
  .option('-o, --output <format>', 'Output format: human or json', 'human')
  .action(async (domain: string, opts: { output: string }) => {
    const output = opts.output as OutputFormat;
    const result = await forgetCommand(domain, output);
    if (output === 'human') await checkAndNotify();
    process.exit(result.status === 'success' ? 0 : 1);
  });

program
  .command('describe')
  .description('Output tool description for AI agent discovery')
  .action(() => {
    const description = {
      schema_version: '1.0',
      name: 'gg-deploy',
      version: CURRENT_VERSION,
      description: 'Deploy any domain to GitHub Pages in one command. Zero git knowledge required. Supports GoDaddy, Cloudflare, and Namecheap DNS providers.',
      homepage: 'https://github.com/abe238/gg-deploy',
      capabilities: [
        'Deploy custom domains to GitHub Pages',
        'Configure DNS records automatically',
        'Push file updates without git',
        'Track deployment history',
        'Check deployment health and SSL status',
      ],
      ai_guidance: {
        when_to_use: 'User wants to deploy a website to GitHub Pages with a custom domain, or update an existing deployment',
        prerequisites: 'DNS provider credentials (GoDaddy/Cloudflare/Namecheap) and GitHub access configured',
        recommended_flow: [
          '1. Run "plan" to preview changes (safe, read-only)',
          '2. Run "apply" to deploy (creates DNS records + enables GitHub Pages)',
          '3. Run "push" to update files (git-free file sync)',
          '4. Run "status" to verify health',
        ],
        user_intents: {
          'deploy a website': 'Use plan → apply',
          'update my site': 'Use push',
          'check if site is working': 'Use status',
          'see my deployments': 'Use list',
          'stop tracking a site': 'Use forget (note: does not delete DNS or GitHub Pages)',
        },
      },
      mcp_integration: {
        server_command: 'gg-deploy mcp-serve',
        compatible_clients: ['Claude Desktop', 'Claude Code', 'Cursor', 'Windsurf', 'N8N', 'any MCP-compatible agent'],
        tools: [
          { cli: 'plan', mcp: 'deploy_site_plan' },
          { cli: 'apply', mcp: 'deploy_site_apply' },
          { cli: 'status', mcp: 'deploy_site_status' },
          { cli: 'list', mcp: 'list_deployments' },
          { cli: 'push', mcp: 'push_changes' },
        ],
      },
      commands: [
        {
          name: 'plan',
          description: 'Preview deployment without making changes. Validates API keys, checks domain ownership, and shows planned DNS/GitHub changes.',
          intent: 'User wants to see what will happen before deploying',
          safe: true,
          arguments: [
            { name: 'domain', required: true, description: 'Domain name (e.g., example.com)', type: 'string' },
            { name: 'repo', required: true, description: 'GitHub repo (e.g., user/repo)', type: 'string' },
          ],
          options: [{ name: '--output', values: ['human', 'json'], default: 'human' }],
          example_input: 'gg-deploy plan myblog.com user/blog --output json',
          example_output: '{"status":"success","plan":{"dns_changes":[...],"github_changes":[...]}}',
        },
        {
          name: 'apply',
          description: 'Execute deployment. Creates DNS A records + CNAME, adds CNAME file to repo, enables GitHub Pages with custom domain.',
          intent: 'User wants to deploy their site to production',
          safe: false,
          requires_confirmation: true,
          side_effects: ['Creates 4 A records + 1 CNAME in DNS', 'Creates CNAME file in GitHub repo', 'Enables GitHub Pages', 'Saves deployment to local history'],
          rollback_available: true,
          arguments: [
            { name: 'domain', required: true, description: 'Domain name', type: 'string' },
            { name: 'repo', required: true, description: 'GitHub repo', type: 'string' },
          ],
          options: [{ name: '--output', values: ['human', 'json'], default: 'human' }],
          example_input: 'gg-deploy apply myblog.com user/blog --output json',
          example_output: '{"status":"success","completed_steps":["verify_domain","verify_repo","configure_dns","add_cname","enable_pages","set_custom_domain","save_deployment"]}',
        },
        {
          name: 'status',
          description: 'Check deployment health including DNS propagation, GitHub Pages status, and SSL certificate state.',
          intent: 'User wants to verify their site is working correctly',
          safe: true,
          arguments: [
            { name: 'domain', required: true, type: 'string' },
            { name: 'repo', required: true, type: 'string' },
          ],
          options: [{ name: '--output', values: ['human', 'json'], default: 'human' }],
          example_input: 'gg-deploy status myblog.com user/blog --output json',
          example_output: '{"domain":"myblog.com","dns_configured":true,"github_pages_enabled":true,"ssl_status":"active","health":"healthy"}',
        },
        {
          name: 'list',
          description: 'Show all tracked deployments with their domains, repos, local paths, and last activity timestamps.',
          intent: 'User wants to see what sites they have deployed',
          safe: true,
          arguments: [],
          options: [{ name: '--output', values: ['human', 'json'], default: 'human' }],
          example_input: 'gg-deploy list --output json',
          example_output: '[{"domain":"myblog.com","repo":"user/blog","localPath":"/Users/me/blog","lastActivity":"2025-12-27T10:00:00Z"}]',
        },
        {
          name: 'push',
          description: 'Upload local file changes to GitHub. Git-free: uses GitHub API directly. Auto-detects deployment from current directory.',
          intent: 'User edited local HTML/CSS files and wants to update their live site',
          safe: false,
          requires_confirmation: false,
          side_effects: ['Commits changed files to GitHub repository via API'],
          rollback_available: false,
          arguments: [
            { name: 'domain', required: false, description: 'Domain (optional, auto-detects from cwd)', type: 'string' },
            { name: 'message', required: false, description: 'Commit message', type: 'string', default: 'GitHub Pages Push by gg-deploy' },
          ],
          options: [{ name: '--output', values: ['human', 'json'], default: 'human' }],
          example_input: 'gg-deploy push "Updated homepage"',
          example_output: '{"success":true,"filesChanged":[{"path":"index.html","action":"update"}]}',
        },
        {
          name: 'forget',
          description: 'Remove deployment from local tracking. WARNING: Does NOT delete DNS records or disable GitHub Pages - site remains live.',
          intent: 'User wants to stop tracking a deployment locally',
          safe: true,
          warning: 'This only removes local tracking. To fully decommission, user must manually delete DNS records and disable GitHub Pages.',
          arguments: [
            { name: 'domain', required: true, description: 'Domain to forget', type: 'string' },
          ],
          options: [{ name: '--output', values: ['human', 'json'], default: 'human' }],
          example_input: 'gg-deploy forget myblog.com',
          example_output: '{"status":"success","completed_steps":["remove_deployment"]}',
        },
      ],
      exit_codes: {
        0: 'success - operation completed successfully',
        1: 'validation_error - invalid input or configuration',
        2: 'partial_success - some steps completed, others failed',
        3: 'failure - operation failed completely',
        4: 'rollback_needed - manual intervention required',
      },
      domain_normalization: 'Accepts domains with/without http(s)://, www., trailing slashes. Examples: "https://www.example.com/" → "example.com"',
    };
    console.log(JSON.stringify(description, null, 2));
  });

program
  .command('mcp-serve')
  .description('Start MCP server for AI agent integration (Claude Desktop, Claude Code, Cursor, Windsurf, N8N, and any MCP-compatible client)')
  .action(async () => {
    await startMcpServer();
  });

program
  .command('ui')
  .description('Start local web interface')
  .action(async () => {
    await startUiServer();
  });

program
  .command('update')
  .description('Check for updates and show upgrade instructions')
  .action(async () => {
    await updateCommand();
  });

program.parse();
