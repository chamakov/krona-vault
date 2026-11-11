import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateStandardTotpCode } from '../../../packages/crypto-totp/src/index.ts';
import { server } from './server.ts';

describe('Suite 3: API HTTP & PWA End-to-End Integration Tests', () => {
  let baseUrl = '';

  it('3.1 Inicia el servidor en puerto efímero y verifica /api/health e integridad del Ledger', async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (typeof addr === 'object' && addr) {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }

    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.status, 'ok');
    assert.equal(body.integrity.ledgerBalanced, true);
    assert.equal(body.integrity.auditChainIntact, true);
  });

  it('3.2 Sirve los 10 portales independientes de KRONA VAULT (/, /login, /wallet, /pos, /tournaments, /trade-in, /stores, /users, /profile, /audit, /custody), CSS corporativo, Manifest y Service Worker', async () => {
    const portals = [
      { path: '/', match: /KRONA Nexus/ },
      { path: '/login', match: /KRONA Gate/ },
      { path: '/wallet', match: /KRONA Pass/ },
      { path: '/pos', match: /KRONA Terminal/ },
      { path: '/tournaments', match: /KRONA Arena/ },
      { path: '/trade-in', match: /KRONA Trade-In/ },
      { path: '/stores', match: /KRONA Stores/ },
      { path: '/users', match: /KRONA IAM/ },
      { path: '/profile', match: /KRONA Profile/ },
      { path: '/audit', match: /KRONA Citadel/ },
      { path: '/custody', match: /KRONA Custody/ },
    ];

    for (const p of portals) {
      const res = await fetch(`${baseUrl}${p.path}`);
      assert.equal(res.status, 200, `Fallo al servir portal ${p.path}`);
      const html = await res.text();
      assert.match(html, p.match);
    }

    const cssRes = await fetch(`${baseUrl}/styles/brand.css`);
    assert.equal(cssRes.status, 200);
    assert.match(await cssRes.text(), /--accent-gold/);

    const jsRes = await fetch(`${baseUrl}/js/krona-core.js`);
    assert.equal(jsRes.status, 200);

    const manifestRes = await fetch(`${baseUrl}/manifest.webmanifest`);
    assert.equal(manifestRes.status, 200);
    const manifest = (await manifestRes.json()) as any;
    assert.equal(manifest.short_name, 'KRONA Vault');

    const swRes = await fetch(`${baseUrl}/sw.js`);
    assert.equal(swRes.status, 200);
  });

  it('3.3 Ejecuta cobro mixto en /api/pos/redeem, genera Voucher Físico Térmico y valida reimpresión auditada', async () => {
    // 1. Cobro sin prueba de autorización -> Rechazo 400 (VULN-02 Mitigada)
    const unauthRedeemRes = await fetch(`${baseUrl}/api/pos/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_norte',
        playerUserId: 'u_player_1',
        totalTicketCents: 50_000,
        creditToApplyCents: 30_000,
      }),
    });
    assert.equal(unauthRedeemRes.status, 400);
    const unauthData = (await unauthRedeemRes.json()) as any;
    assert.match(unauthData.error, /PRUEBA_AUTH_JUGADOR_REQUERIDA/);

    // 2. Cobro con PIN 2FA válido -> Éxito 200
    const redeemRes = await fetch(`${baseUrl}/api/pos/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_norte',
        playerUserId: 'u_player_1',
        totalTicketCents: 50_000,
        creditToApplyCents: 30_000,
        externalPosTicketRef: '#POS-E2E-777',
        productCategory: 'SEALED_PRODUCT',
        conceptNotes: 'Prerelease Pack + Micas',
        totpPin: '123456',
      }),
    });
    assert.equal(redeemRes.status, 200);
    const redeemData = (await redeemRes.json()) as any;
    assert.equal(redeemData.ok, true);
    assert.equal(redeemData.voucher.creditAppliedCents, 30_000);
    assert.equal(redeemData.voucher.remainingCashOrCardCents, 20_000);
    assert.match(redeemData.thermalText, /ORIGINAL - PÓLIZA DE CAJA/);

    const reprintRes = await fetch(`${baseUrl}/api/pos/reprint-voucher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voucherFolio: redeemData.voucher.voucherFolio,
        reason: 'Prueba E2E de reimpresión',
      }),
    });
    assert.equal(reprintRes.status, 200);
    const reprintData = (await reprintRes.json()) as any;
    assert.equal(reprintData.voucher.printCount, 2);
    assert.match(reprintData.thermalText, /COPIA REIMPRESA #2 - NO VÁLIDA PARA ARQUEO/);
  });

  it('3.4 Dispersa pozo de torneo con Split en Top 4 vía /api/tournaments/disperse y verifica que el Ledger siga cuadrado', async () => {
    const dispRes = await fetch(`${baseUrl}/api/tournaments/disperse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_centro',
        tournamentName: 'Torneo E2E Modern',
        totalPoolCents: 400_000,
        applyTop4Split: true,
      }),
    });
    assert.equal(dispRes.status, 200);
    const dispData = (await dispRes.json()) as any;
    assert.equal(dispData.ok, true);
    assert.equal(dispData.standings.length, 4);
    assert.equal(dispData.standings[0].awardedCents, 100_000);
  });

  it('3.5 Registra nuevo jugador en mostrador, abona Trade-In de Singles y genera Corte Z de Caja', async () => {
    const regRes = await fetch(`${baseUrl}/api/players/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Sofía Hernández', alias: '@SofiLorcana' }),
    });
    assert.equal(regRes.status, 200);
    const regData = (await regRes.json()) as any;
    assert.equal(regData.ok, true);

    const issueRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: regData.player.userId,
        amountCents: 45_000,
        sourceType: 'SINGLES_TRADE_IN',
        sourceLabel: 'Compra de 3x Fetchlands',
      }),
    });
    assert.equal(issueRes.status, 200);

    const closureRes = await fetch(`${baseUrl}/api/pos/shift-closure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: 'store_norte' }),
    });
    assert.equal(closureRes.status, 200);
    const closureData = (await closureRes.json()) as any;
    assert.equal(closureData.ok, true);
    assert.match(closureData.report.thermalClosureText, /CORTE Z — CIERRE DE TURNO/);
    assert.equal(closureData.report.reprintedVouchersAlert.length, 1);
  });

  it('3.6 Autentica usuarios reales (/api/auth/login), valida los 6 roles (/api/roles) y aplica control RBAC en alta de usuarios (/api/users/create)', async () => {
    // 1. Verificar matriz de 6 roles
    const rolesRes = await fetch(`${baseUrl}/api/roles`);
    assert.equal(rolesRes.status, 200);
    const rolesData = (await rolesRes.json()) as any;
    assert.equal(Object.keys(rolesData.roleMatrix).length, 6);

    // 2. Login como SUPER_ADMIN con contraseña
    const superLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0002', secret: 'krona2026', method: 'PASSWORD' }),
    });
    assert.equal(superLoginRes.status, 200);
    const superAuth = (await superLoginRes.json()) as any;
    assert.equal(superAuth.user.role, 'SUPER_ADMIN');
    assert.match(superAuth.token, /^KST1\./);

    // 3. SUPER_ADMIN da de alta un nuevo CAJERO en Sucursal Norte
    const createCashierRes = await fetch(`${baseUrl}/api/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAuth.token}`,
      },
      body: JSON.stringify({
        fullName: 'Marco Polo POS',
        alias: '@MarcoCaja',
        role: 'CASHIER',
        assignedStoreId: 'store_norte',
        email: 'marco@kronavault.mx',
        phone: '+52 55 8888 0000',
        password: 'marcoPassword2026',
        securityPin: '654321',
      }),
    });
    assert.equal(createCashierRes.status, 200);
    const createdCashier = (await createCashierRes.json()) as any;
    assert.equal(createdCashier.user.role, 'CASHIER');

    // 4. El nuevo CAJERO inicia sesión con su PIN de 6 dígitos
    const cashierLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: createdCashier.user.memberCode,
        secret: '654321',
        method: 'PIN',
      }),
    });
    assert.equal(cashierLoginRes.status, 200);
    const cashierAuth = (await cashierLoginRes.json()) as any;
    assert.equal(cashierAuth.user.alias, '@MarcoCaja');

    // 5. El CAJERO intenta crear un STORE_ADMIN -> Bloqueado por jerarquía RBAC (400 ESCALACION_PRIVILEGIOS_BLOQUEADA)
    const forbiddenCreateRes = await fetch(`${baseUrl}/api/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierAuth.token}`,
      },
      body: JSON.stringify({
        fullName: 'Intento Escalación',
        alias: '@Escalacion',
        role: 'STORE_ADMIN',
        assignedStoreId: 'store_norte',
      }),
    });
    assert.equal(forbiddenCreateRes.status, 400);
    const forbiddenBody = (await forbiddenCreateRes.json()) as any;
    assert.match(forbiddenBody.error, /ESCALACION_PRIVILEGIOS_BLOQUEADA/);

    // 6. Verificar que /api/auth/demo-switch está bloqueado para cualquier rol que no sea SUPER_ADMIN
    const forbiddenSwitchRes = await fetch(`${baseUrl}/api/auth/demo-switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierAuth.token}`,
      },
      body: JSON.stringify({ userId: 'u_admin_2' }),
    });
    assert.equal(forbiddenSwitchRes.status, 403);

    // 7. Login real como AUDITOR (Solo Lectura) e intento de emitir crédito -> Bloqueado con 403 PERMISO_DENEGADO_RBAC
    const auditorLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0030', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    assert.equal(auditorLoginRes.status, 200);
    const auditorAuth = (await auditorLoginRes.json()) as any;
    assert.equal(auditorAuth.user.role, 'AUDITOR');

    const auditorMutateRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auditorAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: 'u_player_1',
        amountCents: 10_000,
        sourceType: 'MANUAL_ADJUSTMENT',
        sourceLabel: 'Intento Auditor',
      }),
    });
    assert.equal(auditorMutateRes.status, 403);
    const auditorMutateBody = (await auditorMutateRes.json()) as any;
    assert.match(auditorMutateBody.error, /PERMISO_DENEGADO_RBAC/);

    // 8. Verificar que el cierre de sesión (POST /api/auth/logout) revoca el token en memoria del servidor
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierAuth.token}`,
      },
    });
    assert.equal(logoutRes.status, 200);
    const logoutBody = (await logoutRes.json()) as any;
    assert.equal(logoutBody.revoked, true);

    // 9. Intentar consultar /api/state?requireAuth=1 con el token revocado/huérfano -> Devuelve authenticated: false (Cero sesiones fantasma)
    const ghostStateRes = await fetch(`${baseUrl}/api/state?requireAuth=1`, {
      headers: {
        Authorization: `Bearer ${cashierAuth.token}`,
      },
    });
    assert.equal(ghostStateRes.status, 200);
    const ghostStateBody = (await ghostStateRes.json()) as any;
    assert.equal(ghostStateBody.authenticated, false);
    assert.equal(ghostStateBody.sessionUser, null);
    assert.equal(ghostStateBody.sessionInvalidReason, 'SESION_NO_ACTIVA_EN_SERVIDOR');
  });

  it('3.7 Permite al usuario configurar su propio perfil (/api/profile/update): cambiar datos, contraseña, PIN y rotar semilla 2FA', async () => {
    const playerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-1042', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    assert.equal(playerLoginRes.status, 200);
    const playerAuth = (await playerLoginRes.json()) as any;

    const profRes = await fetch(`${baseUrl}/api/profile/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerAuth.token}`,
      },
      body: JSON.stringify({
        fullName: 'Diana Rojas Pro',
        alias: '@DianaYGO_Pro',
        email: 'diana.pro@player.mx',
        phone: '+52 55 9999 1111',
        newPassword: 'dianaNewPass2026',
        newPin: '887766',
        rotateTotpSeed: true,
      }),
    });
    assert.equal(profRes.status, 200);
    const profData = (await profRes.json()) as any;
    assert.equal(profData.user.alias, '@DianaYGO_Pro');

    // Verificar que puede iniciar sesión con su nueva contraseña
    const reloginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '@DianaYGO_Pro',
        secret: 'dianaNewPass2026',
        method: 'PASSWORD',
      }),
    });
    assert.equal(reloginRes.status, 200);
  });

  it('3.8 Ejecuta el ciclo completo de un Torneo (/api/tournaments/create -> enroll -> disperse con firma Four-Eyes) y audita "¿Quién Hizo Qué?" (/api/audit/search)', async () => {
    // Login real como TOURNAMENT_ORGANIZER (@JudgeRob)
    const toLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0010', secret: '440010', mode: 'PIN' }),
    });
    assert.equal(toLoginRes.status, 200);
    const toAuth = (await toLoginRes.json()) as any;
    assert.equal(toAuth.user.role, 'TOURNAMENT_ORGANIZER');

    // 1. Crear nuevo torneo
    const createTrnRes = await fetch(`${baseUrl}/api/tournaments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        name: 'Championship Pokémon TCG E2E',
        gameCategory: 'Pokémon TCG Standard',
        entryFeeCents: 20_000,
        prizeContributionPerPlayerCents: 15_000,
        guaranteedPoolCents: 60_000,
      }),
    });
    assert.equal(createTrnRes.status, 200);
    const trnCreated = (await createTrnRes.json()) as any;
    const tournamentId = trnCreated.tournament.id;
    assert.equal(trnCreated.tournament.status, 'OPEN_REGISTRATION');

    // 2. Inscribir 4 jugadores reales
    for (const pid of ['u_player_1', 'u_player_2', 'u_player_3', 'u_player_4']) {
      const enrollRes = await fetch(`${baseUrl}/api/tournaments/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${toAuth.token}`,
        },
        body: JSON.stringify({ tournamentId, playerUserId: pid }),
      });
      assert.equal(enrollRes.status, 200);
    }

    // 3. Dispersar el torneo con firma Four-Eyes (PIN de Gerente @LauraAdmin: 990011)
    const dispTrnRes = await fetch(`${baseUrl}/api/tournaments/disperse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toAuth.token}`,
      },
      body: JSON.stringify({
        tournamentId,
        storeId: 'store_centro',
        applyTop4Split: true,
        coAuthorizerUserId: 'u_admin_1',
        coAuthPin: '990011',
      }),
    });
    assert.equal(dispTrnRes.status, 200);
    const dispTrnData = (await dispTrnRes.json()) as any;
    assert.equal(dispTrnData.ok, true);
    assert.equal(dispTrnData.tournament.status, 'DISPERSED_COMPLETED');
    assert.equal(dispTrnData.tournament.dispersedByUserId, 'u_to_1');
    assert.equal(dispTrnData.tournament.coAuthorizedByUserId, 'u_admin_1');

    // 4. Consultar "¿Quién Hizo Qué?" en /api/audit/search filtrando por el Juez @JudgeRob
    const searchRes = await fetch(
      `${baseUrl}/api/audit/search?actor=JudgeRob&role=TOURNAMENT_ORGANIZER`
    );
    assert.equal(searchRes.status, 200);
    const searchData = (await searchRes.json()) as any;
    assert.equal(searchData.ok, true);
    assert.ok(searchData.count >= 5);

    const createdAudit = searchData.results.find(
      (r: any) => r.eventAction === 'TOURNAMENT_CREATED' && r.targetEntityId === trnCreated.tournament.folio
    );
    assert.ok(createdAudit, 'Debe existir el registro forense de TOURNAMENT_CREATED');
    assert.equal(createdAudit.actorUserId, 'u_to_1');

    const prizeAudit = searchData.results.find(
      (r: any) => r.eventAction === 'CREDIT_ISSUED' && r.coAuthorizerId === 'u_admin_1'
    );
    assert.ok(prizeAudit, 'Debe existir el registro forense de premio emitido con co-autorización Four-Eyes');
    assert.equal(prizeAudit.actorUserId, 'u_to_1');
    assert.equal(prizeAudit.coAuthorizerId, 'u_admin_1');
  });

  it('3.9 Exige sesión explícita en /api/state?requireAuth=1 (no asigna SUPER_ADMIN sin login) y aísla los datos cuando entra un PLAYER', async () => {
    // Sin token -> authenticated: false
    const unauthRes = await fetch(`${baseUrl}/api/state?requireAuth=1`);
    assert.equal(unauthRes.status, 200);
    const unauthData = (await unauthRes.json()) as any;
    assert.equal(unauthData.authenticated, false);
    assert.equal(unauthData.sessionUser, null);

    // Con token de PLAYER -> solo ve su propia cuenta y portales ['/wallet', '/profile']
    const playerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-8492', secret: '123456', mode: 'PIN' }),
    });
    const playerAuth = (await playerLoginRes.json()) as any;
    assert.equal(playerAuth.user.role, 'PLAYER');

    const stateRes = await fetch(`${baseUrl}/api/state?requireAuth=1`, {
      headers: { Authorization: `Bearer ${playerAuth.token}` },
    });
    const stateData = (await stateRes.json()) as any;
    assert.equal(stateData.authenticated, true);
    assert.equal(stateData.sessionUser.role, 'PLAYER');
    assert.deepEqual(stateData.sessionCapabilities.allowedPortals, ['/wallet', '/profile']);
    assert.equal(stateData.allUsers.length, 1);
    assert.equal(stateData.journalEntries.length, 0);
  });

  it('3.10 Permite a SUPER_ADMIN dar de alta, editar, pausar/reactivar y eliminar sucursales en /api/stores/* con auditoría', async () => {
    // 1. Login como SUPER_ADMIN
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0002', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    const { token } = (await loginRes.json()) as any;
    assert.ok(token);

    // 2. Alta de nueva sucursal
    const createRes = await fetch(`${baseUrl}/api/stores/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Sucursal Satélite',
        code: 'SUC-SATELITE',
        voucherPrefix: 'VCH-SAT',
        legalEntityTaxId: 'SAT260101XYZ',
        address: 'Circuito Novelistas #40, Cd Satélite',
        isActive: true,
      }),
    });
    assert.equal(createRes.status, 200);
    const createData = (await createRes.json()) as any;
    assert.equal(createData.ok, true);
    assert.equal(createData.store.code, 'SUC-SATELITE');
    assert.equal(createData.store.name, 'Sucursal Satélite');
    const newStoreId = createData.store.id;

    // 3. Listar sucursales
    const listRes = await fetch(`${baseUrl}/api/stores`);
    assert.equal(listRes.status, 200);
    const listData = (await listRes.json()) as any;
    assert.ok(listData.stores.some((s: any) => s.id === newStoreId));

    // 4. Modificar sucursal (cambio de nombre y dirección)
    const updateRes = await fetch(`${baseUrl}/api/stores/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storeId: newStoreId,
        name: 'Sucursal Satélite Flagship',
        address: 'Circuito Novelistas #40, Local 2B',
      }),
    });
    assert.equal(updateRes.status, 200);
    const updateData = (await updateRes.json()) as any;
    assert.equal(updateData.store.name, 'Sucursal Satélite Flagship');
    assert.equal(updateData.store.address, 'Circuito Novelistas #40, Local 2B');

    // 5. Pausar / Desactivar sucursal (baja lógica)
    const toggleRes = await fetch(`${baseUrl}/api/stores/toggle-active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storeId: newStoreId,
        isActive: false,
        reason: 'Remodelación de tienda física',
      }),
    });
    assert.equal(toggleRes.status, 200);
    const toggleData = (await toggleRes.json()) as any;
    assert.equal(toggleData.store.isActive, false);

    // 6. Eliminar sucursal sin historial
    const deleteRes = await fetch(`${baseUrl}/api/stores/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storeId: newStoreId,
      }),
    });
    assert.equal(deleteRes.status, 200);
    const deleteData = (await deleteRes.json()) as any;
    assert.equal(deleteData.ok, true);
    assert.equal(deleteData.deletedStoreId, newStoreId);

    // 7. Intentar eliminar store_centro (que sí tiene vouchers y usuarios) debe ser bloqueado para proteger la contabilidad
    const deleteCentroRes = await fetch(`${baseUrl}/api/stores/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
      }),
    });
    assert.equal(deleteCentroRes.status, 400);
    const deleteCentroData = (await deleteCentroRes.json()) as any;
    assert.match(deleteCentroData.error, /TIENDA_CON_/);
  });

  it('3.11 Genera Corte Z de Caja sin error ante storeId inexistente o desactualizado resolviendo sucursal activa sin fallar', async () => {
    // 1. Obtener token de STORE_ADMIN
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0001', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    assert.equal(loginRes.status, 200);
    const { token } = (await loginRes.json()) as any;

    // 2. Enviar petición con un storeId inválido/obsoleto que no existe en el sistema
    const closureRes = await fetch(`${baseUrl}/api/pos/shift-closure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storeId: 'store_obsoleta_inexistente_123',
      }),
    });
    assert.equal(closureRes.status, 200, 'Debe responder 200 OK resolviendo la sucursal activa en lugar de lanzar SUCURSAL_NO_ENCONTRADA');
    const closureData = (await closureRes.json()) as any;
    assert.equal(closureData.ok, true);
    assert.ok(closureData.report);
    assert.ok(closureData.report.closureId);
    assert.ok(closureData.report.storeId, 'Debe haber resuelto un storeId válido');
    assert.ok(closureData.report.thermalClosureText.includes('CORTE Z — CIERRE DE TURNO'));
  });

  it('3.12 Registra usuario con PIN sin setear (unset) y sincroniza Google/Microsoft Authenticator 2FA (RFC 6238)', async () => {
    // 1. Obtener token de SUPER_ADMIN
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0002', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    const { token: adminToken } = (await adminLoginRes.json()) as any;

    // 2. Dar de alta nuevo usuario SIN pasar securityPin
    const createUserRes = await fetch(`${baseUrl}/api/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Raúl Mendoza Sin PIN',
        alias: '@RaulNoPin',
        role: 'PLAYER',
        email: 'raul.nopin@kronavault.mx',
        password: 'raulPassword2026',
        // securityPin no se envía
      }),
    });
    assert.equal(createUserRes.status, 200);
    const createdData = (await createUserRes.json()) as any;
    assert.equal(createdData.user.hasSecurityPin, false, 'El usuario nuevo debe tener hasSecurityPin = false');
    assert.equal(createdData.user.hasAuthenticator, false, 'El usuario nuevo no debe tener Authenticator activo aún');

    // 3. Intentar iniciar sesión con modo PIN -> Debe rechazar con PIN_NO_CONFIGURADO
    const failPinLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: createdData.user.memberCode,
        secret: '123456',
        method: 'PIN',
      }),
    });
    assert.equal(failPinLogin.status, 400);
    const failPinData = (await failPinLogin.json()) as any;
    assert.match(failPinData.error, /PIN_NO_CONFIGURADO/);

    // 4. Iniciar sesión con contraseña -> Exitoso
    const pwdLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: createdData.user.memberCode,
        secret: 'raulPassword2026',
        method: 'PASSWORD',
      }),
    });
    assert.equal(pwdLogin.status, 200);
    const userAuth = (await pwdLogin.json()) as any;

    // 5. El usuario solicita sincronizar Authenticator (/api/auth/2fa/setup)
    const setup2faRes = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      headers: { Authorization: `Bearer ${userAuth.token}` },
    });
    assert.equal(setup2faRes.status, 200);
    const setup2fa = (await setup2faRes.json()) as any;
    assert.ok(setup2fa.secret, 'Debe devolver la clave secreta Base32');
    assert.ok(setup2fa.otpauthUri.startsWith('otpauth://totp/'));
    assert.equal(setup2fa.isSynced, false);

    // 6. Generar el código de 6 dígitos que la app Google Authenticator mostraría
    const nowMs = Date.now();
    const { code: validTotpCode } = generateStandardTotpCode(setup2fa.secret, nowMs);

    // 7. Enviar código para verificar y activar Authenticator (/api/auth/2fa/verify-sync)
    const verifyRes = await fetch(`${baseUrl}/api/auth/2fa/verify-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.token}`,
      },
      body: JSON.stringify({
        code: validTotpCode,
        secret: setup2fa.secret,
      }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = (await verifyRes.json()) as any;
    assert.equal(verifyData.ok, true);
    assert.ok(verifyData.syncedAt);

    // 8. El usuario ahora puede iniciar sesión con su código de 6 dígitos de Google Authenticator
    const totpLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: createdData.user.memberCode,
        secret: validTotpCode,
        method: 'PIN',
      }),
    });
    assert.equal(totpLoginRes.status, 200, 'Debe permitir autenticar con el código de Google Authenticator');
    const totpAuth = (await totpLoginRes.json()) as any;
    assert.equal(totpAuth.user.hasAuthenticator, true);

    // 9. Desvincular Authenticator
    const disableRes = await fetch(`${baseUrl}/api/auth/2fa/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.token}`,
      },
    });
    assert.equal(disableRes.status, 200);
    const disableData = (await disableRes.json()) as any;
    assert.equal(disableData.success, true);
  });

  it('3.13 [POS Mostrador] Valida que el jugador tenga crédito disponible, rechaza si es <= 0 y autoriza con PIN 2FA', async () => {
    // 1. Crear jugador sin crédito
    const regRes = await fetch(`${baseUrl}/api/players/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Jugador Sin Saldo',
        alias: '@SinSaldo',
      }),
    });
    assert.equal(regRes.status, 200);
    const regData = (await regRes.json()) as any;
    const brokePlayerId = regData.player.userId;

    // 2. Intentar redimir crédito en mostrador para jugador sin saldo -> Debe fallar
    const failRedeemRes = await fetch(`${baseUrl}/api/pos/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerUserId: brokePlayerId,
        totalTicketCents: 50000,
        creditToApplyCents: 20000,
        productCategory: 'SEALED_PRODUCT',
        externalPosTicketRef: 'N/A',
        conceptNotes: 'Redención de crédito en tienda',
        authMethod: 'PIN_OFFLINE_2FA',
        totpPin: '123456',
      }),
    });
    assert.equal(failRedeemRes.status, 400);
    const failData = (await failRedeemRes.json()) as any;
    assert.ok(failData.error.includes('SALDO_INSUFICIENTE'));

    // 3. Abonar crédito legítimo al jugador (Trade-In de Singles)
    const issueRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: brokePlayerId,
        amountCents: 35000, // $350 MXN
        sourceType: 'SINGLES_TRADE_IN',
        sourceLabel: 'Trade-In de Cartas Sueltas',
      }),
    });
    assert.equal(issueRes.status, 200);

    // 4. Redimir con PIN de Seguridad o PIN Offline 2FA exitosamente
    const successRedeemRes = await fetch(`${baseUrl}/api/pos/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_centro',
        playerUserId: brokePlayerId,
        totalTicketCents: 60000, // Total ticket $600 MXN
        creditToApplyCents: 30000, // Aplicar $300 MXN de crédito
        productCategory: 'SEALED_PRODUCT',
        externalPosTicketRef: 'N/A',
        conceptNotes: 'Redención de crédito en tienda',
        authMethod: 'PIN_OFFLINE_2FA',
        totpPin: '123456',
      }),
    });
    const successData = (await successRedeemRes.json()) as any;
    assert.equal(successRedeemRes.status, 200);
    assert.equal(successData.ok, true);
    assert.equal(successData.voucher.creditAppliedCents, 30000);
    assert.equal(successData.voucher.conceptNotes, 'Redención de crédito en tienda');
    assert.ok(successData.voucher.voucherFolio.startsWith('VCH-'));
  });

  it('3.14 [Catálogo de Categorías por Tienda] Consulta y personaliza categorías por sede y valida que el POS las refleje', async () => {
    // 1. Consultar categorías por defecto de store_centro
    const catGetRes = await fetch(`${baseUrl}/api/stores/categories?storeId=store_centro`);
    assert.equal(catGetRes.status, 200);
    const catGetData = (await catGetRes.json()) as any;
    assert.equal(catGetData.ok, true);
    assert.equal(catGetData.storeId, 'store_centro');
    assert.ok(Array.isArray(catGetData.categories));
    assert.ok(catGetData.categories.length >= 5);
    assert.ok(catGetData.categories.some((c: any) => c.code === 'SEALED_PRODUCT'));

    // 2. Personalizar agregando una categoría nueva (ej. BOARD_GAMES) y deshabilitando SNACKS_DRINKS
    const updatedCats = [
      ...catGetData.categories.map((c: any) =>
        c.code === 'SNACKS_DRINKS' ? { ...c, isEnabled: false } : c
      ),
      {
        code: 'BOARD_GAMES',
        name: 'Juegos de Mesa y Wargames',
        description: 'Warhammer, D&D, Catan, Codenames',
        isEnabled: true,
      },
    ];

    const catPostRes = await fetch(`${baseUrl}/api/stores/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_centro',
        categories: updatedCats,
      }),
    });
    assert.equal(catPostRes.status, 200);
    const catPostData = (await catPostRes.json()) as any;
    assert.equal(catPostData.ok, true);
    assert.ok(catPostData.categories.some((c: any) => c.code === 'BOARD_GAMES' && c.isEnabled === true));
    assert.ok(catPostData.categories.some((c: any) => c.code === 'SNACKS_DRINKS' && c.isEnabled === false));

    // 3. Verificar que /api/state refleje la sucursal con sus categorías actualizadas
    const stateRes = await fetch(`${baseUrl}/api/state`);
    const stateData = (await stateRes.json()) as any;
    const centroStore = stateData.stores.find((s: any) => s.id === 'store_centro');
    assert.ok(centroStore);
    assert.ok(centroStore.productCategories.some((c: any) => c.code === 'BOARD_GAMES'));
  });

  it('3.15 [Torneo Pokémon TOM / RK9] Parsea clasificaciones HTML por categorías (Master, Senior, Junior), calcula pozos por ocupación y enriquece carteras', async () => {
    const toLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0010', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    const { token: toToken } = (await toLoginRes.json()) as any;

    const sampleTomHtml = `
      <html>
      <head><title>Clasificación Final - Pokémon TCG Cup - 2026-05-10</title></head>
      <body>
        <h3>Ronda 3/3</h3>
        <h2>Categoría Master</h2>
        <table>
          <tr><th>#</th><th>Jugador</th><th>Récord</th><th>Puntos</th><th>OMW%</th></tr>
          <tr><td>1</td><td>Alejandro Gómez (CC-8492)</td><td>3/0/0 (9)</td><td>9</td><td>60.00%</td></tr>
          <tr><td>2</td><td>Daniela Ríos</td><td>2/1/0 (6)</td><td>6</td><td>55.00%</td></tr>
          <tr><td>3</td><td>Jugador Nuevo Poké</td><td>1/2/0 (3)</td><td>3</td><td>45.00%</td></tr>
        </table>
        <h2>Categoría Senior</h2>
        <table>
          <tr><th>#</th><th>Jugador</th><th>Récord</th><th>Puntos</th><th>OMW%</th></tr>
          <tr><td>1</td><td>Santiago Niño</td><td>2/0/0 (6)</td><td>6</td><td>50.00%</td></tr>
        </table>
      </body>
      </html>
    `;

    const parseRes = await fetch(`${baseUrl}/api/tournaments/parse-poke-standings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toToken}`,
      },
      body: JSON.stringify({
        htmlContent: sampleTomHtml,
        entryFeeCents: 20_000,
        prizeContributionCents: 15_000,
      }),
    });

    assert.equal(parseRes.status, 200);
    const parseData = (await parseRes.json()) as any;
    assert.equal(parseData.ok, true);
    assert.equal(parseData.standings.tournamentName, 'Pokémon TCG Cup');
    assert.equal(parseData.standings.categories.length, 2);

    const master = parseData.standings.categories.find((c: any) => c.category === 'Master');
    assert.equal(master.occupancy, 3);
    assert.equal(master.calculatedPoolCents, 45_000); // 3 * $150 = $450 MXN
    assert.equal(master.entries[0].matchedWallet.isExisting, true);
    assert.equal(master.entries[0].matchedWallet.memberCode, 'CC-8492');
    assert.equal(master.entries[2].matchedWallet.isExisting, false);

    const senior = parseData.standings.categories.find((c: any) => c.category === 'Senior');
    assert.equal(senior.occupancy, 1);
    assert.equal(senior.calculatedPoolCents, 15_000);
  });

  it('3.16 [Liquidación Oficial Poké] Dispersa premios por categorías con partida doble, auto-registra jugadores nuevos y valida suma cero', async () => {
    const toLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0010', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    const { token: toToken } = (await toLoginRes.json()) as any;

    const disperseRes = await fetch(`${baseUrl}/api/tournaments/disperse-poke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toToken}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        name: 'Pokémon Premier Challenge Sábado',
        gameFormat: 'Pokémon TCG',
        unifyCategoriesPool: false,
        categories: [
          {
            name: 'Master',
            entryFeeCents: 20_000,
            prizeContributionCents: 15_000,
            registeredCount: 4,
            topCutSize: 2,
            applyEqualSplit: false,
            entries: [
              { rank: 1, playerName: 'Alejandro Gómez' },
              { rank: 2, playerName: 'Valeria Campeona Nueva' },
            ],
          },
          {
            name: 'Senior',
            entryFeeCents: 20_000,
            prizeContributionCents: 15_000,
            registeredCount: 2,
            topCutSize: 1,
            applyEqualSplit: false,
            entries: [
              { rank: 1, playerName: 'Mateo Senior Nuevo' },
            ],
          },
        ],
      }),
    });

    assert.equal(disperseRes.status, 200);
    const data = (await disperseRes.json()) as any;
    assert.equal(data.ok, true);
    assert.equal(data.tournament.status, 'DISPERSED_COMPLETED');
    assert.equal(data.totalDispersedCents, 90_000);
    assert.equal(data.standings.length, 3);

    // Verificar que los jugadores nuevos fueron auto-registrados y tienen crédito activo
    const stateRes = await fetch(`${baseUrl}/api/state`);
    const stateData = (await stateRes.json()) as any;
    const valeria = stateData.players.find((p: any) => p.fullName === 'Valeria Campeona Nueva');
    assert.ok(valeria, 'Valeria debe haber sido auto-registrada en el padrón');
    assert.equal(valeria.availableBalanceCents, 21_000);

    const mateo = stateData.players.find((p: any) => p.fullName === 'Mateo Senior Nuevo');
    assert.ok(mateo, 'Mateo debe haber sido auto-registrado en el padrón');
    assert.equal(mateo.availableBalanceCents, 30_000);

    // Verificar salud contable
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = (await healthRes.json()) as any;
    assert.equal(healthData.integrity.ledgerBalanced, true);
  });

  it('3.17 [Calculadora Rápida Multi-Juego] Calcula pozo por ocupación y costo para otros juegos (MTG, YGO, One Piece, Lorcana) y dispersa a Top Cut con Split', async () => {
    const toLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0010', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    const { token: toToken } = (await toLoginRes.json()) as any;

    // 1. Simulación rápida de pozo para torneo de One Piece de 12 jugadores
    const previewRes = await fetch(`${baseUrl}/api/tournaments/quick-calc-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toToken}`,
      },
      body: JSON.stringify({
        totalPlayers: 12,
        entryFeeCents: 20_000, // $200 MXN
        prizeContributionCents: 15_000, // $150 MXN al pozo
        topCutSize: 4,
        applyTopCutSplit: true, // Split parejo en Top 4
      }),
    });

    assert.equal(previewRes.status, 200);
    const prevData = (await previewRes.json()) as any;
    assert.equal(prevData.ok, true);
    // 12 jug * $150 MXN = $1,800 MXN (180,000 cents)
    assert.equal(prevData.calculation.calculatedPoolCents, 180_000);
    assert.equal(prevData.calculation.storeMarginCents, 60_000); // 12 * 50 = $600 MXN margen tienda
    assert.equal(prevData.calculation.payoutBreakdown.length, 4);
    assert.equal(prevData.calculation.payoutBreakdown[0].awardedCents, 45_000);
    assert.equal(prevData.calculation.payoutBreakdown[3].awardedCents, 45_000);

    // 2. Liquidación rápida multi-juego
    const quickDisperseRes = await fetch(`${baseUrl}/api/tournaments/quick-calc-disperse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toToken}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        name: 'Flagship Battle One Piece',
        gameFormat: 'One Piece TCG',
        totalPlayers: 12,
        entryFeeCents: 20_000,
        prizeContributionCents: 15_000,
        topCutSize: 4,
        applyTopCutSplit: true,
        winners: [
          { position: 1, playerName: 'Luffy Jugador' },
          { position: 2, playerName: 'Zoro Competidor' },
          { position: 3, playerName: 'Nami Pirata' },
          { position: 4, playerName: 'Sanji Chef' },
        ],
      }),
    });

    assert.equal(quickDisperseRes.status, 200);
    const disperseData = (await quickDisperseRes.json()) as any;
    assert.equal(disperseData.ok, true);
    assert.equal(disperseData.totalDispersedCents, 180_000);
    assert.equal(disperseData.standings.length, 4);

    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = (await healthRes.json()) as any;
    assert.equal(healthData.integrity.ledgerBalanced, true);
  });

  it('3.18 [Catálogo de Orígenes Contables de Crédito por Tienda] Consulta y personaliza orígenes contables vía API HTTP con RBAC y auditoría', async () => {
    // 1. Obtener token de SUPER_ADMIN
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0002', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    const { token: adminToken } = (await adminLoginRes.json()) as any;

    // 2. Consulta inicial de orígenes de la tienda store_centro
    const getSourcesRes = await fetch(`${baseUrl}/api/stores/credit-sources?storeId=store_centro`);
    assert.equal(getSourcesRes.status, 200);
    const getSourcesData = (await getSourcesRes.json()) as any;
    assert.equal(getSourcesData.ok, true);
    assert.ok(getSourcesData.creditSources.length >= 7);

    // 3. Cajero intenta actualizar orígenes -> Debe ser rechazado (403/Error)
    const cashierLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0100', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    const { token: cashierToken } = (await cashierLoginRes.json()) as any;

    const failUpdateRes = await fetch(`${baseUrl}/api/stores/credit-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        creditSources: [{ code: 'HACK', name: 'Ilegal', isEnabled: true }],
      }),
    });
    assert.notEqual(failUpdateRes.status, 200, 'Un cajero no debe poder personalizar orígenes contables');

    // 4. SUPER_ADMIN personaliza los orígenes de la sucursal
    const updateSourcesRes = await fetch(`${baseUrl}/api/stores/credit-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        creditSources: [
          {
            code: 'SINGLES_TRADE_IN',
            name: 'Compra de Cartas Sueltas (Singles Trade-In)',
            description: 'Inventario de singles',
            defaultAccountCode: '1105',
            defaultExpiryDays: 180,
            isEnabled: true,
          },
          {
            code: 'DISCORD_COMMUNITY_PRIZE',
            name: 'Premio Dinámica Discord Semanal',
            description: 'Bonos de actividad para miembros del servidor Discord',
            defaultAccountCode: '5102',
            defaultExpiryDays: 90,
            isEnabled: true,
          },
        ],
      }),
    });
    assert.equal(updateSourcesRes.status, 200);
    const updateSourcesData = (await updateSourcesRes.json()) as any;
    assert.equal(updateSourcesData.ok, true);
    assert.equal(updateSourcesData.creditSources.length, 2);
    assert.equal(updateSourcesData.creditSources[1].code, 'DISCORD_COMMUNITY_PRIZE');

    // 5. Validar que /api/state ahora exponga los orígenes actualizados
    const stateRes = await fetch(`${baseUrl}/api/state`);
    const stateData = (await stateRes.json()) as any;
    const centroStore = stateData.stores.find((s: any) => s.id === 'store_centro');
    assert.equal(centroStore.creditSources.length, 2);
  });

  it('3.19 [Personalización de Premiación por Categoría y Multi-Juego] Soporta pozo customizado, número de ganadores libre y porcentajes por posición', async () => {
    const toLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0010', secret: 'krona2026', mode: 'PASSWORD' }),
    });
    const { token: toToken } = (await toLoginRes.json()) as any;

    // 1. Torneo Pokémon con pozo personalizado por categoría y porcentajes custom
    const pokeDisperseRes = await fetch(`${baseUrl}/api/tournaments/disperse-poke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toToken}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        name: 'Pokémon League Cup Personalizado',
        gameFormat: 'Pokémon TCG',
        unifyCategoriesPool: false,
        categories: [
          {
            name: 'Master',
            entryFeeCents: 20_000,
            prizeContributionCents: 10_000,
            registeredCount: 6,
            customPoolCents: 120_000, // Custom: $1,200 MXN en vez de los $600 naturales
            topCutSize: 3, // Custom Top 3
            customPercentagesBps: [5000, 3000, 2000], // 50%, 30%, 20%
            entries: [
              { rank: 1, playerName: 'Campeón Master Custom' },
              { rank: 2, playerName: 'Subcampeón Master Custom' },
              { rank: 3, playerName: 'Tercero Master Custom' },
            ],
          },
          {
            name: 'Junior',
            entryFeeCents: 20_000,
            prizeContributionCents: 10_000,
            registeredCount: 2,
            customPoolCents: 40_000, // Custom: $400 MXN
            topCutSize: 1, // Custom Top 1
            entries: [
              { rank: 1, playerName: 'Campeón Junior Solo' },
            ],
          },
        ],
      }),
    });

    assert.equal(pokeDisperseRes.status, 200);
    const pokeData = (await pokeDisperseRes.json()) as any;
    assert.equal(pokeData.ok, true);
    assert.equal(pokeData.totalDispersedCents, 160_000); // 120,000 + 40,000
    assert.equal(pokeData.standings.length, 4);

    const masterStandings = pokeData.standings.filter((s: any) => s.playerName.includes('Master'));
    assert.equal(masterStandings[0].awardedCents, 60_000); // 50% de 120,000
    assert.equal(masterStandings[1].awardedCents, 36_000); // 30% de 120,000
    assert.equal(masterStandings[2].awardedCents, 24_000); // 20% de 120,000

    const juniorStanding = pokeData.standings.find((s: any) => s.playerName.includes('Junior'));
    assert.equal(juniorStanding.awardedCents, 40_000); // 100% de 40,000

    // 2. Calculadora rápida multi-juego con customPercentagesBps
    const quickPreviewRes = await fetch(`${baseUrl}/api/tournaments/quick-calc-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toToken}`,
      },
      body: JSON.stringify({
        totalPlayers: 10,
        entryFeeCents: 20_000,
        prizeContributionCents: 10_000, // Pool $1,000 MXN (100,000 cents)
        topCutSize: 3,
        customPercentagesBps: [6000, 2500, 1500], // 60%, 25%, 15%
      }),
    });

    assert.equal(quickPreviewRes.status, 200);
    const quickPrevData = (await quickPreviewRes.json()) as any;
    assert.equal(quickPrevData.calculation.effectivePoolCents, 100_000);
    assert.equal(quickPrevData.calculation.payoutBreakdown[0].awardedCents, 60_000);
    assert.equal(quickPrevData.calculation.payoutBreakdown[1].awardedCents, 25_000);
    assert.equal(quickPrevData.calculation.payoutBreakdown[2].awardedCents, 15_000);

    // 3. Dispersión rápida con esquema personalizado
    const quickDisperseRes = await fetch(`${baseUrl}/api/tournaments/quick-calc-disperse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toToken}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        name: 'Torneo Modern Custom Cut',
        gameFormat: 'Magic: The Gathering',
        totalPlayers: 10,
        entryFeeCents: 20_000,
        prizeContributionCents: 10_000,
        topCutSize: 3,
        customPercentagesBps: [6000, 2500, 1500],
        winners: [
          { position: 1, playerName: 'Ganador MTG 1' },
          { position: 2, playerName: 'Ganador MTG 2' },
          { position: 3, playerName: 'Ganador MTG 3' },
        ],
      }),
    });

    assert.equal(quickDisperseRes.status, 200);
    const quickDisperseData = (await quickDisperseRes.json()) as any;
    assert.equal(quickDisperseData.totalDispersedCents, 100_000);
    assert.equal(quickDisperseData.standings[0].awardedCents, 60_000);
    assert.equal(quickDisperseData.standings[1].awardedCents, 25_000);
    assert.equal(quickDisperseData.standings[2].awardedCents, 15_000);

    // 4. Integridad contable Zero-Sum del sistema completo
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = (await healthRes.json()) as any;
    assert.equal(healthData.integrity.ledgerBalanced, true);
  });

  it('3.20 [KRONA Custody™ API E2E] Registro de cartas en resguardo con fotos y comprobante, filtros de inventario, cambio de casillero, RBAC estricto y entrega segura con Four-Eyes', async () => {
    // 1. Obtener tokens de sesión para Cashier, Super Admin y Player
    const cashierLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0020', securityPin: '220020' }), // u_cashier_1
    });
    const cashierToken = ((await cashierLogin.json()) as any).token;

    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0001', securityPin: '110001' }), // u_owner_1
    });
    const adminToken = ((await adminLogin.json()) as any).token;

    const playerLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-8492', securityPin: '123456' }), // u_player_1
    });
    const playerToken = ((await playerLogin.json()) as any).token;

    // 2. Cajero registra un paquete en resguardo
    const createRes = await fetch(`${baseUrl}/api/custody/packages/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        clientUserId: 'u_player_1',
        clientName: 'Rodrigo Takahashi',
        clientPhone: '+52 55 1234 8888',
        purpose: 'GRADING_SUBMISSION',
        vaultLocation: 'Caja Fuerte B - Casillero 07',
        tamperSealNumber: 'SEAL-E2E-777',
        declaredValueCents: 120_000,
        itemsSummary: '1x Charizard Base Set Shadowless PSA candidate',
        dueDate: '2026-12-15',
        items: [
          {
            quantity: 1,
            cardName: 'Charizard Base Set Shadowless',
            setName: 'Base Set',
            condition: 'NM',
            estimatedValueCents: 120_000,
          },
        ],
        photos: [
          {
            photoType: 'SEAL_VIEW',
            caption: 'Precinto inviolable SEAL-E2E-777',
            dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        ],
      }),
    });

    assert.equal(createRes.status, 200);
    const createData = (await createRes.json()) as any;
    assert.equal(createData.ok, true);
    assert.ok(createData.package.id);
    assert.ok(createData.package.folio.startsWith('CUST-'));
    assert.ok(createData.package.claimVerificationCode.startsWith('VC-'));
    assert.ok(createData.claimToken);
    assert.equal(createData.package.status, 'RECEIVED');
    assert.equal(createData.package.photos.length, 1);

    const packageId = createData.package.id;
    const claimCode = createData.package.claimVerificationCode;

    // 3. Consulta de inventario por Player: solo ve sus paquetes
    const playerListRes = await fetch(`${baseUrl}/api/custody/packages`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    assert.equal(playerListRes.status, 200);
    const playerListData = (await playerListRes.json()) as any;
    assert.ok(playerListData.packages.some((p: any) => p.id === packageId));
    assert.ok(playerListData.packages.every((p: any) => p.clientUserId === 'u_player_1'));

    // 4. Detalle individual de paquete
    const detailRes = await fetch(`${baseUrl}/api/custody/packages/${packageId}`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.equal(detailRes.status, 200);
    const detailData = (await detailRes.json()) as any;
    assert.equal(detailData.package.id, packageId);

    // 5. Cajero sube foto de inspección
    const photoRes = await fetch(`${baseUrl}/api/custody/packages/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        packageId,
        photoType: 'CONTENT_VIEW',
        caption: 'Foto de superficie y esquinas',
        dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      }),
    });
    assert.equal(photoRes.status, 200);
    const photoData = (await photoRes.json()) as any;
    assert.equal(photoData.package.photos.length, 2);

    // 6. Actualización de casillero y estado a READY_FOR_PICKUP
    const locRes = await fetch(`${baseUrl}/api/custody/packages/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        packageId,
        vaultLocation: 'Caja Fuerte A - Casillero 01',
        newStatus: 'READY_FOR_PICKUP',
        reason: 'Regresó de PSA calificada',
      }),
    });
    assert.equal(locRes.status, 200);
    const locData = (await locRes.json()) as any;
    assert.equal(locData.package.status, 'READY_FOR_PICKUP');
    assert.equal(locData.package.vaultLocation, 'Caja Fuerte A - Casillero 01');

    // 7. RBAC: Cajero no puede cancelar
    const cancelFailRes = await fetch(`${baseUrl}/api/custody/packages/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ packageId, reasonJustification: 'Intento indebido' }),
    });
    assert.equal(cancelFailRes.status, 403);

    // 8. Entrega con comprobante inválido: rechazado
    const releaseFailRes = await fetch(`${baseUrl}/api/custody/packages/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        packageId,
        claimVerificationCode: 'VC-WRONG-CODE',
      }),
    });
    assert.equal(releaseFailRes.status, 400);

    // 9. Entrega exitosa con comprobante válido
    const releaseRes = await fetch(`${baseUrl}/api/custody/packages/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        packageId,
        claimVerificationCode: claimCode,
        clientSignatureProof: 'FIRMA_RECIBO_E2E',
      }),
    });
    assert.equal(releaseRes.status, 200);
    const releaseData = (await releaseRes.json()) as any;
    assert.equal(releaseData.package.status, 'RELEASED');
    assert.ok(releaseData.package.releasedAt);

    // 10. Salud e integridad general intacta
    const finalHealthRes = await fetch(`${baseUrl}/api/health`);
    const finalHealth = (await finalHealthRes.json()) as any;
    assert.equal(finalHealth.integrity.ledgerBalanced, true);
    assert.equal(finalHealth.integrity.auditChainIntact, true);
  });

  it('3.21 [KRONA Custody™ Catálogos Dinámicos & Intake Ligero] Administra modalidades y tipos de evidencia, y registra paquete simplificado', async () => {
    // 1. Obtener token de SUPER_ADMIN y CASHIER
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0002', securityPin: '990022' }),
    });
    const { token: adminToken } = (await adminLoginRes.json()) as any;

    const cashierLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0020', securityPin: '220020' }),
    });
    const { token: cashierToken } = (await cashierLoginRes.json()) as any;

    // 2. Consultar catálogos por defecto
    const getPurposesRes = await fetch(`${baseUrl}/api/custody/catalog/purposes`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.equal(getPurposesRes.status, 200);
    const purposesData = (await getPurposesRes.json()) as any;
    assert.ok(Array.isArray(purposesData.purposes));
    assert.ok(purposesData.purposes.some((p: any) => p.id === 'GRADING_SUBMISSION'));

    const getEvidenceRes = await fetch(`${baseUrl}/api/custody/catalog/evidence-types`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.equal(getEvidenceRes.status, 200);
    const evidenceData = (await getEvidenceRes.json()) as any;
    assert.ok(Array.isArray(evidenceData.evidenceTypes));
    assert.ok(evidenceData.evidenceTypes.some((e: any) => e.id === 'PACKAGE_FRONT'));

    // 3. SUPER_ADMIN actualiza catálogo de modalidades agregando una personalizada
    const newPurposes = [
      ...purposesData.purposes,
      {
        id: 'CUSTOM_VAULT_MODALITY',
        label: 'Resguardo Especial Torneo Anual',
        description: 'Custodia especial para decks de campeonato anual',
        active: true,
      },
    ];
    const updatePurposesRes = await fetch(`${baseUrl}/api/custody/catalog/purposes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ purposes: newPurposes }),
    });
    assert.equal(updatePurposesRes.status, 200);
    const updatePurposesData = (await updatePurposesRes.json()) as any;
    assert.equal(updatePurposesData.ok, true);
    assert.ok(updatePurposesData.purposes.some((p: any) => p.id === 'CUSTOM_VAULT_MODALITY'));

    // 4. SUPER_ADMIN actualiza catálogo de tipos de evidencia
    const newEvidence = [
      ...evidenceData.evidenceTypes,
      {
        id: 'SPECIAL_SLEEVE_VIEW',
        label: 'Vista de Mica / Toploader Especial',
        description: 'Foto detallada de la mica protectora',
        active: true,
      },
    ];
    const updateEvidenceRes = await fetch(`${baseUrl}/api/custody/catalog/evidence-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ evidenceTypes: newEvidence }),
    });
    assert.equal(updateEvidenceRes.status, 200);
    const updateEvidenceData = (await updateEvidenceRes.json()) as any;
    assert.equal(updateEvidenceData.ok, true);
    assert.ok(updateEvidenceData.evidenceTypes.some((e: any) => e.id === 'SPECIAL_SLEEVE_VIEW'));

    // 5. Cajero no tiene permiso para modificar catálogos (RBAC)
    const cashierFailRes = await fetch(`${baseUrl}/api/custody/catalog/purposes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ purposes: newPurposes }),
    });
    assert.equal(cashierFailRes.status, 403);

    // 6. Registro de paquete con intake simplificado (sin precinto, sin valor declarado, sin fecha límite, cartas solo con cant y nombre)
    const intakeRes = await fetch(`${baseUrl}/api/custody/packages/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        clientName: 'Daniel Soto',
        clientPhone: '+52 55 9999 0000',
        purpose: 'CUSTOM_VAULT_MODALITY',
        vaultLocation: 'Casillero 15',
        itemsSummary: 'Deck Modern competitivo',
        items: [
          { quantity: 4, cardName: 'Ragavan, Nimble Pilferer' },
          { quantity: 4, cardName: 'Lightning Bolt' },
        ],
        photos: [
          {
            photoType: 'SPECIAL_SLEEVE_VIEW',
            caption: 'Micas Dragon Shield selladas',
            dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          },
        ],
      }),
    });
    assert.equal(intakeRes.status, 200);
    const intakeData = (await intakeRes.json()) as any;
    assert.equal(intakeData.ok, true);
    assert.ok(intakeData.package.folio.startsWith('CUST-'));
    assert.equal(intakeData.package.purpose, 'CUSTOM_VAULT_MODALITY');
    assert.equal(intakeData.package.tamperSealNumber, 'N/A');
    assert.equal(intakeData.package.declaredValueCents, 0);
    assert.equal(intakeData.package.items.length, 2);
    assert.equal(intakeData.package.items[0].cardName, 'Ragavan, Nimble Pilferer');
    assert.equal(intakeData.package.items[0].quantity, 4);
    assert.equal(intakeData.package.photos[0].photoType, 'SPECIAL_SLEEVE_VIEW');
  });

  it('3.22 [Seguridad HTTP & Cabeceras Defensivas] Valida cabeceras X-Frame-Options, X-Content-Type-Options y mitigación estricta de Path Traversal', async () => {
    // 1. Verificar cabeceras de seguridad en rutas estáticas y HTML
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    assert.equal(htmlRes.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(htmlRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(htmlRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');

    // 2. Verificar cabeceras de seguridad en respuestas API JSON
    const apiRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(apiRes.status, 200);
    assert.equal(apiRes.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(apiRes.headers.get('x-content-type-options'), 'nosniff');

    // 3. Mitigación estricta de Directory Traversal fuera de /public
    const traversalRes = await fetch(`${baseUrl}/styles/../../package.json`);
    assert.ok([403, 404].includes(traversalRes.status));

    // 4. Ruta desconocida retorna 404
    const notFoundRes = await fetch(`${baseUrl}/api/non-existent-route-9999`);
    assert.equal(notFoundRes.status, 404);
  });

  it('3.23 [Aislamiento RBAC Estricto & Restricción de Conmutador] Impide a CASHIER, PLAYER y AUDITOR ejecutar operaciones de administración o invocar demo-switch', async () => {
    // 1. Obtener sesión legítima de CASHIER
    const cashierLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0020', mode: 'PASSWORD', secret: 'krona2026' }),
    });
    const cashierAuth = (await cashierLogin.json()) as any;
    assert.equal(cashierAuth.user.role, 'CASHIER');

    // 2. CASHIER intenta crear una nueva sucursal (exclusivo de SUPER_ADMIN) -> Rechazado con 403
    const forbiddenStoreRes = await fetch(`${baseUrl}/api/stores/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierAuth.token}`,
      },
      body: JSON.stringify({
        name: 'Sucursal Ilegal Cashier',
        code: 'ILEGAL',
        voucherPrefix: 'ILG',
        fiscalAddress: 'Calle Falsa 123',
      }),
    });
    assert.equal(forbiddenStoreRes.status, 403);
    const forbiddenStoreData = (await forbiddenStoreRes.json()) as any;
    assert.match(forbiddenStoreData.error, /PERMISO_DENEGADO_RBAC/);

    // 3. CASHIER intenta usar /api/auth/demo-switch (restringido a SUPER_ADMIN) -> Rechazado con 403
    const forbiddenSwitchRes = await fetch(`${baseUrl}/api/auth/demo-switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierAuth.token}`,
      },
      body: JSON.stringify({ userId: 'u_admin_2' }),
    });
    assert.equal(forbiddenSwitchRes.status, 403);
    const forbiddenSwitchData = (await forbiddenSwitchRes.json()) as any;
    assert.match(forbiddenSwitchData.error, /PERMISO_DENEGADO_RBAC/);

    // 4. PLAYER intenta emitir crédito o ejecutar redención POS directamente -> Rechazado con 403
    const playerLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-8492', mode: 'PASSWORD', secret: 'krona2026' }),
    });
    const playerAuth = (await playerLogin.json()) as any;
    assert.equal(playerAuth.user.role, 'PLAYER');

    const forbiddenRedeemRes = await fetch(`${baseUrl}/api/pos/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        playerUserId: 'u_player_1',
        totalTicketCents: 10_000,
        creditToApplyCents: 5_000,
      }),
    });
    assert.equal(forbiddenRedeemRes.status, 403);
  });

  it('3.24 [Custodia Cuatro-Ojos: Prevención de Auto-Entrega y Validación de Testigo] Rechaza liberación con PIN incorrecto o cuando el testigo es el mismo actor', async () => {
    // 1. Iniciar sesión como SUPER_ADMIN para operar el paquete
    const superAdminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0002', mode: 'PASSWORD', secret: 'krona2026' }),
    });
    const saAuth = (await superAdminLogin.json()) as any;

    // 2. Registrar paquete de custodia de alto valor ($25,000 MXN) que exige Four-Eyes
    const createPkgRes = await fetch(`${baseUrl}/api/custody/packages/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        clientUserId: 'u_player_1',
        purpose: 'GRADING_SUBMISSION',
        vaultLocation: 'Bóveda Diamante C-99',
        tamperSealNumber: 'SEAL-SEC-991',
        declaredValueCents: 2_500_000,
        itemsSummary: '1x Black Lotus Unlimited NM',
        items: [{ game: 'MTG', cardName: 'Black Lotus', condition: 'NM', quantity: 1, declaredItemValueCents: 2_500_000 }],
        photos: [
          {
            photoType: 'TAMPER_SEAL_CLOSEUP',
            caption: 'Precinto holográfico',
            dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          },
        ],
      }),
    });
    assert.equal(createPkgRes.status, 200);
    const pkgData = (await createPkgRes.json()) as any;
    const pkgId = pkgData.package.id;
    const claimCode = pkgData.package.claimVerificationCode;

    // 3. Intento de auto-liberación (mismo actor como testigo) -> Rechazado por conflicto Four-Eyes
    const selfReleaseRes = await fetch(`${baseUrl}/api/custody/packages/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saAuth.token}`,
      },
      body: JSON.stringify({
        packageId: pkgId,
        claimVerificationCode: claimCode,
        coAuthorizerId: saAuth.user.userId,
        supervisorPin: '990022',
      }),
    });
    assert.equal(selfReleaseRes.status, 400);
    const selfReleaseData = (await selfReleaseRes.json()) as any;
    assert.match(selfReleaseData.error, /CONFLICTO_FOUR_EYES/);

    // 4. Intento de liberación con testigo legítimo pero PIN incorrecto -> Rechazado
    const wrongPinRes = await fetch(`${baseUrl}/api/custody/packages/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saAuth.token}`,
      },
      body: JSON.stringify({
        packageId: pkgId,
        claimVerificationCode: claimCode,
        coAuthorizerId: 'u_admin_1',
        supervisorPin: '000000',
      }),
    });
    assert.equal(wrongPinRes.status, 400);
    const wrongPinData = (await wrongPinRes.json()) as any;
    assert.match(wrongPinData.error, /PIN_SUPERVISOR_INCORRECTO/);

    // 5. Liberación exitosa con Four-Eyes verificado
    const validReleaseRes = await fetch(`${baseUrl}/api/custody/packages/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saAuth.token}`,
      },
      body: JSON.stringify({
        packageId: pkgId,
        claimVerificationCode: claimCode,
        coAuthorizerId: 'u_admin_1',
        supervisorPin: '990011',
      }),
    });
    assert.equal(validReleaseRes.status, 200);
    const validReleaseData = (await validReleaseRes.json()) as any;
    assert.equal(validReleaseData.package.status, 'RELEASED');

    // 6. Intento de doble liberación del mismo paquete -> Rechazado
    const doubleReleaseRes = await fetch(`${baseUrl}/api/custody/packages/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saAuth.token}`,
      },
      body: JSON.stringify({
        packageId: pkgId,
        claimVerificationCode: claimCode,
        coAuthorizerId: 'u_admin_1',
        supervisorPin: '990011',
      }),
    });
    assert.equal(doubleReleaseRes.status, 400);
    const doubleReleaseData = (await doubleReleaseRes.json()) as any;
    assert.match(doubleReleaseData.error, /PAQUETE_YA_ENTREGADO/);
  });

  it('3.25 [Validación de Entrada y Dominio Contable en Trade-In] Rechaza importes negativos o nulos y valida orígenes contables', async () => {
    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0010', mode: 'PASSWORD', secret: 'krona2026' }),
    });
    const adminAuth = (await adminLogin.json()) as any;

    // 1. Importe 0 en Trade-In -> Rechazado con 400
    const zeroAmountRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: 'u_player_1',
        amountCents: 0,
        sourceType: 'SINGLES_TRADE_IN',
        sourceLabel: 'Trade-in prueba',
      }),
    });
    assert.equal(zeroAmountRes.status, 400);
    const zeroData = (await zeroAmountRes.json()) as any;
    assert.match(zeroData.error, /MONTO_INVALIDO/);

    // 2. Importe negativo -> Rechazado con 400
    const negativeRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: 'u_player_1',
        amountCents: -5000,
        sourceType: 'SINGLES_TRADE_IN',
        sourceLabel: 'Trade-in prueba negativo',
      }),
    });
    assert.equal(negativeRes.status, 400);
    const negData = (await negativeRes.json()) as any;
    assert.match(negData.error, /MONTO_INVALIDO/);
  });

  it('3.26 [Políticas de Bóveda & Umbrales 4-Ojos y Emisión] Configura umbrales dinámicos, valida límites mínimos/máximos de emisión y precedencia FEFO de categorías en POS', async () => {
    // 1. Iniciar sesión como SUPER_ADMIN
    const saLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0002', mode: 'PASSWORD', secret: 'krona2026' }),
    });
    const saAuth = (await saLogin.json()) as any;

    // 2. Configurar umbrales dinámicos en /api/admin/policies
    const policyRes = await fetch(`${baseUrl}/api/admin/policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saAuth.token}`,
      },
      body: JSON.stringify({
        requireFourEyesThresholdCents: 50_000, // $500 MXN
        minSingleIssuanceCents: 500,           // $5.00 MXN
        maxSingleIssuanceCents: 1_000_000,     // $10,000 MXN
        reason: 'Ajuste de prueba para umbrales de bóveda',
      }),
    });
    assert.equal(policyRes.status, 200);
    const policyData = (await policyRes.json()) as any;
    assert.equal(policyData.ok, true);
    assert.equal(policyData.org.requireFourEyesThresholdCents, 50_000);
    assert.equal(policyData.org.minSingleIssuanceCents, 500);
    assert.equal(policyData.org.maxSingleIssuanceCents, 1_000_000);

    // 3. Crear un jugador exclusivo para esta prueba
    const playerRes = await fetch(`${baseUrl}/api/players/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Jugador Prueba FEFO', alias: '@FefoPlayer', storeId: 'store_centro' }),
    });
    const { player: fefoUser } = (await playerRes.json()) as any;

    // 4. Intentar emitir crédito menor al mínimo ($2.00 MXN = 200 cents) -> Rechazado
    const belowMinRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: fefoUser.userId,
        amountCents: 200,
        sourceType: 'SINGLES_TRADE_IN',
        sourceLabel: 'Trade-in menor al mínimo',
      }),
    });
    assert.equal(belowMinRes.status, 400);
    const belowMinData = (await belowMinRes.json()) as any;
    assert.match(belowMinData.error, /MONTO_MENOR_AL_MINIMO/);

    // 5. Intentar emitir crédito mayor al máximo ($15,000 MXN = 1,500,000 cents) -> Rechazado
    const aboveMaxRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: fefoUser.userId,
        amountCents: 1_500_000,
        sourceType: 'SINGLES_TRADE_IN',
        sourceLabel: 'Trade-in mayor al máximo',
      }),
    });
    assert.equal(aboveMaxRes.status, 400);
    const aboveMaxData = (await aboveMaxRes.json()) as any;
    assert.match(aboveMaxData.error, /MONTO_SUPERA_MAXIMO/);

    // 6. Iniciar sesión como Cajero (o Juez) para probar Four-Eyes en monto que supera el umbral ($600 MXN >= $500 MXN)
    const cashierLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0010', mode: 'PASSWORD', secret: 'krona2026' }),
    });
    const toAuth = (await cashierLogin.json()) as any;

    const noSupervisorRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: fefoUser.userId,
        amountCents: 60_000, // $600 MXN > $500 MXN
        sourceType: 'SINGLES_TRADE_IN',
        sourceLabel: 'Trade-in alto sin segundo supervisor',
      }),
    });
    assert.equal(noSupervisorRes.status, 400);
    const noSupData = (await noSupervisorRes.json()) as any;
    assert.match(noSupData.error, /REQUIERE_AUTORIZACION_2_PASOS_GERENCIAL|Four-Eyes/);

    // 7. Emitir con segundo supervisor pero sin PIN -> Rechazo (VULN-01 Mitigada)
    const withoutPinRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: fefoUser.userId,
        amountCents: 60_000,
        sourceType: 'SINGLES_TRADE_IN',
        sourceLabel: 'Trade-in alto con co-autorizador sin PIN',
        coAuthorizerUserId: 'u_admin_1',
      }),
    });
    assert.equal(withoutPinRes.status, 400);
    const withoutPinData = (await withoutPinRes.json()) as any;
    assert.match(withoutPinData.error, /PIN_SUPERVISOR_REQUERIDO/);

    // 8. Emitir con segundo supervisor co-autorizador y su PIN 2FA válido -> Éxito
    const withSupervisorRes = await fetch(`${baseUrl}/api/credit/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toAuth.token}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        targetUserId: fefoUser.userId,
        amountCents: 60_000,
        sourceType: 'SINGLES_TRADE_IN',
        sourceLabel: 'Trade-in alto con co-autorizador',
        coAuthorizerUserId: 'u_admin_1',
        coAuthorizerPin: '990011',
      }),
    });
    assert.equal(withSupervisorRes.status, 200);
  });

  it('3.27 [KRONA Custody™ API E2E] Flujo de Resguardo a Nombre de Otra Persona (Quién Deja vs Quién Recibe / Escrow P2P)', async () => {
    // 1. Iniciar sesión como Cajero
    const cashierLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'CC-0020', securityPin: '220020' }),
    });
    assert.equal(cashierLogin.status, 200);
    const { token: cashierToken } = (await cashierLogin.json()) as any;

    // 2. Registrar resguardo bilateral donde un jugador deja cartas para otro
    const intakeRes = await fetch(`${baseUrl}/api/custody/packages/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        storeId: 'store_centro',
        depositorName: 'Fernando Torres (Remitente)',
        depositorPhone: '+52 55 7777 8888',
        recipientName: 'Mateo González (Destinatario)',
        recipientPhone: '+52 55 3333 2222',
        isForThirdParty: true,
        purpose: 'CONSIGNMENT_ESCROW',
        vaultLocation: 'Caja Fuerte A - Casillero 20',
        itemsSummary: 'Mox Diamond (Stronghold)',
        items: [
          {
            quantity: 1,
            cardName: 'Mox Diamond',
            condition: 'NM',
            setName: 'Stronghold',
          },
        ],
      }),
    });

    assert.equal(intakeRes.status, 200);
    const intakeData = (await intakeRes.json()) as any;
    assert.equal(intakeData.ok, true);
    assert.equal(intakeData.package.isForThirdParty, true);
    assert.equal(intakeData.package.depositorName, 'Fernando Torres (Remitente)');
    assert.equal(intakeData.package.recipientName, 'Mateo González (Destinatario)');
    assert.equal(intakeData.package.clientName, 'Mateo González (Destinatario)');
    const packageId = intakeData.package.id;
    const claimCode = intakeData.package.claimVerificationCode;

    // 3. Buscar paquete por nombre de quien deja y por nombre de quien recibe
    const searchDep = await fetch(`${baseUrl}/api/custody/packages?search=Fernando`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    const searchDepData = (await searchDep.json()) as any;
    assert.ok(searchDepData.packages.some((p: any) => p.id === packageId));

    const searchRec = await fetch(`${baseUrl}/api/custody/packages?search=Mateo`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    const searchRecData = (await searchRec.json()) as any;
    assert.ok(searchRecData.packages.some((p: any) => p.id === packageId));

    // 4. Liberación registrando el nombre de la persona que retira físicamente
    const releaseRes = await fetch(`${baseUrl}/api/custody/packages/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        packageId,
        claimVerificationCode: claimCode,
        pickedUpByName: 'Mateo González',
        pickedUpByRole: 'DESTINATARIO_TITULAR',
      }),
    });

    assert.equal(releaseRes.status, 200);
    const releaseData = (await releaseRes.json()) as any;
    assert.equal(releaseData.ok, true);
    assert.equal(releaseData.package.status, 'RELEASED');
    assert.equal(releaseData.package.pickedUpByName, 'Mateo González');
    assert.equal(releaseData.package.pickedUpByRole, 'DESTINATARIO_TITULAR');
  });

  it('3.28 [Seguridad Defensiva HTTP] Rechaza redenciones POS sin prueba de cliente y exige PIN en co-autorizaciones Four-Eyes', async () => {
    // 1. Intentar cobro en mostrador sin enviar prueba de cliente
    const noProofRes = await fetch(`${baseUrl}/api/pos/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_centro',
        playerUserId: 'u_player_1',
        totalTicketCents: 20000,
        creditToApplyCents: 10000,
      }),
    });
    assert.equal(noProofRes.status, 400);
    const noProofData = (await noProofRes.json()) as any;
    assert.match(noProofData.error, /PRUEBA_AUTH_JUGADOR_REQUERIDA/);

    // 2. Intentar co-autorización Four-Eyes auto-asignándose al mismo actor -> CONFLICTO_FOUR_EYES
    const selfCoAuthRes = await fetch(`${baseUrl}/api/admin/merge-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceUserId: 'u_player_1',
        targetUserId: 'u_player_2',
        coAuthorizerId: 'u_admin_1', // Mismo actor
        coAuthorizerPin: '990011',
      }),
    });
    assert.equal(selfCoAuthRes.status, 400);
    const selfCoAuthData = (await selfCoAuthRes.json()) as any;
    assert.match(selfCoAuthData.error, /CONFLICTO_FOUR_EYES/);

    // 3. Intentar co-autorización Four-Eyes con supervisor distinto pero sin PIN -> PIN_SUPERVISOR_REQUERIDO
    const mergeFailRes = await fetch(`${baseUrl}/api/admin/merge-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceUserId: 'u_player_1',
        targetUserId: 'u_player_2',
        coAuthorizerId: 'u_admin_2', // Distinto supervisor
        // coAuthorizerPin omitido
      }),
    });
    assert.equal(mergeFailRes.status, 400);
    const mergeFailData = (await mergeFailRes.json()) as any;
    assert.match(mergeFailData.error, /PIN_SUPERVISOR_REQUERIDO/);
  });

  after(() => {
    server.close();
  });
});

