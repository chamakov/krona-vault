# Arquitectura de Implementación e Integración de Software: Apple Wallet y Google Wallet en KRONA VAULT™

Esta especificación técnica detalla el diseño de integración de **Apple Wallet** (formato nativo `.pkpass` y protocolo REST PassKit Web Service) y **Google Wallet** (Save to Google Wallet JWT + REST API v1) dentro del ecosistema KRONA VAULT (Node.js, TypeScript, Ledger Engine contable y PWA Vanilla JS).

---

## 1. Diagrama de Arquitectura General

```mermaid
flowchart TB
    subgraph ClientLayers ["Capas de Cliente (Player & POS)"]
        iOS["Apple Wallet (iOS / Apple Watch)<br/>Nativo PassKit"]
        Android["Google Wallet (Android)<br/>Google Play Services"]
        PWA["KRONA PWA (/wallet)<br/>Vanilla JS + OS Detection"]
        POS["Caja Mostrador POS (/pos)<br/>Voucher Térmico + 2FA"]
    end

    subgraph APILayer ["Servidor API HTTP (apps/api/src/server.ts)"]
        HTTPRouter["Router HTTP Nativo (node:http)"]
        ApplePassEndpoint["GET /api/wallet/apple/:userId/pass.pkpass"]
        GoogleSaveEndpoint["GET /api/wallet/google/:userId/save-url"]
        AppleWebService["Apple PassKit Web Service API (/api/v1/*)<br/>registrations, passes, logs"]
    end

    subgraph ServiceLayer ["Servicios de Integración Wallet"]
        PassKitGenerator["PassKit Packager Service<br/>(node:crypto + archiver)"]
        GoogleJwtSigner["Google Wallet Service<br/>(RS256 JWT + REST Client)"]
        PushService["WalletPushNotificationService<br/>(In-Memory Queue + APNs HTTP/2)"]
    end

    subgraph EngineLayer ["Núcleo Transaccional (apps/api/src/ledger-engine.ts)"]
        Ledger["Ledger Engine (Doble Partida)"]
        WalletRegistry["WalletRegistrationRecord Registry<br/>(Tokens, APNs, Serials)"]
        AuditChain["Audit Hash-Chain Inmutable"]
        D1Snapshot["Persistencia Local / Cloudflare D1<br/>(krona-vault.local.json)"]
    end

    subgraph ExternalAppleGoogle ["Servicios Oficiales de Notificación"]
        APNs["Apple Push Notification service (APNs)<br/>api.push.apple.com:443"]
        GoogleAPI["Google Wallet Objects REST API<br/>walletobjects.googleapis.com"]
    end

    PWA -->|Descarga .pkpass| ApplePassEndpoint
    PWA -->|Deep Link JWT| GoogleSaveEndpoint
    ApplePassEndpoint --> PassKitGenerator
    GoogleSaveEndpoint --> GoogleJwtSigner

    iOS <-->|Protocolo PassKit v1| AppleWebService
    AppleWebService <--> WalletRegistry

    POS -->|Dispersión / Cobro / Custodia| Ledger
    Ledger -->|Evento de Saldo| PushService
    PushService -->|Payload vacío {}| APNs
    PushService -->|PATCH Balance| GoogleAPI
    APNs -->|Silent Wakeup| iOS
    GoogleAPI -->|Cloud Messaging| Android

    Ledger --> WalletRegistry
    Ledger --> AuditChain
    Ledger --> D1Snapshot
```

---

## 2. Librerías y Dependencias Recomendadas en Node.js

### 2.1 Apple Wallet (`.pkpass` Package & Signer)

Un archivo `.pkpass` es un contenedor comprimido ZIP que requiere:
1. `pass.json`: Definición semántica de la tarjeta (`storeCard`), paleta cromática, campos (saldo, nombre, ID de socio), barcode QR y metadatos de sincronización web (`webServiceURL`, `authenticationToken`).
2. Activos gráficos requeridos por Apple HIG: `icon.png`, `icon@2x.png`, `icon@3x.png`, `logo.png`, `logo@2x.png`, `strip.png` (o `thumbnail.png`).
3. `manifest.json`: Mapa hash SHA-1 de cada uno de los archivos incluidos en el archivo ZIP.
4. `signature`: Firma binaria PKCS#7 / CMS (Cryptographic Message Syntax) desasociada (*detached*) generada sobre `manifest.json`, firmada con el certificado Pass Type ID emitido por Apple y la clave privada de la tienda, concatenando el certificado intermedio Apple Worldwide Developer Relations (WWDR) G4.

#### Comparativa: `passkit-generator` vs Generación Nativa (`node:crypto` + `archiver`)

| Criterio | Opción A: `passkit-generator` | Opción B: Generación Modular Nativa (`node:crypto` + `archiver`) |
| :--- | :--- | :--- |
| **Dependencias Externas** | Múltiples dependencias transitivas (forge, jszip, etc.). | Solo 1 dependencia (`archiver` para streaming zip) o compresión nativa. |
| **Control de Criptografía** | Delega en librerías JS de PKCS#7. | Control directo con `node:crypto.createSign('RSA-SHA256')` o `openssl cms`. |
| **Compatibilidad Node Strip-Types & Workers** | Puede presentar fricción con builds ESM puros. | 100% compatible con `node --experimental-strip-types` y Cloudflare Workers `nodejs_compat`. |
| **Modo Mock / Pruebas Unitarias** | Requiere certificados reales o flags de bypass. | Módulo desacoplado con MockSigner automático para CI/CD sin credenciales Apple. |
| **Rendimiento y Streaming** | Crea buffers en memoria. | Pipe directo a `res` de `node:http` con bajo consumo de memoria. |

**Recomendación de Arquitectura:**
Implementar un módulo nativo desacoplado `packages/wallet-passkit` (o en `apps/api/src/wallet/apple-pass-service.ts`) apoyado en `archiver` para el empaquetado ZIP y `node:crypto` para la digestión de hashes SHA-1 y la firma CMS.

#### Requisitos de Certificados Apple:
1. **Pass Type Identifier**: Registrado en developer.apple.com (ej. `pass.mx.kronavault.wallet`).
2. **Certificado Pass Type ID (`pass.cer`)**: Descargado y convertido a formato PEM:
   ```bash
   openssl x509 -inform der -in pass.cer -out pass-cert.pem
   openssl pkcs12 -in pass-key.p12 -nocerts -out pass-key.pem -nodes
   ```
3. **Apple WWDR Intermediate Certificate (G4)**:
   ```bash
   curl -o AppleWWDRCAG4.cer https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
   openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr-g4.pem
   ```
4. **Variables de Entorno**:
   ```env
   APPLE_PASS_TYPE_IDENTIFIER=pass.mx.kronavault.wallet
   APPLE_TEAM_IDENTIFIER=A1B2C3D4E5
   APPLE_PASS_CERT_PEM="-----BEGIN CERTIFICATE-----\n..."
   APPLE_PASS_KEY_PEM="-----BEGIN PRIVATE KEY-----\n..."
   APPLE_WWDR_CERT_PEM="-----BEGIN CERTIFICATE-----\n..."
   APPLE_PASS_WEB_SERVICE_URL="https://vault.kronavault.mx/api/v1"
   ```

---

### 2.2 Google Wallet (Google Wallet API & Save to Wallet JWT)

Google Wallet funciona mediante dos modelos combinados:
1. **Save to Google Wallet JWT (Skinny / Fat JWT)**: Permite que el usuario guarde el pase con un solo clic sin necesidad de pre-crear el objeto en los servidores de Google vía REST. El enlace deep link oficial tiene la forma:
   `https://pay.google.com/gp/v/save/${jwtToken}`.
2. **Google Wallet REST API v1 (`https://walletobjects.googleapis.com/walletobjects/v1`)**: Para actualizaciones automáticas de saldo desde el backend cuando el jugador realiza una compra o recibe premios de torneo.

#### Evaluación de Librerías:
- **`node:crypto` nativo**: Permite firmar el JWT con algoritmo `RS256` utilizando la clave privada RSA de la cuenta de servicio de Google sin requerir librerías pesadas externas:
  ```typescript
  import { createSign } from 'node:crypto';
  // Firma estándar RS256: Base64Url(Header) + "." + Base64Url(Payload)
  ```
- **`google-auth-library`**: Recomendada si se consume la API REST de Google para actualizaciones en segundo plano (*Background Patching*), ya que gestiona automáticamente la expiración, renovación y caché de tokens OAuth2 de la cuenta de servicio (`scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']`).

#### Variables de Entorno Requeridas:
```env
GOOGLE_WALLET_ISSUER_ID=3388000000022221111
GOOGLE_WALLET_CLASS_ID=3388000000022221111.krona_vault_pass
GOOGLE_WALLET_SA_EMAIL=krona-wallet-sa@krona-vault.iam.gserviceaccount.com
GOOGLE_WALLET_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

---

## 3. Nuevos Endpoints en la API HTTP (`apps/api/src/server.ts`)

### 3.1 Endpoints de Emisión Inicial de Pases

#### 1. `GET /api/wallet/apple/:userId/pass.pkpass`
- **Propósito**: Genera el archivo binario `.pkpass` en tiempo real para el usuario solicitado.
- **Flujo de Seguridad**:
  - Verifica sesión del usuario (o token temporal de descarga firmado).
  - Consulta en `engine.walletsByUser.get(userId)` los datos vigentes del jugador (nombre, memberCode, saldo disponible, tramos FEFO, resguardos en bóveda).
  - Recupera o genera un `authenticationToken` criptográfico de 32 bytes y registra el pase en el motor.
  - Ensambla `pass.json`, calcula `manifest.json`, genera `signature` PKCS#7 y empaqueta el ZIP.
- **Cabeceras HTTP de Respuesta**:
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/vnd.apple.pkpass
  Content-Disposition: attachment; filename="krona-pass.pkpass"
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0
  ```

#### 2. `GET /api/wallet/google/:userId/save-url`
- **Propósito**: Construye el objeto `genericObject` de Google Wallet con los datos actuales del jugador, firma el JWT con la cuenta de servicio y devuelve la URL para agregar la tarjeta con un clic.
- **Respuesta JSON**:
  ```json
  {
    "ok": true,
    "saveUrl": "https://pay.google.com/gp/v/save/eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2026-10-21T04:30:00.000Z"
  }
  ```

---

### 3.2 Rutas Oficiales del Protocolo Apple PassKit Web Service (`/api/v1`)

Apple Wallet en iOS y watchOS implementa una especificación REST estándar y estricta para sincronización automática:

```mermaid
sequenceDiagram
    autonumber
    participant iPhone as iPhone (Apple Wallet)
    participant API as KRONA Server (/api/v1)
    participant Engine as Ledger Engine
    participant APNs as Apple APNs

    Note over iPhone,API: 1. Registro del Dispositivo al Instalar Pase
    iPhone->>API: POST /api/v1/devices/{deviceLibraryId}/registrations/{passTypeId}/{serialNumber}<br/>Header: Authorization: ApplePass {authToken}<br/>Body: {"pushToken": "..."}
    API->>Engine: registerWalletDevice(...)
    Engine-->>API: OK (Nuevo o Existente)
    API-->>iPhone: 201 Created (o 200 OK)

    Note over Engine,APNs: 2. Cambio en Saldo (Torneo / POS / Devolución)
    Engine->>APNs: Push Notification (Payload vacío {}) a device pushToken
    APNs-->>iPhone: Silent Background Wakeup

    Note over iPhone,API: 3. Consulta de Pases Modificados
    iPhone->>API: GET /api/v1/devices/{deviceLibraryId}/registrations/{passTypeId}?passesUpdatedSince={tag}
    API->>Engine: getPassesForDevice(...)
    Engine-->>API: { lastUpdated: "2026-10-21T04:00:00Z", serialNumbers: ["CC-0001"] }
    API-->>iPhone: 200 OK con lista de seriales (o 204 No Content)

    Note over iPhone,API: 4. Descarga del Pase Actualizado
    iPhone->>API: GET /api/v1/passes/{passTypeId}/{serialNumber}<br/>Header: Authorization: ApplePass {authToken}<br/>Header: If-Modified-Since: {date}
    alt Sin cambios
        API-->>iPhone: 304 Not Modified
    else Con cambios
        API->>Engine: Generar .pkpass actualizado
        API-->>iPhone: 200 OK (application/vnd.apple.pkpass)
        Note over iPhone: Apple Wallet actualiza saldo y muestra banner en pantalla de bloqueo
    end

    Note over iPhone,API: 5. Eliminación del Pase por el Usuario
    iPhone->>API: DELETE /api/v1/devices/{deviceLibraryId}/registrations/{passTypeId}/{serialNumber}<br/>Header: Authorization: ApplePass {authToken}
    API->>Engine: unregisterWalletDevice(...)
    API-->>iPhone: 200 OK
```

#### Especificación Detallada de Cada Endpoint `/api/v1`:

1. **`POST /api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber`**
   - **Header Requerido**: `Authorization: ApplePass <authenticationToken>`
   - **Body**: `{ "pushToken": "string" }`
   - **Lógica**: Valida que el `authenticationToken` coincida con el generado para ese `serialNumber`. Almacena o actualiza la tupla `(deviceLibraryIdentifier, pushToken, passTypeIdentifier, serialNumber)`.
   - **Códigos HTTP**:
     - `201 Created`: Si el dispositivo no estaba registrado para ese pase.
     - `200 OK`: Si el dispositivo ya estaba registrado.
     - `401 Unauthorized`: Si el token `ApplePass` es incorrecto.

2. **`GET /api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier`**
   - **Query Param Opcional**: `passesUpdatedSince=<tag_o_iso_timestamp>`
   - **Lógica**: Retorna la lista de números de serie asociados a este dispositivo que se hayan modificado después de la fecha `passesUpdatedSince`.
   - **Códigos HTTP**:
     - `200 OK`: `{ "lastUpdated": "2026-10-21T03:30:00Z", "serialNumbers": ["CC-0001"] }`
     - `204 No Content`: Si no hay pases modificados desde la fecha indicada.

3. **`GET /api/v1/passes/:passTypeIdentifier/:serialNumber`**
   - **Header Requerido**: `Authorization: ApplePass <authenticationToken>`
   - **Header Opcional**: `If-Modified-Since: <HTTP-date>`
   - **Lógica**: Valida el token. Compara la fecha de última actualización del pase con `If-Modified-Since`. Si no ha cambiado, retorna `304`. Si cambió, genera y retorna el binario `.pkpass` con cabecera `Last-Modified`.
   - **Códigos HTTP**:
     - `200 OK`: Archivo binario `.pkpass`.
     - `304 Not Modified`: Si la versión en el dispositivo ya es la más reciente.
     - `401 Unauthorized`: Token inválido.
     - `404 Not Found`: Pase inexistente.

4. **`DELETE /api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber`**
   - **Header Requerido**: `Authorization: ApplePass <authenticationToken>`
   - **Lógica**: Elimina el registro del dispositivo de la base de datos para no seguir enviando notificaciones APNs.
   - **Códigos HTTP**:
     - `200 OK`: Desvinculación exitosa.
     - `401 Unauthorized`: Token inválido.

5. **`POST /api/v1/log`**
   - **Body**: `{ "logs": ["string"] }`
   - **Lógica**: Apple Wallet reporta automáticamente cualquier fallo de renderizado, error de firma o discrepancia de formato en el cliente. Se registran en el log de auditoría del sistema para diagnóstico.
   - **Códigos HTTP**: `200 OK`.

---

## 4. Persistencia y Modelo de Datos en el Motor (`apps/api/src/ledger-engine.ts`)

### 4.1 Definición de la Entidad `WalletRegistrationRecord`

En `packages/shared-types/src/index.ts`:

```typescript
export type WalletPlatformType = 'APPLE' | 'GOOGLE';

export interface WalletRegistrationRecord {
  /** Identificador único UUID del registro */
  id: string;
  /** ID del jugador propietario del pase */
  userId: string;
  /** Plataforma móvil: APPLE o GOOGLE */
  platform: WalletPlatformType;
  /** Identificador único de librería del dispositivo (Apple) o ID de cuenta cliente (Google) */
  deviceLibraryIdentifier: string;
  /** Token de notificación APNs (Apple) o push token / subscriber token (Google) */
  pushToken: string;
  /** Número de serie del pase (habitualmente user.memberCode ej. 'CC-0001') */
  serialNumber: string;
  /** Identificador de tipo de pase (ej. 'pass.mx.kronavault.wallet' o ClassId de Google) */
  passTypeIdentifier: string;
  /** Token de autenticación simétrico de 32 bytes para autorizar llamadas ApplePass */
  authenticationToken: string;
  /** Tag o timestamp de última modificación para cabecera HTTP If-Modified-Since */
  lastUpdatedTag: string;
  /** Fecha de registro inicial */
  createdAt: string;
  /** Fecha de última actualización */
  updatedAt: string;
}
```

### 4.2 Estado y Métodos en `ControlCreditoEngine`

```typescript
export class ControlCreditoEngine {
  // Estado en memoria indexado para alto rendimiento:
  public walletRegistrations: Map<string, WalletRegistrationRecord> = new Map();
  // Índice secundario: `${deviceLibraryIdentifier}:${passTypeIdentifier}:${serialNumber}` -> id
  private walletDevicePassIndex: Map<string, string> = new Map();
  // Índice secundario por userId: userId -> Set<id>
  private walletUserIndex: Map<string, Set<string>> = new Map();

  /**
   * Registra o actualiza un dispositivo móvil vinculado a un pase digital
   */
  public registerWalletDevice(params: {
    userId: string;
    platform: WalletPlatformType;
    deviceLibraryIdentifier: string;
    pushToken: string;
    serialNumber: string;
    passTypeIdentifier: string;
    authenticationToken: string;
  }): { record: WalletRegistrationRecord; isNew: boolean } {
    const key = `${params.deviceLibraryIdentifier}:${params.passTypeIdentifier}:${params.serialNumber}`;
    const existingId = this.walletDevicePassIndex.get(key);
    const now = new Date().toISOString();

    if (existingId && this.walletRegistrations.has(existingId)) {
      const rec = this.walletRegistrations.get(existingId)!;
      rec.pushToken = params.pushToken;
      rec.updatedAt = now;
      return { record: rec, isNew: false };
    }

    const id = randomUUID();
    const newRecord: WalletRegistrationRecord = {
      id,
      userId: params.userId,
      platform: params.platform,
      deviceLibraryIdentifier: params.deviceLibraryIdentifier,
      pushToken: params.pushToken,
      serialNumber: params.serialNumber,
      passTypeIdentifier: params.passTypeIdentifier,
      authenticationToken: params.authenticationToken,
      lastUpdatedTag: now,
      createdAt: now,
      updatedAt: now,
    };

    this.walletRegistrations.set(id, newRecord);
    this.walletDevicePassIndex.set(key, id);

    let userSet = this.walletUserIndex.get(params.userId);
    if (!userSet) {
      userSet = new Set();
      this.walletUserIndex.set(params.userId, userSet);
    }
    userSet.add(id);

    return { record: newRecord, isNew: true };
  }

  /**
   * Desregistra un dispositivo cuando el usuario elimina el pase de su teléfono
   */
  public unregisterWalletDevice(params: {
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
    serialNumber: string;
    authenticationToken: string;
  }): boolean {
    const key = `${params.deviceLibraryIdentifier}:${params.passTypeIdentifier}:${params.serialNumber}`;
    const id = this.walletDevicePassIndex.get(key);
    if (!id) return false;

    const rec = this.walletRegistrations.get(id);
    if (!rec || rec.authenticationToken !== params.authenticationToken) {
      return false;
    }

    this.walletRegistrations.delete(id);
    this.walletDevicePassIndex.delete(key);
    this.walletUserIndex.get(rec.userId)?.delete(id);
    return true;
  }

  /**
   * Obtiene todos los dispositivos registrados para un usuario
   */
  public getWalletDevicesForUser(userId: string): WalletRegistrationRecord[] {
    const ids = this.walletUserIndex.get(userId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.walletRegistrations.get(id))
      .filter((r): r is WalletRegistrationRecord => Boolean(r));
  }

  /**
   * Actualiza el tag de modificación de un pase para forzar actualización en la próxima consulta
   */
  public touchPassUpdatedTag(serialNumber: string): void {
    const now = new Date().toISOString();
    for (const rec of this.walletRegistrations.values()) {
      if (rec.serialNumber === serialNumber) {
        rec.lastUpdatedTag = now;
        rec.updatedAt = now;
      }
    }
  }
}
```

### 4.3 Persistencia en Snapshots e Hidratación (`EngineStateSnapshot`)

Se amplía la interfaz `EngineStateSnapshot` para incluir la colección `walletRegistrations`:

```typescript
export interface EngineStateSnapshot {
  version: number;
  updatedAt: string;
  org: OrganizationSettings;
  stores: StoreBranch[];
  wallets: PlayerWalletState[];
  tournaments: TournamentRecord[];
  journalEntries: JournalEntryRecord[];
  idempotencyKeys: string[];
  vouchers: PhysicalVoucher[];
  redemptions: PosRedemptionRecord[];
  preorderHolds: PreorderHoldRecord[];
  shiftClosures: StoreShiftClosureReport[];
  auditLogs: AuditLogRecord[];
  usedQrNonces: string[];
  activeSessions: ActiveSessionRecord[];
  custodyPackages?: CustodyPackageRecord[];
  walletRegistrations?: WalletRegistrationRecord[]; // <-- NUEVO CAMPO
  // ...
}
```

---

## 5. Disparadores de Actualización Automática (Push Triggering Pipeline)

### 5.1 Momentos del Ciclo de Vida que Detonan Actualización

| Evento de Negocio | Método en `ledger-engine.ts` | Parámetros Clave | Impacto en el Pase Digital |
| :--- | :--- | :--- | :--- |
| **1. Dispersión de Premios de Torneo** | `disperseTournamentPool()` / `issueCredit()` | `sourceType: 'TOURNAMENT_PRIZE'` | Incrementa saldo disponible, agrega tramo con fecha de vigencia del torneo, muestra notificación en pantalla de bloqueo. |
| **2. Cobro en Mostrador POS** | `redeemCreditAtPos()` | `creditToApplyCents > 0` | Descuenta saldo líquido según tramos FEFO, actualiza barra de saldo disponible y folio de ticket. |
| **3. Bono de Trade-In de Singles** | `issueCredit()` | `sourceType: 'SINGLES_TRADE_IN'` | Acredita saldo inmediato acordado por cartas entregadas al catálogo de la tienda. |
| **4. Devolución de Compra** | `processPosReturn()` / `refund` | `refundedCreditCents > 0` | Restaura crédito de tienda prioritariamente para evitar fuga de efectivo (*Anti-Cash-Out*). |
| **5. Resguardo en Bóveda (Custodia)** | `createCustodyPackage()` / `releaseCustodyPackage()` | `purpose: GRADING / SAFE_KEEPING` | Actualiza el campo auxiliar "Mis Resguardos en Bóveda" en el reverso del pase con el folio y conteo de cartas activas. |
| **6. Fusión de Cuentas / Ajuste Manual** | `mergePlayerWallets()` / `adjustBalanceManual()` | `targetUserId`, `amountCents` | Unifica el saldo consolidado y reasigna los pases activos al nuevo ID canónico. |

### 5.2 Diseño del Servicio Asíncrono (`WalletPushNotificationService`)

Para **nunca bloquear la respuesta HTTP en la caja POS** (donde los cajeros imprimen vouchers térmicos en <100ms) ni retrasar la liquidación masiva de torneos con cientos de jugadores:

```mermaid
flowchart LR
    A["Operación de Negocio<br/>(POS / Torneo / Custodia)"] -->|Transacción Exitosa| B["Ledger Engine"]
    B -->|Retorna HTTP 200 Inmediato| C["Cajero POS / Pantalla"]
    B -.->|Evento wallet:notify-update| D["WalletPushNotificationService<br/>(In-Memory Queue)"]
    
    subgraph AsyncWorker ["Worker Asíncrono en Segundo Plano"]
        D --> E["Debounce & Grouping<br/>(1.5 segundos por usuario)"]
        E --> F{"Plataforma del Dispositivo"}
        F -->|Apple| G["APNs HTTP/2 Client<br/>(Push Payload {})"]
        F -->|Google| H["Google Wallet REST API<br/>(PATCH /genericObjects)"]
    end
    
    G --> I["Apple APNs Gateway"]
    H --> J["Google Play Services"]
```

#### Implementación del Servicio Asíncrono:

```typescript
import http2 from 'node:http2';
import { EventEmitter } from 'node:events';
import type { ControlCreditoEngine } from './ledger-engine.ts';

export class WalletPushNotificationService extends EventEmitter {
  private queue: Map<string, { userId: string; serialNumber: string; queuedAt: number }> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 1500;

  constructor(private engine: ControlCreditoEngine) {
    super();
  }

  /**
   * Encola la notificación para un usuario de manera no bloqueante
   */
  public queueNotification(userId: string, serialNumber: string): void {
    this.queue.set(userId, { userId, serialNumber, queuedAt: Date.now() });
    this.engine.touchPassUpdatedTag(serialNumber);

    if (!this.debounceTimer) {
      this.debounceTimer = setTimeout(() => {
        this.processBatch().catch((err) => console.error('Error procesando lote de notificaciones Wallet:', err));
        this.debounceTimer = null;
      }, this.DEBOUNCE_MS);
    }
  }

  /**
   * Procesa el lote agrupado de dispositivos
   */
  private async processBatch(): Promise<void> {
    const items = Array.from(this.queue.values());
    this.queue.clear();

    for (const item of items) {
      const devices = this.engine.getWalletDevicesForUser(item.userId);
      const appleDevices = devices.filter((d) => d.platform === 'APPLE');
      const googleDevices = devices.filter((d) => d.platform === 'GOOGLE');

      // 1. Despachar a Apple APNs vía HTTP/2
      if (appleDevices.length > 0) {
        await Promise.allSettled(
          appleDevices.map((d) => this.sendApnsSilentPush(d.pushToken, d.passTypeIdentifier))
        );
      }

      // 2. Despachar a Google Wallet REST API
      if (googleDevices.length > 0) {
        await this.syncGoogleWalletObject(item.userId, item.serialNumber).catch((err) =>
          console.warn(`Error actualizando Google Wallet para ${item.userId}:`, err)
        );
      }
    }
  }

  /**
   * Envía push vacío {} por HTTP/2 a APNs
   */
  private async sendApnsSilentPush(pushToken: string, passTypeIdentifier: string): Promise<void> {
    // Si no hay certificados configurados en entorno de desarrollo/pruebas, salta de forma segura
    if (!process.env.APPLE_PASS_CERT_PEM) return;

    return new Promise((resolve) => {
      try {
        const client = http2.connect('https://api.push.apple.com:443');
        client.on('error', (err) => {
          console.error('APNs connection error:', err);
          resolve();
        });

        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${pushToken}`,
          'apns-topic': passTypeIdentifier,
          'apns-push-type': 'background',
          'apns-priority': '5',
        });

        req.write(JSON.stringify({}));
        req.end();

        req.on('response', (headers) => {
          const status = headers[':status'];
          if (status !== 200) {
            console.warn(`APNs respuesta con status ${status} para token ${pushToken.slice(0, 8)}...`);
          }
          client.close();
          resolve();
        });
      } catch (err) {
        console.error('Fallo al disparar APNs push:', err);
        resolve();
      }
    });
  }

  /**
   * Actualiza el objeto en Google Wallet REST API
   */
  private async syncGoogleWalletObject(userId: string, memberCode: string): Promise<void> {
    const user = this.engine.walletsByUser.get(userId);
    if (!user) return;
    // Construye el payload actualizado y ejecuta PATCH https://walletobjects.googleapis.com/...
  }
}
```

---

## 6. Integración en la PWA del Jugador (`apps/web-pwa/public/wallet.html`)

### 6.1 Detección Inteligente del Sistema Operativo

En `wallet.html`, la sección de descarga de pases identifica el entorno mediante `navigator.userAgent`, `navigator.platform` y `navigator.maxTouchPoints`:

```javascript
function detectPlayerDeviceOS() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  return isIOS ? 'IOS' : isAndroid ? 'ANDROID' : 'DESKTOP';
}
```

### 6.2 Comportamiento de Interfaz Adaptativa

- **Si es iOS**:
  - Muestra el botón oficial **"Add to Apple Wallet"** en tamaño destacado (*hero banner*).
  - Al hacer clic, descarga `/api/wallet/apple/{userId}/pass.pkpass`, lo que abre de inmediato la hoja nativa de iOS para agregar el pase a la app Wallet.
- **Si es Android**:
  - Muestra el botón oficial **"Save to Google Wallet"**.
  - Al hacer clic, invoca `/api/wallet/google/{userId}/save-url` y redirige directamente a la app de Google Wallet o URL de guardado.
- **Si es Desktop (PC / Mac con navegador de escritorio)**:
  - Muestra un módulo interactivo con los dos botones oficiales junto con un **Código QR interactivo para escanear con la cámara del celular**:
  - *"Escanea este código con tu iPhone o Android para llevar tu KRONA Pass™ en el bolsillo"*.

### 6.3 Código HTML y CSS de los Botones Oficiales

```html
<!-- MÓDULO WALLET: AGREGAR A APPLE / GOOGLE WALLET -->
<section class="vault-card" id="digitalPassSection" style="margin-bottom:1.15rem;background:linear-gradient(180deg, #101522 0%, #07090E 100%);border:1px solid var(--border-gold);">
  <div class="card-header">
    <div class="card-title">
      <svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
      <span>Pase Oficial en tu Teléfono (Apple & Google Wallet)</span>
    </div>
    <span class="badge badge-gold">SYNC NATIVO</span>
  </div>
  <p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:1rem;">
    Lleva tu saldo de tienda, tramos de torneos y resguardos en bóveda directamente en la billetera de tu celular. Se actualiza automáticamente cada vez que recibes premios o compras en caja.
  </p>

  <!-- CONTENEDOR MÓVIL (iOS / Android) -->
  <div id="mobileWalletActions" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;">
    <!-- Botón Oficial Add to Apple Wallet -->
    <a id="btnAppleWallet" href="#" class="btn-wallet-apple" style="display:none;" onclick="downloadApplePass(event)">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.63 1.35-.58.67-.99 1.74-.86 2.76 1 .08 2.03-.51 2.57-1.26z"/>
      </svg>
      <span>Agregar a <strong>Apple Wallet</strong></span>
    </a>

    <!-- Botón Oficial Save to Google Wallet -->
    <a id="btnGoogleWallet" href="#" class="btn-wallet-google" style="display:none;" onclick="openGoogleWallet(event)">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
      </svg>
      <span>Guardar en <strong>Google Wallet</strong></span>
    </a>
  </div>

  <!-- CONTENEDOR DESKTOP CON QR PARA ESCANEAR -->
  <div id="desktopWalletQrNotice" style="display:none;margin-top:0.85rem;background:var(--bg-abyss);padding:1rem;border-radius:var(--radius-sm);border:1px dashed var(--border-default);">
    <div style="display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap;">
      <div id="desktopQrContainer" style="background:#FFF;padding:0.5rem;border-radius:4px;display:inline-block;"></div>
      <div style="flex:1;min-width:220px;">
        <h2 style="font-size:0.92rem;font-weight:700;color:var(--accent-gold-hover);margin-bottom:0.25rem;">Lleva tu pase a tu teléfono</h2>
        <p style="font-size:0.75rem;color:var(--text-secondary);line-height:1.4;margin-bottom:0.5rem;">
          Apunta la cámara de tu teléfono a este código para abrir tu pase digital en tu iPhone o Android.
        </p>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button class="btn btn-slate" style="font-size:0.72rem;padding:0.35rem 0.65rem;" onclick="downloadApplePass(event)">Descargar .pkpass (Mac)</button>
          <button class="btn btn-slate" style="font-size:0.72rem;padding:0.35rem 0.65rem;" onclick="openGoogleWallet(event)">Abrir Google Save</button>
        </div>
      </div>
    </div>
  </div>
</section>
```

#### Estilos CSS Corporativos para los Badges:
```css
/* Botón Oficial Apple Wallet */
.btn-wallet-apple {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  background-color: #000000;
  color: #FFFFFF !important;
  border: 1px solid #333333;
  border-radius: 8px;
  padding: 0.55rem 1.15rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 0.85rem;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.btn-wallet-apple:hover {
  background-color: #1A1A1A;
  border-color: #555555;
  transform: translateY(-1px);
}

/* Botón Oficial Google Wallet */
.btn-wallet-google {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  background-color: #1F1F1F;
  color: #FFFFFF !important;
  border: 1px solid #333333;
  border-radius: 8px;
  padding: 0.55rem 1.15rem;
  font-family: "Google Sans", Roboto, -apple-system, sans-serif;
  font-size: 0.85rem;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.btn-wallet-google:hover {
  background-color: #2D2D2D;
  border-color: #555555;
  transform: translateY(-1px);
}
```

---

## 7. Plan de Implementación Paso a Paso & Roadmap

```mermaid
gantt
    title Roadmap de Implementación: Apple & Google Wallet en KRONA VAULT
    dateFormat  YYYY-MM-DD
    section Fase 1: Fundaciones
    Gestión de Certificados Apple & Google SA     :done, p1_1, 2026-10-21, 2d
    Modelado de Datos WalletRegistrationRecord    :done, p1_2, 2026-10-22, 2d
    Generador de PKCS#7 & Plantilla pass.json      :active, p1_3, 2026-10-23, 3d

    section Fase 2: Endpoints & Protocolo
    Endpoint de Emisión .pkpass y Google JWT     :p2_1, 2026-10-26, 3d
    Rutas Oficiales Apple PassKit Web Service     :p2_2, 2026-10-28, 4d
    Pruebas E2E con Apple Wallet Simulator       :p2_3, 2026-10-31, 3d

    section Fase 3: Push Pipeline
    Servicio Asíncrono WalletPushNotification    :p3_1, 2026-11-03, 3d
    Ganchos en LedgerEngine (Torneos, POS, etc.)  :p3_2, 2026-11-05, 3d
    Conector APNs HTTP/2 y Google REST API       :p3_3, 2026-11-08, 4d

    section Fase 4: PWA UI & Piloto
    Componentes en wallet.html con OS Detection  :p4_1, 2026-11-12, 2d
    Piloto en Tienda Real con Jugadores Activos  :p4_2, 2026-11-14, 5d
    Auditoría de Rendimiento en Caja (<100ms)    :p4_3, 2026-11-19, 2d
```

### Paso 1: Configuración de Credenciales y Plantillas Gráficas (Día 1 a 3)
1. Crear el Pass Type ID en el portal de Apple Developer y generar el certificado de firma.
2. Crear la cuenta de servicio en Google Cloud Console, asignar el rol de Issuer en Google Pay & Wallet Console.
3. Generar los activos PNG obligatorios en `@2x` y `@3x` con el logo de KRONA VAULT y fondo corporativo oscuro `#07090E`.

### Paso 2: Extensión del Motor Ledger (`ledger-engine.ts`) (Día 4 a 6)
1. Incorporar el modelo `WalletRegistrationRecord` en `packages/shared-types`.
2. Implementar los métodos de registro, desregistro y actualización de tags en `ControlCreditoEngine`.
3. Actualizar `exportSnapshot()` e `importSnapshot()` para garantizar que los tokens y registros de dispositivos persistan tras reinicios y en Cloudflare D1.

### Paso 3: Endpoints REST en `server.ts` (Día 7 a 10)
1. Implementar `GET /api/wallet/apple/:userId/pass.pkpass` con cabeceras MIME correctas.
2. Implementar `GET /api/wallet/google/:userId/save-url` con firma RS256.
3. Montar la suite de rutas bajo `/api/v1` conforme a la especificación oficial de Apple PassKit.
4. Agregar pruebas automatizadas en `apps/api/src/api-e2e.test.ts`.

### Paso 4: Pipeline de Actualización Automática Asíncrona (Día 11 a 14)
1. Instanciar `WalletPushNotificationService`.
2. Añadir los disparadores de notificación en los 6 momentos clave del ciclo contable.
3. Verificar que las respuestas HTTP del mostrador POS mantengan una latencia menor a 15ms sin esperar la llamada a Apple o Google.

### Paso 5: PWA e Integración con Jugadores (Día 15 a 18)
1. Actualizar `apps/web-pwa/public/wallet.html` con los botones nativos y la lógica de detección de SO.
2. Añadir soporte para modo de visualización en escritorio mediante generación de QR de vinculación.
3. Realizar pruebas piloto en mostrador físico con dispositivos iOS reales y Android.
