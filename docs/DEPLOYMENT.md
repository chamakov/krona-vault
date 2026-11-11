# Multi-Environment Deployment Guide — KRONA VAULT™

> 🌐 **Languages / Idiomas**: [ 🇺🇸 English ](./DEPLOYMENT.md) · [ 🇲🇽 Español ](./DEPLOYMENT.es.md)

This guide describes how to deploy **KRONA VAULT™** across various environments, from fast local development to production-grade, highly available self-hosted setups on **Proxmox VE**, **Linux VPS**, **Docker Compose**, and **Cloudflare Workers**.

---

## Table of Contents

1. [Hardware & Infrastructure Requirements](#1-hardware--infrastructure-requirements)
2. [Quick Deployment with Docker Compose (Recommended)](#2-quick-deployment-with-docker-compose-recommended)
3. [Production Deployment on Proxmox VE / Linux VPS](#3-production-deployment-on-proxmox-ve--linux-vps)
4. [Secure Cryptographic Key Generation](#4-secure-cryptographic-key-generation)
5. [Reverse Proxy & TLS Configuration (Caddy + Cloudflare)](#5-reverse-proxy--tls-configuration-caddy--cloudflare)
6. [Database Backup & Restoration](#6-database-backup--restoration)
7. [Serverless Edge Deployment (Cloudflare Workers & D1)](#7-serverless-edge-deployment-cloudflare-workers--d1)
8. [Health Checks & Observability](#8-health-checks--observability)

---

## 1. Hardware & Infrastructure Requirements

### Minimum (1 store, up to 2,000 players)
- **CPU**: 1 vCPU (x86_64 or ARM64)
- **RAM**: 1.5 GB
- **Storage**: 20 GB SSD
- **OS**: Debian 12 / Ubuntu 22.04 LTS or Proxmox VE LXC Container / VM

### Recommended (Multi-store consorcia, 100+ concurrent tournament players)
- **CPU**: 2 vCPU
- **RAM**: 4 GB
- **Storage**: 50 GB NVMe with off-site backups
- **OS**: Ubuntu 24.04 LTS / Debian 12

---

## 2. Quick Deployment with Docker Compose (Recommended)

The [`docker-compose.yml`](../docker-compose.yml) orchestrates the complete production stack in isolated containers:
- **`krona-app`**: Node.js 22 LTS (Bilingual PWA + REST API + Ledger Engine).
- **`krona-postgres`**: PostgreSQL 16 with checksums, WAL archiving, and double-entry triggers.
- **`krona-valkey`**: In-memory Valkey 8 for anti-replay nonce tracking and real-time pub/sub.
- **`krona-caddy`**: Reverse proxy with Cloudflare DNS-01 ACME challenge for automated TLS.
- **`krona-db-backup`**: Scheduled cron container making compressed PostgreSQL dumps every 15 minutes.

### Steps:

1. **Clone the repository on the target host**:
   ```bash
   git clone https://github.com/chamakov/krona-vault.git /opt/krona-vault
   cd /opt/krona-vault
   ```

2. **Copy and configure environment variables**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   *(See [Secure Cryptographic Key Generation](#4-secure-cryptographic-key-generation))*.

3. **Build and launch services in background**:
   ```bash
   docker compose up -d --build
   ```

4. **Verify container health**:
   ```bash
   docker compose ps
   ```

5. **Access the application**:
   Navigate to `http://localhost:3000` (or your configured FQDN via Caddy).

---

## 3. Production Deployment on Proxmox VE / Linux VPS

### Proxmox VE (LXC vs VM):
- A **KVM Virtual Machine** with Debian 12 or Ubuntu 24.04 is recommended for full disk and kernel virtualization.
- For an **Unprivileged LXC Container**, ensure `nesting=1` and `keyctl=1` are enabled in the container configuration.

### Systemd Service for Automated Boot
```ini
# /etc/systemd/system/krona-vault.service
[Unit]
Description=KRONA VAULT™ Stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/krona-vault
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now krona-vault.service
```

---

## 4. Secure Cryptographic Key Generation

Before deploying to production, **NEVER** use default passwords from `.env.example`. Generate high-entropy keys using `openssl`:

```bash
# JWT Secret (for session token signing)
openssl rand -hex 32

# QR HMAC Secret (for dynamic TOTP QR code validation)
openssl rand -hex 32

# Audit HSM Secret (for forensic hash-chain sealing)
openssl rand -hex 32

# PostgreSQL Password
openssl rand -base64 24

# Valkey Password
openssl rand -base64 24
```

Store these values safely in your production `.env` and keep offline backups in a password manager.

---

## 5. Reverse Proxy & TLS Configuration (Caddy + Cloudflare)

The stack includes a custom Caddy image (`ghcr.io/caddybuilds/caddy-cloudflare`) capable of solving **ACME DNS-01 challenges**. This allows Let's Encrypt SSL certificates to be automatically provisioned even on internal LAN IP addresses without opening router ports:

1. Create a Cloudflare API Token with `Zone.DNS (Edit)` permission.
2. In your `.env` file, define:
   ```env
   APP_DOMAIN=vault.yourstore.com
   CF_DNS_API_TOKEN=your_cloudflare_token_here
   ```
3. Caddy will automatically issue and renew valid SSL certificates.

---

## 6. Database Backup & Restoration

### Scheduled Automated Dumps
The `krona-db-backup` container creates snapshots in the `pg_backups_local` Docker volume every 15 minutes with rolling retention:
- Keep minutes: 1440 min (24 hours)
- Keep daily: 30 days
- Keep weekly: 12 weeks
- Keep monthly: 24 months

### Manual Instant Backup
```bash
# Trigger via Docker container
docker compose exec db-backup /backup.sh

# Or run Node utility script
npm run db:backup
```

### Database Restoration
```bash
gunzip < /path/to/backup.sql.gz | docker compose exec -T postgres psql -U kv_admin -d krona_vault
```

---

## 7. Serverless Edge Deployment (Cloudflare Workers & D1)

The platform is fully portable to Cloudflare's serverless edge:

1. Log in with Wrangler:
   ```bash
   npx wrangler login
   ```
2. Create your D1 database:
   ```bash
   npx wrangler d1 create krona-vault-db
   ```
3. Execute SQL migrations:
   ```bash
   npx wrangler d1 execute krona-vault-db --file=apps/api/migrations/0001_init_d1.sql
   ```
4. Deploy the Worker:
   ```bash
   npm run cf:deploy
   ```

---

## 8. Health Checks & Observability

Diagnostic endpoint:
```bash
curl -f http://localhost:3000/api/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 1284.5,
  "ledgerIntegrity": "BALANCED",
  "database": "connected"
}
```
If the ledger equation fails or the cryptographic audit chain reports tampering, `/api/health` returns HTTP status `503 Service Unavailable`.
