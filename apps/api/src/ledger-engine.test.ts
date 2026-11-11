import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ControlCreditoEngine } from './ledger-engine.ts';
import {
  createDynamicQrToken,
  generatePlayerTotpPin,
} from '../../../packages/crypto-totp/src/index.ts';
import {
  parsePokemonStandingsHTML,
  calculateTopCutPrizeDistribution,
  calculateQuickMultiGamePool,
} from './pokemon-standings-parser.ts';

describe('Suite 2: ControlCreditoEngine — Contabilidad, Multi-Tienda, Vouchers, Torneos, Seguridad y Casos Borde', () => {

  it('2.1 [Torneos & Splits] Calcula Split de Premios en Top 4 con Integridad de Suma Cero y manejo de centavos residuales', () => {
    const engine = new ControlCreditoEngine();
    const standings = engine.calculateTournamentSplit(100_000, [
      { position: 1, playerUserId: 'p1', playerMemberCode: 'CC-1001', playerName: 'Alex (Seed 1)', record: '5-0-0', defaultPercentageBps: 5000, inTopSplit: true },
      { position: 2, playerUserId: 'p2', playerMemberCode: 'CC-1002', playerName: 'Dani (Seed 2)', record: '4-1-0', defaultPercentageBps: 3000, inTopSplit: true },
      { position: 3, playerUserId: 'p3', playerMemberCode: 'CC-1003', playerName: 'Fer (Seed 3)', record: '4-1-0', defaultPercentageBps: 2000, inTopSplit: true },
    ]);

    const totalAwarded = standings.reduce((sum, s) => sum + s.awardedCents, 0);
    assert.equal(totalAwarded, 100_000, 'La suma de premios debe cuadrar al centavo con el pozo');
    assert.equal(standings[0].awardedCents, 33_340);
    assert.equal(standings[1].awardedCents, 33_330);
    assert.equal(standings[2].awardedCents, 33_330);
  });

  it('2.2 [Seguridad RBAC/ABAC & Four-Eyes] Bloquea auto-atención, bloquea emisión por Cajero y exige 4-Ojos en montos altos o ajustes manuales', () => {
    const engine = new ControlCreditoEngine();
    const admin1 = engine.registerUser({ userId: 'adm1', memberCode: 'CC-01', fullName: 'Gerente 1', alias: '@G1', role: 'STORE_ADMIN' });
    const admin2 = engine.registerUser({ userId: 'adm2', memberCode: 'CC-02', fullName: 'Gerente 2', alias: '@G2', role: 'SUPER_ADMIN' });
    const cashier = engine.registerUser({ userId: 'csh1', memberCode: 'CC-03', fullName: 'Cajero', alias: '@C1', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'plr1', memberCode: 'CC-99', fullName: 'Jugador', alias: '@P1', role: 'PLAYER' });

    assert.throws(() => {
      engine.issueCredit({
        storeId: 'store_centro',
        targetUserId: admin1.userId,
        actorUserId: admin1.userId,
        actorRole: 'STORE_ADMIN',
        amountCents: 20_000,
        sourceType: 'TOURNAMENT_PRIZE',
        sourceLabel: 'Auto-premio',
        referenceId: 'T-1',
        expiryDays: 90,
      });
    }, /CONFLICTO_DE_INTERES_ABAC/);

    assert.throws(() => {
      engine.issueCredit({
        storeId: 'store_centro',
        targetUserId: player.userId,
        actorUserId: cashier.userId,
        actorRole: 'CASHIER',
        amountCents: 20_000,
        sourceType: 'TOURNAMENT_PRIZE',
        sourceLabel: 'Emisión por cajero',
        referenceId: 'T-1',
        expiryDays: 90,
      });
    }, /PERMISO_DENEGADO_RBAC/);

    assert.throws(() => {
      engine.issueCredit({
        storeId: 'store_centro',
        targetUserId: player.userId,
        actorUserId: admin1.userId,
        actorRole: 'STORE_ADMIN',
        amountCents: 150_000,
        sourceType: 'TOURNAMENT_PRIZE',
        sourceLabel: 'Premio Mayor sin 4-Ojos',
        referenceId: 'T-BIG',
        expiryDays: 90,
      });
    }, /REQUIERE_AUTORIZACION_2_PASOS_GERENCIAL/);

    const okIssue = engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: admin1.userId,
      actorRole: 'STORE_ADMIN',
      coAuthorizerUserId: admin2.userId,
      amountCents: 150_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Premio Mayor Aprobado 4-Ojos',
      referenceId: 'T-BIG',
      expiryDays: 90,
    });
    assert.equal(okIssue.lot?.remainingAmountCents, 150_000);
  });

  it('2.3 [Consumo FEFO y Restricciones por Categoría] Consume primero el crédito promocional o próximo a vencer y respeta restricciones de categoría', () => {
    const engine = new ControlCreditoEngine();
    const to = engine.registerUser({ userId: 'to1', memberCode: 'CC-10', fullName: 'TO', alias: '@TO', role: 'TOURNAMENT_ORGANIZER' });
    const cashier = engine.registerUser({ userId: 'csh1', memberCode: 'CC-20', fullName: 'Cajero', alias: '@Csh', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'p1', memberCode: 'CC-88', fullName: 'Jugador FEFO', alias: '@FEFO', role: 'PLAYER' });

    const lotPerm = engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: to.userId,
      actorRole: 'TOURNAMENT_ORGANIZER',
      amountCents: 50_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Torneo FNM',
      referenceId: 'FNM-1',
      expiryDays: 180,
      priorityRank: 100,
    }).lot!;

    const lotPromo = engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: to.userId,
      actorRole: 'TOURNAMENT_ORGANIZER',
      amountCents: 20_000,
      sourceType: 'PROMOTIONAL_BONUS',
      sourceLabel: 'Bono Sellado',
      referenceId: 'PROMO-1',
      expiryDays: 5,
      allowedCategories: ['SEALED_PRODUCT'],
      priorityRank: 200,
    }).lot!;

    const nowMs = Date.now();
    const qr1 = createDynamicQrToken(player.deviceSecret, player.memberCode, nowMs).qrToken;
    assert.throws(() => {
      engine.redeemCreditAtPos({
        redeemingStoreId: 'store_centro',
        playerUserId: player.userId,
        cashierUserId: cashier.userId,
        cashierRole: 'CASHIER',
        totalTicketCents: 60_000,
        creditToApplyCents: 60_000,
        productCategory: 'SINGLES',
        externalPosTicketRef: '#POS-01',
        conceptNotes: 'Compra Singles',
        playerAuthProof: { method: 'QR_DYNAMIC_TOTP', qrToken: qr1, timestampMs: nowMs },
      });
    }, /SALDO_ELEGIBLE_INSUFICIENTE/);

    const qr2 = createDynamicQrToken(player.deviceSecret, player.memberCode, nowMs + 1000).qrToken;
    const redemption = engine.redeemCreditAtPos({
      redeemingStoreId: 'store_centro',
      playerUserId: player.userId,
      cashierUserId: cashier.userId,
      cashierRole: 'CASHIER',
      totalTicketCents: 30_000,
      creditToApplyCents: 30_000,
      productCategory: 'SEALED_PRODUCT',
      externalPosTicketRef: '#POS-02',
      conceptNotes: 'Caja Sobres',
      playerAuthProof: { method: 'QR_DYNAMIC_TOTP', qrToken: qr2, timestampMs: nowMs + 1000 },
    });

    assert.equal(redemption.consumedLots.length, 2);
    assert.equal(redemption.consumedLots[0].lotId, lotPromo.id);
    assert.equal(redemption.consumedLots[0].amountCents, 20_000);
    assert.equal(redemption.consumedLots[1].lotId, lotPerm.id);
    assert.equal(redemption.consumedLots[1].amountCents, 10_000);
    assert.equal(lotPromo.status, 'DEPLETED');
    assert.equal(lotPerm.remainingAmountCents, 40_000);
  });

  it('2.4 [Multi-Tienda: ORG_POOLED vs INTER_STORE_CLEARING vs STORE_ISOLATED] Verifica liquidación contable entre sucursales y aislamiento', () => {
    const engine = new ControlCreditoEngine();
    const to = engine.registerUser({ userId: 'to1', memberCode: 'CC-10', fullName: 'TO', alias: '@TO', role: 'TOURNAMENT_ORGANIZER' });
    const cashier = engine.registerUser({ userId: 'csh1', memberCode: 'CC-20', fullName: 'Cajero', alias: '@Csh', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'p1', memberCode: 'CC-77', fullName: 'Jugador Multi', alias: '@Multi', role: 'PLAYER' });

    engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: to.userId,
      actorRole: 'TOURNAMENT_ORGANIZER',
      amountCents: 50_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Premio Centro',
      referenceId: 'T-CEN',
      expiryDays: 90,
    });

    engine.org.sharingPolicy = 'STORE_ISOLATED';
    const pinOffline = generatePlayerTotpPin(player.deviceSecret, player.memberCode).totpPin;
    assert.throws(() => {
      engine.redeemCreditAtPos({
        redeemingStoreId: 'store_norte',
        playerUserId: player.userId,
        cashierUserId: cashier.userId,
        cashierRole: 'CASHIER',
        totalTicketCents: 20_000,
        creditToApplyCents: 20_000,
        productCategory: 'SEALED_PRODUCT',
        externalPosTicketRef: '#POS-NOR-1',
        conceptNotes: 'Intento en otra tienda aislada',
        playerAuthProof: { method: 'PIN_OFFLINE_2FA', totpPin: pinOffline },
      });
    }, /SALDO_ELEGIBLE_INSUFICIENTE/);

    engine.org.sharingPolicy = 'INTER_STORE_CLEARING';
    const crossRedeem = engine.redeemCreditAtPos({
      redeemingStoreId: 'store_norte',
      playerUserId: player.userId,
      cashierUserId: cashier.userId,
      cashierRole: 'CASHIER',
      totalTicketCents: 20_000,
      creditToApplyCents: 20_000,
      productCategory: 'SEALED_PRODUCT',
      externalPosTicketRef: '#POS-NOR-2',
      conceptNotes: 'Redención cruzada con Clearing',
      playerAuthProof: { method: 'PIN_OFFLINE_2FA', totpPin: pinOffline },
    });

    const codes = crossRedeem.journalEntry.lines.map((l) => l.accountCode);
    assert.ok(codes.includes('2101'));
    assert.ok(codes.includes('2201'));
    assert.ok(codes.includes('1201'));
    assert.ok(codes.includes('4101'));
  });

  it('2.5 [Voucher Físico Térmico y Anti-Doble Uso] Emite Voucher original y marca COPIA REIMPRESA en reimpresiones', () => {
    const engine = new ControlCreditoEngine();
    const to = engine.registerUser({ userId: 'to', memberCode: 'CC-1', fullName: 'TO', alias: '@TO', role: 'TOURNAMENT_ORGANIZER' });
    const cashier = engine.registerUser({ userId: 'csh', memberCode: 'CC-2', fullName: 'Cajero', alias: '@Csh', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'plr', memberCode: 'CC-3', fullName: 'Cliente', alias: '@Cli', role: 'PLAYER' });

    engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: to.userId,
      actorRole: 'TOURNAMENT_ORGANIZER',
      amountCents: 40_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Torneo',
      referenceId: 'T-1',
      expiryDays: 90,
    });

    const { qrToken } = createDynamicQrToken(player.deviceSecret, player.memberCode);
    const { voucher } = engine.redeemCreditAtPos({
      redeemingStoreId: 'store_centro',
      playerUserId: player.userId,
      cashierUserId: cashier.userId,
      cashierRole: 'CASHIER',
      totalTicketCents: 35_000,
      creditToApplyCents: 15_000,
      productCategory: 'ACCESSORIES',
      externalPosTicketRef: '#POS-555',
      conceptNotes: 'Playmat Oficial',
      playerAuthProof: { method: 'QR_DYNAMIC_TOTP', qrToken },
    });

    const originalText = engine.renderThermalVoucherText(voucher.voucherFolio);
    assert.match(originalText, /ORIGINAL - PÓLIZA DE CAJA/);
    assert.match(originalText, /POR COBRAR EN CAJA:\s+\$200\.00 MXN/);

    engine.reprintPhysicalVoucher(voucher.voucherFolio, cashier.userId, 'CASHIER', 'Reimpresión por papel atascado');
    const copyText = engine.renderThermalVoucherText(voucher.voucherFolio);
    assert.match(copyText, /COPIA REIMPRESA #2 - NO VÁLIDA PARA ARQUEO/);
  });

  it('2.6 [Devoluciones Anti-Cash-Out] En compras mixtas reintegra PRIMERO el Crédito de Tienda y restaura su fecha de vencimiento original', () => {
    const engine = new ControlCreditoEngine();
    const admin1 = engine.registerUser({ userId: 'adm1', memberCode: 'CC-01', fullName: 'Admin 1', alias: '@A1', role: 'STORE_ADMIN' });
    const admin2 = engine.registerUser({ userId: 'adm2', memberCode: 'CC-02', fullName: 'Admin 2', alias: '@A2', role: 'SUPER_ADMIN' });
    const cashier = engine.registerUser({ userId: 'csh', memberCode: 'CC-03', fullName: 'Cajero', alias: '@C', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'plr', memberCode: 'CC-04', fullName: 'Jugador', alias: '@P', role: 'PLAYER' });

    const { lot } = engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: admin1.userId,
      actorRole: 'STORE_ADMIN',
      amountCents: 60_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Torneo',
      referenceId: 'T-1',
      expiryDays: 15,
    });
    const originalExpiry = lot!.expiresAt;

    const { qrToken } = createDynamicQrToken(player.deviceSecret, player.memberCode);
    const { voucher } = engine.redeemCreditAtPos({
      redeemingStoreId: 'store_centro',
      playerUserId: player.userId,
      cashierUserId: cashier.userId,
      cashierRole: 'CASHIER',
      totalTicketCents: 100_000,
      creditToApplyCents: 60_000,
      productCategory: 'SEALED_PRODUCT',
      externalPosTicketRef: '#POS-MIX-01',
      conceptNotes: '2x Productos ($500 c/u)',
      playerAuthProof: { method: 'QR_DYNAMIC_TOTP', qrToken },
    });

    const refund1 = engine.refundPosPurchase({
      voucherFolio: voucher.voucherFolio,
      refundAmountCents: 50_000,
      actorUserId: admin1.userId,
      coAuthorizerUserId: admin2.userId,
      reason: 'Devolución parcial de 1 artículo',
    });

    assert.equal(refund1.refundedToStoreCreditCents, 50_000);
    assert.equal(refund1.refundedToCashCents, 0);
    assert.equal(refund1.restoredLot?.expiresAt, originalExpiry);

    const refund2 = engine.refundPosPurchase({
      voucherFolio: voucher.voucherFolio,
      refundAmountCents: 50_000,
      actorUserId: admin1.userId,
      coAuthorizerUserId: admin2.userId,
      reason: 'Devolución del resto de la orden',
    });
    assert.equal(refund2.refundedToStoreCreditCents, 10_000);
    assert.equal(refund2.refundedToCashCents, 40_000);
  });

  it('2.7 [Preventas (Pre-Order Escrow) y Expiración Breakage] Pausa el vencimiento durante preventa y da +30 días si cancela la tienda', () => {
    const engine = new ControlCreditoEngine();
    const to = engine.registerUser({ userId: 'to', memberCode: 'CC-1', fullName: 'TO', alias: '@TO', role: 'TOURNAMENT_ORGANIZER' });
    const cashier = engine.registerUser({ userId: 'csh', memberCode: 'CC-2', fullName: 'Cajero', alias: '@Csh', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'plr', memberCode: 'CC-3', fullName: 'Jugador Preventa', alias: '@Pre', role: 'PLAYER' });

    const { lot } = engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: to.userId,
      actorRole: 'TOURNAMENT_ORGANIZER',
      amountCents: 80_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Premio Torneo',
      referenceId: 'T-PRE',
      expiryDays: 10,
    });
    const originalExpMs = new Date(lot!.expiresAt!).getTime();

    engine.holdCreditForPreorder({
      storeId: 'store_centro',
      playerUserId: player.userId,
      cashierUserId: cashier.userId,
      preorderRef: 'PRE-COLLECTOR-BOX',
      amountCents: 50_000,
    });

    assert.equal(player.availableBalanceCents, 30_000);
    assert.equal(player.escrowPreorderCents, 50_000);
    assert.notEqual(lot!.expirationPausedAt, null);

    const futureIso = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const expiryRun = engine.expireOverdueLots(futureIso, to.userId);
    assert.equal(expiryRun.expiredLotsCount, 0);

    const cancelRes = engine.cancelPreorderHold({
      preorderRef: 'PRE-COLLECTOR-BOX',
      cancelledByStore: true,
      actorUserId: to.userId,
    });
    assert.equal(cancelRes.releasedCents, 50_000);
    assert.equal(cancelRes.graceExtendedDays, 30);
    assert.equal(player.availableBalanceCents, 80_000);
    const newExpMs = new Date(lot!.expiresAt!).getTime();
    assert.ok(newExpMs > originalExpMs + 29 * 86_400_000);
  });

  it('2.8 [Clawback & Fusión de Cuentas Duplicadas] Consolida saldos positivos con saldos deudores al fusionar cuentas y verifica integridad total', () => {
    const engine = new ControlCreditoEngine();
    const admin1 = engine.registerUser({ userId: 'adm1', memberCode: 'CC-01', fullName: 'Admin 1', alias: '@A1', role: 'STORE_ADMIN' });
    const admin2 = engine.registerUser({ userId: 'adm2', memberCode: 'CC-02', fullName: 'Admin 2', alias: '@A2', role: 'SUPER_ADMIN' });
    const cashier = engine.registerUser({ userId: 'csh', memberCode: 'CC-03', fullName: 'Cajero', alias: '@C', role: 'CASHIER' });

    const primaryAcc = engine.registerUser({ userId: 'p_main', memberCode: 'CC-100', fullName: 'Pedro Principal', alias: '@Pedro', role: 'PLAYER' });
    const dupAcc = engine.registerUser({ userId: 'p_dup', memberCode: 'CC-200', fullName: 'Pedro Duplicado', alias: '@PedroTemp', role: 'PLAYER' });

    engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: dupAcc.userId,
      actorUserId: admin1.userId,
      actorRole: 'STORE_ADMIN',
      amountCents: 40_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Error',
      referenceId: 'T-ERR',
      expiryDays: 90,
    });
    const { qrToken } = createDynamicQrToken(dupAcc.deviceSecret, dupAcc.memberCode);
    engine.redeemCreditAtPos({
      redeemingStoreId: 'store_centro',
      playerUserId: dupAcc.userId,
      cashierUserId: cashier.userId,
      cashierRole: 'CASHIER',
      totalTicketCents: 40_000,
      creditToApplyCents: 40_000,
      productCategory: 'SINGLES',
      externalPosTicketRef: '#POS-DUP',
      conceptNotes: 'Gasto antes de clawback',
      playerAuthProof: { method: 'QR_DYNAMIC_TOTP', qrToken },
    });
    engine.clawbackErroneousPrize({
      storeId: 'store_centro',
      targetUserId: dupAcc.userId,
      actorUserId: admin1.userId,
      coAuthorizerUserId: admin2.userId,
      amountToReverseCents: 40_000,
      reason: 'Premio asignado al jugador equivocado',
    });
    assert.equal(dupAcc.debtBalanceCents, 40_000);

    engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: primaryAcc.userId,
      actorUserId: admin1.userId,
      actorRole: 'STORE_ADMIN',
      amountCents: 70_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Premio Legítimo',
      referenceId: 'T-OK',
      expiryDays: 90,
    });

    const merged = engine.mergePlayerAccounts({
      storeId: 'store_centro',
      primaryUserId: primaryAcc.userId,
      secondaryUserId: dupAcc.userId,
      adminMakerId: admin1.userId,
      adminCheckerId: admin2.userId,
    });

    assert.equal(merged.primaryAvailableCents, 30_000);
    assert.equal(merged.primaryDebtCents, 0);
    assert.equal(dupAcc.status, 'MERGED_INACTIVE');

    const integrityOk = engine.verifySystemIntegrity();
    assert.equal(integrityOk.ledgerBalanced, true);
    assert.equal(integrityOk.auditChainIntact, true);

    engine.auditLogs[0].payloadAfter = { tamperedByHacker: 9999999 };
    const integrityAfterTamper = engine.verifySystemIntegrity();
    assert.equal(integrityAfterTamper.auditChainIntact, false);
  });

  it('2.9 [Idempotencia Estricta en POS] Impide doble cobro accidental si la red o el cajero envía la misma idempotencyKey', () => {
    const engine = new ControlCreditoEngine();
    const to = engine.registerUser({ userId: 'to', memberCode: 'CC-1', fullName: 'TO', alias: '@TO', role: 'TOURNAMENT_ORGANIZER' });
    const cashier = engine.registerUser({ userId: 'csh', memberCode: 'CC-2', fullName: 'Cajero', alias: '@Csh', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'plr', memberCode: 'CC-3', fullName: 'Cliente', alias: '@Cli', role: 'PLAYER' });

    engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: to.userId,
      actorRole: 'TOURNAMENT_ORGANIZER',
      amountCents: 50_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Torneo',
      referenceId: 'T-1',
      expiryDays: 90,
    });

    const pin = generatePlayerTotpPin(player.deviceSecret, player.memberCode).totpPin;
    engine.redeemCreditAtPos({
      redeemingStoreId: 'store_centro',
      playerUserId: player.userId,
      cashierUserId: cashier.userId,
      cashierRole: 'CASHIER',
      totalTicketCents: 20_000,
      creditToApplyCents: 20_000,
      productCategory: 'SEALED_PRODUCT',
      externalPosTicketRef: '#POS-IDEM-01',
      conceptNotes: 'Cobro único',
      idempotencyKey: 'IDEM-KEY-FIXED-001',
      playerAuthProof: { method: 'PIN_OFFLINE_2FA', totpPin: pin },
    });

    assert.throws(() => {
      engine.redeemCreditAtPos({
        redeemingStoreId: 'store_centro',
        playerUserId: player.userId,
        cashierUserId: cashier.userId,
        cashierRole: 'CASHIER',
        totalTicketCents: 20_000,
        creditToApplyCents: 20_000,
        productCategory: 'SEALED_PRODUCT',
        externalPosTicketRef: '#POS-IDEM-01',
        conceptNotes: 'Reintento duplicado por doble clic',
        idempotencyKey: 'IDEM-KEY-FIXED-001',
        playerAuthProof: { method: 'PIN_OFFLINE_2FA', totpPin: pin },
      });
    }, /OPERACION_DUPLICADA_IDEMPOTENCIA/);
  });

  it('2.10 [Verificador de Voucher Físico y Corte Z de Caja] Detecta alteración en papel y genera el arqueo completo del turno', () => {
    const engine = new ControlCreditoEngine();
    const to = engine.registerUser({ userId: 'to', memberCode: 'CC-1', fullName: 'TO', alias: '@TO', role: 'TOURNAMENT_ORGANIZER' });
    const cashier = engine.registerUser({ userId: 'csh', memberCode: 'CC-2', fullName: 'Cajero', alias: '@Csh', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'plr', memberCode: 'CC-3', fullName: 'Cliente', alias: '@Cli', role: 'PLAYER' });

    // Gana en Sucursal Norte y gasta en Sucursal Centro
    engine.issueCredit({
      storeId: 'store_norte',
      targetUserId: player.userId,
      actorUserId: to.userId,
      actorRole: 'TOURNAMENT_ORGANIZER',
      amountCents: 50_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Torneo Norte',
      referenceId: 'T-NOR',
      expiryDays: 90,
    });

    const { qrToken } = createDynamicQrToken(player.deviceSecret, player.memberCode);
    const { voucher } = engine.redeemCreditAtPos({
      redeemingStoreId: 'store_centro',
      playerUserId: player.userId,
      cashierUserId: cashier.userId,
      cashierRole: 'CASHIER',
      totalTicketCents: 30_000,
      creditToApplyCents: 25_000,
      productCategory: 'SINGLES',
      externalPosTicketRef: '#POS-Z-01',
      conceptNotes: 'Carta suelta',
      playerAuthProof: { method: 'QR_DYNAMIC_TOTP', qrToken },
    });

    // 1. Verificación auténtica
    const validCheck = engine.verifyPhysicalVoucherAuthenticity({
      voucherFolio: voucher.voucherFolio,
      reportedCreditCents: 25_000,
      providedSeal: voucher.cryptographicSeal,
    });
    assert.equal(validCheck.authentic, true);

    // 2. Intento de falsificar el monto en el papel ($350 en vez de $250 con el mismo sello)
    const fakeCheck = engine.verifyPhysicalVoucherAuthenticity({
      voucherFolio: voucher.voucherFolio,
      reportedCreditCents: 35_000,
      providedSeal: voucher.cryptographicSeal,
    });
    assert.equal(fakeCheck.authentic, false);
    assert.equal(fakeCheck.reason, 'SELLO_O_MONTO_ALTERADO_FALSIFICACION_DETECTADA');

    // 3. Generar Corte Z de Caja en Sucursal Centro
    const closure = engine.generateStoreShiftClosure('store_centro', to.userId);
    assert.equal(closure.vouchersCount, 1);
    assert.equal(closure.totalCreditRedeemedCents, 25_000);
    assert.equal(closure.interStoreReceivableCents, 25_000, 'Sucursal Centro tiene $250 a favor por redimir crédito de Sucursal Norte');
    assert.match(closure.thermalClosureText, /CORTE Z — CIERRE DE TURNO/);
  });

  it('2.11 [Bloqueo de Emergencia por Extravío y Rotación de Semilla] Invalida inmediatamente cualquier QR generado antes del robo', () => {
    const engine = new ControlCreditoEngine();
    const to = engine.registerUser({ userId: 'to', memberCode: 'CC-1', fullName: 'TO', alias: '@TO', role: 'TOURNAMENT_ORGANIZER' });
    const cashier = engine.registerUser({ userId: 'csh', memberCode: 'CC-2', fullName: 'Cajero', alias: '@Csh', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'plr', memberCode: 'CC-3', fullName: 'Cliente', alias: '@Cli', role: 'PLAYER' });

    engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: to.userId,
      actorRole: 'TOURNAMENT_ORGANIZER',
      amountCents: 50_000,
      sourceType: 'TOURNAMENT_PRIZE',
      sourceLabel: 'Torneo',
      referenceId: 'T-1',
      expiryDays: 90,
    });

    const stolenQr = createDynamicQrToken(player.deviceSecret, player.memberCode).qrToken;

    // El jugador bloquea su billetera y rota su semilla criptográfica
    engine.toggleWalletSecurityLock({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: player.userId,
      actorRole: 'PLAYER',
      lock: true,
      rotateSecret: true,
      reason: 'Celular extraviado',
    });

    assert.equal(player.status, 'SELF_LOCKED');

    // Incluso si luego desbloquea su cuenta, el QR antiguo ya no sirve porque la semilla rotó
    engine.toggleWalletSecurityLock({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: to.userId,
      actorRole: 'TOURNAMENT_ORGANIZER',
      lock: false,
      reason: 'Identidad validada en tienda',
    });

    assert.throws(() => {
      engine.redeemCreditAtPos({
        redeemingStoreId: 'store_centro',
        playerUserId: player.userId,
        cashierUserId: cashier.userId,
        cashierRole: 'CASHIER',
        totalTicketCents: 10_000,
        creditToApplyCents: 10_000,
        productCategory: 'SINGLES',
        externalPosTicketRef: '#POS-STOLEN',
        conceptNotes: 'Intento con QR viejo',
        playerAuthProof: { method: 'QR_DYNAMIC_TOTP', qrToken: stolenQr },
      });
    }, /AUTENTICACION_2FA_FALLIDA/);
  });

  it('2.12 [Configuración y Ciclo de Vida de Tiendas] Permite a SUPER_ADMIN dar de alta, editar, pausar/reactivar y eliminar sucursales con auditoría', () => {
    const engine = new ControlCreditoEngine();
    const admin2 = engine.registerUser({ userId: 'adm_s2', memberCode: 'CC-902', fullName: 'Super Admin', alias: '@Super', role: 'SUPER_ADMIN' });
    const cashier = engine.registerUser({ userId: 'csh_s2', memberCode: 'CC-903', fullName: 'Cajero Local', alias: '@Cashier', role: 'CASHIER' });

    // Cajero no tiene permiso para crear sucursales
    assert.throws(() => {
      engine.createStoreBranch({
        actorUserId: cashier.userId,
        name: 'Tienda No Autorizada',
      });
    }, /PERMISO_DENEGADO_RBAC/);

    // SUPER_ADMIN crea sucursal
    const nueva = engine.createStoreBranch({
      actorUserId: admin2.userId,
      name: 'Sucursal Insurgentes Sur',
      code: 'SUC-INSURGENTES',
      voucherPrefix: 'VCH-INS',
      address: 'Av. Insurgentes Sur #1200',
      legalEntityTaxId: 'INS260101XYZ',
      isActive: true,
    });

    assert.equal(nueva.code, 'SUC-INSURGENTES');
    assert.equal(engine.stores.get(nueva.id)?.name, 'Sucursal Insurgentes Sur');

    // Modificar sucursal
    const mod = engine.updateStoreBranch({
      actorUserId: admin2.userId,
      storeId: nueva.id,
      name: 'Sucursal Insurgentes Mega',
      address: 'Av. Insurgentes Sur #1200, Piso 3',
    });
    assert.equal(mod.name, 'Sucursal Insurgentes Mega');
    assert.equal(mod.address, 'Av. Insurgentes Sur #1200, Piso 3');

    // Pausar sucursal (baja lógica)
    const pausada = engine.toggleStoreBranchStatus({
      actorUserId: admin2.userId,
      storeId: nueva.id,
      isActive: false,
      reason: 'Mantenimiento de cableado de red',
    });
    assert.equal(pausada.isActive, false);

    // Reactivar
    const reactivada = engine.toggleStoreBranchStatus({
      actorUserId: admin2.userId,
      storeId: nueva.id,
      isActive: true,
    });
    assert.equal(reactivada.isActive, true);

    // Eliminar sucursal sin historial
    const del = engine.deleteStoreBranch({
      actorUserId: admin2.userId,
      storeId: nueva.id,
    });
    assert.equal(del.success, true);
    assert.equal(engine.stores.has(nueva.id), false);
  });

  it('2.13 [Cálculo de Pozos por Ocupación y Categorías Pokémon] Valida partición por categorías (Master, Senior, Junior), ocupación exacta y pactos Zero-Sum con centavos residuales', () => {
    const engine = new ControlCreditoEngine();
    const to = engine.registerUser({
      userId: 'to_pk1',
      memberCode: 'CC-TO1',
      fullName: 'Juez Pokémon Oficial',
      alias: '@JudgePoke',
      role: 'TOURNAMENT_ORGANIZER',
      assignedStoreId: 'store_centro',
    });

    // Fixture HTML representativo de TOM / Play! Pokémon
    const tomHtmlFixture = `
      <!DOCTYPE html>
      <html>
      <head><title>Standings - League Challenge Pokémon TCG - 2026-04-20</title></head>
      <body>
        <h3>Ronda 4/4</h3>
        <h2>Categoría Master</h2>
        <table>
          <tr><th>#</th><th>Jugador</th><th>Récord</th><th>Puntos</th><th>OMW%</th></tr>
          <tr><td>1</td><td>Carlos Méndez</td><td>4/0/0 (12)</td><td>12</td><td>65.00%</td></tr>
          <tr><td>2</td><td>Valeria Orozco</td><td>3/1/0 (9)</td><td>9</td><td>60.00%</td></tr>
          <tr><td>3</td><td>Bruno Díaz</td><td>3/1/0 (9)</td><td>9</td><td>55.00%</td></tr>
          <tr><td>4</td><td>Fernanda Gómez</td><td>2/2/0 (6)</td><td>6</td><td>50.00%</td></tr>
          <tr><td>5</td><td>David Torres</td><td>2/2/0 (6)</td><td>6</td><td>45.00%</td></tr>
          <tr><td>6</td><td>Esteban Quito</td><td>1/3/0 (3)</td><td>3</td><td>40.00%</td></tr>
        </table>

        <h2>Categoría Senior</h2>
        <table>
          <tr><th>#</th><th>Jugador</th><th>Récord</th><th>Puntos</th><th>OMW%</th></tr>
          <tr><td>1</td><td>Rodrigo Jr Sánchez</td><td>3/0/0 (9)</td><td>9</td><td>58.00%</td></tr>
          <tr><td>2</td><td>Camila Soto</td><td>2/1/0 (6)</td><td>6</td><td>52.00%</td></tr>
          <tr><td>3</td><td>Emiliano Vega</td><td>1/2/0 (3)</td><td>3</td><td>44.00%</td></tr>
        </table>

        <h2>Categoría Junior</h2>
        <table>
          <tr><th>#</th><th>Jugador</th><th>Récord</th><th>Puntos</th><th>OMW%</th></tr>
          <tr><td>1</td><td>Mateo Luna</td><td>2/0/0 (6)</td><td>6</td><td>50.00%</td></tr>
        </table>
      </body>
      </html>
    `;

    // 1. Parsear el HTML con costos configurados ($150 MXN entrada, $100 MXN aporte pozo)
    const parsed = parsePokemonStandingsHTML(tomHtmlFixture, {
      entryFeeCents: 15_000,
      prizeContributionCents: 10_000,
    });

    assert.equal(parsed.tournamentName, 'League Challenge Pokémon TCG');
    assert.equal(parsed.totalRounds, 4);
    assert.equal(parsed.categories.length, 3);

    const masterCat = parsed.categories.find((c) => c.category === 'Master');
    const seniorCat = parsed.categories.find((c) => c.category === 'Senior');
    const juniorCat = parsed.categories.find((c) => c.category === 'Junior');

    assert.ok(masterCat && seniorCat && juniorCat);
    assert.equal(masterCat.occupancy, 6, 'Master debe tener 6 jugadores');
    assert.equal(seniorCat.occupancy, 3, 'Senior debe tener 3 jugadores');
    assert.equal(juniorCat.occupancy, 1, 'Junior debe tener 1 jugador');

    assert.equal(masterCat.calculatedPoolCents, 60_000, 'Master pool = 6 * $100 = $600 MXN (60,000 centavos)');
    assert.equal(seniorCat.calculatedPoolCents, 30_000, 'Senior pool = 3 * $100 = $300 MXN (30,000 centavos)');
    assert.equal(juniorCat.calculatedPoolCents, 10_000, 'Junior pool = 1 * $100 = $100 MXN (10,000 centavos)');
    assert.equal(parsed.totalOccupancy, 10);
    assert.equal(parsed.unifiedPoolCents, 100_000);

    // 2. Verificar distribución de Top Cut en Master (Top 4 con división estándar y Split)
    const masterTop4Std = calculateTopCutPrizeDistribution({
      totalPoolCents: masterCat.calculatedPoolCents,
      topCutSize: 4,
      applyEqualSplit: false,
      entries: masterCat.entries,
    });
    assert.equal(masterTop4Std.length, 4);
    const sumMasterStd = masterTop4Std.reduce((s, p) => s + p.awardedCents, 0);
    assert.equal(sumMasterStd, 60_000, 'Distribución estándar debe sumar exactamente 60,000 centavos');

    // Split en Top 4: pozo impar 60,000 / 4 = 15,000 c/u
    const masterTop4Split = calculateTopCutPrizeDistribution({
      totalPoolCents: masterCat.calculatedPoolCents,
      topCutSize: 4,
      applyEqualSplit: true,
      entries: masterCat.entries,
    });
    assert.equal(masterTop4Split[0].awardedCents, 15_000);
    assert.equal(masterTop4Split[3].awardedCents, 15_000);

    // 3. Crear y dispersar torneo por categorías en el motor con Partida Doble
    const trn = engine.createCategoryTournament({
      storeId: 'store_centro',
      actorUserId: to.userId,
      name: parsed.tournamentName,
      gameFormat: 'Pokémon TCG',
      gameType: 'POKEMON_TCG',
      categories: parsed.categories.map((c) => ({
        name: c.category,
        entryFeeCents: 15_000,
        prizeContributionCents: 10_000,
        registeredCount: c.occupancy,
        topCutSize: c.category === 'Master' ? 4 : c.category === 'Senior' ? 2 : 1,
      })),
      unifyCategoriesPool: false,
      sourceStandingsRaw: tomHtmlFixture,
    });

    assert.ok(trn.folio.startsWith('TRN-'));
    assert.equal(trn.categories?.length, 3);
    assert.equal(trn.calculatedPrizePoolCents, 100_000);

    // Resolver y dispersar los premios auto-creando jugadores que no existían
    const disperseResult = engine.disperseCategoryTournament({
      tournamentId: trn.id,
      actorUserId: to.userId,
      categoryDispersions: [
        {
          categoryName: 'Master',
          poolCents: 60_000,
          standings: calculateTopCutPrizeDistribution({
            totalPoolCents: 60_000,
            topCutSize: 4,
            applyEqualSplit: false,
            entries: masterCat.entries,
            resolvePlayerFn: (e) => {
              const wallet = engine.findOrCreatePlayer({
                fullName: e.playerName,
                storeId: 'store_centro',
                actorUserId: to.userId,
              });
              return { userId: wallet.userId, memberCode: wallet.memberCode, fullName: wallet.fullName };
            },
          }),
        },
        {
          categoryName: 'Senior',
          poolCents: 30_000,
          standings: calculateTopCutPrizeDistribution({
            totalPoolCents: 30_000,
            topCutSize: 2,
            applyEqualSplit: false,
            entries: seniorCat.entries,
            resolvePlayerFn: (e) => {
              const wallet = engine.findOrCreatePlayer({
                fullName: e.playerName,
                storeId: 'store_centro',
                actorUserId: to.userId,
              });
              return { userId: wallet.userId, memberCode: wallet.memberCode, fullName: wallet.fullName };
            },
          }),
        },
      ],
    });

    assert.equal(disperseResult.tournament.status, 'DISPERSED_COMPLETED');
    assert.equal(disperseResult.totalDispersedCents, 90_000);
    assert.equal(disperseResult.standings.length, 6);

    // Verificar que el ganador de Master tiene su crédito acreditado
    const winnerMaster = engine.walletsByUser.get(disperseResult.standings[0].playerUserId);
    assert.ok(winnerMaster);
    assert.ok(winnerMaster.availableBalanceCents > 0);

    // Validar integridad contable total del sistema
    const integrity = engine.verifySystemIntegrity();
    assert.equal(integrity.ledgerBalanced, true, 'El libro mayor debe estar perfectamente balanceado (Debits = Credits)');
    assert.equal(integrity.auditChainIntact, true, 'La cadena criptográfica SHA-256 debe permanecer intacta');
  });

  it('2.14 [Catálogo de Orígenes Contables de Crédito] Permite consultar y personalizar orígenes por sede y dinamiza la imputación contable en partida doble', () => {
    const engine = new ControlCreditoEngine();
    const admin = engine.registerUser({ userId: 'adm_cs1', memberCode: 'CC-CS1', fullName: 'Super Admin', alias: '@Super', role: 'SUPER_ADMIN' });
    const cashier = engine.registerUser({ userId: 'csh_cs1', memberCode: 'CC-CS2', fullName: 'Cajero Local', alias: '@Cashier', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'ply_cs1', memberCode: 'CC-CS3', fullName: 'Jugador Prueba', alias: '@Gamer', role: 'PLAYER' });

    // Consulta de orígenes por defecto
    const sourcesDefault = engine.getStoreCreditSources('store_centro');
    assert.ok(sourcesDefault.length >= 7);
    const singlesDefault = sourcesDefault.find((s) => s.code === 'SINGLES_TRADE_IN');
    assert.equal(singlesDefault?.defaultAccountCode, '1105');

    // Cajero no tiene permiso para actualizar catálogo de orígenes
    assert.throws(() => {
      engine.updateStoreCreditSources({
        actorUserId: cashier.userId,
        storeId: 'store_centro',
        creditSources: [{ code: 'CUSTOM', name: 'Custom Source', isEnabled: true }],
      });
    }, /PERMISO_DENEGADO_RBAC/);

    // SUPER_ADMIN personaliza los orígenes de store_centro agregando un origen exclusivo
    const updatedStore = engine.updateStoreCreditSources({
      actorUserId: admin.userId,
      storeId: 'store_centro',
      creditSources: [
        {
          code: 'STREAM_LIVE_RAFFLE',
          name: 'Rifa Especial Stream Twitch',
          description: 'Abono de dinamica en transmision',
          defaultAccountCode: '5102',
          defaultExpiryDays: 60,
          isEnabled: true,
        },
        {
          code: 'CUSTOM_BULK_ACQUISITION',
          name: 'Adquisición de Bulk Especializado',
          description: 'Cajas de cartas selladas de coleccionista',
          defaultAccountCode: '1105',
          defaultExpiryDays: 365,
          isEnabled: true,
        },
      ],
    });

    assert.equal(updatedStore.creditSources?.length, 2);

    // Emisión con el nuevo origen personalizado
    const issueResult = engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: player.userId,
      actorUserId: admin.userId,
      actorRole: 'SUPER_ADMIN',
      amountCents: 50_000,
      sourceType: 'STREAM_LIVE_RAFFLE',
      sourceLabel: 'Ganador de Trivia en Twitch',
      expiryDays: 60,
    });

    assert.ok(issueResult.journalEntry);
    const debitLine = issueResult.journalEntry.lines.find((l) => l.debitCents > 0);
    assert.equal(debitLine?.accountCode, '5102');
    assert.ok(debitLine?.accountName.includes('Gasto Promocional'));

    // Billetera del jugador debe tener los $500.00 MXN
    const wallet = engine.walletsByUser.get(player.userId);
    assert.equal(wallet?.availableBalanceCents, 50_000);

    // Integridad contable perfecta
    const integrity = engine.verifySystemIntegrity();
    assert.equal(integrity.ledgerBalanced, true);
    assert.equal(integrity.auditChainIntact, true);
  });

  it('2.15 [Cartas en Resguardo en Bóveda (Vault Custody)] Ciclo Completo: Registro, Precinto, Evidencia Fotográfica con SHA-256, Permisos Atómicos RBAC y Liberación Segura con Four-Eyes', () => {
    const engine = new ControlCreditoEngine();
    const admin = engine.registerUser({ userId: 'u_adm_cust', memberCode: 'CC-CUST-1', fullName: 'Director Bóveda', alias: '@BovedaAdmin', role: 'SUPER_ADMIN' });
    const cashier = engine.registerUser({ userId: 'u_csh_cust', memberCode: 'CC-CUST-2', fullName: 'Cajero Mostrador', alias: '@CajeroCust', role: 'CASHIER' });
    const player = engine.registerUser({ userId: 'u_ply_cust', memberCode: 'CC-CUST-3', fullName: 'Coleccionista Pro', alias: '@Collector', role: 'PLAYER' });
    const auditor = engine.registerUser({ userId: 'u_aud_cust', memberCode: 'CC-CUST-4', fullName: 'Auditor Fiscal', alias: '@AuditorCust', role: 'AUDITOR' });

    // 1. Cajero registra recepción de paquete de alto valor
    const intakeResult = engine.createCustodyPackage({
      actorUserId: cashier.userId,
      storeId: 'store_centro',
      clientUserId: player.userId,
      clientName: player.fullName,
      clientPhone: '+52 55 9999 8888',
      purpose: 'GRADING_SUBMISSION',
      vaultLocation: 'Caja Fuerte B - Casillero 09',
      tamperSealNumber: 'SEAL-2026-PSA-001',
      declaredValueCents: 150_000,
      itemsSummary: '2x Dual Lands Revised (Underground Sea & Volcanic Island)',
      dueDate: '2026-12-01',
      items: [
        {
          quantity: 1,
          cardName: 'Underground Sea',
          setName: 'Revised Edition',
          condition: 'NM',
          estimatedValueCents: 85_000,
        },
        {
          quantity: 1,
          cardName: 'Volcanic Island',
          setName: 'Revised Edition',
          condition: 'LP',
          estimatedValueCents: 65_000,
        },
      ],
      photos: [
        {
          photoType: 'SEAL_VIEW',
          caption: 'Precinto SEAL-2026-PSA-001 intacto',
          dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      ],
      intakeSupervisorId: admin.userId,
    });

    assert.ok(intakeResult.package);
    assert.equal(intakeResult.package.status, 'RECEIVED');
    assert.equal(intakeResult.package.folio.startsWith('CUST-'), true);
    assert.ok(intakeResult.package.claimVerificationCode.startsWith('VC-'));
    assert.ok(intakeResult.claimToken);
    assert.equal(intakeResult.package.photos.length, 1);
    assert.ok(intakeResult.package.photos[0].sha256Hash);

    // 2. Adjuntar foto adicional de inspección
    const photoAttached = engine.attachCustodyPhoto({
      actorUserId: cashier.userId,
      packageId: intakeResult.package.id,
      photoType: 'CONTENT_VIEW',
      caption: 'Detalle de esquinas de Volcanic Island',
      dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    });
    assert.equal(photoAttached.photos.length, 2);

    // 3. Mover a casillero definitivo en bóveda
    const moved = engine.updateCustodyLocation({
      actorUserId: cashier.userId,
      packageId: intakeResult.package.id,
      vaultLocation: 'Caja Fuerte A - Gaveta de Alta Seguridad 02',
      newStatus: 'READY_FOR_PICKUP',
      reason: 'Regresó calificada de PSA con grados 9 y 8.5',
    });
    assert.equal(moved.status, 'READY_FOR_PICKUP');
    assert.equal(moved.vaultLocation, 'Caja Fuerte A - Gaveta de Alta Seguridad 02');

    // 4. RBAC: Cajero no tiene permiso custody:package:cancel
    assert.throws(() => {
      engine.cancelCustodyPackage({
        actorUserId: cashier.userId,
        packageId: intakeResult.package.id,
        reasonJustification: 'Intento de anulación no autorizado',
      });
    }, /PERMISO_DENEGADO_RBAC/);

    // 5. Intento de liberación con código de comprobante inválido
    assert.throws(() => {
      engine.releaseCustodyPackage({
        actorUserId: cashier.userId,
        packageId: intakeResult.package.id,
        claimVerificationCode: 'VC-INVALID-CODE',
      });
    }, /COMPROBANTE_RESGUARDO_INVALIDO/);

    // 6. Intento de liberación por un rol no autorizado (Auditor)
    assert.throws(() => {
      engine.releaseCustodyPackage({
        actorUserId: auditor.userId,
        packageId: intakeResult.package.id,
        claimVerificationCode: intakeResult.package.claimVerificationCode,
      });
    }, /PERMISO_DENEGADO_RBAC/);

    // 7. Liberación exitosa presentando el código del comprobante
    const released = engine.releaseCustodyPackage({
      actorUserId: cashier.userId,
      packageId: intakeResult.package.id,
      claimVerificationCode: intakeResult.package.claimVerificationCode,
      clientSignatureProof: 'FIRMA_DIGITAL_ENTREGA_CONFORME',
    });
    assert.equal(released.status, 'RELEASED');
    assert.ok(released.releasedAt);

    // 8. Re-liberación bloqueada
    assert.throws(() => {
      engine.releaseCustodyPackage({
        actorUserId: cashier.userId,
        packageId: intakeResult.package.id,
        claimVerificationCode: intakeResult.package.claimVerificationCode,
      });
    }, /PAQUETE_YA_ENTREGADO/);

    // 9. Integridad del hash chain de auditoría intacto
    const integrityCust = engine.verifySystemIntegrity();
    assert.equal(integrityCust.ledgerBalanced, true);
    assert.equal(integrityCust.auditChainIntact, true);
  });

  it('2.16 [Resguardo en Bóveda a Nombre de Alguien Más] Flujo Bilateral (Quién Deja vs Quién Recibe), Aislamiento RLS y Registro de Quien Retira', () => {
    const engine = new ControlCreditoEngine();
    const cashier = engine.registerUser({ userId: 'u_csh_cust2', memberCode: 'CC-CSH-2', fullName: 'Cajero Mostrador 2', alias: '@Cajero2', role: 'CASHIER' });
    const playerA = engine.registerUser({ userId: 'u_ply_a', memberCode: 'CC-PLY-A', fullName: 'Alejandro Morales (Remitente)', alias: '@AlexM', role: 'PLAYER' });
    const playerB = engine.registerUser({ userId: 'u_ply_b', memberCode: 'CC-PLY-B', fullName: 'Carlos Mendoza (Destinatario)', alias: '@CarlosM', role: 'PLAYER' });
    const playerC = engine.registerUser({ userId: 'u_ply_c', memberCode: 'CC-PLY-C', fullName: 'Tercero Ajeno', alias: '@Tercero', role: 'PLAYER' });

    // 1. Alejandro (Player A) deja un paquete de cartas en resguardo a nombre de Carlos (Player B)
    const result = engine.createCustodyPackage({
      actorUserId: cashier.userId,
      storeId: 'store_centro',
      depositorUserId: playerA.userId,
      depositorName: playerA.fullName,
      depositorPhone: '+52 55 1111 2222',
      recipientUserId: playerB.userId,
      recipientName: playerB.fullName,
      recipientPhone: '+52 55 3333 4444',
      isForThirdParty: true,
      purpose: 'CONSIGNMENT_ESCROW',
      vaultLocation: 'Caja Fuerte B - Casillero 15',
      itemsSummary: 'Playset de The One Ring (Foil)',
      items: [
        {
          quantity: 4,
          cardName: 'The One Ring',
          setName: 'Lord of the Rings',
          isFoil: true,
          declaredItemValueCents: 200_000,
        },
      ],
    });

    const pkg = result.package;
    assert.equal(pkg.isForThirdParty, true);
    assert.equal(pkg.depositorUserId, playerA.userId);
    assert.equal(pkg.depositorName, playerA.fullName);
    assert.equal(pkg.recipientUserId, playerB.userId);
    assert.equal(pkg.recipientName, playerB.fullName);
    assert.equal(pkg.clientName, playerB.fullName); // Destinatario como titular
    assert.ok(pkg.statusReason?.includes('Alejandro Morales'));
    assert.ok(pkg.statusReason?.includes('Carlos Mendoza'));

    // 2. Búsqueda por remitente y destinatario
    const searchByDepositor = engine.listCustodyPackages({ actorUserId: cashier.userId, search: 'Alejandro' });
    assert.equal(searchByDepositor.length, 1);
    assert.equal(searchByDepositor[0].id, pkg.id);

    const searchByRecipient = engine.listCustodyPackages({ actorUserId: cashier.userId, search: 'Carlos' });
    assert.equal(searchByRecipient.length, 1);
    assert.equal(searchByRecipient[0].id, pkg.id);

    // 3. Row-Level Security:
    // Alejandro (remitente) puede ver el paquete
    const listForPlayerA = engine.listCustodyPackages({ actorUserId: playerA.userId });
    assert.ok(listForPlayerA.some(p => p.id === pkg.id));

    // Carlos (destinatario) puede ver el paquete
    const listForPlayerB = engine.listCustodyPackages({ actorUserId: playerB.userId });
    assert.ok(listForPlayerB.some(p => p.id === pkg.id));

    // Tercero ajeno (Player C) NO puede ver el paquete
    const listForPlayerC = engine.listCustodyPackages({ actorUserId: playerC.userId });
    assert.equal(listForPlayerC.some(p => p.id === pkg.id), false);

    // Y getCustodyPackage directo rechaza a Player C con 403
    assert.throws(() => {
      engine.getCustodyPackage(pkg.id, playerC.userId);
    }, /ACCESO_DENEGADO/);

    // 4. Liberación registrando quién retira físicamente
    const released = engine.releaseCustodyPackage({
      actorUserId: cashier.userId,
      packageId: pkg.id,
      claimVerificationCode: pkg.claimVerificationCode,
      pickedUpByName: playerB.fullName,
      pickedUpByRole: 'DESTINATARIO_TITULAR',
    });

    assert.equal(released.status, 'RELEASED');
    assert.equal(released.pickedUpByName, playerB.fullName);
    assert.equal(released.pickedUpByRole, 'DESTINATARIO_TITULAR');
    assert.ok(released.statusReason?.includes('Carlos Mendoza'));
    assert.ok(released.statusReason?.includes('DESTINATARIO_TITULAR'));

    // 5. Integridad del hash-chain
    const integrity = engine.verifySystemIntegrity();
    assert.equal(integrity.auditChainIntact, true);
  });

  it('2.17 [Seguridad Financiera P2P y Validación Estricta de 4-Ojos] Rechaza importes negativos/nulos en P2P y exige PIN de supervisor sin excepciones', () => {
    const engine = new ControlCreditoEngine();
    const admin = engine.registerUser({
      userId: 'u_adm_p2p',
      memberCode: 'STF-P2P',
      fullName: 'Gerente P2P',
      alias: '@GerenteP2P',
      role: 'STORE_ADMIN',
      securityPin: '887766',
    });
    const playerA = engine.registerUser({
      userId: 'u_p2p_a',
      memberCode: 'CC-P2P-A',
      fullName: 'Remitente P2P',
      alias: '@PlayerP2PA',
      role: 'PLAYER',
    });
    const playerB = engine.registerUser({
      userId: 'u_p2p_b',
      memberCode: 'CC-P2P-B',
      fullName: 'Destinatario P2P',
      alias: '@PlayerP2PB',
      role: 'PLAYER',
    });

    // Habilitar política P2P para la prueba
    engine.org.p2pPolicy = 'ENABLED_WITH_LIMITS';

    // 1. Fondear cuenta de Player A con $500 MXN
    engine.issueCredit({
      storeId: 'store_centro',
      targetUserId: playerA.userId,
      actorUserId: admin.userId,
      actorRole: 'STORE_ADMIN',
      amountCents: 50_000,
      sourceType: 'SINGLES_TRADE_IN',
      sourceLabel: 'Trade-in inicial para pruebas P2P',
      expiryDays: 90,
    });

    // 2. Intentar transferencia P2P con monto negativo -> Debe ser rechazada
    assert.throws(() => {
      engine.transferCreditP2P({
        storeId: 'store_centro',
        fromUserId: playerA.userId,
        toUserId: playerB.userId,
        amountCents: -50_000,
      });
    }, /MONTO_TRANSFERENCIA_INVALIDO/);

    // 3. Intentar transferencia P2P con monto cero -> Debe ser rechazada
    assert.throws(() => {
      engine.transferCreditP2P({
        storeId: 'store_centro',
        fromUserId: playerA.userId,
        toUserId: playerB.userId,
        amountCents: 0,
      });
    }, /MONTO_TRANSFERENCIA_INVALIDO/);

    // 4. Intentar transferencia P2P con decimales -> Debe ser rechazada
    assert.throws(() => {
      engine.transferCreditP2P({
        storeId: 'store_centro',
        fromUserId: playerA.userId,
        toUserId: playerB.userId,
        amountCents: 100.5,
      });
    }, /MONTO_TRANSFERENCIA_INVALIDO/);

    // 5. Transferencia legítima de $200 MXN -> Éxito
    const res = engine.transferCreditP2P({
      storeId: 'store_centro',
      fromUserId: playerA.userId,
      toUserId: playerB.userId,
      amountCents: 20_000,
    });
    assert.ok(res.transferredNetCents > 0);
    assert.equal(playerA.availableBalanceCents, 30_000);
    assert.equal(playerB.availableBalanceCents, res.transferredNetCents);

    // 6. Validación de Four-Eyes: verifySupervisorPin exige PIN y rechaza sin credencial
    assert.throws(() => {
      engine.verifySupervisorPin(playerA.userId, admin.userId, '');
    }, /PIN_SUPERVISOR_REQUERIDO/);

    assert.throws(() => {
      engine.verifySupervisorPin(playerA.userId, admin.userId, '000000');
    }, /PIN_SUPERVISOR_INCORRECTO/);

    const supVerified = engine.verifySupervisorPin(playerA.userId, admin.userId, '887766');
    assert.equal(supVerified.userId, admin.userId);
  });
});

