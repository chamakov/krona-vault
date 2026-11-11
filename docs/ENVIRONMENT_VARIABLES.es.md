# Referencia de Variables de Entorno — KRONA VAULT™

> 🌐 **Idiomas / Languages**: [ 🇲🇽 Español ](./ENVIRONMENT_VARIABLES.es.md) · [ 🇺🇸 English ](./ENVIRONMENT_VARIABLES.md)

Este documento describe todas las variables de entorno soportadas por **KRONA VAULT™**, su propósito, valores predeterminados y recomendaciones para producción.

Copia `.env.example` hacia `.env` antes de iniciar la aplicación.

---

## Tabla Resumen de Variables

| Variable | Tipo | Requerido en Prod | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :--- | :--- |
| `APP_DOMAIN` | String | Sí | `vault.mitienda.com` | Nombre de dominio FQDN utilizado para emisión de certificados TLS y WebAuthn RP_ID. |
| `TZ` | String | No | `America/Mexico_City` | Zona horaria del servidor para sellado de tiempo en vouchers y auditoría. |
| `POSTGRES_USER` | String | Sí | `kv_admin` | Usuario administrador de la base de datos PostgreSQL. |
| `POSTGRES_PASSWORD`| String | Sí | *(cambiar en prod)* | Contraseña segura para el usuario de base de datos. |
| `POSTGRES_DB` | String | Sí | `krona_vault` | Nombre de la base de datos de producción. |
| `VALKEY_PASSWORD` | String | Sí | *(cambiar en prod)* | Contraseña de autenticación para el servidor de caché Valkey/Redis. |
| `JWT_SECRET` | Hex (32B) | Sí | *(generar con openssl)* | Clave simétrica para firmar y validar tokens de sesión JWT. |
| `QR_HMAC_SECRET` | Hex (32B) | Sí | *(generar con openssl)* | Clave para calcular el HMAC SHA-256 de los códigos QR dinámicos y sellos de voucher. |
| `AUDIT_HSM_SECRET` | Hex (32B) | Sí | *(generar con openssl)* | Clave maestra para sellar cada eslabón de la bitácora forense de auditoría. |
| `CF_DNS_API_TOKEN` | String | Opcional | `""` | Token de API de Cloudflare con permisos de edición DNS para resolver el reto ACME DNS-01 en Caddy. |
| `CF_TUNNEL_TOKEN` | String | Opcional | `""` | Token para levantar un Cloudflare Zero Trust Tunnel y exponer el servicio de forma segura sin abrir puertos. |
| `PORT` | Number | No | `3000` | Puerto TCP en el que escucha el servidor HTTP Node.js. |
| `NODE_ENV` | String | No | `production` | Modo de ejecución de Node.js (`production`, `development`, `test`). |

---

## Detalle de Parámetros Criptográficos

### `JWT_SECRET`
- **Uso**: Firma de tokens de autenticación para operadores de caja, administradores y jugadores.
- **Riesgo si se compromete**: Un atacante podría emitir sesiones falsas de usuario o escalar privilegios a `SUPER_ADMIN`.
- **Generación recomendada**:
  ```bash
  openssl rand -hex 32
  ```

### `QR_HMAC_SECRET`
- **Uso**: Autenticación de QR dinámico (TOTP) rotativo de 30 segundos presentado en el mostrador POS por el jugador.
- **Riesgo si se compromete**: Posibilidad de falsificar tokens QR de jugadores conocidos.
- **Generación recomendada**:
  ```bash
  openssl rand -hex 32
  ```

### `AUDIT_HSM_SECRET`
- **Uso**: Sellado de la cadena de bloques interna (hash-chaining) en la tabla de bitácora forense. Cada registro almacena:
  $$\text{row\_hash} = \text{HMAC-SHA256}(\text{AUDIT\_HSM\_SECRET}, \text{prev\_hash} \parallel \text{payload})$$
- **Riesgo si se compromete**: Pérdida de garantía de no-repudio si un administrador con acceso a la base de datos intenta alterar asientos contables pasados.
- **Generación recomendada**:
  ```bash
  openssl rand -hex 32
  ```

---

## Variables Opcionales para Cloudflare y Redes Privadas

### `CF_DNS_API_TOKEN`
Requerido únicamente si utilizas Caddy para obtener automáticamente certificados SSL para dominios que no tienen IP pública directa (desafío DNS-01).

### `CF_TUNNEL_TOKEN`
Permite conectar tu servidor local o Proxmox directamente a la red perimetral de Cloudflare mediante `cloudflared`, evitando configurar NAT o abrir puertos 80/443 en el router de tu sucursal.
