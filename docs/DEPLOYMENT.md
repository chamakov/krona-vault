# Guía Completa de Despliegue en Entornos — KRONA VAULT™

Esta guía describe cómo desplegar **KRONA VAULT™** en diferentes entornos, desde desarrollo local rápido hasta entornos productivos auto-hospedados de alta disponibilidad en **Proxmox VE**, **VPS Linux**, **Docker Compose** y **Cloudflare Workers**.

---

## Índice

1. [Requisitos de Infraestructura](#1-requisitos-de-infraestructura)
2. [Despliegue Rápido con Docker Compose (Recomendado)](#2-despliegue-rápido-con-docker-compose-recomendado)
3. [Despliegue en Producción (Proxmox VE / Linux VPS)](#3-despliegue-en-producción-proxmox-ve--linux-vps)
4. [Generación Segura de Claves Criptográficas](#4-generación-segura-de-claves-criptográficas)
5. [Configuración de Proxy Inverso y Certificados TLS (Caddy + Cloudflare)](#5-configuración-de-proxy-inverso-y-certificados-tls-caddy--cloudflare)
6. [Respaldo y Restauración de Base de Datos](#6-respaldo-y-restauración-de-base-de-datos)
7. [Despliegue Serverless en Cloudflare Workers & D1](#7-despliegue-serverless-en-cloudflare-workers--d1)
8. [Verificación de Salud y Monitoreo](#8-verificación-de-salud-y-monitoreo)

---

## 1. Requisitos de Infraestructura

### Mínimos (1 sucursal, hasta 2,000 jugadores)
- **CPU**: 1 vCPU (x86_64 o ARM64)
- **RAM**: 1.5 GB
- **Almacenamiento**: 20 GB SSD
- **SO**: Debian 12 / Ubuntu 22.04 LTS o Proxmox VE Container (LXC) / VM

### Recomendados (Multi-tienda, torneos de 100+ jugadores simultáneos)
- **CPU**: 2 vCPU
- **RAM**: 4 GB
- **Almacenamiento**: 50 GB NVMe con respaldo externo
- **SO**: Ubuntu 24.04 LTS / Debian 12

---

## 2. Despliegue Rápido con Docker Compose (Recomendado)

El archivo [`docker-compose.yml`](../docker-compose.yml) orquesta la arquitectura completa en contenedores aislados:
- **`cc-app`**: Servidor Node.js 22 LTS (API REST + PWA).
- **`cc-postgres`**: PostgreSQL 16 con checksums, WAL archiving y triggers de partida doble.
- **`cc-valkey`**: Valkey 8 en memoria para invalidación anti-replay y pub/sub en tiempo real.
- **`cc-caddy`**: Proxy inverso con módulo DNS Cloudflare para TLS automático sin puertos abiertos.
- **`cc-db-backup`**: Contenedor cron que genera respaldos comprimidos de PostgreSQL cada 15 minutos.

### Pasos:

1. **Clonar el repositorio en el servidor**:
   ```bash
   git clone https://github.com/chamakov/krona-vault.git /opt/krona-vault
   cd /opt/krona-vault
   ```

2. **Copiar y configurar variables de entorno**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   *(Ver [Generación Segura de Claves](#4-generación-segura-de-claves-criptográficas))*.

3. **Compilar y levantar los servicios en segundo plano**:
   ```bash
   docker compose up -d --build
   ```

4. **Verificar que todos los contenedores estén saludables**:
   ```bash
   docker compose ps
   ```

5. **Acceder a la aplicación**:
   Navega a `http://localhost:3000` (o a tu FQDN configurado con Caddy).

---

## 3. Despliegue en Producción (Proxmox VE / Linux VPS)

### En Proxmox VE (LXC Container vs VM):
- Se recomienda una **VM con Debian 12 o Ubuntu Server 24.04** si requieres aislamiento estricto de virtualización de red y disco NVMe.
- Si utilizas un contenedor **LXC Unprivileged**, asegúrate de habilitar las opciones de `nesting=1` y `keyctl=1` para Docker.

### Configuración con Systemd para Reinicio Automático
Docker Compose con `restart: unless-stopped` se encarga de iniciar automáticamente con el sistema. Para supervisión externa con systemd:

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

Habilitar el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now krona-vault.service
```

---

## 4. Generación Segura de Claves Criptográficas

Antes de desplegar en producción, **NUNCA** utilices las contraseñas predeterminadas de `.env.example`. Genera claves de alta entropía con `openssl`:

```bash
# JWT Secret (para sesiones y tokens de autenticación)
openssl rand -hex 32

# QR HMAC Secret (para firma de QR dinámicos y validez temporal)
openssl rand -hex 32

# Audit HSM Secret (para encadenamiento criptográfico forense)
openssl rand -hex 32

# Contraseña de PostgreSQL
openssl rand -base64 24

# Contraseña de Valkey
openssl rand -base64 24
```

Guarda estos valores en tu archivo `.env` del servidor y mantén copias seguras en tu gestor de contraseñas de infraestructura.

---

## 5. Configuración de Proxy Inverso y Certificados TLS (Caddy + Cloudflare)

El stack incluye una imagen personalizada de Caddy (`ghcr.io/caddybuilds/caddy-cloudflare`) que resuelve el desafío **ACME DNS-01**. Esto permite emitir certificados SSL/TLS legítimos de Let's Encrypt para dominios que operan tanto en internet como en redes privadas locales (LAN / VPN):

1. Crea un API Token en Cloudflare con permisos: `Zone.DNS (Edit)`.
2. En tu archivo `.env`, define:
   ```env
   APP_DOMAIN=credito.tutienda.com
   CF_DNS_API_TOKEN=tu_token_de_cloudflare
   ```
3. Caddy obtendrá y renovará automáticamente los certificados SSL.

---

## 6. Respaldo y Restauración de Base de Datos

### Respaldos Automáticos
El contenedor `krona-db-backup` genera automáticamente respaldos en el volumen `pg_backups_local` cada 15 minutos con retención configurable:
- Mantener minutos: 1440 min (24 hrs)
- Mantener diarios: 30 días
- Mantener semanales: 12 semanas
- Mantener mensuales: 24 meses

### Respaldo Manual Inmediato
```bash
# Mediante el contenedor
docker compose exec db-backup /backup.sh

# O mediante script local de Node
npm run db:backup
```

### Restauración de Base de Datos
```bash
# Descomprimir y restaurar en PostgreSQL
gunzip < /ruta/al/respaldo.sql.gz | docker compose exec -T postgres psql -U kv_admin -d krona_vault
```

---

## 7. Despliegue Serverless en Cloudflare Workers & D1

El proyecto está preparado para ejecutarse en el Edge utilizando **Cloudflare Workers** y **Cloudflare D1** (SQLite distribuido):

1. Iniciar sesión en Cloudflare Wrangler:
   ```bash
   npx wrangler login
   ```
2. Crear la base de datos D1:
   ```bash
   npx wrangler d1 create krona-vault-db
   ```
3. Aplicar las migraciones SQL:
   ```bash
   npx wrangler d1 execute krona-vault-db --file=apps/api/migrations/0001_init_d1.sql
   ```
4. Desplegar el Worker:
   ```bash
   npm run cf:deploy
   ```

---

## 8. Verificación de Salud y Monitoreo

Endpoint de diagnóstico y salud del sistema:
```bash
curl -f http://localhost:3000/api/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 1284.5,
  "ledgerIntegrity": "BALANCED",
  "database": "connected"
}
```
Si el balance del libro mayor reporta inconsistencias o el hash de auditoría no coincide, `/api/health` devolverá código HTTP `503 Service Unavailable`.
