# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**gg-deploy** - Free hosting deserves free tooling. Domain to GitHub Pages in 60 seconds.

Multi-interface deployment tool:
- CLI: `npx gg-deploy apply example.com user/repo`
- Web UI: `npx gg-deploy ui` (React on localhost:3847)
- Desktop App: Tauri-based native app
- MCP Server: For Claude Desktop/Code integration

## Build Commands

```bash
# CLI/npm package
npm run build           # TypeScript compilation
npm run dev             # Development with tsx

# Web UI
cd ui && npm run build  # Vite build to ui/dist/

# Desktop App (Tauri)
npm run tauri:build     # Full release build
npm run tauri:dev       # Development mode

# Binary builds
npm run bundle          # esbuild bundle for pkg
npm run build:binary    # Create standalone binaries
```

## Architecture Notes

### Tauri Desktop App

The desktop app embeds the React UI but **does NOT run the Node.js backend server**. This means:

1. **Config read/write**: Uses Tauri Rust commands (`read_config`, `write_config`) instead of HTTP API
2. **API testing**: Still works (direct HTTPS to GoDaddy/GitHub/Cloudflare)
3. **Deployment**: Currently blocked in desktop mode (would need full backend port)

Key file: `src-tauri/src/lib.rs` - Contains Rust commands for config management

### Frontend Detection

`ui/src/App.tsx` detects Tauri mode via:
```typescript
const isTauri = () => '__TAURI_INTERNALS__' in window
```

When in Tauri mode:
- Uses `invoke()` for config operations
- Skips HTTP API calls for local operations
- Shows appropriate UI for desktop context

## Build Lessons Learned

### Critical: Tauri Desktop Needs Native Commands

**Problem** (v2.0.0): Desktop app shipped without backend server, breaking all config operations.

**Solution**: Implemented Tauri Rust commands in `lib.rs`:
- `read_config()` - Reads from `~/.gg-deploy/config.json`
- `write_config()` - Writes to config file with 0600 permissions
- `get_config_path_str()` - Returns config path for display

**Lesson**: Tauri apps need native alternatives for any server-side functionality.

### macOS Gatekeeper and Unsigned Apps

**Problem**: "App is damaged" error when opening unsigned DMG.

**Solution**: Document first-run instructions:
```bash
xattr -cr "/Applications/GG Deploy.app"
```

Or: Right-click → Open → Open (bypasses Gatekeeper one time)

**Lesson**: Always include first-run instructions in README for unsigned apps.

### Version Sync Across Files

**Files that must match**:
- `package.json` → `version`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/tauri.conf.json` → `version`

**Lesson**: Update all three before any release.

### Custom Menus Replace All Menus

**Problem**: Tauri 2.x custom menus are opt-in and replace the entire menu bar.

**Solution**: When adding custom menu items (like "Check for Updates..."), must recreate:
- App menu (About, Quit, etc.)
- Edit menu (Undo, Redo, Cut, Copy, Paste)
- Window menu (Minimize, Maximize, Close)

Use `PredefinedMenuItem` for standard items to get proper keyboard shortcuts.

### GitHub Actions for Signing

**Required secrets** for signed releases:
- `TAURI_SIGNING_PRIVATE_KEY` - For updater signatures
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Key password

Without these, builds work but updater signatures fail (local dev OK, CI release needs them).

## Testing Checklist

Before any desktop release:

- [ ] Build UI: `cd ui && npm run build`
- [ ] Build Tauri: `npm run tauri:build`
- [ ] Open built app from target directory
- [ ] Verify credentials load from `~/.gg-deploy/config.json`
- [ ] Test settings save/load cycle
- [ ] Verify menu items work (Edit shortcuts, Check for Updates)
- [ ] Test on fresh machine (Gatekeeper experience)

## File Structure

```
gg-deploy/
├── src/                    # CLI/Node.js backend
│   ├── cli.ts              # Commander.js CLI
│   ├── services/           # GoDaddy, GitHub, Cloudflare, Namecheap APIs
│   └── ui-server.ts        # Express server for web UI
├── ui/                     # React frontend
│   ├── src/App.tsx         # Main app with Tauri detection
│   └── dist/               # Built assets (embedded in Tauri)
├── src-tauri/              # Tauri/Rust desktop wrapper
│   ├── src/lib.rs          # Rust commands + menu setup
│   ├── tauri.conf.json     # App config, bundling, updater
│   └── Cargo.toml          # Rust dependencies
└── .github/workflows/      # CI/CD
    └── desktop-release.yml # Multi-platform builds
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Config not loading in desktop | Missing Tauri commands | Check lib.rs has read_config |
| "App is damaged" on macOS | Gatekeeper quarantine | `xattr -cr` on .app |
| Menu shortcuts not working | Missing PredefinedMenuItem | Use predefined for standard items |
| Version mismatch in build | Files not synced | Update all 3 version files |
| Updater signature fails | Missing TAURI_SIGNING_PRIVATE_KEY | Add to GitHub secrets |
