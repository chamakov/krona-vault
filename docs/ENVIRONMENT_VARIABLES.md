# Environment Variables Reference — KRONA VAULT™

> 🌐 **Languages / Idiomas**: [ 🇺🇸 English ](./ENVIRONMENT_VARIABLES.md) · [ 🇲🇽 Español ](./ENVIRONMENT_VARIABLES.es.md)

This document details all supported environment variables in **KRONA VAULT™**, their operational purpose, defaults, and production recommendations.

Copy `.env.example` to `.env` before launching the stack.

---

## Environment Variables Summary

| Variable | Type | Required in Prod | Default Value | Description |
| :--- | :--- | :---: | :--- | :--- |
| `APP_DOMAIN` | String | Yes | `vault.mitienda.com` | FQDN domain name used for TLS automated certificates and WebAuthn RP_ID. |
| `TZ` | String | No | `America/Mexico_City` | Server timezone for timestamping receipts and audit events. |
| `POSTGRES_USER` | String | Yes | `kv_admin` | Administrative database user for PostgreSQL. |
| `POSTGRES_PASSWORD`| String | Yes | *(change in prod)* | Strong password for the PostgreSQL user. |
| `POSTGRES_DB` | String | Yes | `krona_vault` | Production PostgreSQL database name. |
| `VALKEY_PASSWORD` | String | Yes | *(change in prod)* | Authentication password for Valkey/Redis cache. |
| `JWT_SECRET` | Hex (32B) | Yes | *(generate via openssl)* | Symmetric key used to sign and verify session JWTs. |
| `QR_HMAC_SECRET` | Hex (32B) | Yes | *(generate via openssl)* | Key used to compute HMAC SHA-256 for dynamic QR TOTP and receipt seals. |
| `AUDIT_HSM_SECRET` | Hex (32B) | Yes | *(generate via openssl)* | Master secret for sealing the forensic hash-chain ledger audit log. |
| `CF_DNS_API_TOKEN` | String | Optional | `""` | Cloudflare API Token with DNS edit permissions for ACME DNS-01 challenges. |
| `CF_TUNNEL_TOKEN` | String | Optional | `""` | Cloudflare Zero Trust Tunnel token for portless external ingress. |
| `PORT` | Number | No | `3000` | Local TCP listening port for Node.js API server. |
| `NODE_ENV` | String | No | `production` | Node.js runtime environment mode (`production`, `development`, `test`). |

---

## Cryptographic Parameters in Detail

### `JWT_SECRET`
- **Purpose**: Signs authentication tokens for cashier, tournament manager, and admin sessions.
- **Risk if compromised**: An adversary could forge valid session tokens or escalate privileges to `SUPER_ADMIN`.
- **Generation command**:
  ```bash
  openssl rand -hex 32
  ```

### `QR_HMAC_SECRET`
- **Purpose**: Authenticates rotating 30-second dynamic TOTP QR codes presented by players at checkout.
- **Risk if compromised**: Enables forgery of player verification tokens.
- **Generation command**:
  ```bash
  openssl rand -hex 32
  ```

### `AUDIT_HSM_SECRET`
- **Purpose**: Computes SHA-256 HMAC seals over every ledger audit event:
  $$\text{row\_hash} = \text{HMAC-SHA256}(\text{AUDIT\_HSM\_SECRET}, \text{prev\_hash} \parallel \text{payload})$$
- **Risk if compromised**: Loss of non-repudiation guarantees against internal database tampering.
- **Generation command**:
  ```bash
  openssl rand -hex 32
  ```
