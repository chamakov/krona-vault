import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  createDynamicQrToken,
  verifyDynamicQrToken,
  generatePlayerTotpPin,
  generateVoucherCryptographicSeal,
  computeAuditHashChainLink,
  GENESIS_AUDIT_HASH,
  encodeBase32,
  decodeBase32,
  formatBase32Secret,
  generateAuthenticatorSecret,
  generateStandardTotpCode,
  verifyStandardTotpCode,
  generateOtpAuthUri,
  generateCustodyReceiptSeal,
  hashCredential,
  verifyCredentialHash,
} from './index.ts';

describe('Suite 1: @control-credito/crypto-totp — Seguridad Criptográfica, QR 2FA, PIN Offline y Hash-Chain', () => {
  const secret = 'device_secret_test_key_998877';
  const memberCode = 'CC-8492';
  const fixedNow = 1760729240000;

  it('1.1 Genera y verifica un QR Dinámico TOTP dentro de la ventana activa de 30s', () => {
    const { qrToken, payload, expiresInSeconds } = createDynamicQrToken(secret, memberCode, fixedNow);
    assert.equal(payload.memberCode, memberCode);
    assert.equal(payload.totpPin.length, 6);
    assert.ok(expiresInSeconds >= 1 && expiresInSeconds <= 30);

    const verification = verifyDynamicQrToken(qrToken, secret, fixedNow + 5000);
    assert.equal(verification.valid, true);
    assert.equal(verification.payload?.nonce, payload.nonce);
  });

  it('1.2 Tolera deriva de reloj de +-1 ventana de 30s entre celular del jugador y servidor POS', () => {
    const { qrToken } = createDynamicQrToken(secret, memberCode, fixedNow);
    const verificationDrift = verifyDynamicQrToken(qrToken, secret, fixedNow + 29_000, 1);
    assert.equal(verificationDrift.valid, true);
  });

  it('1.3 Rechaza QR Dinámico expirado (>60s) previniendo ataque de captura de pantalla (Screenshot Replay)', () => {
    const { qrToken } = createDynamicQrToken(secret, memberCode, fixedNow);
    const verification = verifyDynamicQrToken(qrToken, secret, fixedNow + 90_000);
    assert.equal(verification.valid, false);
    assert.equal(verification.reason, 'QR_EXPIRADO_TOMA_CAPTURA_DETECTADA');
  });

  it('1.4 Rechaza QR Dinámico si se intenta manipular el memberCode, nonce o firma HMAC', () => {
    const { qrToken } = createDynamicQrToken(secret, memberCode, fixedNow);
    const tamperedMember = qrToken.replace('CC-8492', 'CC-9999');
    assert.equal(verifyDynamicQrToken(tamperedMember, secret, fixedNow).valid, false);

    const parts = qrToken.split('.');
    parts[5] = '0000000000000000';
    const tamperedSig = parts.join('.');
    const resSig = verifyDynamicQrToken(tamperedSig, secret, fixedNow);
    assert.equal(resSig.valid, false);
    assert.equal(resSig.reason, 'FIRMA_CRIPTOGRAFICA_INVALIDA');
  });

  it('1.5 Rechaza formatos de QR malformados o de versiones desconocidas', () => {
    assert.equal(verifyDynamicQrToken('INVALID_QR_STRING', secret, fixedNow).valid, false);
    assert.equal(verifyDynamicQrToken('CC2.CC-8492.123.abc.123456.sig', secret, fixedNow).valid, false);
  });

  it('1.6 Genera PIN TOTP de 6 dígitos determinista para Modo Sótano (Jugador 100% sin internet)', () => {
    const pinA = generatePlayerTotpPin(secret, memberCode, fixedNow);
    const pinB = generatePlayerTotpPin(secret, memberCode, fixedNow + 2000);
    assert.equal(pinA.totpPin, pinB.totpPin);
    assert.match(pinA.totpPin, /^\d{6}$/);
  });

  it('1.7 Genera Sello Criptográfico para Voucher Físico Térmico y cambia ante cualquier alteración de monto o folio', () => {
    const baseSeal = generateVoucherCryptographicSeal({
      voucherFolio: 'VCH-SUC01-20261017-0042',
      storeCode: 'SUC-01',
      memberCode: 'CC-8492',
      creditAppliedCents: 25000,
      journalEntryId: 'je_12345',
      hsmSecret: 'hsm_secret_2026',
    });
    assert.match(baseSeal, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

    const alteredAmountSeal = generateVoucherCryptographicSeal({
      voucherFolio: 'VCH-SUC01-20261017-0042',
      storeCode: 'SUC-01',
      memberCode: 'CC-8492',
      creditAppliedCents: 35000, // Alterado por $100
      journalEntryId: 'je_12345',
      hsmSecret: 'hsm_secret_2026',
    });
    assert.notEqual(baseSeal, alteredAmountSeal);
  });

  it('1.8 Encadena eslabones SHA-256 + Server HMAC para Auditoría Forense Inmutable', () => {
    const link1 = computeAuditHashChainLink(
      {
        seqId: 1,
        timestampIso: '2026-10-17T18:00:00.000Z',
        orgId: 'org-1',
        storeId: 'store-1',
        actorUserId: 'cashier-1',
        coAuthorizerId: 'player-1',
        eventAction: 'POS_REDEMPTION',
        payloadBeforeJson: '{"balance":100000}',
        payloadAfterJson: '{"balance":75000}',
        prevHash: GENESIS_AUDIT_HASH,
      },
      'server_hsm_secret'
    );
    const link2 = computeAuditHashChainLink(
      {
        seqId: 2,
        timestampIso: '2026-10-17T18:05:00.000Z',
        orgId: 'org-1',
        storeId: 'store-1',
        actorUserId: 'cashier-1',
        coAuthorizerId: 'player-1',
        eventAction: 'POS_REDEMPTION',
        payloadBeforeJson: '{"balance":75000}',
        payloadAfterJson: '{"balance":50000}',
        prevHash: link1.rowHash,
      },
      'server_hsm_secret'
    );
    assert.equal(link1.rowHash.length, 64);
    assert.equal(link2.rowHash.length, 64);
    assert.notEqual(link1.rowHash, link2.rowHash);
  });

  it('1.9 Codifica y decodifica Base32 (RFC 4648) de forma reversible e ignora espacios/guiones', () => {
    const raw = Buffer.from('12345678901234567890', 'utf8');
    const b32 = encodeBase32(raw);
    assert.equal(b32, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');

    const formatted = formatBase32Secret(b32);
    assert.equal(formatted.includes(' '), true);

    const decoded = decodeBase32(formatted);
    assert.equal(decoded.toString('utf8'), '12345678901234567890');
  });

  it('1.10 Genera y verifica códigos TOTP estándar (RFC 6238 HMAC-SHA1) compatibles con Google Authenticator', () => {
    const b32Secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    // Prueba a tiempo 59s (epoch 59000 ms -> T=1) según RFC 6238 Apéndice B
    const { code, expiresInSeconds } = generateStandardTotpCode(b32Secret, 59_000);
    assert.equal(code, '287082');
    assert.equal(expiresInSeconds, 1);

    // Verificación exacta a tiempo 59s
    assert.equal(verifyStandardTotpCode('287082', b32Secret, 59_000), true);

    // Tolerancia a deriva de +-1 ventana (30s)
    assert.equal(verifyStandardTotpCode('287082', b32Secret, 70_000), true); // 11s después en ventana T=2
    assert.equal(verifyStandardTotpCode('287082', b32Secret, 150_000), false); // Expirado > 60s
    assert.equal(verifyStandardTotpCode('000000', b32Secret, 59_000), false); // Código incorrecto
  });

  it('1.11 Genera URI otpauth:// estandarizado para escaneo en apps Authenticator', () => {
    const secret = generateAuthenticatorSecret();
    const uri = generateOtpAuthUri({
      secret,
      accountName: 'CC-0001 (@chamakov)',
      issuer: 'KRONA VAULT',
    });
    assert.ok(uri.startsWith('otpauth://totp/KRONA%20VAULT:CC-0001%20(%40chamakov)?secret='));
    assert.ok(uri.includes('&issuer=KRONA%20VAULT&algorithm=SHA1&digits=6&period=30'));
  });

  it('1.12 Genera Sello Criptográfico, Código Base32 y Token de Comprobante de Resguardo en Bóveda (VaultSeal™ Custody)', () => {
    const result = generateCustodyReceiptSeal({
      folio: 'CUST-2026-0001',
      storeCode: 'SUC-CENTRO',
      clientMemberCode: 'CC-8492',
      tamperSealNumber: 'SEAL-994182',
      declaredValueCents: 1850000,
      hsmSecret: 'TEST_HSM_SECRET_123',
    });

    assert.ok(result.sealText.match(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/));
    assert.ok(result.claimVerificationCode.match(/^VC-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/));
    assert.ok(result.receiptToken.startsWith('KVC1.SUC-CENTRO.CUST-2026-0001.'));

    // Cualquier cambio altera el sello determinista
    const altered = generateCustodyReceiptSeal({
      folio: 'CUST-2026-0001',
      storeCode: 'SUC-CENTRO',
      clientMemberCode: 'CC-8492',
      tamperSealNumber: 'SEAL-994183', // Precinto cambiado
      declaredValueCents: 1850000,
      hsmSecret: 'TEST_HSM_SECRET_123',
    });
    assert.notEqual(result.sealText, altered.sealText);
    assert.notEqual(result.claimVerificationCode, altered.claimVerificationCode);
  });

  it('1.13 Garantiza que el QR Dinámico TOTP sea estable durante toda la ventana de 30s (no cambia cada segundo) y rote al expirar el ciclo', () => {
    // Tomar un timestamp al inicio de una ventana de 30s
    const windowStart = Math.floor(fixedNow / 30000) * 30000;
    const tokenAt0s = createDynamicQrToken(secret, memberCode, windowStart);
    const tokenAt1s = createDynamicQrToken(secret, memberCode, windowStart + 1000);
    const tokenAt10s = createDynamicQrToken(secret, memberCode, windowStart + 10000);
    const tokenAt28s = createDynamicQrToken(secret, memberCode, windowStart + 28000);

    // Debe ser exactamente el mismo token e idéntico QR durante los 30 segundos
    assert.equal(tokenAt0s.qrToken, tokenAt1s.qrToken, 'El QR no debe cambiar al segundo 1');
    assert.equal(tokenAt0s.qrToken, tokenAt10s.qrToken, 'El QR no debe cambiar al segundo 10');
    assert.equal(tokenAt0s.qrToken, tokenAt28s.qrToken, 'El QR no debe cambiar al segundo 28');
    assert.equal(tokenAt0s.payload.nonce, tokenAt28s.payload.nonce, 'El nonce debe ser determinista por ventana');

    // Al llegar a la siguiente ventana (+30s), el token debe rotar
    const tokenNextWindow = createDynamicQrToken(secret, memberCode, windowStart + 30000);
    assert.notEqual(tokenAt0s.qrToken, tokenNextWindow.qrToken, 'El QR debe rotar cuando el timeStep de 30s expire');
    assert.notEqual(tokenAt0s.payload.nonce, tokenNextWindow.payload.nonce, 'El nonce debe renovarse en la nueva ventana');
  });

  it('1.14 Genera y valida credenciales con scrypt y salt aleatorio, soportando retrocompatibilidad legacy', () => {
    const rawPin = '123456';
    const scryptHash1 = hashCredential(rawPin);
    const scryptHash2 = hashCredential(rawPin);

    assert.ok(scryptHash1.startsWith('scrypt$'), 'El hash generado debe usar el esquema scrypt$');
    assert.notEqual(scryptHash1, scryptHash2, 'Dos hashes del mismo PIN deben diferir por tener salts únicos');
    assert.equal(verifyCredentialHash(rawPin, scryptHash1), true, 'Debe verificar correctamente el PIN con scrypt');
    assert.equal(verifyCredentialHash('654321', scryptHash1), false, 'Debe rechazar un PIN erróneo');

    // Validación de retrocompatibilidad con hash legacy HMAC-SHA256
    const legacyHash = createHmac('sha256', 'KRONA_IAM_SALT_V1').update(rawPin).digest('hex');
    assert.equal(verifyCredentialHash(rawPin, legacyHash), true, 'Debe admitir y verificar hashes legacy HMAC-SHA256');
    assert.equal(verifyCredentialHash('wrong', legacyHash), false, 'Debe rechazar credenciales incorrectas en hash legacy');
  });
});

