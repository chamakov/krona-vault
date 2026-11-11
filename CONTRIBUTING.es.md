# Guía de Contribución a KRONA VAULT™

> 🌐 **Idiomas / Languages**: [ 🇲🇽 Español ](./CONTRIBUTING.es.md) · [ 🇺🇸 English ](./CONTRIBUTING.md)

¡Gracias por tu interés en contribuir a **KRONA VAULT™**! Este proyecto es de código abierto con el objetivo de ofrecer un sistema seguro, confiable y auto-hospedado para el control de crédito en tienda, punto de venta y contabilidad por partida doble.

---

## 🏛️ Filosofía y Principios Críticos

1. **Integridad Contable Innegociable**: Toda operación financiera debe respetar la regla de partida doble: $\sum \text{Debe} = \sum \text{Haber}$. Los balances nunca se alteran directamente; solo se crean nuevos asientos inmutables.
2. **Seguridad y Cero Fuga de Secretos**: Nunca almacenes contraseñas, semillas TOTP o llaves HMAC en texto plano ni en logs.
3. **Mecanismos Anti-Fraude**: Todo cobro o redención debe soportar validación con segundo factor (QR dinámico o PIN offline) y los vouchers físicos deben incluir sello criptográfico único.
4. **Calidad y Cobertura de Pruebas**: Cualquier cambio en el motor contable o criptográfico debe acompañarse de pruebas automatizadas que cubran casos borde.

---

## 🛠️ Requisitos Previos

- **Node.js**: `>= 22.23.4` (recomendado usar `nvm` o `fnm`, el repo incluye `.nvmrc` y `.node-version`).
- **npm**: `>= 10.9.9`.
- **Docker & Docker Compose**: Opcional para desarrollo local de base de datos y entorno completo.
- **Git**: `>= 2.30`.

---

## 🚀 Configuración del Entorno Local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/chamakov/krona-vault.git
   cd krona-vault
   ```

2. **Instalar dependencias del monorepo**:
   ```bash
   npm ci
   ```

3. **Verificar tipos de TypeScript**:
   ```bash
   npm run typecheck
   ```

4. **Ejecutar la suite de pruebas unitarias y de integración**:
   ```bash
   npm test
   ```

5. **Ejecutar pruebas End-to-End con Playwright (opcional)**:
   ```bash
   # Instalar navegadores de Playwright si es la primera vez
   npx playwright install --with-deps chromium

   # Ejecutar pruebas E2E
   npm run test:e2e
   ```

6. **Iniciar el servidor en modo desarrollo**:
   ```bash
   npm run dev:api
   # La API y la PWA estarán disponibles en http://localhost:3000
   ```

---

## 📁 Estructura del Monorepo

```
krona-vault/
├── apps/
│   ├── api/             # Servidor HTTP, motor contable, endpoints REST y Cloudflare Worker
│   └── web-pwa/         # Interfaz PWA vanilla offline-first (11 portales)
├── packages/
│   ├── crypto-totp/     # Generador/validador de QR TOTP, PIN offline, HMAC y hash-chain
│   └── shared-types/    # Definiciones TypeScript compartidas en todo el sistema
├── infra/
│   ├── caddy/           # Configuración de proxy inverso y TLS automático
│   └── postgres/        # Esquema SQL con triggers de inmutabilidad contable
├── docs/                # Documentación técnica, diseño de arquitectura y despliegues
├── e2e/                 # Suites de pruebas funcionales y de seguridad con Playwright
├── scripts/             # Herramientas de respaldo y utilidades administrativas
└── docker-compose.yml   # Orquestación de contenedores para producción y staging
```

---

## 📐 Convenciones de Código y Commits

- Usamos **Conventional Commits**:
  - `feat: agregar nuevo catálogo de categorías por sucursal`
  - `fix: corregir redondeo de centavos en liquidación de torneos`
  - `docs: actualizar guía de despliegue en Proxmox`
  - `test: añadir pruebas para consumo FEFO con saldo mixto`
  - `refactor: optimizar verificación de sellos de auditoría`
- TypeScript estricto en todos los paquetes.
- Nombres de funciones y variables claros y descriptivos en español o inglés técnico coherente con el módulo.

---

## 🔄 Proceso de Pull Requests

1. Crea una rama desde `main`:
   ```bash
   git checkout -b feature/nombre-de-tu-mejora
   ```
2. Realiza tus cambios asegurando que:
   - `npm run typecheck` pasa sin advertencias ni errores.
   - `npm test` pasa al 100%.
   - No se incluyan archivos `.env` o credenciales.
3. Haz push a tu fork o rama y abre un Pull Request contra `main`.
4. Completa la plantilla de PR detallando el contexto y las pruebas realizadas.
5. El equipo revisará el código y se ejecutarán los flujos de GitHub Actions.

---

## 💬 Canales de Comunicación

- **Preguntas o Ideas**: Abre un hilo en [GitHub Discussions](https://github.com/chamakov/krona-vault/discussions) o un [Issue](https://github.com/chamakov/krona-vault/issues).
- **Vulnerabilidades de Seguridad**: Por favor revisa [`SECURITY.md`](./SECURITY.md) antes de reportar problemas de seguridad públicamente.
