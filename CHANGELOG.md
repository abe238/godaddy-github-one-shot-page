# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-26

### Added
- **Multi-provider DNS support**: Now supports GoDaddy, Cloudflare, and Namecheap
- **Cloudflare provider**: Full DNS management with zone auto-detection
- **Namecheap provider**: DNS management with automatic backup before changes
- **DNS Provider Factory**: Auto-detects configured provider from credentials
- **Provider selector in UI**: Choose your DNS provider from dropdown
- **Dynamic credential fields**: UI shows only relevant fields for selected provider
- **Connection testing for all providers**: Verify API credentials work before deploying
- **DNSProviderError class**: Standardized error handling with suggestions

### Changed
- CLI now shows active provider name in plan/status output
- MCP server tools updated to mention multi-provider support
- Config structure extended to support multiple providers
- Existing GoDaddy configurations remain fully compatible

### Fixed
- CLI describe command now uses dynamic version instead of hardcoded value

## [1.1.1] - 2025-12-26

### Added
- Desktop app auto-update support via Tauri updater

### Fixed
- PKG binary crash in update command when running as packaged binary

## [1.1.0] - 2025-12-25

### Added
- Tauri desktop app for macOS, Windows, and Linux
- Node.js SEA (Single Executable Application) builds
- GitHub Actions workflow for cross-platform releases
- Update checker with notification system

## [1.0.0] - 2025-12-24

### Added
- Initial release
- GoDaddy DNS management
- GitHub Pages deployment
- Web UI for easy configuration
- CLI commands: plan, apply, status
- MCP server for Claude integration
- Credential storage in ~/.gg-deploy/config.json
