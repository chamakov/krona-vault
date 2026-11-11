# KRONA VAULT — Especificación y Diseño Técnico Exhaustivo de Integración con Google Wallet (Google Pay Passes API / Android)

**Versión:** 1.0.0  
**Fecha:** 2026-10-21  
**Estado:** Propuesta Técnica de Arquitectura Aprobada para Implementación  
**Alcance:** Monorepo `controlCredito` (`apps/api`, `apps/web-pwa`, `packages/shared-types`, `packages/crypto-totp`)  
**Ecosistema:** Google Cloud Platform, Google Pay & Wallet Business Console, Google Wallet REST API v1, Android OS / Google Play Services

---

## 1. Resumen Ejecutivo y Visión Arquitectónica

La integración de **KRONA VAULT™** con **Google Wallet** dota a los jugadores de cartas coleccionables (*Magic: The Gathering, Pokémon TCG, Yu-Gi-Oh!, One Piece, Lorcana*) con una credencial digital nativa de alta fidelidad en dispositivos Android.

A través de esta integración, la tarjeta de jugador de KRONA VAULT reside de manera persistente en la aplicación del sistema Google Wallet del teléfono Android, proporcionando:
1. **Identificación Inmediata en Mostrador y Torneos:** Despliegue de código QR/Barcode con `memberCode` y sellos dinámicos TOTP para check-in en eventos y cobro en caja registradora.
2. **Saldo en Tiempo Real con Push Pasivo:** Despliegue permanente del saldo disponible en Pesos Mexicanos (`$MXN`). Cualquier premio ganado en torneo o abono en mostrador dispara una actualización inmediata mediante llamadas REST que Google Play Services traduce en **notificaciones push directas en la pantalla de bloqueo y barra de estado de Android**.
3. **Despertar Contextual por Proximidad (Geofencing):** La tarjeta emerge proactivamente en la pantalla bloqueada cuando el jugador cruza el perímetro geográfico de cualquiera de las sucursales físicas de KRONA VAULT.
4. **Arquitectura Criptográfica Cero Confianza (Zero-Trust Signing):** Los pases se emiten como JSON Web Tokens (JWT) firmados asimétricamente con llaves RSA-256 (`RS256`) ligadas a una Cuenta de Servicio (*Service Account*) de Google Cloud, garantizando autenticidad total sin depender de sesiones web abiertas.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                ARQUITECTURA GENERAL                                    │
│                                                                                        │
│   ┌─────────────────────┐    REST PATCH (Balance)    ┌─────────────────────────────┐   │
│   │                     ├───────────────────────────►│ Google Wallet REST API v1   │   │
│   │     KRONA VAULT     │                            │ (walletobjects.googleapis)  │   │
│   │     API Engine      │◄───────────────────────────┤                             │   │
│   │    (Node.js/TS)     │    OAuth2 Bearer Token     └──────────────┬──────────────┘   │
│   │                     │    (Service Account JWT)                  │                  │
│   └──────────┬──────────┘                                           │ Google Push      │
│              │                                                      │ (Play Services)  │
│              │ Firma JWT (RS256)                                    ▼                  │
│              │ deep-link /save/{jwt}                         ┌──────────────┐          │
│              ▼                                               │ Dispositivo  │          │
│   ┌─────────────────────┐       Deep-Link Intent             │   Android    │          │
│   │  KRONA PWA Player   ├───────────────────────────────────►│Google Wallet │          │
│   │  (Web-PWA Client)   │                                    │  App Nativa  │          │
│   └─────────────────────┘                                    └──────────────┘          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitectura y Modelo de Datos de Google Wallet API

### 2.1. Configuración de Google Cloud Console y Cuentas de Servicio

Para operar con la API de Google Wallet, KRONA VAULT utiliza una identidad de servicio autenticada con roles de emisor:

1. **Creación y Configuración del Proyecto GCP:**
   - Proyecto en GCP: `krona-vault-production` (ID: `krona-vault-prod-9842`).
   - Habilitar la API: **Google Wallet API** (anteriormente conocida como *Google Pay Passes API*, servicio: `walletobjects.googleapis.com`).

2. **Creación de la Service Account (Cuenta de Servicio):**
   - Nombre: `krona-wallet-signer`
   - Email asignado: `krona-wallet-signer@krona-vault-prod-9842.iam.gserviceaccount.com`
   - Rol IAM en GCP: Ningún rol especial de administración en GCP es requerido; su autorización se realiza directamente en la consola comercial de Wallet.

3. **Generación y Gestión de Clave Privada JSON:**
   - Se genera una clave en formato JSON con algoritmo RSA de 2048 bits.
   - Campos críticos del archivo `krona-wallet-credentials.json`:
     - `client_email`: Identidad del emisor firmante.
     - `private_key`: Llave privada PEM (`-----BEGIN PRIVATE KEY-----\n...`).
     - `private_key_id`: Huella digital del par de claves.
   - **Almacenamiento Seguro:** En KRONA VAULT, la llave se inyecta mediante variables de entorno en producción:
     - `GOOGLE_WALLET_ISSUER_ID="3388000000022345678"`
     - `GOOGLE_WALLET_CLIENT_EMAIL="krona-wallet-signer@krona-vault-prod-9842.iam.gserviceaccount.com"`
     - `GOOGLE_WALLET_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...-----END PRIVATE KEY-----\n"`

---

### 2.2. Google Pay & Wallet Business Console y Registro de Issuer ID

1. **Alta de Empresa en Business Console:**
   - Acceso al portal [Google Pay & Wallet Business Console](https://pay.google.com/business/console).
   - Perfil comercial: *KRONA VAULT TCG & Games S.A. de C.V.*
   - Se genera el **Issuer ID (ID de Emisor)**: un número entero global único de 18 a 20 dígitos (ejemplo: `3388000000022345678`).

2. **Vinculación de la Service Account con el Issuer ID:**
   - En la sección **Google Wallet API** > **Service Accounts**, se añade la dirección `krona-wallet-signer@krona-vault-prod-9842.iam.gserviceaccount.com`.
   - Se le otorgan permisos de **Desarrollador / Administrador**. A partir de este momento, cualquier llamada autenticada por esta Service Account tiene autoridad delegada sobre el Issuer ID.

3. **Modos de Operación (Demo / Producción):**
   - **Demo / Sandbox:** Por defecto, los pases generados solo pueden guardarse en cuentas de Google que hayan sido registradas como "Cuentas de prueba" (*Test Accounts*) en la consola.
   - **Aprobación de Producción:** Se envía la solicitud de revisión del diseño visual del pase desde la consola. Una vez aprobada, cualquier usuario del mundo con cuenta de Google y Android puede añadir el pase sin restricciones.

---

### 2.3. Paradigma y Separación: Clase (`Class`) vs Objeto (`Object`)

Google Wallet desacopla estrictamente el diseño y las reglas globales (la **Clase**) de los datos transaccionales de cada persona (el **Objeto**).

```
                      CLASE (Plantilla de Tienda)
             ID: 3388000000022345678.krona_vault_pass_v1
       ┌─────────────────────────────────────────────────────────┐
       │ - Logotipo KRONA VAULT (660x660 px)                     │
       │ - Color de Fondo Hexadecimal: #0F172A (Deep Slate)      │
       │ - Emisor: "KRONA VAULT™"                                │
       │ - 10 Geocercas (Ubicaciones físicas de las sucursales) │
       │ - Enlaces Globales (PWA, Términos, Soporte)             │
       └────────────────────────────┬────────────────────────────┘
                                    │ Instancia 1:N
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
OBJETO JUGADOR 1                                  OBJETO JUGADOR 2
ID: ...player_u_1001                              ID: ...player_u_2045
┌─────────────────────────────────┐               ┌─────────────────────────────────┐
│ Jugador: Rodrigo Chamakov       │               │ Jugador: Valeria Gómez          │
│ Member: KV-1001                 │               │ Member: KV-2045                 │
│ Saldo: $1,450.00 MXN            │               │ Saldo: $620.00 MXN              │
│ QR: Dynamic TOTP / MemberCode   │               │ QR: Dynamic TOTP / MemberCode   │
│ DeepLink: /wallet?u=u_1001      │               │ DeepLink: /wallet?u=u_2045      │
└─────────────────────────────────┘               └─────────────────────────────────┘
```

#### Regla Estricta de Identificadores (IDs) en Google Wallet:
Tanto las Clases como los Objetos deben tener un `id` con el formato canónico:
$$\text{ID} = \text{IssuerID} + \text{"."} + \text{AlphanumericSuffix}$$
- **Class ID:** `3388000000022345678.krona_vault_pass_v1`
- **Object ID:** `3388000000022345678.player_u_admin_1_kv1001`

---

### 2.4. Comparativa de Clases: `GenericClass` vs `LoyaltyClass`

Google Wallet ofrece dos modelos altamente viables para KRONA VAULT:

| Criterio | `GenericClass` / `GenericObject` | `LoyaltyClass` / `LoyaltyObject` |
| :--- | :--- | :--- |
| **Enfoque de Negocio** | Credencial multipropósito, Bóveda de Saldo, Pases personalizados. | Programas de fidelidad clásicos, puntos y recompensas. |
| **Soporte de Balance** | Campo `header` y módulos de texto (`textModulesData`) con formateo arbitrario (`$1,450.00 MXN`). | Campo estructurado nativo `loyaltyPoints` con `label` y `balance` (numérico o texto). |
| **Jerarquía Visual** | Tarjeta moderna con diseño de cabecera personalizable, `cardTitle`, `subheader` y módulos agrupados. | Renderizado estándar tipo tarjeta de recompensas de supermercado o aerolínea. |
| **Flexibilidad de Campos** | Alta: Permite desglosar *Saldo en Bóveda*, *Escrow en Preventas*, *Crédito por Caducar*. | Media: Orientada primordialmente a "Puntos Acumulados" y "Nivel". |
| **Recomendación KRONA VAULT** | **RECOMENDADA (Elección Principal)**: Brinda estética premium de bóveda bancaria/gaming y total libertad para desgloses financieros de TCG. | Alternativa viable si se desea interoperabilidad estricta con sistemas POS de lealtad basados en puntos. |

---

### 2.5. Definición Exhaustiva del JSON de la Clase (`GenericClass`)

Esta definición se crea **una sola vez** en la API de Google Wallet al inicializar el sistema KRONA VAULT:

```json
{
  "id": "3388000000022345678.krona_vault_pass_v1",
  "issuerName": "KRONA VAULT™",
  "reviewStatus": "UNDER_REVIEW",
  "cardTitle": {
    "defaultValue": {
      "language": "es-419",
      "value": "TARJETA DE SOCIO Y SALDO EN BÓVEDA"
    }
  },
  "header": {
    "defaultValue": {
      "language": "es-419",
      "value": "KRONA VAULT"
    }
  },
  "hexBackgroundColor": "#0F172A",
  "logo": {
    "sourceUri": {
      "uri": "https://vault.kronagames.com/static/wallet/krona-vault-logo-square.png"
    },
    "contentDescription": {
      "defaultValue": {
        "language": "es-419",
        "value": "Logotipo Oficial KRONA VAULT"
      }
    }
  },
  "heroImage": {
    "sourceUri": {
      "uri": "https://vault.kronagames.com/static/wallet/krona-vault-hero-banner.png"
    },
    "contentDescription": {
      "defaultValue": {
        "language": "es-419",
        "value": "Banner de Bóveda y Torneos KRONA"
      }
    }
  },
  "locations": [
    {
      "kind": "walletobjects#latLongPoint",
      "latitude": 19.418432,
      "longitude": -99.162431
    },
    {
      "kind": "walletobjects#latLongPoint",
      "latitude": 19.509822,
      "longitude": -99.234120
    }
  ],
  "linksModuleData": {
    "uris": [
      {
        "uri": "https://vault.kronagames.com",
        "description": "Portal Web PWA KRONA VAULT",
        "id": "portal_link"
      },
      {
        "uri": "https://vault.kronagames.com/legal/terminos-credito",
        "description": "Reglamento de Custodia y Saldo",
        "id": "terms_link"
      },
      {
        "uri": "tel:+525512345678",
        "description": "Atención al Jugador y WhatsApp",
        "id": "support_phone"
      }
    ]
  },
  "enableSmartTap": false
}
```

---

### 2.6. Definición Exhaustiva del JSON del Objeto (`GenericObject`)

Este objeto representa la tarjeta viva del jugador, con su saldo actual, código de miembro, nombre y enlaces personalizados a su PWA:

```json
{
  "id": "3388000000022345678.player_u_1001_kv1001",
  "classId": "3388000000022345678.krona_vault_pass_v1",
  "state": "ACTIVE",
  "hasUsers": true,
  "cardTitle": {
    "defaultValue": {
      "language": "es-419",
      "value": "KRONA VAULT PLAYER PASS"
    }
  },
  "subheader": {
    "defaultValue": {
      "language": "es-419",
      "value": "SALDO DISPONIBLE EN TIENDA"
    }
  },
  "header": {
    "defaultValue": {
      "language": "es-419",
      "value": "$1,450.00 MXN"
    }
  },
  "barcode": {
    "type": "QR_CODE",
    "value": "KV1001:TOTP:849201",
    "alternateText": "KV-1001"
  },
  "textModulesData": [
    {
      "id": "player_name",
      "header": "JUGADOR",
      "body": "Rodrigo Chamakov"
    },
    {
      "id": "member_code",
      "header": "NÚMERO DE SOCIO",
      "body": "KV-1001"
    },
    {
      "id": "escrow_balance",
      "header": "RESGUARDADO EN PREVENTAS",
      "body": "$350.00 MXN"
    },
    {
      "id": "membership_tier",
      "header": "NIVEL DE CUENTA",
      "body": "MIEMBRO ORO (PREMIUM)"
    }
  ],
  "linksModuleData": {
    "uris": [
      {
        "uri": "https://vault.kronagames.com/wallet?session=u_1001_fastpass",
        "description": "Abrir Mi Bóveda en KRONA PWA",
        "id": "pwa_fastlink"
      },
      {
        "uri": "https://vault.kronagames.com/tournaments/active",
        "description": "Ver Torneos y Standings de Hoy",
        "id": "tournaments_link"
      }
    ]
  }
}
```

---

## 3. Generación y Distribución del Pase al Teléfono Android

### 3.1. Creación del JSON Web Token (JWT) Firmado con RS256

Para distribuir el pase al usuario final sin necesidad de forzarlo a autenticarse previamente en una API de Google, se emite un **JWT firmado criptográficamente**. Google Wallet acepta este token firmado por la Service Account autorizada y permite al usuario guardar el pase con un solo clic.

#### Estructura del JWT:

1. **Header:**
   ```json
   {
     "alg": "RS256",
     "typ": "JWT"
   }
   ```

2. **Payload:**
   ```json
   {
     "iss": "krona-wallet-signer@krona-vault-prod-9842.iam.gserviceaccount.com",
     "aud": "google",
     "origins": [
       "https://vault.kronagames.com",
       "https://krona-vault.pages.dev"
     ],
     "typ": "savetowallet",
     "payload": {
       "genericObjects": [
         {
           "id": "3388000000022345678.player_u_1001_kv1001",
           "classId": "3388000000022345678.krona_vault_pass_v1",
           "state": "ACTIVE",
           "header": {
             "defaultValue": {
               "language": "es-419",
               "value": "$1,450.00 MXN"
             }
           },
           "subheader": {
             "defaultValue": {
               "language": "es-419",
               "value": "SALDO DISPONIBLE EN TIENDA"
             }
           },
           "barcode": {
             "type": "QR_CODE",
             "value": "KV1001:TOTP:849201",
             "alternateText": "KV-1001"
           },
           "textModulesData": [
             {
               "id": "player_name",
               "header": "JUGADOR",
               "body": "Rodrigo Chamakov"
             },
             {
               "id": "member_code",
               "header": "SOCIO",
               "body": "KV-1001"
             }
           ]
         }
       ]
     }
   }
   ```

> [!IMPORTANT]
> El campo `origins` debe contener estrictamente los dominios web autorizados desde donde se ejecuta el botón en el cliente PWA. Si un atacante roba el JWT e intenta incrustarlo en un sitio de phishing (`https://sitio-malicioso.com`), Google Wallet rechazará la solicitud de guardado al validar el encabezado HTTP `Origin`.

---

### 3.2. Implementación de Generación del JWT en TypeScript (`apps/api`)

En el backend de KRONA VAULT (`apps/api`), se implementa un servicio dedicado utilizando la biblioteca criptográfica nativa de Node.js o `jsonwebtoken`:

```typescript
// apps/api/src/services/google-wallet.service.ts
import jwt from 'jsonwebtoken';
import { PlayerWalletState } from '../../../packages/shared-types/src/index.ts';

export interface GoogleWalletConfig {
  issuerId: string;
  clientEmail: string;
  privateKeyPem: string;
  allowedOrigins: string[];
}

export class GoogleWalletService {
  constructor(private readonly config: GoogleWalletConfig) {}

  /**
   * Genera el deep-link firmado para agregar o actualizar la tarjeta en Android
   */
  public generateSaveUrl(player: PlayerWalletState): string {
    const objectId = `${this.config.issuerId}.player_${player.userId}_${player.memberCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const classId = `${this.config.issuerId}.krona_vault_pass_v1`;

    const formattedBalance = `$${(player.availableBalanceCents / 100).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} MXN`;

    const formattedEscrow = `$${(player.escrowPreorderCents / 100).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} MXN`;

    const payload = {
      iss: this.config.clientEmail,
      aud: 'google',
      origins: this.config.allowedOrigins,
      typ: 'savetowallet',
      payload: {
        genericObjects: [
          {
            id: objectId,
            classId: classId,
            state: player.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
            cardTitle: {
              defaultValue: {
                language: 'es-419',
                value: 'KRONA VAULT PLAYER PASS',
              },
            },
            subheader: {
              defaultValue: {
                language: 'es-419',
                value: 'SALDO DISPONIBLE EN TIENDA',
              },
            },
            header: {
              defaultValue: {
                language: 'es-419',
                value: formattedBalance,
              },
            },
            barcode: {
              type: 'QR_CODE',
              value: player.memberCode,
              alternateText: player.memberCode,
            },
            textModulesData: [
              {
                id: 'player_name',
                header: 'JUGADOR',
                body: player.fullName || player.alias,
              },
              {
                id: 'member_code',
                header: 'ID SOCIO',
                body: player.memberCode,
              },
              {
                id: 'escrow_balance',
                header: 'EN PREVENTAS / ESCROW',
                body: formattedEscrow,
              },
              {
                id: 'account_status',
                header: 'ESTADO',
                body: player.status === 'ACTIVE' ? 'ACTIVO' : 'BLOQUEADO',
              },
            ],
            linksModuleData: {
              uris: [
                {
                  uri: `https://vault.kronagames.com/wallet?player=${encodeURIComponent(player.memberCode)}`,
                  description: 'Abrir Mi Bóveda en KRONA PWA',
                  id: 'pwa_link',
                },
              ],
            },
          },
        ],
      },
    };

    const token = jwt.sign(payload, this.config.privateKeyPem, {
      algorithm: 'RS256',
    });

    return `https://pay.google.com/gp/v/save/${token}`;
  }
}
```

---

### 3.3. Botón Oficial "Guardar en Google Wallet" y Comportamiento Multiplataforma

Google especifica pautas estrictas de marca para el botón web (*Google Wallet Web Button*):

```html
<!-- En la PWA de KRONA VAULT (apps/web-pwa) -->
<a href="https://pay.google.com/gp/v/save/{JWT_GENERADO}" target="_blank" rel="noopener noreferrer">
  <img 
    src="https://developers.google.com/static/wallet/retail/images/es-419_add_to_google_wallet_wallet-button.svg" 
    alt="Guardar en Google Wallet"
    height="48"
  />
</a>
```

#### Comportamiento Diferenciado por Dispositivo:
1. **En Teléfono Móvil Android:**
   - La URL `https://pay.google.com/gp/v/save/{token}` dispara un **Android Intent Filter**.
   - El navegador cede el control de forma inmediata a la aplicación nativa **Google Wallet** instalada en el sistema.
   - Se abre un modal nativo (*Bottom Sheet*) que muestra la vista previa con los colores de KRONA VAULT, el saldo actual y el botón "Guardar".
   - Al tocar "Guardar", el pase queda registrado en el llavero de Google Play Services del teléfono y disponible sin conexión (*offline*).
2. **En Computadora de Escritorio (PC / Mac):**
   - El enlace abre el portal web `https://pay.google.com` en una pestaña del navegador.
   - El usuario inicia sesión en su cuenta de Google (Gmail/Workspace).
   - Aparece la confirmación: *"Tarjeta guardada en tu cuenta de Google"*.
   - Inmediatamente, mediante sincronización en la nube de Google, el pase aparece mágicamente en el teléfono Android del usuario en cuestión de segundos, sin haber tocado el móvil.

---

## 4. Actualizaciones en Tiempo Real y Notificaciones Push Nativas

Uno de los mayores diferenciadores competitivos de KRONA VAULT frente a sistemas de lealtad tradicionales es la capacidad de **empujar notificaciones push a la pantalla de bloqueo de Android sin necesidad de que el usuario tenga una app nativa pesada instalada**. Google Wallet actúa como el agente push nativo del sistema operativo.

### 4.1. Diagrama de Secuencia: Acreditación de Premio en Torneo y Push Inmediato

```mermaid
sequenceDiagram
    autonumber
    actor Judge as Juez de Torneo / Staff
    participant API as KRONA VAULT API Engine
    participant Ledger as Motor Contable Partida Doble
    participant Queue as Google Wallet Event Queue
    participant GAPI as Google Wallet REST API v1
    participant Android as Teléfono Android (Google Play Services)

    Judge->>API: Finalizar Torneo (ej. Top 4 Pokémon Regional)
    API->>Ledger: Ejecutar Póliza Contable (Abono +$450.00 MXN a Jugador)
    Ledger-->>API: Póliza Asentada (Nuevo Saldo: $1,450.00 MXN)
    API->>Queue: Encolar Evento 'WALLET_UPDATE_REQUEST'
    API-->>Judge: Confirmación de Pago de Torneo Exitoso
    
    Note over Queue,GAPI: Proceso Asíncrono / No Bloqueante
    Queue->>GAPI: PATCH /walletobjects/v1/genericObject/{resourceId}<br/>Authorization: Bearer [OAuth2 Token]<br/>Body: { header: "$1,450.00 MXN", messages: [...] }
    GAPI-->>Queue: HTTP 200 OK (Objeto Actualizado)
    
    GAPI->>Android: Notificación Push C2DM / Play Services
    Note over Android: Google Wallet despierta en segundo plano
    Android-->>Android: Despliega Notificación en Barra de Estado & Lock Screen
    Note right of Android: 🔔 KRONA VAULT: ¡Premio Acreditado!<br/>Se han acreditado $450 MXN. Nuevo saldo: $1,450.00 MXN
```

---

### 4.2. Llamada REST `PATCH` a Google Wallet API

Para actualizar el saldo y emitir la notificación push nativa, el backend de KRONA VAULT envía una solicitud HTTP `PATCH`:

- **Endpoint:**
  `PATCH https://walletobjects.googleapis.com/walletobjects/v1/genericObject/3388000000022345678.player_u_1001_kv1001`
- **Encabezados HTTP:**
  ```http
  Authorization: Bearer ya29.c.b0...[Token_OAuth2_Service_Account]
  Content-Type: application/json
  ```
- **Cuerpo de la Solicitud (Payload):**
  ```json
  {
    "header": {
      "defaultValue": {
        "language": "es-419",
        "value": "$1,450.00 MXN"
      }
    },
    "textModulesData": [
      {
        "id": "player_name",
        "header": "JUGADOR",
        "body": "Rodrigo Chamakov"
      },
      {
        "id": "member_code",
        "header": "ID SOCIO",
        "body": "KV-1001"
      },
      {
        "id": "escrow_balance",
        "header": "RESGUARDADO EN PREVENTAS",
        "body": "$350.00 MXN"
      },
      {
        "id": "account_status",
        "header": "ESTADO",
        "body": "ACTIVO"
      }
    ],
    "messages": [
      {
        "header": "¡Premio Acreditado en KRONA VAULT!",
        "body": "Se han depositado $450.00 MXN por tu 2do Lugar en el Torneo Standard. Tu saldo actualizado es de $1,450.00 MXN.",
        "displayInterval": {
          "start": {
            "date": "2026-10-21T03:30:00Z"
          }
        },
        "id": "prize_msg_tournament_9812"
      }
    ]
  }
  ```

### 4.3. Parámetro `messages` y Notificación Push Nativa de Android

Al incluir un nuevo elemento en el arreglo `messages` dentro de la llamada `PATCH`, el servidor de Google Wallet identifica que existe una notificación dirigida al usuario:
- **Prioridad de Entrega:** Se transmite vía Google Play Services con alta prioridad.
- **Pantalla Bloqueada:** Se muestra como una tarjeta en la pantalla bloqueada con el icono oficial de KRONA VAULT.
- **Interacción:** Si el jugador pulsa la notificación, Android abre instantáneamente la tarjeta de Google Wallet mostrando el saldo actualizado y el mensaje completo.

---

### 4.4. Control de Cuotas de API de Google y Mitigación de Saturación

En torneos masivos de TCG (*Regional Championships* de 128 o 256 jugadores), el cierre de la ronda final y la premiación concurrente podrían emitir cientos de llamadas simultáneas a la API de Google Wallet.

#### Cuotas Oficiales de Google Wallet API:
- Límite por defecto: **100 solicitudes por minuto por proyecto**.
- Límite diario: **50,000 llamadas por día** (ampliable mediante formulario de soporte de Google Cloud).

#### Buenas Prácticas y Estrategia de Resiliencia en KRONA VAULT:
1. **Desacoplamiento Asíncrono Estricto:** La liquidación contable de premios en KRONA VAULT jamás espera de forma síncrona la respuesta de Google Wallet. La transacción financiera local se asienta en <5 milisegundos en PostgreSQL y emite un evento interno `PLAYER_BALANCE_UPDATED`.
2. **Cola de Encolamiento con Rate Limiter:** Un proceso en segundo plano (Worker) consume los eventos con una política de drenado limitada a **15 solicitudes por segundo** (900 req/min, respetando la cuota asignada).
3. **Agrupamiento por Lotes (Batch Requests):** Google Wallet soporta peticiones HTTP Batch en `https://walletobjects.googleapis.com/batch`. Mediante esta técnica, se pueden empaquetar hasta **100 operaciones `PATCH` en una única conexión HTTP**, reduciendo drásticamente el consumo de cuota y el overhead de red TLS.
4. **Debouncing en Compras Rápidas:** Si un jugador realiza tres compras seguidas en mostrador en un lapso de 30 segundos, el worker aplica un *debounce* de 5 segundos, enviando únicamente el estado final del saldo a Google Wallet.
5. **Reintentos con Backoff Exponencial y Jitter:** Manejo automatizado de respuestas HTTP 429 (`RESOURCE_EXHAUSTED`) con tiempos de espera crecientes aleatorios ($2^n + \text{rand}(0, 1000)\text{ms}$).

---

## 5. Geolocalización y Avisos por Proximidad en Pantalla Bloqueada

Google Wallet aprovecha el hardware GPS y las balizas de red del dispositivo Android sin consumir batería adicional mediante el servicio de geocercas (*Geofencing API*) de Google Play Services.

### 5.1. Configuración de `locations` en la Clase o en el Objeto

Se pueden registrar hasta **10 ubicaciones geográficas** por Clase u Objeto. KRONA VAULT las define a nivel de `GenericClass` para que apliquen a todas las sucursales de la cadena, o a nivel de `GenericObject` si el jugador tiene una tienda sede preferida:

```json
"locations": [
  {
    "kind": "walletobjects#latLongPoint",
    "latitude": 19.418432,
    "longitude": -99.162431
  },
  {
    "kind": "walletobjects#latLongPoint",
    "latitude": 19.509822,
    "longitude": -99.234120
  }
]
```

### 5.2. Activación Automática en la Pantalla de Bloqueo de Android

```
┌─────────────────────────────────────────────────────────────┐
│ 12:45 PM                                                    │
│ Miércoles, 21 de Octubre                                    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💳 KRONA VAULT                                          │ │
│ │ Estás cerca de la Sucursal Roma Norte                   │ │
│ │ Toca para abrir tu tarjeta de socio y saldo en bóveda   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                    [ Lector de Huella ]                     │
└─────────────────────────────────────────────────────────────┘
```

1. **Detección Pasiva de Entrada en Geocerca:** Cuando el jugador camina hacia la tienda y cruza el radio de detección (calibrado por Google entre 100 y 150 metros de las coordenadas registradas), Google Play Services detecta el evento sin abrir la app.
2. **Notificación en Pantalla Bloqueada (Ambient Lock Screen Notification):** El teléfono despliega un banner nativo con el nombre y logotipo de KRONA VAULT: *"Estás cerca de KRONA VAULT (Roma Norte). Toca para ver tu tarjeta de socio y saldo"*.
3. **Acceso Inmediato en Mostrador:** El jugador toca la notificación, desbloquea con huella digital o reconocimiento facial, y la tarjeta aparece en pantalla con el código QR listo para que el cajero lo escanee en segundos.

---

## 6. Google Smart Tap (Tecnología NFC de Google Wallet)

### 6.1. ¿Qué es Google Smart Tap?

**Google Smart Tap** es el protocolo propietario de comunicación NFC de campo cercano desarrollado por Google sobre la norma internacional **ISO/IEC 14443 Tipo A y Tipo B** y comandos APDU (ISO 7816-4). 

A diferencia de los códigos de barras y QR ópticos, Smart Tap permite que el jugador simplemente acerque la parte trasera de su teléfono Android a la terminal de punto de venta de la tienda para identificarse y transmitir su saldo o ID de socio, de la misma manera que paga con una tarjeta de crédito contactless.

```
┌────────────────────────┐      NFC (13.56 MHz Smart Tap)      ┌────────────────────────┐
│   Teléfono Android     ├────────────────────────────────────►│  Terminal POS Mostrador │
│   (Google Wallet)      │◄────────────────────────────────────┤  (Lector NFC Certif.)  │
└────────────────────────┘       Criptograma Cifrado           └───────────┬────────────┘
                                 (AES-GCM / Ephemeral Key)                 │
                                                                           ▼
                                                               ┌────────────────────────┐
                                                               │  KRONA VAULT POS Agent │
                                                               │  (Valida MemberCode)   │
                                                               └────────────────────────┘
```

### 6.2. Mecanismo de Funcionamiento y Protocolo de Seguridad

1. **Emisión de Handshake NFC:** La terminal de mostrador transmite un identificador de colector Smart Tap (*Collector ID*, típicamente coincidente con el `Issuer ID` de la tienda).
2. **Filtrado en el Teléfono:** El chip NFC de Android busca en Google Wallet si existe un pase que coincida con ese *Collector ID*. Si coincide, el teléfono selecciona automáticamente la tarjeta de KRONA VAULT, incluso sin que el usuario tenga que navegar en menús.
3. **Generación de Criptograma Dinámico:** Por razones de privacidad y prevención de espionaje en radiofrecuencia (evitar que un tercero clone el ID del socio con una antena pirata en la tienda), el teléfono no transmite el ID de miembro en texto plano:
   - Genera un criptograma efímero cifrado con la clave pública del comercio (AES-128 o AES-256 GCM).
   - El criptograma incluye un número de secuencia (*nonce*), estampa de tiempo y el valor `smartTapRedemptionValue` registrado en el objeto.
4. **Descifrado en Punto de Venta:** El lector NFC o la aplicación local de KRONA VAULT en caja descifra el criptograma utilizando su clave privada local y extrae el identificador seguro del jugador (`KV-1001`).

### 6.3. Requisitos para Habilitación de Smart Tap

Para activar Smart Tap en KRONA VAULT se requieren los siguientes pasos formales:
1. **Convenio de Desarrollador Smart Tap con Google:** Firmar el anexo de confidencialidad y términos de Smart Tap en la consola de Google Pay & Wallet.
2. **Generación de Llaves de Cifrado (Merchant Cryptographic Keys):** Cargar la clave pública en la consola de Google Wallet y almacenar la clave privada en el hardware de punto de venta (*Secure Element* / SAM de la terminal).
3. **Hardware Contactless Compatible:** Terminales que admitan el kernel de Smart Tap:
   - Terminales bancarias Verifone (Engage / Android POS) o Ingenico (Tetra).
   - Lectores USB NFC para PC de mostrador compatibles con el SDK de Smart Tap (ej. Advanced Card Systems ACR122U con middleware o pegatinas inteligentes certificadas).

### 6.4. Estrategia Gradual de Despliegue para KRONA VAULT

```
  ┌─────────────────────────────────────────────────────────┐
  │ FASE 1: PRODUCCIÓN ACTUAL (Q4 2026)                     │
  │ - Código QR de alta resolución en Google Wallet.        │
  │ - TOTP dinámico de seguridad o memberCode.              │
  │ - Compatibilidad con el 100% de pistolas láser ópticas. │
  └────────────────────────────┬────────────────────────────┘
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │ FASE 2: PILOTO SMART TAP (Q2 2027)                      │
  │ - Configuración de smartTapRedemptionValue en el Objeto.│
  │ - Instalación de terminales NFC de mesa en caja matriz. │
  │ - Experiencia "Tap & Play": El jugador acerca el cel y  │
  │   queda inscrito al torneo instantáneamente.            │
  └─────────────────────────────────────────────────────────┘
```

---

## 7. Diagrama de Arquitectura de Clases y Datos (Mermaid)

El siguiente diagrama detalla la relación estructural entre el modelo interno de base de datos de KRONA VAULT y las entidades requeridas por la API de Google Wallet:

```mermaid
classDiagram
    class PlayerWalletState {
        +string walletId
        +string userId
        +string memberCode
        +string fullName
        +string alias
        +number availableBalanceCents
        +number escrowPreorderCents
        +string status
        +string deviceSecret
    }

    class GoogleGenericClass {
        +string id: "IssuerID.krona_vault_pass_v1"
        +string issuerName: "KRONA VAULT™"
        +string hexBackgroundColor: "#0F172A"
        +Object logo
        +Object heroImage
        +Array locations
        +Object linksModuleData
    }

    class GoogleGenericObject {
        +string id: "IssuerID.player_userId_memberCode"
        +string classId
        +string state: "ACTIVE" | "INACTIVE"
        +Object header: "$1,450.00 MXN"
        +Object subheader: "SALDO DISPONIBLE EN TIENDA"
        +Object barcode: QR_CODE
        +Array textModulesData
        +Array linksModuleData
        +Array messages
    }

    class GoogleWalletJWT {
        +string iss: service-account-email
        +string aud: "google"
        +Array origins
        +string typ: "savetowallet"
        +Object payload
    }

    PlayerWalletState --> GoogleGenericObject : Mapeo y Sincronización
    GoogleGenericClass "1" <-- "*" GoogleGenericObject : Pertenece a
    GoogleGenericObject --> GoogleWalletJWT : Encapsulado en Payload
```

---

## 8. Guía de Implementación Paso a Paso en KRONA VAULT

### Paso 1: Configurar Variables de Entorno en `.env`
```ini
# Google Wallet Integration
GOOGLE_WALLET_ISSUER_ID=3388000000022345678
GOOGLE_WALLET_CLIENT_EMAIL=krona-wallet-signer@krona-vault-prod-9842.iam.gserviceaccount.com
GOOGLE_WALLET_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...-----END PRIVATE KEY-----\n"
GOOGLE_WALLET_CLASS_ID=3388000000022345678.krona_vault_pass_v1
GOOGLE_WALLET_ALLOWED_ORIGINS=https://vault.kronagames.com,http://localhost:3000
```

### Paso 2: Endpoint para Obtener Enlace de Agregado en `apps/api/src/server.ts`
```typescript
// GET /api/wallet/google/save-link
if (req.method === 'GET' && url.pathname === '/api/wallet/google/save-link') {
  const session = resolveActorSession(req, engine);
  const saveUrl = googleWalletService.generateSaveUrl(session.actor);
  return sendJson(res, 200, { ok: true, saveUrl });
}
```

### Paso 3: Hook de Notificación de Cambio de Saldo en `apps/api/src/ledger-engine.ts`
En cada método que altera el saldo del jugador (`awardTournamentPrizes`, `redeemStoreCreditPosVoucher`, `depositCredit`):
```typescript
this.emit('PLAYER_BALANCE_CHANGED', {
  userId: player.userId,
  memberCode: player.memberCode,
  newBalanceCents: player.availableBalanceCents,
  reason: 'PREMIO_TORNEO',
  deltaCents: awardedCents
});
```

El worker en segundo plano toma este evento y ejecuta:
```typescript
await googleWalletService.patchPlayerBalance({
  userId,
  memberCode,
  newBalanceCents,
  pushMessage: `Premio acreditado: +$${(deltaCents / 100).toFixed(2)} MXN en KRONA VAULT.`
});
```

---

## 9. Conclusiones y Valor Estratégico para KRONA VAULT

1. **Cero Fricción para el Jugador Android:** No requiere descargas pesadas desde Google Play Store. Un toque en la PWA abre de inmediato la app nativa Google Wallet del sistema operativo.
2. **Canal Push Directo y Gratuito:** KRONA VAULT obtiene un canal de comunicación directo a la barra de estado y pantalla de bloqueo para avisar de premios de torneos, recargas y preventas sin costos de SMS ni problemas de entrega de correos electrónicos.
3. **Presencia Física en Tienda:** Gracias a las geocercas pasivas, cada vez que un jugador entra a la tienda de juegos, su teléfono le recuerda su saldo y le ofrece su código QR para comprar o competir.
4. **Seguridad y Criptografía de Nivel Financiero:** Firmas asimétricas RS256, tokens restringidos por dominio de origen (*origins*) y preparación para lectores contactless NFC Smart Tap de última generación.
