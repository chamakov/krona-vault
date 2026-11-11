# KRONA VAULT™ — Tracker de Iniciativas y Backlog de Producto

> Registro centralizado de iniciativas, funcionalidades, estado de desarrollo y control de cambios para el ecosistema **KRONA VAULT™**.  
> **Última actualización**: 26 de Octubre de 2026

---

## 1. Tablero Resumen de Iniciativas

| ID | Iniciativa / Módulo | Prioridad | Estado | Documentación / Referencia |
|---|---|:---:|:---:|---|
| `FEAT-CORE-01` | **Motor de Doble Partida & Ledger** | P0 | ✅ **Implementado** | [`apps/api/src/ledger-engine.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/ledger-engine.ts) |
| `FEAT-POS-01` | **Terminal POS & Vouchers Térmicos** | P0 | ✅ **Implementado** | [`apps/web-pwa/public/pos.html`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/pos.html) |
| `FEAT-PWA-01` | **Billetera Móvil del Jugador PWA** | P0 | ✅ **Implementado** | [`apps/web-pwa/public/wallet.html`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/wallet.html) |
| `FEAT-TOUR-01` | **Arena de Torneos & Categorías** | P0 | ✅ **Implementado** | [`apps/web-pwa/public/tournaments.html`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/tournaments.html) |
| `FEAT-AUDIT-01` | **Corte Z & Hash-Chain Forense** | P0 | ✅ **Implementado** | [`apps/web-pwa/public/audit.html`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/audit.html) |
| `FEAT-CUST-01` | **Cartas en Resguardo (Custody & Escrow)** | P1 | ✅ **Implementado** | [`apps/web-pwa/public/custody.html`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/custody.html), [`apps/api/src/server.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/server.ts) |
| `FEAT-SEO-01` | **SEO Técnico, Open Graph, PWA v11 & JSON-LD** | P1 | ✅ **Implementado** | [`apps/web-pwa/public/`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/) |
| `FEAT-SYNC-01` | **Sincronización Cloudflare Worker & Respaldo Automático** | P1 | ✅ **Implementado** | [`apps/api/src/worker.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/worker.ts), [`scripts/backup-db.ts`](file:///Users/chamakov/Repos/controlCredito/scripts/backup-db.ts) |
| `FEAT-E2E-01` | **Pruebas End-to-End con Playwright (Chromium)** | P1 | ✅ **Implementado** | [`playwright.config.ts`](file:///Users/chamakov/Repos/controlCredito/playwright.config.ts), [`e2e/`](file:///Users/chamakov/Repos/controlCredito/e2e/) |
| `FEAT-E2E-02` | **Cobertura Total E2E 11 Portales, 43 Specs & Modo Sótano** | P0 | ✅ **Implementado** | [`e2e/`](file:///Users/chamakov/Repos/controlCredito/e2e/), [`playwright.config.ts`](file:///Users/chamakov/Repos/controlCredito/playwright.config.ts) |
| `FEAT-CI-01` | **Pipeline GitHub Actions CI & Security Guard** | P0 | ✅ **Implementado** | [`.github/workflows/ci.yml`](file:///Users/chamakov/Repos/controlCredito/.github/workflows/ci.yml) |
| `FEAT-SEC-02` | **Actualización Parche de Seguridad Node.js & Hardening** | P0 | ✅ **Implementado** | `Dockerfile`, `package.json`, `.nvmrc`, [`apps/api/src/server.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/server.ts) |
| `FEAT-SEC-03` | **Auditoría Forense OWASP/STRIDE & 10 Remediaciones** | P0 | ✅ **Implementado** | [`security-audit-report.md`](file:///Users/chamakov/.gemini/antigravity-cli/brain/59dacb00-46d6-4742-977e-5aa7b9095728/security-audit-report.md) |
| `FEAT-WALLETS-01` | **Apple Wallet (iOS) & Google Wallet (Android)** | P2 | ⏸️ **En Backlog (Pausado)** | [`PLAN_TECNICO_MAESTRO_WALLETS_APPLE_GOOGLE.md`](file:///Users/chamakov/.gemini/antigravity-cli/brain/6553d203-c3d5-467c-ad4b-657560c8bf60/PLAN_TECNICO_MAESTRO_WALLETS_APPLE_GOOGLE.md) |

---

## 2. Detalle de Iniciativas en Backlog

### `[FEAT-WALLETS-01]` Tarjeta de Jugador en Apple Wallet & Google Wallet con Tracking en Tiempo Real

* **Estado**: ⏸️ **PAUSADO / EN BACKLOG** (Por indicación del usuario: no implementar por el momento; análisis técnico 100% completado).
* **Fecha de Registro**: 21 de Octubre de 2026.
* **Tipo**: Feature / Integración Móvil Nativa (iOS & Android).
* **Impacto Operativo**: Alto (Fidelización de jugadores, consulta de saldo en pantalla de bloqueo y tracking de presencia).

#### Resumen de la Funcionalidad:
Permite a los jugadores agregar su tarjeta de identificación de KRONA VAULT directamente a las aplicaciones nativas **Apple Wallet** (en iPhone / Apple Watch) y **Google Wallet** (en Android / Wear OS). La tarjeta muestra el saldo en pesos MXN en tiempo real, activa notificaciones al aproximarse a una sucursal mediante Geocercas GPS / iBeacons BLE y permite rastrear la instalación y el desregistro del pase.

#### Seguridad & Anti-Fraude:
- **Arquitectura de Seguridad Dual (Zero-Trust POS)**:
  - El pase nativo sirve para **identificación y presencia** (check-in a torneos, consulta de saldo en pantalla de bloqueo, recepción de cartas en custodia).
  - Cualquier intento de **débito o cobro en caja** (> $0) exige obligatoriamente autenticación transaccional (PIN Bunker de 6 dígitos del jugador o QR dinámico de 30s desde la PWA), neutralizando ataques por captura de pantalla compartida.

#### Documentación Técnica Vinculada:
1. **Plan Técnico Maestro**:
   - [`PLAN_TECNICO_MAESTRO_WALLETS_APPLE_GOOGLE.md`](file:///Users/chamakov/.gemini/antigravity-cli/brain/6553d203-c3d5-467c-ad4b-657560c8bf60/PLAN_TECNICO_MAESTRO_WALLETS_APPLE_GOOGLE.md)
2. **Especificaciones de Arquitectura**:
   - [Especificación Apple PassKit (`.pkpass` & Web Service)](file:///Users/chamakov/Repos/controlCredito/docs/architecture/apple-passkit-integration-design.md)
   - [Especificación Google Wallet API (JWT RS256 & REST)](file:///Users/chamakov/Repos/controlCredito/docs/architecture/google-wallet-integration-design.md)
   - [Análisis Criptográfico, Seguridad y Dinámica QR](file:///Users/chamakov/Repos/controlCredito/docs/architecture/apple-google-wallet-security-fraud-dynamics.md)
   - [Arquitectura de Integración Full-Stack en Node.js/TypeScript](file:///Users/chamakov/Repos/controlCredito/docs/architecture/apple-google-wallet-fullstack-architecture.md)

#### Requisitos Previos para Reactivación (Criterios de Descongelamiento):
- [ ] Alta en **Apple Developer Program** ($99 USD/año) para emisión de certificados Pass Type Identifier (`pass.mx.kronavault.wallet`) y certificado intermedio WWDR G4.
- [ ] Configuración de **Google Cloud Platform Service Account** con clave privada RSA-2048 y registro de `Issuer ID` en la consola de Google Pay & Wallet.
- [ ] Decisión de negocio de comenzar la fase de despliegue a producción.

#### Checklist de Implementación al Descongelar:
- [ ] **Fase 1 — Modelado & Criptografía**:
  - [ ] Agregar interfaz `WalletRegistrationRecord` en [`packages/shared-types/src/index.ts`](file:///Users/chamakov/Repos/controlCredito/packages/shared-types/src/index.ts).
  - [ ] Implementar índices y métodos en [`apps/api/src/ledger-engine.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/ledger-engine.ts) (`registerWalletDevice`, `unregisterWalletDevice`, `getWalletDevicesForUser`).
- [ ] **Fase 2 — Apple Wallet (`.pkpass` & PassKit Web Service)**:
  - [ ] Crear servicio empaquetador con `node:crypto` + `archiver` en `apps/api/src/services/apple-pass-service.ts`.
  - [ ] Implementar los 5 endpoints oficiales del protocolo Apple PassKit Web Service en [`apps/api/src/server.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/server.ts) (`/api/v1/devices/...`, `/api/v1/passes/...`, `/api/v1/log`).
- [ ] **Fase 3 — Google Wallet API (Save JWT & REST v1)**:
  - [ ] Crear servicio firmador de JWT con algoritmo RS256 en `apps/api/src/services/google-wallet-service.ts`.
  - [ ] Implementar endpoint `GET /api/wallet/google/:userId/save-url` y llamadas `PATCH` a `walletobjects.googleapis.com`.
- [ ] **Fase 4 — Pipeline de Actualización Push & PWA**:
  - [ ] Implementar `WalletPushNotificationService` con cola asíncrona y debounce de 1.5s.
  - [ ] Conectar los 6 disparadores de saldo en `ledger-engine.ts` (Premios de torneo, cobro POS, trade-in, reembolso, custodia, ajuste manual).
  - [ ] Agregar los botones oficiales de Apple Wallet y Google Wallet con detección inteligente de SO en [`apps/web-pwa/public/wallet.html`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/wallet.html).
  - [ ] Pruebas E2E y de carga en dispositivos físicos iPhone y Android.

---

### `[FEAT-SEO-01]` Auditoría e Implementación de SEO Técnico, Open Graph, PWA v11 y Schema.org

* **Estado**: ✅ **COMPLETADO / IMPLEMENTADO**
* **Fecha de Registro**: 21 de Octubre de 2026.
* **Módulos Optimizados**: 11 pantallas HTML (`index.html`, `login.html`, `wallet.html`, `pos.html`, `tournaments.html`, `trade-in.html`, `custody.html`, `stores.html`, `users.html`, `profile.html`, `audit.html`) + `manifest.webmanifest`, `manifest.json`, `sw.js`, `apps/api/src/server.ts`.
* **Entregables Principales**:
  1. **SEO Técnico & Convención Homogénea**: Títulos estandarizados con formato `[Módulo™] — [Función de Valor] | KRONA VAULT™`, eliminación de vestigios internos `(controlCredito)` e informales.
  2. **Indexación y Seguridad**: Directiva `index, follow` exclusivamente en `index.html` (portal público); directiva `noindex, nofollow, noarchive, nosnippet` en las 10 interfaces operativas/autenticadas para prevenir fugas de pantallas de caja y libro mayor.
  3. **Social Graph Completo**: Metadatos Open Graph (`og:site_name`, `og:type`, `og:url`, `og:title`, `og:description`, `og:image`, `og:locale`) y Twitter Cards (`summary`) en todos los archivos HTML para optimizar previsualizaciones en WhatsApp, Discord, Telegram y redes sociales.
  4. **PWA & Service Worker v11**: Web App Manifest con soporte universal (`manifest.webmanifest` y `manifest.json`), shortcuts nativos hacia Bóveda, POS, Torneos y Resguardo. Precaché de los 11 portales y recursos críticos en `sw.js` con estrategia Stale-While-Revalidate para assets, Network-First para páginas y fallback HTML corporativo sin conexión.
  5. **Datos Estructurados**: Inclusión de Schema.org JSON-LD (`SoftwareApplication`, `FinancialService`, `Organization`) en `index.html`, `wallet.html` y `tournaments.html`.

---

### `[FEAT-CUST-01]` Cartas en Resguardo en Bóveda (Vault Custody & Escrow P2P)

* **Estado**: ✅ **COMPLETADO / IMPLEMENTADO**
* **Fecha de Registro**: 22 de Octubre de 2026.
* **Componentes**: [`apps/web-pwa/public/custody.html`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/custody.html), [`apps/api/src/server.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/server.ts), [`apps/api/src/ledger-engine.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/ledger-engine.ts).
* **Entregables Principales**:
  1. **Recepción con Evidencia Criptográfica**: Registro de paquetes de cartas selladas (Grading PSA, Consignación, Cuarentena, Bóveda), evidencia fotográfica con hash SHA-256 inmutable por toma y cálculo de digest integral de contenido.
  2. **Comprobante Térmico VaultSeal™**: Emisión de comprobante físico (58mm/80mm) con folio secuencial (`CUST-SUC-YYYYMMDD-XXXX`), token HMAC, código Base32 legible y código QR de reclamo.
  3. **Escrow P2P y Resguardo a Terceros**: Flujo bilateral completo (`depositor` quién deja vs `recipient` quién recoge), permitiendo custodia segura para intercambios entre jugadores o compras a distancia.
  4. **Entrega Segura Four-Eyes (4-Ojos)**: Desprecinto y liberación en mostrador con verificación de token/código, PIN 2FA del destinatario y co-firma obligatoria de un segundo supervisor con bloqueo de auto-entrega.
  5. **Cobertura E2E**: 6 pruebas automatizadas en verde que validan el ciclo de vida completo, cambio de casillero y restricciones RBAC.

---

### `[FEAT-E2E-01]` Suite Integral de Pruebas End-to-End con Playwright (Chromium)

* **Estado**: ✅ **COMPLETADO / IMPLEMENTADO**
* **Fecha de Registro**: 26 de Octubre de 2026.
* **Componentes**: [`playwright.config.ts`](file:///Users/chamakov/Repos/controlCredito/playwright.config.ts), [`e2e/`](file:///Users/chamakov/Repos/controlCredito/e2e/).
* **Entregables Principales**:
  1. **Orquestación Automática**: Configuración de `webServer` en `playwright.config.ts` para levantar el servidor Node 22 (`npm start`) automáticamente.
  2. **6 Suites E2E Cubiertas (23 pruebas reales)**:
     - `01-auth-and-navigation`: Login, conmutador demo, bloqueo RBAC `Alt+4` y logout.
     - `02-pos-and-vouchers`: Cobro mixto, emisión de tirilla original y detección auditada de reimpresión copia #2.
     - `03-wallet-pwa`: KRONA Pass™ PWA, Dynamic Pulse QR™ SVG, rotación TOTP, Modo Búnker PIN y tranches FEFO.
     - `04-tournaments-and-splits`: Arena de torneos, calculadora multi-TCG, reparto equitativo (*Equal Split*) y dispersión en lote.
     - `05-custody-vault`: Padrón de custodia física, búsqueda reactiva, admisión con VaultSeal™ y selector térmico 80mm/58mm.
     - `06-audit-citadel`: Ecuación contable $\sum \text{DEBE} = \sum \text{HABER}$, Arqueo Corte Z y verificador forense de firmas físicas.

---

### `[FEAT-SEC-02]` Actualización Parche Crítico de Seguridad Node.js & Hardening

* **Estado**: ✅ **COMPLETADO / IMPLEMENTADO**
* **Fecha de Registro**: 26 de Octubre de 2026.
* **Componentes**: [`Dockerfile`](file:///Users/chamakov/Repos/controlCredito/Dockerfile), [`package.json`](file:///Users/chamakov/Repos/controlCredito/package.json), [`.nvmrc`](file:///Users/chamakov/Repos/controlCredito/.nvmrc), [`.node-version`](file:///Users/chamakov/Repos/controlCredito/.node-version), [`apps/api/src/server.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/server.ts).
* **Entregables Principales**:
  1. **Actualización a Node.js v22.23.4 (LTS Jod)**: Mitigación de vulnerabilidades críticas del parche de seguridad de Octubre 2026:
     - `CVE-2026-111497`: Out-of-bounds write / RCE en el descompresor Brotli bundled de Google.
     - `CVE-2026-105482`: Truncamiento de bytes NUL en resolución DNS.
     - `CVE-2026-105483` & `CVE-2026-106069`: Bypasses de verificación de certificados TLS.
  2. **Contenedor Inmutable & No-Root**: Fijación de imagen base a `node:22.23.4-alpine` y ejecución bajo usuario no privilegiado `USER node` para prevenir escalamiento de privilegios.
  3. **Cabeceras de Seguridad HTTP**: Incorporación de `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `X-Frame-Options: SAMEORIGIN` tanto en respuestas API JSON como en el despachador de archivos estáticos.
  4. **Restricción de Versión de Motor**: Actualización de `"engines"` en `package.json` a `node: >=22.23.4` y `npm: >=10.9.9`.

---

### `[FEAT-SEC-03]` Auditoría Integral de Seguridad KRONA VAULT™ (OWASP ASVS / STRIDE)

* **Estado**: ✅ **COMPLETADO / REMEDIACIÓN IMPLEMENTADA AL 100%**
* **Fecha de Registro**: 28 de Octubre de 2026.
* **Componentes**: [`apps/api/src/ledger-engine.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/ledger-engine.ts), [`apps/api/src/server.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/server.ts), [`packages/crypto-totp/src/index.ts`](file:///Users/chamakov/Repos/controlCredito/packages/crypto-totp/src/index.ts), [`apps/api/src/pokemon-standings-parser.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/pokemon-standings-parser.ts), [`apps/web-pwa/public/`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/), [`Dockerfile`](file:///Users/chamakov/Repos/controlCredito/Dockerfile).
* **Entregables Principales**:
  1. **Informe Forense & Modelo STRIDE**: Documentación de 10 vulnerabilidades identificadas con puntuación CVSS v3.1 y alineación OWASP Top 10 en [`security-audit-report.md`](file:///Users/chamakov/.gemini/antigravity-cli/brain/59dacb00-46d6-4742-977e-5aa7b9095728/security-audit-report.md).
  2. **Remediación P0 (Crítica)**:
     - `VULN-01`: Exigencia estricta de `supervisorPin` en `verifySupervisorPin` y eliminación de selección automática de co-autorizador en `resolveCoAuthorizerId`.
     - `VULN-02`: Supresión total de auto-generación de Dynamic QR / TOTP en servidor en `/api/pos/redeem`; rechazo estricto con `PRUEBA_AUTH_JUGADOR_REQUERIDA` y protección de tokens en `/api/bootstrap`.
  3. **Remediación P1 (Alta)**:
     - `VULN-03`: Implementación de `escapeHtml` en `krona-core.js`, saneamiento de variables en `tournaments.html` y `custody.html`, y corrección de desescape inseguro de entidades en `pokemon-standings-parser.ts`.
     - `VULN-04`: Migración de credenciales a algoritmo `scrypt` con salt criptográfica aleatoria de 16 bytes (`randomBytes`), manteniendo verificación retrocompatible en tiempo constante (`timingSafeEqual`) contra ataques de tiempo.
  4. **Remediación P2 y P3 (Media y Baja)**:
     - `VULN-05`: Extensión de rate limiting a `/api/pos/redeem` y `/api/custody/packages/release` con extracción segura de IP (`getClientIp`) resistente a spoofing.
     - `VULN-06`: Purga automática en tiempo de ejecución (TTL 120s) sobre `usedQrNonces` y limpieza periódica de cubos en el limitador de tasa para prevenir fugas de memoria Heap.
     - `VULN-07`: Adición de `ENV NODE_ENV=production` en `Dockerfile` y restricción de fallbacks de sesión anónima a Super Admin.
     - `VULN-08`: Validación de enteros estrictamente positivos (`amountCents > 0`) en transferencias P2P.
     - `VULN-09`: Alerta preventiva si `AUDIT_HSM_SECRET` no está configurado en producción.
     - `VULN-10`: Máscara restrictiva `0o600` en la creación de archivos de base de datos local y snapshots.
  5. **Verificación de Regresión & Expansión de Pruebas**: **84/84 pruebas pasando al 100%** (14 pruebas unitarias de criptografía, 45 de motor y API HTTP, 25 pruebas Playwright E2E en Chromium con cobertura específica para rechazo de cobro sin PIN/token, validación de montos P2P, y sanitización XSS en custodia).






---

### `[FEAT-E2E-02]` Cobertura Total de Flujos de Negocio: 11 Portales PWA, 43 Pruebas E2E & Modo Sótano

* **Estado**: ✅ **COMPLETADO / IMPLEMENTADO**
* **Fecha de Registro**: 30 de Octubre de 2026.
* **Componentes**: [`playwright.config.ts`](file:///Users/chamakov/Repos/controlCredito/playwright.config.ts), [`e2e/`](file:///Users/chamakov/Repos/controlCredito/e2e/), [`apps/web-pwa/public/`](file:///Users/chamakov/Repos/controlCredito/apps/web-pwa/public/), [`apps/api/src/server.ts`](file:///Users/chamakov/Repos/controlCredito/apps/api/src/server.ts).
* **Entregables Principales**:
  1. **Cobertura al 100% de los 11 Portales Web PWA**: Creación de 5 nuevas suites dedicadas en Playwright:
     - `07-trade-in-exchange.spec.ts`: Valuación de singles, catálogo de orígenes GAAP (Cta 1105), alta rápida de cliente, umbral de autorización dual 4-Ojos y comprobante térmico de recepción.
     - `08-stores-network.spec.ts`: Administración multi-sede, alta de sucursales con prefijo térmico, conmutación fluida de pestañas (Sedes, Categorías FEFO, Orígenes de Crédito) y persistencia de catálogos.
     - `09-users-citadel.spec.ts`: Directorio maestro IAM, matriz RBAC de 6 roles, alta de nuevo staff (CASHIER) con credenciales iniciales y flujo de fusión irreversible de cuentas duplicadas (*Merge*).
     - `10-profile-self-service.spec.ts`: Autoservicio del operador, actualización de datos de perfil, rotación criptográfica de semilla 2FA (KRONA Pulse™) y panel de vinculación Authenticator RFC 6238 con clave Base32.
     - `11-offline-pwa-resilience.spec.ts`: Contingencia sin conexión (Modo Sótano), detección automática del evento `offline`, renderizado de banner de advertencia y preservación de interfaz y saldos locales.
  2. **Subflujos Críticos Añadidos en Suites Existentes**:
     - `02-pos-and-vouchers.spec.ts`: Reembolso auditado Anti-Cash-Out (`#posViewRefund`) con restitución prioritaria a crédito de tienda y emisión de póliza térmica.
     - `05-custody-vault.spec.ts`: Liberación física de paquetes en mostrador con verificación de precinto, PIN 2FA del destinatario y co-firma Four-Eyes.
  3. **Certificación Total**: **102 de 102 pruebas en verde** (14 criptográficas, 45 de motor/API REST y 43 pruebas Playwright Chromium E2E).

---

### `[FEAT-CI-01]` Pipeline Automatizado de Integración Continua (GitHub Actions CI)

* **Estado**: ✅ **COMPLETADO / IMPLEMENTADO**
* **Fecha de Registro**: 30 de Octubre de 2026.
* **Componentes**: [`.github/workflows/ci.yml`](file:///Users/chamakov/Repos/controlCredito/.github/workflows/ci.yml).
* **Entregables Principales**:
  1. **Ejecución Automatizada en Pull Request y Push**: Valida ramas `main` y `master`.
  2. **Etapas de Verificación Continua**:
     - Configuración de Node.js v22.23.4 LTS con cache de paquetes `npm`.
     - `npm run typecheck`: Validación estricta de TypeScript en todos los workspaces.
     - `npm test`: Ejecución de suites unitarias y de integración (Cripto TOTP + Ledger Engine + API REST).
     - `npx playwright install --with-deps chromium`: Instalación desatendida del navegador Playwright.
     - `npm run test:e2e`: Ejecución de las 43 pruebas E2E en Chromium con servidor local efímero.
  3. **Gestión de Artefactos**: Carga automática de reportes de fallas y capturas de pantalla si alguna prueba se degrada.
