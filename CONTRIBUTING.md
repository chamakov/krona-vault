# Contributing to KRONA VAULT™

> 🌐 **Languages / Idiomas**: [ 🇺🇸 English ](./CONTRIBUTING.md) · [ 🇲🇽 Español ](./CONTRIBUTING.es.md)

Thank you for your interest in contributing to **KRONA VAULT™**! This open-source project provides a secure, reliable, and self-hosted ecosystem for store credit control, point-of-sale checkout, and double-entry accounting.

---

## 🏛️ Philosophy & Invariant Rules

1. **Non-Negotiable Accounting Invariant**: Every financial operation must respect double-entry bookkeeping: $\sum \text{Debit} = \sum \text{Credit}$. Account balances are never directly updated; state changes are recorded strictly through immutable entries.
2. **Zero Secret Leaks**: Never store or log plain-text passwords, TOTP seeds, or cryptographic HMAC keys.
3. **Anti-Fraud Standards**: All redemptions must support second-factor authentication (dynamic QR or offline PIN), and physical vouchers must contain tamper-evident cryptographic seals.
4. **Test-Driven Rigor**: Any change to accounting or cryptography engines must be accompanied by automated tests covering edge cases.

---

## 🛠️ Prerequisites

- **Node.js**: `>= 22.23.4` (recommended: `nvm` or `fnm`; repository includes `.nvmrc` and `.node-version`).
- **npm**: `>= 10.9.9`.
- **Docker & Docker Compose**: Optional for local full-stack database and container staging.
- **Git**: `>= 2.30`.

---

## 🚀 Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/chamakov/krona-vault.git
   cd krona-vault
   ```

2. **Install monorepo dependencies**:
   ```bash
   npm ci
   ```

3. **Verify TypeScript types**:
   ```bash
   npm run typecheck
   ```

4. **Run unit and integration test suites**:
   ```bash
   npm test
   ```

5. **Run End-to-End browser tests with Playwright (optional)**:
   ```bash
   # Install Playwright browsers on first run
   npx playwright install --with-deps chromium

   # Run test suite
   npm run test:e2e
   ```

6. **Start development API server**:
   ```bash
   npm run dev:api
   # API and bilingual PWA will be available at http://localhost:3000
   ```

---

## 📁 Monorepo Layout

```
krona-vault/
├── apps/
│   ├── api/             # HTTP server, double-entry engine, REST endpoints & Cloudflare Worker
│   └── web-pwa/         # Bilingual offline-first PWA frontend (11 portals)
├── packages/
│   ├── crypto-totp/     # Dynamic TOTP QR, offline PIN, HMAC-SHA256 & hash-chain
│   └── shared-types/    # Shared TypeScript contracts and interfaces
├── infra/
│   ├── caddy/           # Reverse proxy configuration with automated TLS
│   └── postgres/        # PostgreSQL schema with double-entry triggers
├── docs/                # Architecture specifications & deployment guides (EN/ES)
├── e2e/                 # Playwright functional and security test suites
├── scripts/             # Backup utilities and maintenance tooling
└── docker-compose.yml   # Multi-container orchestration
```

---

## 📐 Code & Commit Conventions

- We follow **Conventional Commits**:
  - `feat: add multi-currency exchange rate calculation`
  - `fix: resolve residual penny allocation in top cut split`
  - `docs: update Proxmox VE deployment instructions`
  - `test: add test case for FEFO credit burn priority`
  - `refactor: optimize audit hash-chain verification`
- Strict TypeScript everywhere (no unvetted `any`).
- Clear, readable function names and documentation comments.

---

## 🔄 Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Verify all quality gates pass locally:
   - `npm run typecheck` passes with zero errors.
   - `npm test` passes 100%.
   - No `.env` files or secret keys are committed.
3. Push to your branch and submit a Pull Request against `main`.
4. Fill out the PR template describing the context and testing performed.
5. GitHub Actions CI will automatically run verification checks on your PR.

---

## 💬 Community Channels

- **Discussions & Ideas**: Open a thread in [GitHub Discussions](https://github.com/chamakov/krona-vault/discussions) or submit an [Issue](https://github.com/chamakov/krona-vault/issues).
- **Security Inquiries**: Please review [`SECURITY.md`](./SECURITY.md) before reporting security issues publicly.
