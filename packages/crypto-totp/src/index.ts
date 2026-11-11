import { createHmac, createHash, randomBytes, timingSafeEqual, scryptSync } from 'node:crypto';

export interface DynamicQrPayload {
  /** Versión del protocolo QR */
  v: 1;
  /** Código de miembro o UUID del jugador (ej. CC-8492) */
  memberCode: string;
  /** Ventana temporal de 30s (Unix epoch / 30) */
  timeStep: number;
  /** Nonce único de 8 caracteres hex para prevenir Replay Attack de captura de pantalla */
  nonce: string;
  /** Código numérico TOTP de 6 dígitos (también visible para dictar en Modo Sótano offline) */
  totpPin: string;
  /** Firma HMAC-SHA256 truncada (16 chars hex) */
  signature: string;
}

export interface AuditChainInput {
  seqId: number;
  timestampIso: string;
  orgId: string;
  storeId: string;
  actorUserId: string;
  coAuthorizerId: string | null;
  eventAction: string;
  payloadBeforeJson: string;
  payloadAfterJson: string;
  prevHash: string;
}

export const GENESIS_AUDIT_HASH = '0'.repeat(64);

/**
 * Calcula un código TOTP de 6 dígitos determinista (ventana de 30s) para el jugador.
 * Permite validar en caja incluso si el jugador no tiene internet en el local ("Modo Sótano").
 */
export function generatePlayerTotpPin(
  deviceSecret: string,
  memberCode: string,
  timestampMs: number = Date.now(),
  stepSeconds: number = 30
): { totpPin: string; timeStep: number; expiresInSeconds: number } {
  const timeStep = Math.floor(timestampMs / 1000 / stepSeconds);
  const elapsedInStep = Math.floor((timestampMs / 1000) % stepSeconds);
  const expiresInSeconds = stepSeconds - elapsedInStep;

  const hmac = createHmac('sha256', deviceSecret)
    .update(`TOTP:${memberCode}:${timeStep}`)
    .digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const totpPin = (binary % 1_000_000).toString().padStart(6, '0');
  return { totpPin, timeStep, expiresInSeconds };
}

/**
 * Genera el string compacto para el QR Dinámico de pago (`CC1.<memberCode>.<timeStep>.<nonce>.<totpPin>.<sig>`)
 * El nonce es determinista por cada ventana de 30s (timeStep), garantizando que el QR permanezca
 * 100% estable en pantalla durante los 30 segundos y únicamente rote al cumplirse el ciclo.
 */
export function createDynamicQrToken(
  deviceSecret: string,
  memberCode: string,
  timestampMs: number = Date.now(),
  customNonce?: string
): { qrToken: string; payload: DynamicQrPayload; expiresInSeconds: number } {
  const { totpPin, timeStep, expiresInSeconds } = generatePlayerTotpPin(
    deviceSecret,
    memberCode,
    timestampMs
  );
  const deterministicNonce = createHmac('sha256', deviceSecret)
    .update(`NONCE|${memberCode}|${timeStep}`)
    .digest('hex')
    .slice(0, 8);
  const nonce = customNonce || deterministicNonce;
  const messageToSign = `CC1|${memberCode}|${timeStep}|${nonce}|${totpPin}`;
  const signature = createHmac('sha256', deviceSecret)
    .update(messageToSign)
    .digest('hex')
    .slice(0, 16);

  const payload: DynamicQrPayload = {
    v: 1,
    memberCode,
    timeStep,
    nonce,
    totpPin,
    signature,
  };

  const qrToken = `CC1.${memberCode}.${timeStep}.${nonce}.${totpPin}.${signature}`;
  return { qrToken, payload, expiresInSeconds };
}

/**
 * Verifica criptográficamente un QR Dinámico escaneado en el POS.
 * Soporta una tolerancia de +-1 ventana de 30s por desfase de reloj del móvil.
 */
export function verifyDynamicQrToken(
  qrToken: string,
  deviceSecret: string,
  nowMs: number = Date.now(),
  allowedWindowDrift: number = 1
): { valid: boolean; reason?: string; payload?: DynamicQrPayload } {
  const parts = qrToken.trim().split('.');
  if (parts.length !== 6 || parts[0] !== 'CC1') {
    return { valid: false, reason: 'FORMATO_QR_INVALIDO' };
  }

  const [, memberCode, timeStepStr, nonce, totpPin, providedSig] = parts;
  const timeStep = Number.parseInt(timeStepStr, 10);
  if (Number.isNaN(timeStep)) {
    return { valid: false, reason: 'TIMESTEP_INVALIDO' };
  }

  const currentStep = Math.floor(nowMs / 1000 / 30);
  if (Math.abs(currentStep - timeStep) > allowedWindowDrift) {
    return { valid: false, reason: 'QR_EXPIRADO_TOMA_CAPTURA_DETECTADA' };
  }

  const expectedTotp = generatePlayerTotpPin(deviceSecret, memberCode, timeStep * 30 * 1000).totpPin;
  if (expectedTotp !== totpPin) {
    return { valid: false, reason: 'TOTP_PIN_INCORRECTO' };
  }

  const messageToSign = `CC1|${memberCode}|${timeStep}|${nonce}|${totpPin}`;
  const expectedSig = createHmac('sha256', deviceSecret)
    .update(messageToSign)
    .digest('hex')
    .slice(0, 16);

  const sigBufferA = Buffer.from(providedSig, 'utf8');
  const sigBufferB = Buffer.from(expectedSig, 'utf8');
  if (sigBufferA.length !== sigBufferB.length || !timingSafeEqual(sigBufferA, sigBufferB)) {
    return { valid: false, reason: 'FIRMA_CRIPTOGRAFICA_INVALIDA' };
  }

  return {
    valid: true,
    payload: {
      v: 1,
      memberCode,
      timeStep,
      nonce,
      totpPin,
      signature: providedSig,
    },
  };
}

/**
 * Calcula el Sello Criptográfico impreso en el Voucher Físico Térmico (58mm/80mm)
 * para que cualquier auditor pueda validar la autenticidad del papel en el corte de caja.
 */
export function generateVoucherCryptographicSeal(params: {
  voucherFolio: string;
  storeCode: string;
  memberCode: string;
  creditAppliedCents: number;
  journalEntryId: string;
  hsmSecret: string;
}): string {
  const raw = `${params.voucherFolio}|${params.storeCode}|${params.memberCode}|${params.creditAppliedCents}|${params.journalEntryId}`;
  const hex = createHmac('sha256', params.hsmSecret).update(raw).digest('hex').toUpperCase();
  // Formato legible en papel térmico: XXXX-XXXX-XXXX-XXXX
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

/**
 * Genera el Sello Criptográfico, Código Corto Base32 y Token del Comprobante de Resguardo en Bóveda (VaultSeal™ Custody)
 */
export function generateCustodyReceiptSeal(params: {
  folio: string;
  storeCode: string;
  clientMemberCode: string;
  tamperSealNumber?: string;
  declaredValueCents?: number;
  hsmSecret: string;
}): { sealText: string; receiptToken: string; claimVerificationCode: string } {
  const seal = params.tamperSealNumber?.trim() || 'N/A';
  const val = params.declaredValueCents ?? 0;
  const raw = `CUSTODY|${params.folio}|${params.storeCode}|${params.clientMemberCode}|${seal}|${val}`;
  const hex = createHmac('sha256', params.hsmSecret).update(raw).digest('hex').toUpperCase();
  const sealText = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;

  // Código corto Base32 de 8 caracteres legible: VC-XXXX-YYYY
  const chars = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  let shortCode = '';
  for (let i = 0; i < 8; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    shortCode += chars[byte % chars.length];
  }
  const claimVerificationCode = `VC-${shortCode.slice(0, 4)}-${shortCode.slice(4, 8)}`;
  const receiptToken = `KVC1.${params.storeCode}.${params.folio}.${claimVerificationCode}.${hex.slice(0, 16)}`;

  return { sealText, receiptToken, claimVerificationCode };
}

/**
 * Calcula el eslabón de la cadena de auditoría inmutable (Hash-Chain SHA-256 + Server HMAC)
 */
export function computeAuditHashChainLink(
  input: AuditChainInput,
  serverHsmSecret: string
): { rowHash: string; serverHmac: string } {
  const canonical = [
    input.seqId,
    input.timestampIso,
    input.orgId,
    input.storeId,
    input.actorUserId,
    input.coAuthorizerId ?? 'NONE',
    input.eventAction,
    input.payloadBeforeJson,
    input.payloadAfterJson,
    input.prevHash,
  ].join('||');

  const rowHash = createHash('sha256').update(canonical).digest('hex');
  const serverHmac = createHmac('sha256', serverHsmSecret).update(rowHash).digest('hex');

  return { rowHash, serverHmac };
}

export interface SessionTokenPayload {
  sid: string;
  uid: string;
  mc: string;
  role: string;
  storeId: string | null;
  iat: number;
  exp: number;
}

/**
 * Genera un hash criptográficamente seguro con scrypt (N=16384, r=8, p=1) y salt único de 16 bytes.
 * Formato del digest: `scrypt$<saltHex>$<derivedKeyHex>`
 */
export function hashCredential(rawSecret: string, salt?: string): string {
  const secretClean = String(rawSecret).trim();
  const effectiveSalt = salt ?? randomBytes(16).toString('hex');
  const derivedKey = scryptSync(secretClean, effectiveSalt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$${effectiveSalt}$${derivedKey}`;
}

/**
 * Valida un secreto contra un hash almacenado, con soporte transparente para hashes scrypt
 * y retrocompatibilidad con hashes legacy HMAC-SHA256. Utiliza timingSafeEqual para mitigar timing attacks.
 */
export function verifyCredentialHash(rawSecret: string, storedHash?: string | null): boolean {
  if (!storedHash || !rawSecret) return false;
  const secretClean = String(rawSecret).trim();

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    const computed = scryptSync(secretClean, salt, 32, { N: 16384, r: 8, p: 1 });
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (computed.length !== expectedBuf.length) return false;
    return timingSafeEqual(computed, expectedBuf);
  }

  // Soporte retrocompatible para hashes legacy HMAC-SHA256 (KRONA_IAM_SALT_V1)
  const legacyHash = createHmac('sha256', 'KRONA_IAM_SALT_V1').update(secretClean).digest('hex');
  const computedBuf = Buffer.from(legacyHash, 'utf8');
  const expectedBuf = Buffer.from(storedHash, 'utf8');
  if (computedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(computedBuf, expectedBuf);
}

/**
 * Emite un token de sesión firmado (`KST1.<base64url(payload)>.<hmacSha256Hex>`)
 */
export function createSessionToken(
  payload: SessionTokenPayload,
  serverHsmSecret: string
): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', serverHsmSecret)
    .update(`KST1.${encoded}`)
    .digest('hex')
    .slice(0, 32);
  return `KST1.${encoded}.${sig}`;
}

/**
 * Verifica la autenticidad y vigencia de un token de sesión `KST1`.
 */
export function verifySessionToken(
  token: string,
  serverHsmSecret: string,
  nowMs: number = Date.now()
): { valid: boolean; reason?: string; payload?: SessionTokenPayload } {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'TOKEN_VACIO' };
  }
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'KST1') {
    return { valid: false, reason: 'FORMATO_TOKEN_INVALIDO' };
  }
  const [, encoded, providedSig] = parts;
  const expectedSig = createHmac('sha256', serverHsmSecret)
    .update(`KST1.${encoded}`)
    .digest('hex')
    .slice(0, 32);

  const bufA = Buffer.from(providedSig, 'utf8');
  const bufB = Buffer.from(expectedSig, 'utf8');
  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
    return { valid: false, reason: 'FIRMA_SESION_INVALIDA' };
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (payload.exp * 1000 < nowMs) {
      return { valid: false, reason: 'SESION_EXPIRADA' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'PAYLOAD_SESION_CORRUPTO' };
  }
}

/* ==========================================================================
   RFC 6238 STANDARD TOTP & BASE32 (Google Authenticator, Microsoft Authenticator)
   ========================================================================== */

const RFC4648_BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Codifica un buffer en Base32 estándar (RFC 4648)
 */
export function encodeBase32(buffer: Buffer | Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += RFC4648_BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += RFC4648_BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Decodifica una cadena Base32 (RFC 4648) en Buffer, ignorando espacios y guiones
 */
export function decodeBase32(base32Str: string): Buffer {
  const clean = String(base32Str).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = RFC4648_BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Genera una semilla criptográfica de 20 bytes (160 bits) codificada en Base32 (32 caracteres)
 * compatible con Google Authenticator, Microsoft Authenticator, 1Password, Authy y Apple Passwords.
 */
export function generateAuthenticatorSecret(): string {
  return encodeBase32(randomBytes(20));
}

/**
 * Formatea una clave secreta en bloques de 4 caracteres para facilitar su lectura y captura manual
 */
export function formatBase32Secret(secret: string): string {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }
  return chunks.join(' ');
}

/**
 * Genera el código TOTP estándar de 6 dígitos (RFC 6238 HMAC-SHA1) para una clave Base32
 */
export function generateStandardTotpCode(
  base32Secret: string,
  timestampMs: number = Date.now(),
  stepSeconds: number = 30
): { code: string; expiresInSeconds: number } {
  const key = decodeBase32(base32Secret);
  const timeStep = Math.floor(timestampMs / 1000 / stepSeconds);
  const elapsed = Math.floor((timestampMs / 1000) % stepSeconds);
  const expiresInSeconds = stepSeconds - elapsed;

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(timeStep));

  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binary % 1_000_000).toString().padStart(6, '0');
  return { code, expiresInSeconds };
}

/**
 * Verifica un código TOTP de 6 dígitos ingresado desde Google Authenticator / Microsoft Authenticator.
 * Incluye tolerancia a deriva de reloj de +-1 ventana (30s).
 */
export function verifyStandardTotpCode(
  providedCode: string,
  base32Secret: string,
  nowMs: number = Date.now(),
  windowDrift: number = 1
): boolean {
  if (!providedCode || !base32Secret) return false;
  const cleanCode = String(providedCode).trim();
  if (!/^\d{6}$/.test(cleanCode)) return false;

  const key = decodeBase32(base32Secret);
  if (key.length === 0) return false;

  const currentStep = Math.floor(nowMs / 1000 / 30);
  for (let drift = -windowDrift; drift <= windowDrift; drift++) {
    const step = currentStep + drift;
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(BigInt(step));

    const hmac = createHmac('sha1', key).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const expected = (binary % 1_000_000).toString().padStart(6, '0');
    if (expected === cleanCode) {
      return true;
    }
  }
  return false;
}

/**
 * Genera el URI estándar `otpauth://` para que la app de autenticación lo configure automáticamente
 */
export function generateOtpAuthUri(params: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = params.issuer || 'KRONA VAULT';
  const cleanSecret = params.secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(params.accountName)}`;
  return `otpauth://totp/${label}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}


