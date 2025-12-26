# gg-deploy v2.0: Multi-Provider DNS Support

**Target Release:** v2.0.0
**Total Tasks:** 39
**Estimated Effort:** 18-21 hours

---

## Phase 1: Core Infrastructure (5 tasks)

### 1.1 Create DNSProvider interface in types.ts
- [ ] Add `DNSProvider` interface with methods:
  - `listDomains(): Promise<DomainInfo[]>`
  - `getDNSRecords(domain: string): Promise<DNSRecord[]>`
  - `setGitHubPagesRecords(domain: string, githubUser: string): Promise<void>`
  - `verifyDomain(domain: string): Promise<boolean>`
- [ ] Add `readonly name: ProviderName` property
- [ ] Add `DomainInfo` type: `{ domain: string; status: string }`
- [ ] Add `ProviderName` type: `'godaddy' | 'cloudflare' | 'namecheap'`

### 1.2 Create DNSProviderError class in types.ts
- [ ] Define error codes: `AUTH_ERROR | DOMAIN_NOT_FOUND | RATE_LIMITED | VALIDATION_ERROR`
- [ ] Properties: `provider`, `code`, `humanMessage`, `suggestion?`, `retriable`
- [ ] Extend `Error` class with formatted message

### 1.3 Extend AppConfig in config.ts
- [ ] Add `CloudflareConfig` interface: `{ apiToken: string }`
- [ ] Add `NamecheapConfig` interface: `{ apiUser: string; apiKey: string; clientIP: string }`
- [ ] Add optional `dnsProvider?: ProviderName` to `AppConfig`
- [ ] Add `cloudflare?: CloudflareConfig` to `AppConfig`
- [ ] Add `namecheap?: NamecheapConfig` to `AppConfig`
- [ ] Add `getCloudflareConfig(): CloudflareConfig | null`
- [ ] Add `getNamecheapConfig(): NamecheapConfig | null`
- [ ] Add `saveCloudflareConfig()` function
- [ ] Add `saveNamecheapConfig()` function

### 1.4 Create dns-factory.ts
- [ ] Create `src/services/dns-factory.ts`
- [ ] Implement `detectProvider(config: AppConfig): ProviderName`
  - Return explicit `dnsProvider` if set
  - Auto-detect from credentials if single provider
  - Error if multiple providers without explicit selection
- [ ] Implement `create(config: AppConfig): DNSProvider`
  - Lazy instantiation based on detected provider
  - Return appropriate service class

### 1.5 Refactor GoDaddyService to implement DNSProvider
- [ ] Add `implements DNSProvider` to class declaration
- [ ] Add `readonly name: ProviderName = 'godaddy'`
- [ ] Update constructor to accept `GoDaddyConfig` parameter
- [ ] Convert error throws to `DNSProviderError`
- [ ] Ensure all method signatures match interface
- [ ] Add retry logic with exponential backoff

---

## Phase 2: Cloudflare Provider (7 tasks)

### 2.1 Create cloudflare.ts skeleton
- [ ] Create `src/services/cloudflare.ts`
- [ ] Define `CloudflareService` class implementing `DNSProvider`
- [ ] Add `readonly name = 'cloudflare'`
- [ ] Set `baseUrl = 'https://api.cloudflare.com/client/v4'`
- [ ] Implement `headers` getter with Bearer token auth

### 2.2 Implement getZoneId() method
- [ ] Fetch `/zones?name={domain}`
- [ ] Extract zone ID from `result[0].id`
- [ ] Throw `DNSProviderError` if zone not found
- [ ] Consider caching zone ID for session

### 2.3 Implement listDomains() for Cloudflare
- [ ] Fetch `/zones` with pagination
- [ ] Map zones to `DomainInfo[]` format
- [ ] Handle pagination (`page`, `per_page` params)

### 2.4 Implement getDNSRecords() for Cloudflare
- [ ] Fetch `/zones/{zoneId}/dns_records`
- [ ] Filter to A, CNAME, TXT types
- [ ] Map to `DNSRecord[]` format

### 2.5 Implement setGitHubPagesRecords() for Cloudflare
- [ ] Get zone ID first
- [ ] Delete existing A records for `@` name
- [ ] Delete existing CNAME for `www` name
- [ ] Create 4 A records with GitHub IPs
  - **CRITICAL:** Set `proxied: false` (required for GitHub HTTPS)
- [ ] Create CNAME record for `www` → `{user}.github.io`
- [ ] Consider batch API for atomic operations

### 2.6 Implement verifyDomain() for Cloudflare
- [ ] Check if domain exists in zones list
- [ ] Return boolean

### 2.7 Add retry logic with exponential backoff
- [ ] Create `withRetry<T>(fn, maxRetries)` helper
- [ ] Parse `Ratelimit-Remaining` header
- [ ] Respect 1200 requests/5min limit
- [ ] Exponential backoff: 1s, 2s, 4s delays

---

## Phase 3: Command Integration (5 tasks)

### 3.1 Update apply.ts to use factory
- [ ] Import `DNSProviderFactory` and `readConfig`
- [ ] Replace `new GoDaddyService()` with `DNSProviderFactory.create(readConfig())`
- [ ] Update variable name from `godaddy` to `dns`
- [ ] Handle `DNSProviderError` in catch block
- [ ] Test with existing GoDaddy config (regression test)

### 3.2 Update plan.ts to use factory
- [ ] Same changes as apply.ts
- [ ] Add provider name to plan output: `"Provider: cloudflare"`

### 3.3 Update status.ts to use factory
- [ ] Same changes as apply.ts
- [ ] Add provider name to status output

### 3.4 Update CLI help text
- [ ] Update `--help` output to mention multi-provider support
- [ ] Add examples for each provider
- [ ] Document `dnsProvider` config field

### 3.5 Add integration tests for factory
- [ ] Test: single provider auto-detection
- [ ] Test: explicit provider selection overrides auto-detect
- [ ] Test: error thrown when multiple providers without explicit selection
- [ ] Test: error thrown when no provider configured

---

## Phase 4: Namecheap Provider (10 tasks)

### 4.1 Add dependencies
- [ ] `npm install tldts` (Public Suffix List parsing)
- [ ] `npm install xml2js` (XML parsing)
- [ ] Add types: `@types/xml2js`
- [ ] Update package.json

### 4.2 Create namecheap.ts skeleton
- [ ] Create `src/services/namecheap.ts`
- [ ] Define `NamecheapService` class implementing `DNSProvider`
- [ ] Add `readonly name = 'namecheap'`
- [ ] Set API endpoint: `https://api.namecheap.com/xml.response`
- [ ] Store config: `apiUser`, `apiKey`, `clientIP`

### 4.3 Implement splitDomain() helper
- [ ] Import `parse` from `tldts`
- [ ] Extract `domainWithoutSuffix` (SLD) and `publicSuffix` (TLD)
- [ ] Handle edge cases: `co.uk`, `com.au`, `.photography`
- [ ] Return `{ sld: string; tld: string }`

### 4.4 Implement XML request builder
- [ ] Build URL with query params: `ApiUser`, `ApiKey`, `UserName`, `ClientIp`, `Command`
- [ ] Parse XML response with `xml2js`
- [ ] Extract errors from `ApiResponse.Errors`
- [ ] Map error codes to `DNSProviderError`:
  - 1011150 → IP not whitelisted
  - 500000 → Rate limited

### 4.5 Implement listDomains() for Namecheap
- [ ] Command: `namecheap.domains.getList`
- [ ] Parse `DomainGetListResult.Domain` array
- [ ] Map to `DomainInfo[]`

### 4.6 Implement getDNSRecords() for Namecheap
- [ ] Command: `namecheap.domains.dns.getHosts`
- [ ] Parse domain with `splitDomain()`
- [ ] Parse `DomainDNSGetHostsResult.host` array
- [ ] Map to `DNSRecord[]`

### 4.7 Implement backup mechanism
- [ ] Create `.gg-deploy/backups/` directory if not exists
- [ ] Fetch current records before any write
- [ ] Save as JSON: `{domain}-{timestamp}.json`
- [ ] Log backup path to console: `"Backup saved to .gg-deploy/backups/..."`

### 4.8 Implement setGitHubPagesRecords() for Namecheap
- [ ] **Step 1:** Backup existing records (4.7)
- [ ] **Step 2:** Fetch all current records
- [ ] **Step 3:** Filter out GitHub-related records (A @ with GitHub IPs, CNAME www)
- [ ] **Step 4:** Create new GitHub records array
- [ ] **Step 5:** Merge preserved + new records
- [ ] **Step 6:** Call `namecheap.domains.dns.setHosts` with FULL record list
  - **WARNING:** This replaces ALL records!
- [ ] **Step 7:** Verify records applied correctly

### 4.9 Implement verifyDomain() for Namecheap
- [ ] Check domain exists in `getList` response
- [ ] Check status is active
- [ ] Return boolean

### 4.10 Add Namecheap-specific error handling
- [ ] Handle IP whitelist error (1011150): suggest adding IP in dashboard
- [ ] Handle rate limit error (500000): retry with backoff
- [ ] Handle auth errors: check apiKey, apiUser
- [ ] Log helpful messages for common errors

---

## Phase 5: UI Updates (5 tasks)

### 5.1 Add provider selector to Settings
- [ ] Add dropdown/radio: GoDaddy | Cloudflare | Namecheap
- [ ] Default to auto-detected provider
- [ ] Save selection to `dnsProvider` in config
- [ ] Style consistently with existing UI

### 5.2 Create dynamic credential fields
- [ ] **GoDaddy fields:** API Key, API Secret, Environment (prod/ote)
- [ ] **Cloudflare fields:** API Token only
- [ ] **Namecheap fields:** API User, API Key, Client IP
- [ ] Show/hide fields based on provider selection
- [ ] Preserve existing values when switching

### 5.3 Update connection test logic
- [ ] Test button uses selected provider
- [ ] Show provider-specific error messages
- [ ] Update status badge for each provider independently
- [ ] Handle provider-specific errors gracefully

### 5.4 Update main deploy screen
- [ ] Show current provider name badge
- [ ] Add provider-specific help links
- [ ] Show warning for Namecheap: "Requires IP whitelist"
- [ ] Show tip for Cloudflare: "Recommended for new users"

### 5.5 Update UI server endpoints
- [ ] Add `/api/test-cloudflare` endpoint
- [ ] Add `/api/test-namecheap` endpoint
- [ ] Update `/api/save-config` to handle all providers
- [ ] Update `/api/status` to return current provider

---

## Phase 6: Documentation & Release (6 tasks)

### 6.1 Update README.md
- [ ] Add provider comparison table
- [ ] Add Cloudflare setup guide with screenshots
- [ ] Add Namecheap setup guide with IP whitelist warning
- [ ] Update requirements section
- [ ] Update troubleshooting for each provider
- [ ] Add migration guide for existing users

### 6.2 Create/Update CHANGELOG.md
- [ ] Document v2.0.0 release
- [ ] List new features: Cloudflare support, Namecheap support
- [ ] List any breaking changes
- [ ] Credit contributors

### 6.3 Update MCP server
- [ ] Ensure `mcp-server.ts` uses `DNSProviderFactory`
- [ ] Update tool descriptions to mention multi-provider
- [ ] Test MCP server with each provider

### 6.4 Create unit tests
- [ ] Test `DNSProviderFactory.detectProvider()` logic
- [ ] Test each provider implements interface correctly
- [ ] Mock API responses for each provider
- [ ] Test error handling and retry logic

### 6.5 Create integration tests (optional)
- [ ] Document test account setup for each provider
- [ ] Create test scripts with real API calls
- [ ] Add `npm run test:integration` script
- [ ] Skip in CI without credentials

### 6.6 Fix describe command version
- [ ] Update `cli.ts` describe command to use `CURRENT_VERSION` instead of hardcoded `'0.1.0'`

### 6.7 Version bump and release
- [ ] Update `package.json` version from `1.1.x` to `2.0.0`
- [ ] Run full test suite
- [ ] Build and verify package
- [ ] Create git tag `v2.0.0`
- [ ] Push tag to GitHub
- [ ] `npm publish`
- [ ] Create GitHub Release with notes
- [ ] Announce on relevant channels

---

## Task Dependencies

```
Phase 1 ─┬─> Phase 2 (Cloudflare)
         │
         ├─> Phase 3 (Commands) ──> Phase 6.3 (MCP)
         │
         └─> Phase 4 (Namecheap)

Phase 2 + 4 ──> Phase 5 (UI)

All Phases ──> Phase 6 (Docs & Release)
```

## Quick Reference: Files to Create/Modify

| File | Action | Phase |
|------|--------|-------|
| `src/types.ts` | MODIFY | 1 |
| `src/config.ts` | MODIFY | 1 |
| `src/services/dns-factory.ts` | CREATE | 1 |
| `src/services/godaddy.ts` | MODIFY | 1 |
| `src/services/cloudflare.ts` | CREATE | 2 |
| `src/services/namecheap.ts` | CREATE | 4 |
| `src/commands/apply.ts` | MODIFY | 3 |
| `src/commands/plan.ts` | MODIFY | 3 |
| `src/commands/status.ts` | MODIFY | 3 |
| `src/cli.ts` | MODIFY | 3 |
| `src/mcp-server.ts` | MODIFY | 6 |
| `src/ui-server.ts` | MODIFY | 5 |
| `ui/src/App.tsx` | MODIFY | 5 |
| `README.md` | MODIFY | 6 |
| `CHANGELOG.md` | CREATE/MODIFY | 6 |
| `package.json` | MODIFY | 4, 6 |

---

## Risk Mitigation Checklist

- [ ] Namecheap: Backup mechanism implemented before any write
- [ ] Cloudflare: `proxied: false` hardcoded for all GitHub records
- [ ] All providers: Retry logic with exponential backoff
- [ ] All providers: Errors normalized to DNSProviderError
- [ ] Factory: Clear error when multiple providers configured
- [ ] Config: Backward compatible (existing GoDaddy configs work)
- [ ] UI: Dynamic fields prevent credential confusion
- [ ] Docs: IP whitelist warning prominent for Namecheap

---

*Generated: December 26, 2025*
*Plan approved by: Adversarial debate analysis*
