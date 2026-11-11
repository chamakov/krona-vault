# Política de Seguridad — Control Crédito

La seguridad e integridad de los datos financieros, libros contables y mecanismos de autorización de dos factores son la máxima prioridad de este proyecto.

---

## 🛡️ Versiones Soportadas

Actualmente, solo la rama principal (`main`) y las versiones etiquetadas más recientes reciben parches de seguridad activos:

| Versión | Soporte Activo |
| :--- | :--- |
| `1.0.x` / `main` | ✅ Sí |
| Versiones anteriores | ❌ No |

---

## 🔒 Reporte Responsable de Vulnerabilidades

**Por favor NO abras un Issue público para reportar una vulnerabilidad de seguridad crítica o un fallo en el motor contable/criptográfico.**

Para reportar una vulnerabilidad de manera confidencial y coordinada:

1. Utiliza la funcionalidad de **Private Vulnerability Reporting** de GitHub directamente en el repositorio:
   - Ve a la pestaña **Security** del repositorio en GitHub.
   - Selecciona **Advisories** y haz clic en **New draft security advisory**.
2. O bien, envía un correo privado al mantenedor a través de los datos de contacto publicados en el perfil del autor.

### Información Útil para Incluir en el Reporte
- Descripción detallada de la vulnerabilidad y vector de ataque.
- Pasos reproducibles o prueba de concepto (PoC).
- Componente afectado (`packages/crypto-totp`, `apps/api/src/ledger-engine.ts`, endpoints POS, etc.).
- Impacto potencial en la integridad contable, saldos de jugadores o autenticación.
- Sugerencia de remediación si cuentas con una.

---

## ⏳ Compromiso de Respuesta

- **Recepción y confirmación inicial**: dentro de las primeras 48 horas.
- **Evaluación y prueba de concepto**: dentro de los primeros 5 días hábiles.
- **Desarrollo y liberación del parche**: según la severidad, coordinando una fecha de divulgación responsable con el investigador.

---

## 🎯 Modelo de Amenazas Clave en este Proyecto

Al colaborar o auditar la plataforma, ten en cuenta las siguientes defensas arquitectónicas:
1. **Partida Doble Inmutable**: Ningún asiento puede destruirse o actualizarse; solo se neutralizan mediante contra-asientos autorizados.
2. **Anti-Replay en QR y Vouchers**: Los códigos QR rotan cada 30 segundos con nonce único; los vouchers físicos térmicos registran contador de impresiones y sello criptográfico único.
3. **Principio de Cuatro Ojos (Four-Eyes / Maker-Checker)**: Operaciones críticas (ajustes de saldo mayores al umbral, entregas de resguardos) exigen co-firma de un segundo supervisor y bloquean la auto-atención.
