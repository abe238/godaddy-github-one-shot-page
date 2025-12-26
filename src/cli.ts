#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { planCommand } from './commands/plan.js';
import { applyCommand } from './commands/apply.js';
import { statusCommand } from './commands/status.js';
import { startMcpServer } from './mcp-server.js';
import { startUiServer } from './ui-server.js';
import type { OutputFormat } from './types.js';

const program = new Command();

program
  .name('gg-deploy')
  .description('Free hosting deserves free tooling. Domain → GitHub Pages in 60 seconds.')
  .version('1.0.0');

program
  .command('plan')
  .description('Preview deployment without making changes (safe for AI agents)')
  .argument('<domain>', 'Domain name (e.g., example.com)')
  .argument('<repo>', 'GitHub repo (e.g., user/repo)')
  .option('-o, --output <format>', 'Output format: human or json', 'human')
  .action(async (domain: string, repo: string, opts: { output: string }) => {
    const output = opts.output as OutputFormat;
    const result = await planCommand(domain, repo, output);
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
    process.exit(result.status === 'success' ? 0 : 1);
  });

program
  .command('describe')
  .description('Output tool description for AI agent discovery')
  .action(() => {
    const description = {
      name: 'gg-deploy',
      version: '0.1.0',
      description: 'Deploy any domain to GitHub Pages in one command',
      commands: [
        {
          name: 'plan',
          description: 'Preview deployment without making changes',
          safe: true,
          arguments: [
            { name: 'domain', required: true, description: 'Domain name' },
            { name: 'repo', required: true, description: 'GitHub repo (user/repo)' },
          ],
          options: [
            { name: '--output', values: ['human', 'json'], default: 'human' },
          ],
          example: 'gg-deploy plan example.com user/example --output json',
        },
        {
          name: 'apply',
          description: 'Execute deployment',
          safe: false,
          requires_confirmation: true,
          side_effects: ['Creates DNS records', 'Modifies GitHub Pages settings'],
          rollback_available: true,
          arguments: [
            { name: 'domain', required: true },
            { name: 'repo', required: true },
          ],
          options: [
            { name: '--output', values: ['human', 'json'], default: 'human' },
          ],
          example: 'gg-deploy apply example.com user/example --output json',
        },
        {
          name: 'status',
          description: 'Check deployment health',
          safe: true,
          arguments: [
            { name: 'domain', required: true },
            { name: 'repo', required: true },
          ],
          options: [
            { name: '--output', values: ['human', 'json'], default: 'human' },
          ],
          example: 'gg-deploy status example.com user/example --output json',
        },
      ],
      exit_codes: {
        0: 'success',
        1: 'validation_error',
        2: 'partial_success',
        3: 'failure',
        4: 'rollback_needed',
      },
    };
    console.log(JSON.stringify(description, null, 2));
  });

program
  .command('mcp-serve')
  .description('Start MCP server for Claude Desktop/Code integration')
  .action(async () => {
    await startMcpServer();
  });

program
  .command('ui')
  .description('Start local web interface')
  .action(async () => {
    await startUiServer();
  });

program.parse();
