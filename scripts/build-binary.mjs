#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const version = pkg.version;

console.log(`\n🚀 Building gg-deploy v${version} binaries...\n`);

// Ensure bin directory exists
const binDir = join(projectRoot, 'bin');
if (!existsSync(binDir)) {
  mkdirSync(binDir, { recursive: true });
}

// Step 1: Build TypeScript
console.log('📦 Compiling TypeScript...');
execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });

// Step 2: Bundle with esbuild
console.log('\n📦 Bundling with esbuild...');
execSync(`npx esbuild dist/cli.js \
  --bundle \
  --platform=node \
  --target=node18 \
  --outfile=bin/cli.bundle.cjs \
  --format=cjs \
  --external:fsevents \
  --minify`, { cwd: projectRoot, stdio: 'inherit' });

// Step 3: Create binaries with pkg
console.log('\n🔨 Creating native binaries...');

const targets = [
  { pkg: 'node18-macos-arm64', name: `gg-deploy-${version}-macos-arm64` },
  { pkg: 'node18-macos-x64', name: `gg-deploy-${version}-macos-x64` },
  { pkg: 'node18-linux-x64', name: `gg-deploy-${version}-linux-x64` },
  { pkg: 'node18-linux-arm64', name: `gg-deploy-${version}-linux-arm64` },
  { pkg: 'node18-win-x64', name: `gg-deploy-${version}-win-x64.exe` },
];

for (const target of targets) {
  console.log(`  → ${target.name}`);
  try {
    execSync(`npx pkg bin/cli.bundle.cjs \
      --target ${target.pkg} \
      --output bin/${target.name} \
      --compress GZip`, { cwd: projectRoot, stdio: 'pipe' });
  } catch (error) {
    console.error(`    ⚠️ Failed: ${error.message}`);
  }
}

console.log('\n✅ Build complete! Binaries in ./bin/\n');

// List created files
execSync('ls -lh bin/', { cwd: projectRoot, stdio: 'inherit' });
