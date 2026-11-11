/**
 * KRONA VAULT™ (controlCredito) — Cloudflare Workers + Cloudflare D1 + Static Assets Entrypoint
 * Compatible con Cloudflare Workers Free Tier ($0 USD/mes):
 * - nodejs_compat habilitado para @control-credito/crypto-totp (node:crypto)
 * - Persistencia transaccional automática en Cloudflare D1 (tabla vault_state)
 * - Archivos estáticos de los 11 portales servidos desde env.ASSETS
 */

import {
  ControlCreditoEngine,
  ROLE_DEFINITION_MATRIX,
  type EngineStateSnapshot,
  type PlayerWalletState,
} from './ledger-engine.ts';
import {
  createDynamicQrToken,
  generatePlayerTotpPin,
} from '../../../packages/crypto-totp/src/index.ts';
import type {
  UserRoleType,
  TournamentPrizeStanding,
  CustodyPhotoType,
  CustodyStatus,
} from '../../../packages/shared-types/src/index.ts';
import {
  parsePokemonStandingsHTML,
  calculateTopCutPrizeDistribution,
  calculateQuickMultiGamePool,
} from './pokemon-standings-parser.ts';

export interface CloudflareWorkerEnv {
  DB?: {
    prepare(query: string): {
      bind(...values: unknown[]): {
        first<T = Record<string, unknown>>(): Promise<T | null>;
        run(): Promise<unknown>;
      };
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
  HSM_SECRET?: string;
}

let memoryEngineFallback: ControlCreditoEngine | null = null;

function sanitizeUser(u: PlayerWalletState) {
  return {
    walletId: u.walletId,
    userId: u.userId,
    memberCode: u.memberCode,
    fullName: u.fullName,
    alias: u.alias,
    email: u.email,
    phone: u.phone,
    role: u.role,
    assignedStoreId: u.assignedStoreId,
    hasSecurityPin: Boolean(u.securityPinHash),
    hasAuthenticator: Boolean(u.authenticatorSecret && u.authenticatorSyncedAt),
    authenticatorSyncedAt: u.authenticatorSyncedAt || null,
    availableBalanceCents: u.availableBalanceCents,
    escrowPreorderCents: u.escrowPreorderCents,
    debtBalanceCents: u.debtBalanceCents,
    status: u.status,
    mergedIntoUserId: u.mergedIntoUserId,
    createdAt: u.createdAt,
    createdByUserId: u.createdByUserId,
    lastLoginAt: u.lastLoginAt,
    lots: u.lots,
  };
}

async function loadEngineFromD1(env: CloudflareWorkerEnv): Promise<ControlCreditoEngine> {
  const secret = env.HSM_SECRET || 'prod_hsm_secret_control_credito_2026';

  if (!env.DB) {
    if (!memoryEngineFallback) {
      memoryEngineFallback = new ControlCreditoEngine(secret);
      memoryEngineFallback.resetToCleanSingleUser();
    }
    return memoryEngineFallback;
  }

  const engine = new ControlCreditoEngine(secret);
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS vault_state (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)'
  ).run();

  const row = await env.DB.prepare('SELECT payload FROM vault_state WHERE id = ?')
    .bind('main')
    .first<{ payload: string }>();

  if (row && row.payload) {
    const parsed = JSON.parse(row.payload) as EngineStateSnapshot;
    engine.importSnapshot(parsed);
  } else {
    engine.resetToCleanSingleUser();
    const initialSnapshot = engine.exportSnapshot();
    await env.DB.prepare(
      'INSERT OR REPLACE INTO vault_state (id, payload, updated_at) VALUES (?, ?, ?)'
    )
      .bind('main', JSON.stringify(initialSnapshot), initialSnapshot.updatedAt)
      .run();
  }

  return engine;
}

async function saveEngineToD1(
  env: CloudflareWorkerEnv,
  engine: ControlCreditoEngine
): Promise<void> {
  if (!env.DB) return;
  const snapshot = engine.exportSnapshot();
  await env.DB.prepare(
    'INSERT OR REPLACE INTO vault_state (id, payload, updated_at) VALUES (?, ?, ?)'
  )
    .bind('main', JSON.stringify(snapshot), snapshot.updatedAt)
    .run();
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function resolveSessionActor(
  request: Request,
  engine: ControlCreditoEngine,
  fallbackUserId: string = 'u_owner_1',
  allowedRoles?: UserRoleType[]
): { actor: PlayerWalletState; isExplicitSession: boolean; sid?: string } {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim();
    const verified = engine.verifyActiveSession(rawToken);
    if (!verified.valid || !verified.user || !verified.session) {
      throw new Error(`SESION_INVALIDA: ${verified.reason || 'TOKEN_NO_RECONOCIDO'}`);
    }
    const actor = verified.user;
    if (allowedRoles && !allowedRoles.includes(actor.role)) {
      throw new Error(
        `PERMISO_DENEGADO_RBAC: Tu rol actual (${actor.role}) no tiene autorización para ejecutar esta operación. Roles permitidos: ${allowedRoles.join(', ')}`
      );
    }
    return { actor, isExplicitSession: true, sid: verified.session.sid };
  }

  const fallback =
    engine.walletsByUser.get(fallbackUserId) ??
    engine.walletsByUser.get('u_owner_1') ??
    Array.from(engine.walletsByUser.values())[0]!;
  return { actor: fallback, isExplicitSession: false };
}

function resolveCoAuthorizerId(
  engine: ControlCreditoEngine,
  actorUserId: string,
  supervisorIdOrCode?: string,
  supervisorPin?: string
): string {
  if (supervisorIdOrCode) {
    const sup = engine.verifySupervisorPin(actorUserId, supervisorIdOrCode, supervisorPin);
    if (sup.userId === actorUserId) {
      return 'SYSTEM_SOLO_SUPER_ADMIN_2FA';
    }
    return sup.userId;
  }
  const otherSupervisor = Array.from(engine.walletsByUser.values()).find(
    (u) => u.userId !== actorUserId && (u.role === 'SUPER_ADMIN' || u.role === 'STORE_ADMIN')
  );
  if (otherSupervisor) return otherSupervisor.userId;
  return 'SYSTEM_SOLO_SUPER_ADMIN_2FA';
}

function resolveEffectiveStoreId(
  engine: ControlCreditoEngine,
  requestedStoreId?: string,
  actorStoreId?: string | null
): string {
  if (requestedStoreId && engine.stores.has(requestedStoreId)) {
    return requestedStoreId;
  }
  if (actorStoreId && engine.stores.has(actorStoreId)) {
    return actorStoreId;
  }
  const firstActive = Array.from(engine.stores.values()).find((s) => s.isActive);
  if (firstActive) {
    return firstActive.id;
  }
  const firstAny = Array.from(engine.stores.values())[0];
  if (firstAny) {
    return firstAny.id;
  }
  throw new Error(
    'SUCURSAL_NO_ENCONTRADA: No hay ninguna sucursal registrada en el sistema. Registra una sucursal en /stores antes de operar.'
  );
}

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    // 1. Si no es una ruta /api/*, servir los portales HTML/CSS/JS desde Cloudflare Workers Assets
    if (!url.pathname.startsWith('/api/')) {
      if (env.ASSETS) {
        const portalMap: Record<string, string> = {
          '/': '/index.html',
          '/login': '/login.html',
          '/wallet': '/wallet.html',
          '/pos': '/pos.html',
          '/trade-in': '/trade-in.html',
          '/tournaments': '/tournaments.html',
          '/stores': '/stores.html',
          '/users': '/users.html',
          '/profile': '/profile.html',
          '/audit': '/audit.html',
          '/custody': '/custody.html',
        };
        const mappedPath = portalMap[url.pathname];
        if (mappedPath) {
          const assetUrl = new URL(mappedPath, url.origin);
          return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
        }
        return env.ASSETS.fetch(request);
      }
      return new Response('Assets binding no configurado en wrangler.toml', { status: 404 });
    }

    // 2. Enrutador API Financiero, IAM y Forense con Persistencia D1
    try {
      const engine = await loadEngineFromD1(env);
      const isMutation = request.method === 'POST';
      const body: Record<string, any> = (isMutation
        ? await request.json().catch(() => ({}))
        : {}) as Record<string, any>;

      if (request.method === 'GET' && url.pathname === '/api/health') {
        return jsonResponse(200, {
          status: 'ok',
          runtime: 'cloudflare-workers-d1',
          integrity: engine.verifySystemIntegrity(),
          timestamp: new Date().toISOString(),
        });
      }

      if (request.method === 'GET' && url.pathname === '/api/roles') {
        const authHeader = request.headers.get('authorization');
        const rawToken =
          authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const verified = rawToken ? engine.verifyActiveSession(rawToken) : { valid: false };
        const isSuperAdmin = verified.valid && verified.user?.role === 'SUPER_ADMIN';

        const demoAccounts = isSuperAdmin
          ? Array.from(engine.walletsByUser.values()).map((u) => ({
              userId: u.userId,
              memberCode: u.memberCode,
              role: u.role,
              label: `${u.fullName} (${u.role})`,
            }))
          : [];
        return jsonResponse(200, {
          ok: true,
          roleMatrix: ROLE_DEFINITION_MATRIX,
          demoAccounts,
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        const auth = engine.authenticateUser({
          identifier: body.identifier || '',
          secret: body.secret || '',
          mode: body.mode === 'PIN' || body.method === 'PIN' ? 'PIN' : 'PASSWORD',
          storeId: body.storeId,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, {
          ok: true,
          token: auth.token,
          user: sanitizeUser(auth.user),
          capabilities: ROLE_DEFINITION_MATRIX[auth.user.role],
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        const authHeader = request.headers.get('authorization');
        const rawToken =
          authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const revoked = rawToken ? engine.revokeSession(rawToken) : false;
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, revoked });
      }

      if (request.method === 'GET' && url.pathname === '/api/auth/session') {
        const authHeader = request.headers.get('authorization');
        const rawToken =
          authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const verified = rawToken
          ? engine.verifyActiveSession(rawToken)
          : { valid: false, reason: 'SIN_TOKEN' };
        if (!verified.valid || !verified.user || !verified.session) {
          return jsonResponse(200, {
            ok: true,
            authenticated: false,
            reason: verified.reason || 'SIN_SESION_ACTIVA',
          });
        }
        return jsonResponse(200, {
          ok: true,
          authenticated: true,
          session: verified.session,
          user: sanitizeUser(verified.user),
          capabilities: ROLE_DEFINITION_MATRIX[verified.user.role],
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/demo-switch') {
        const { actor, isExplicitSession } = resolveSessionActor(request, engine, 'u_owner_1', [
          'SUPER_ADMIN',
        ]);
        if (!isExplicitSession || actor.role !== 'SUPER_ADMIN') {
          throw new Error(
            'PERMISO_DENEGADO_RBAC: El cambio directo de rol está restringido exclusivamente a sesiones activas de SUPER_ADMIN.'
          );
        }
        const auth = engine.issueSessionForUser(body.userId || actor.userId);
        await saveEngineToD1(env, engine);
        return jsonResponse(200, {
          ok: true,
          token: auth.token,
          user: sanitizeUser(auth.user),
          capabilities: ROLE_DEFINITION_MATRIX[auth.user.role],
        });
      }

      if (request.method === 'GET' && url.pathname === '/api/state') {
        const requireAuth = url.searchParams.get('requireAuth') === '1';
        const authHeader = request.headers.get('authorization');
        const rawToken =
          authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

        if (requireAuth) {
          const verified = rawToken
            ? engine.verifyActiveSession(rawToken)
            : { valid: false, reason: 'SIN_TOKEN' };
          if (!verified.valid || !verified.user) {
            return jsonResponse(200, {
              authenticated: false,
              sessionInvalidReason: verified.reason || 'SIN_SESION_ACTIVA',
              sessionUser: null,
              sessionCapabilities: null,
              roleMatrix: ROLE_DEFINITION_MATRIX,
              stores: Array.from(engine.stores.values()),
              integrity: engine.verifySystemIntegrity(),
            });
          }
        }

        const { actor } = resolveSessionActor(request, engine, 'u_owner_1');
        const firstPlayer = Array.from(engine.walletsByUser.values()).find(
          (u) => u.role === 'PLAYER'
        );
        const requestedPlayerId = url.searchParams.get('playerId') ?? '';
        const effectivePlayerId =
          actor.role === 'PLAYER' ? actor.userId : requestedPlayerId;

        const activePlayer =
          engine.walletsByUser.get(effectivePlayerId) ?? firstPlayer ?? actor;
        const qrData = createDynamicQrToken(
          activePlayer.deviceSecret,
          activePlayer.memberCode
        );
        const pinData = generatePlayerTotpPin(
          activePlayer.deviceSecret,
          activePlayer.memberCode
        );

        const rawAllUsers = Array.from(engine.walletsByUser.values()).map(sanitizeUser);
        const isPersonalScope = actor.role === 'PLAYER';

        const allUsers = isPersonalScope ? [sanitizeUser(actor)] : rawAllUsers;
        const players = isPersonalScope
          ? [sanitizeUser(actor)]
          : rawAllUsers.filter((u) => u.role === 'PLAYER');
        const staff = isPersonalScope
          ? []
          : rawAllUsers.filter((u) => u.role !== 'PLAYER');

        const allVouchers = Array.from(engine.vouchers.values())
          .reverse()
          .map((v) => ({
            ...v,
            thermalText: engine.renderThermalVoucherText(v.voucherFolio),
          }));

        const vouchers = isPersonalScope
          ? allVouchers.filter((v) => v.playerUserId === actor.userId)
          : allVouchers;

        const auditLogs = isPersonalScope
          ? [...engine.auditLogs]
              .reverse()
              .filter(
                (a) =>
                  a.actorUserId === actor.userId ||
                  a.targetEntityId === actor.userId ||
                  a.targetEntityId === actor.walletId ||
                  a.targetMemberCode === actor.memberCode
              )
          : [...engine.auditLogs].reverse();

        return jsonResponse(200, {
          authenticated: true,
          org: engine.org,
          stores: Array.from(engine.stores.values()),
          sessionUser: sanitizeUser(actor),
          sessionCapabilities: ROLE_DEFINITION_MATRIX[actor.role],
          roleMatrix: ROLE_DEFINITION_MATRIX,
          allUsers,
          staff,
          players,
          activePlayer: {
            ...sanitizeUser(activePlayer),
            dynamicQr: qrData.qrToken,
            totpPin: pinData.totpPin,
            expiresInSeconds: qrData.expiresInSeconds,
          },
          tournaments: Array.from(engine.tournaments.values()).reverse(),
          vouchers,
          shiftClosures: isPersonalScope ? [] : [...engine.shiftClosures].reverse(),
          journalEntries: isPersonalScope ? [] : [...engine.journalEntries].reverse(),
          auditLogs,
          integrity: engine.verifySystemIntegrity(),
        });
      }

      if (request.method === 'GET' && url.pathname === '/api/audit/search') {
        const results = engine.queryForensicAudit({
          actorQuery: url.searchParams.get('actor') ?? undefined,
          roleFilter: url.searchParams.get('role') ?? undefined,
          actionFilter: url.searchParams.get('action') ?? undefined,
          targetOrRefQuery: url.searchParams.get('target') ?? undefined,
        });
        return jsonResponse(200, { ok: true, count: results.length, results });
      }

      if (request.method === 'POST' && url.pathname === '/api/admin/reset-local-db') {
        resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN']);
        const owner = engine.resetToCleanSingleUser();
        const session = engine.issueSessionForUser(owner.userId);
        await saveEngineToD1(env, engine);
        return jsonResponse(200, {
          ok: true,
          user: sanitizeUser(owner),
          token: session.token,
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/users/create') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'SUPER_ADMIN',
          'STORE_ADMIN',
          'TOURNAMENT_ORGANIZER',
          'CASHIER',
        ]);
        const created = engine.createUserWithRBAC({
          actorUserId: actor.userId,
          fullName: body.fullName || 'Nuevo Usuario',
          alias: body.alias || `@User${Math.floor(1000 + Math.random() * 9000)}`,
          memberCode: body.memberCode,
          role: (body.role as UserRoleType) || 'PLAYER',
          email: body.email,
          phone: body.phone,
          assignedStoreId: body.assignedStoreId,
          password: body.password || 'krona2026',
          securityPin: body.securityPin?.trim() || undefined,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, user: sanitizeUser(created) });
      }

      if (request.method === 'POST' && url.pathname === '/api/users/update') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'SUPER_ADMIN',
          'STORE_ADMIN',
        ]);
        const updated = engine.adminUpdateUser({
          actorUserId: actor.userId,
          targetUserId: body.targetUserId,
          newRole: body.newRole || body.role,
          newAssignedStoreId: body.newAssignedStoreId !== undefined ? body.newAssignedStoreId : body.assignedStoreId,
          newStatus: body.newStatus || body.status,
          reason: body.reason || 'Cambio administrativo desde KRONA IAM',
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, user: sanitizeUser(updated) });
      }

      if (request.method === 'POST' && url.pathname === '/api/admin/merge-accounts') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'SUPER_ADMIN',
          'STORE_ADMIN',
        ]);
        const checkerId = resolveCoAuthorizerId(
          engine,
          actor.userId,
          body.coAuthorizerId || body.coAuthorizerUserId,
          body.coAuthorizerPin || body.coAuthPin
        );
        const merged = engine.mergePlayerAccounts({
          storeId: resolveEffectiveStoreId(engine, body.storeId, actor.assignedStoreId),
          primaryUserId: body.primaryUserId,
          secondaryUserId: body.secondaryUserId,
          adminMakerId: actor.userId,
          adminCheckerId: checkerId,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...merged });
      }

      if (request.method === 'POST' && url.pathname === '/api/profile/update') {
        const { actor, isExplicitSession } = resolveSessionActor(request, engine, 'u_owner_1');
        const targetId = isExplicitSession ? actor.userId : body.userId || actor.userId;
        const updated = engine.updateOwnProfile({
          userId: targetId,
          fullName: body.fullName,
          alias: body.alias,
          email: body.email,
          phone: body.phone,
          newPassword: body.newPassword,
          newSecurityPin: body.newSecurityPin || body.newPin,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, user: sanitizeUser(updated) });
      }

      if ((request.method === 'GET' || request.method === 'POST') && url.pathname === '/api/auth/2fa/setup') {
        const { actor, isExplicitSession } = resolveSessionActor(request, engine, 'u_owner_1');
        const userId = isExplicitSession ? actor.userId : url.searchParams.get('userId') || actor.userId;
        const setup = engine.getOrInitAuthenticatorSetup(userId);
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...setup });
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/2fa/verify-sync') {
        const { actor, isExplicitSession } = resolveSessionActor(request, engine, 'u_owner_1');
        const userId = isExplicitSession ? actor.userId : body.userId || actor.userId;
        const result = engine.verifyAndActivateAuthenticator({
          userId,
          token: String(body.token || body.code || '').trim(),
          secret: body.secret ? String(body.secret).trim() : undefined,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...result });
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/2fa/disable') {
        const { actor, isExplicitSession } = resolveSessionActor(request, engine, 'u_owner_1');
        const userId = isExplicitSession ? actor.userId : body.userId || actor.userId;
        const result = engine.disableAuthenticator(userId);
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...result });
      }

      if (request.method === 'POST' && url.pathname === '/api/players/register') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'SUPER_ADMIN',
          'STORE_ADMIN',
          'TOURNAMENT_ORGANIZER',
          'CASHIER',
        ]);
        const nextNum = Math.floor(1000 + Math.random() * 9000);
        const newUser = engine.createUserWithRBAC({
          actorUserId: actor.userId,
          memberCode: body.memberCode || `CC-${nextNum}`,
          fullName: body.fullName || 'Nuevo Jugador',
          alias: body.alias || `@Player${nextNum}`,
          role: 'PLAYER',
          email: body.email,
          phone: body.phone,
          assignedStoreId: resolveEffectiveStoreId(engine, body.storeId, actor.assignedStoreId),
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, player: sanitizeUser(newUser) });
      }

      if (request.method === 'POST' && url.pathname === '/api/credit/issue') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'SUPER_ADMIN',
          'STORE_ADMIN',
          'TOURNAMENT_ORGANIZER',
        ]);
        const fallbackStaff =
          Array.from(engine.walletsByUser.values()).find(
            (u) => u.userId !== body.targetUserId && u.role !== 'PLAYER'
          ) ?? actor;
        const effectiveActor =
          actor.userId === body.targetUserId ? fallbackStaff : actor;
        const coAuthId = resolveCoAuthorizerId(
          engine,
          effectiveActor.userId,
          body.coAuthorizerId || body.coAuthorizerUserId,
          body.coAuthorizerPin || body.coAuthPin
        );

        const resIssue = engine.issueCredit({
          storeId: resolveEffectiveStoreId(engine, body.storeId, effectiveActor.assignedStoreId),
          targetUserId: body.targetUserId,
          actorUserId: effectiveActor.userId,
          actorRole: effectiveActor.role,
          coAuthorizerUserId: coAuthId,
          amountCents: Number(body.amountCents),
          sourceType: body.sourceType || 'SINGLES_TRADE_IN',
          sourceLabel: body.sourceLabel || 'Compra de Cartas Sueltas (Trade-In)',
          referenceId: body.referenceId || `OP-${Date.now().toString().slice(-5)}`,
          expiryDays: body.expiryDays !== undefined ? body.expiryDays : 180,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...resIssue });
      }

      if (request.method === 'POST' && url.pathname === '/api/pos/redeem') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'CASHIER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const player = engine.walletsByUser.get(body.playerUserId);
        if (!player) throw new Error('JUGADOR_NO_ENCONTRADO');

        const fallbackCashier =
          Array.from(engine.walletsByUser.values()).find(
            (u) => u.userId !== player.userId && u.role !== 'PLAYER'
          ) ?? actor;
        const effectiveCashier =
          actor.userId === player.userId ? fallbackCashier : actor;

        const qrToken =
          body.qrToken ||
          createDynamicQrToken(player.deviceSecret, player.memberCode).qrToken;
        const totpPin =
          body.totpPin ||
          generatePlayerTotpPin(player.deviceSecret, player.memberCode).totpPin;

        const result = engine.redeemCreditAtPos({
          redeemingStoreId: resolveEffectiveStoreId(
            engine,
            body.storeId || body.redeemingStoreId,
            effectiveCashier.assignedStoreId
          ),
          playerUserId: body.playerUserId,
          cashierUserId: effectiveCashier.userId,
          cashierRole: effectiveCashier.role,
          totalTicketCents: Number(body.totalTicketCents),
          creditToApplyCents: Number(body.creditToApplyCents),
          productCategory: body.productCategory || 'SEALED_PRODUCT',
          externalPosTicketRef:
            body.externalPosTicketRef || `#POS-${Math.floor(10000 + Math.random() * 90000)}`,
          conceptNotes: body.conceptNotes || 'Compra de mostrador con crédito a cuenta',
          idempotencyKey: body.idempotencyKey,
          playerAuthProof: {
            method: body.authMethod || 'QR_DYNAMIC_TOTP',
            qrToken,
            totpPin,
          },
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, {
          ok: true,
          voucher: result.voucher,
          thermalText: engine.renderThermalVoucherText(result.voucher.voucherFolio),
          consumedLots: result.consumedLots,
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/pos/reprint-voucher') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'CASHIER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const updated = engine.reprintPhysicalVoucher(
          body.voucherFolio,
          actor.userId,
          actor.role,
          body.reason || 'Reimpresión solicitada en caja'
        );
        await saveEngineToD1(env, engine);
        return jsonResponse(200, {
          ok: true,
          voucher: updated,
          thermalText: engine.renderThermalVoucherText(updated.voucherFolio),
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/pos/verify-voucher') {
        const check = engine.verifyPhysicalVoucherAuthenticity({
          voucherFolio: body.voucherFolio || '',
          reportedCreditCents: Number(body.reportedCreditCents || 0),
          providedSeal: body.providedSeal || '',
        });
        return jsonResponse(200, { ok: true, ...check });
      }

      if (request.method === 'POST' && url.pathname === '/api/pos/refund') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'STORE_ADMIN',
          'SUPER_ADMIN',
          'CASHIER',
        ]);
        const coAuthId = resolveCoAuthorizerId(
          engine,
          actor.userId,
          body.coAuthorizerId || body.coAuthorizerUserId,
          body.coAuthorizerPin || body.coAuthPin
        );
        const refund = engine.refundPosPurchase({
          voucherFolio: body.voucherFolio,
          refundAmountCents: Number(body.refundAmountCents),
          actorUserId: actor.userId,
          coAuthorizerUserId: coAuthId,
          reason: body.reason || 'Devolución de artículo en mostrador',
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...refund });
      }

      if (request.method === 'POST' && url.pathname === '/api/pos/preorder-hold') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'CASHIER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const firstPlayer = Array.from(engine.walletsByUser.values()).find(
          (u) => u.role === 'PLAYER'
        );
        const hold = engine.holdCreditForPreorder({
          storeId: resolveEffectiveStoreId(engine, body.storeId, actor.assignedStoreId),
          playerUserId: body.playerUserId || firstPlayer?.userId || actor.userId,
          cashierUserId: actor.userId,
          preorderRef: body.preorderRef || `PRE-${Date.now().toString().slice(-5)}`,
          amountCents: Number(body.amountCents || 25_000),
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, hold });
      }

      if (request.method === 'POST' && url.pathname === '/api/pos/preorder-cancel') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'STORE_ADMIN',
          'SUPER_ADMIN',
          'CASHIER',
        ]);
        const result = engine.cancelPreorderHold({
          preorderRef: body.preorderRef,
          cancelledByStore: Boolean(body.cancelledByStore),
          actorUserId: actor.userId,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...result });
      }

      if (request.method === 'POST' && url.pathname === '/api/pos/shift-closure') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'CASHIER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const targetStoreId = resolveEffectiveStoreId(engine, body.storeId, actor.assignedStoreId);
        const report = engine.generateStoreShiftClosure(
          targetStoreId,
          actor.userId
        );
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, report });
      }

      if (request.method === 'POST' && url.pathname === '/api/wallet/security-lock') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1');
        const targetUserId = body.targetUserId || actor.userId;
        const wallet = engine.toggleWalletSecurityLock({
          storeId: resolveEffectiveStoreId(engine, body.storeId, actor.assignedStoreId),
          targetUserId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          lock: Boolean(body.lock),
          rotateSecret: Boolean(body.rotateSecret),
          reason: body.reason || 'Bloqueo preventivo desde PWA / Caja',
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, wallet: sanitizeUser(wallet) });
      }

      if (request.method === 'POST' && url.pathname === '/api/tournaments/create') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'TOURNAMENT_ORGANIZER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const trn = engine.createTournament({
          storeId: resolveEffectiveStoreId(engine, body.storeId, actor.assignedStoreId),
          actorUserId: actor.userId,
          name: body.name || 'Torneo Oficial TCG',
          gameFormat: body.gameFormat || body.gameCategory || 'MTG Modern',
          entryFeeCents: Number(body.entryFeeCents ?? 20_000),
          prizeContributionPerPlayerCents: Number(body.prizeContributionPerPlayerCents ?? 100_000),
          guaranteedPrizePoolCents: Number(
            body.guaranteedPrizePoolCents ?? body.guaranteedPoolCents ?? 200_000
          ),
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, tournament: trn });
      }

      if (request.method === 'POST' && url.pathname === '/api/tournaments/enroll') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'TOURNAMENT_ORGANIZER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const trn = engine.enrollPlayerInTournament({
          tournamentId: body.tournamentId,
          actorUserId: actor.userId,
          playerUserId: body.playerUserId,
          matchRecord: body.matchRecord,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, tournament: trn });
      }

      if (request.method === 'POST' && url.pathname === '/api/tournaments/disperse') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'TOURNAMENT_ORGANIZER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const coAuthId = resolveCoAuthorizerId(
          engine,
          actor.userId,
          body.coAuthorizerId || body.coAuthorizerUserId,
          body.coAuthorizerPin || body.coAuthPin
        );
        const coAuthUser = engine.walletsByUser.get(coAuthId);

        const trackedTrn = body.tournamentId
          ? engine.tournaments.get(body.tournamentId)
          : undefined;

        const totalPoolCents = Number(
          body.totalPoolCents || trackedTrn?.calculatedPrizePoolCents || 480_000
        );
        const applyTop4Split = Boolean(body.applyTop4Split);

        const availablePlayers = Array.from(engine.walletsByUser.values()).filter(
          (u) => u.role === 'PLAYER'
        );
        const rawSourcePlayers =
          trackedTrn && trackedTrn.participants.length >= 1
            ? trackedTrn.participants.slice(0, 4).map((p, idx) => ({
                position: idx + 1,
                playerUserId: p.playerUserId,
                playerMemberCode: p.playerMemberCode,
                playerName: p.playerName,
                record: p.matchRecord || '4-1-0',
                defaultPercentageBps: idx === 0 ? 4500 : idx === 1 ? 2500 : 1500,
                inTopSplit: applyTop4Split,
              }))
            : availablePlayers.slice(0, 4).map((p, idx) => ({
                position: idx + 1,
                playerUserId: p.userId,
                playerMemberCode: p.memberCode,
                playerName: p.fullName,
                record: '4-1-0',
                defaultPercentageBps: idx === 0 ? 4500 : idx === 1 ? 2500 : 1500,
                inTopSplit: applyTop4Split,
              }));

        if (rawSourcePlayers.length === 0) {
          throw new Error(
            'SIN_JUGADORES_INSCRITOS: Registra e inscribe al menos 1 jugador (rol PLAYER) antes de dispersar premios.'
          );
        }

        const totalBps = rawSourcePlayers.reduce((s, p) => s + p.defaultPercentageBps, 0);
        if (totalBps !== 10_000 && rawSourcePlayers.length > 0) {
          rawSourcePlayers[0].defaultPercentageBps += 10_000 - totalBps;
        }

        const standings = engine.calculateTournamentSplit(totalPoolCents, rawSourcePlayers);
        const tournamentRef = trackedTrn?.folio || `TRN-${Date.now().toString().slice(-5)}`;
        const tournamentName =
          body.tournamentName || trackedTrn?.name || 'Torneo Semanal';

        for (const st of standings) {
          const fallbackStaff =
            Array.from(engine.walletsByUser.values()).find(
              (u) => u.userId !== st.playerUserId && u.role !== 'PLAYER'
            ) ?? actor;
          const issueActor =
            actor.userId === st.playerUserId ? fallbackStaff : actor;
          engine.issueCredit({
            storeId: resolveEffectiveStoreId(
              engine,
              body.storeId || trackedTrn?.storeId,
              issueActor.assignedStoreId
            ),
            targetUserId: st.playerUserId,
            actorUserId: issueActor.userId,
            actorRole: issueActor.role,
            coAuthorizerUserId: coAuthId,
            amountCents: st.awardedCents,
            sourceType: 'TOURNAMENT_PRIZE',
            sourceLabel: `Premio Pos #${st.position} ${tournamentName}${st.inTopSplit ? ' [Split Top Cut]' : ''}`,
            referenceId: tournamentRef,
            expiryDays: 180,
          });
        }

        if (trackedTrn) {
          trackedTrn.status = 'DISPERSED_COMPLETED';
          trackedTrn.applyTop4Split = applyTop4Split;
          trackedTrn.standings = standings;
          trackedTrn.dispersedByUserId = actor.userId;
          trackedTrn.dispersedByName = `${actor.fullName} (${actor.memberCode})`;
          trackedTrn.coAuthorizedByUserId = coAuthId;
          trackedTrn.coAuthorizedByName = coAuthUser
            ? `${coAuthUser.fullName} (${coAuthUser.memberCode})`
            : coAuthId;
          trackedTrn.dispersedAt = new Date().toISOString();
        }

        await saveEngineToD1(env, engine);
        return jsonResponse(200, {
          ok: true,
          standings,
          tournamentRef,
          tournament: trackedTrn,
        });
      }

      // 1. Parser de Resultados Pokémon (TOM HTML / RK9) con Cálculo de Pozo por Ocupación
      if (request.method === 'POST' && url.pathname === '/api/tournaments/parse-poke-standings') {
        resolveSessionActor(request, engine, 'u_to_1', [
          'TOURNAMENT_ORGANIZER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const rawHtml = String(body.htmlContent || body.rawHtml || '');
        if (!rawHtml.trim()) {
          throw new Error('CONTENIDO_HTML_REQUERIDO: Pega o sube el HTML de clasificaciones de TOM o RK9.');
        }

        const entryFeeCents = Math.max(0, Number(body.entryFeeCents ?? 15_000));
        const prizeContributionCents = Math.max(0, Number(body.prizeContributionCents ?? 10_000));
        const guaranteedPoolCents = Math.max(0, Number(body.guaranteedPoolCents ?? 0));

        const parsed = parsePokemonStandingsHTML(rawHtml, {
          entryFeeCents,
          prizeContributionCents,
          guaranteedPoolCents,
        });

        const allPlayers = Array.from(engine.walletsByUser.values()).filter((u) => u.role === 'PLAYER');

        const enrichedCategories = parsed.categories.map((cat) => {
          const enrichedEntries = cat.entries.map((entry) => {
            const cleanEntryName = entry.playerName.trim();
            const lower = cleanEntryName.toLowerCase();
            const matched = allPlayers.find((p) => {
              const pFull = p.fullName.toLowerCase().trim();
              const pAlias = p.alias.toLowerCase().replace('@', '').trim();
              return (
                pFull === lower ||
                (pFull.length > 4 && lower.length > 4 && (pFull.includes(lower) || lower.includes(pFull))) ||
                pAlias === lower.replace(/[@\s]/g, '')
              );
            });

            return {
              ...entry,
              matchedWallet: matched
                ? {
                    userId: matched.userId,
                    memberCode: matched.memberCode,
                    fullName: matched.fullName,
                    alias: matched.alias,
                    isExisting: true,
                  }
                : {
                    userId: null,
                    memberCode: 'NUEVO',
                    fullName: cleanEntryName,
                    alias: `@${cleanEntryName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'player'}`,
                    isExisting: false,
                  },
            };
          });

          return {
            ...cat,
            entries: enrichedEntries,
          };
        });

        return jsonResponse(200, {
          ok: true,
          standings: {
            ...parsed,
            categories: enrichedCategories,
          },
        });
      }

      // 2. Dispersión Oficial de Torneo Pokémon (TOM) con Partida Doble
      if (request.method === 'POST' && url.pathname === '/api/tournaments/disperse-poke') {
        const { actor } = resolveSessionActor(request, engine, 'u_to_1', [
          'TOURNAMENT_ORGANIZER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const coAuthId = resolveCoAuthorizerId(
          engine,
          actor.userId,
          body.coAuthorizerId || body.coAuthorizerUserId,
          body.coAuthorizerPin || body.coAuthPin
        );

        const storeId = resolveEffectiveStoreId(engine, body.storeId, actor.assignedStoreId);
        const tournamentName = (body.name || body.tournamentName || 'Torneo Oficial Pokémon').trim();
        const gameFormat = body.gameFormat || 'Pokémon TCG';
        const unifyCategoriesPool = Boolean(body.unifyCategoriesPool);
        const unifySeniorJunior = Boolean(body.unifySeniorJunior);

        const categoriesInput: Array<{
          name: string;
          entryFeeCents: number;
          prizeContributionCents: number;
          registeredCount: number;
          guaranteedPoolCents?: number;
          customPoolCents?: number;
          customPoolPercentage?: number;
          topCutSize: number;
          applyEqualSplit?: boolean;
          customPercentagesBps?: number[];
          entries: Array<{
            rank: number;
            playerName: string;
            record?: string;
            matchPoints?: number;
            playerUserId?: string;
          }>;
        }> = body.categories || [];

        if (categoriesInput.length === 0) {
          throw new Error('SIN_CATEGORIAS: Proporciona al menos 1 categoría con jugadores y ocupación.');
        }

        const trn = engine.createCategoryTournament({
          storeId,
          actorUserId: actor.userId,
          name: tournamentName,
          gameFormat,
          gameType: 'POKEMON_TCG',
          categories: categoriesInput.map((c) => ({
            name: c.name,
            entryFeeCents: c.entryFeeCents,
            prizeContributionCents: c.prizeContributionCents,
            registeredCount: c.registeredCount,
            guaranteedPoolCents: c.guaranteedPoolCents || 0,
            customPoolCents: c.customPoolCents,
            customPoolPercentage: c.customPoolPercentage,
            customPercentagesBps: c.customPercentagesBps,
            topCutSize: c.topCutSize || 4,
          })),
          unifyCategoriesPool,
          unifySeniorJunior,
          sourceStandingsRaw: body.rawHtmlContent,
        });

        const categoryDispersions: Array<{
          categoryName: string;
          poolCents: number;
          standings: TournamentPrizeStanding[];
        }> = [];

        if (unifyCategoriesPool) {
          const totalUnifiedPool = body.customTotalPoolCents != null
            ? Number(body.customTotalPoolCents)
            : categoriesInput.reduce(
                (sum, c) => sum + (c.customPoolCents != null ? c.customPoolCents : Math.max(c.guaranteedPoolCents || 0, c.registeredCount * c.prizeContributionCents)),
                0
              );
          const allEntries = categoriesInput.flatMap((c) => c.entries).sort((a, b) => a.rank - b.rank);
          const topCutSize = Number(body.unifiedTopCutSize || 4);
          const standings = calculateTopCutPrizeDistribution({
            totalPoolCents: totalUnifiedPool,
            topCutSize,
            applyEqualSplit: Boolean(body.applyEqualSplit),
            customPercentagesBps: body.customPercentagesBps,
            entries: allEntries.map((e) => ({
              rank: e.rank,
              playerName: e.playerName,
              record: e.record || `${e.matchPoints ?? 0} pts`,
              matchPoints: e.matchPoints || 0,
              opponentWinPercentage: 0,
            })),
            resolvePlayerFn: (entry) => {
              const wallet = engine.findOrCreatePlayer({
                fullName: entry.playerName,
                storeId,
                actorUserId: actor.userId,
              });
              return {
                userId: wallet.userId,
                memberCode: wallet.memberCode,
                fullName: wallet.fullName,
              };
            },
          });

          categoryDispersions.push({
            categoryName: 'Unificado',
            poolCents: totalUnifiedPool,
            standings,
          });
        } else {
          for (const cat of categoriesInput) {
            const catPool = cat.customPoolCents != null && cat.customPoolCents >= 0
              ? cat.customPoolCents
              : Math.max(cat.guaranteedPoolCents || 0, cat.registeredCount * cat.prizeContributionCents);
            if (catPool <= 0 || cat.entries.length === 0) continue;

            const standings = calculateTopCutPrizeDistribution({
              totalPoolCents: catPool,
              topCutSize: cat.topCutSize || 4,
              applyEqualSplit: Boolean(cat.applyEqualSplit),
              customPercentagesBps: cat.customPercentagesBps,
              entries: cat.entries.map((e) => ({
                rank: e.rank,
                playerName: e.playerName,
                record: e.record || `${e.matchPoints ?? 0} pts`,
                matchPoints: e.matchPoints || 0,
                opponentWinPercentage: 0,
              })),
              resolvePlayerFn: (entry) => {
                const wallet = engine.findOrCreatePlayer({
                  fullName: entry.playerName,
                  storeId,
                  actorUserId: actor.userId,
                });
                return {
                  userId: wallet.userId,
                  memberCode: wallet.memberCode,
                  fullName: wallet.fullName,
                };
              },
            });

            categoryDispersions.push({
              categoryName: cat.name,
              poolCents: catPool,
              standings,
            });
          }
        }

        const result = engine.disperseCategoryTournament({
          tournamentId: trn.id,
          actorUserId: actor.userId,
          coAuthorizerUserId: coAuthId,
          categoryDispersions,
        });

        await saveEngineToD1(env, engine);

        return jsonResponse(200, {
          ok: true,
          tournament: result.tournament,
          totalDispersedCents: result.totalDispersedCents,
          journalEntryIds: result.journalEntryIds,
          standings: result.standings,
          categoryDispersions,
        });
      }

      // 3. Simulación Rápida de Pozo Multi-Juego (MTG, Yu-Gi-Oh!, One Piece, Lorcana)
      if (request.method === 'POST' && url.pathname === '/api/tournaments/quick-calc-preview') {
        resolveSessionActor(request, engine, 'u_to_1', [
          'TOURNAMENT_ORGANIZER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
          'CASHIER',
        ]);
        const totalPlayers = Math.max(0, Number(body.totalPlayers || 0));
        const entryFeeCents = Math.max(0, Number(body.entryFeeCents || 0));
        const prizeContributionCents = Math.max(0, Number(body.prizeContributionCents || 0));
        const guaranteedPoolCents = Math.max(0, Number(body.guaranteedPoolCents || 0));
        const topCutSize = Math.max(1, Number(body.topCutSize || 4));
        const applyTopCutSplit = Boolean(body.applyTopCutSplit);

        const calculation = calculateQuickMultiGamePool({
          totalPlayers,
          entryFeeCents,
          prizeContributionCents,
          guaranteedPoolCents,
          topCutSize,
          applyTopCutSplit,
          customPercentagesBps: body.customPercentagesBps,
        });

        return jsonResponse(200, { ok: true, calculation });
      }

      // 4. Liquidación Rápida Multi-Juego (MTG, Yu-Gi-Oh!, One Piece, Lorcana)
      if (request.method === 'POST' && url.pathname === '/api/tournaments/quick-calc-disperse') {
        const { actor } = resolveSessionActor(request, engine, 'u_to_1', [
          'TOURNAMENT_ORGANIZER',
          'STORE_ADMIN',
          'SUPER_ADMIN',
        ]);
        const coAuthId = resolveCoAuthorizerId(
          engine,
          actor.userId,
          body.coAuthorizerId || body.coAuthorizerUserId,
          body.coAuthorizerPin || body.coAuthPin
        );

        const storeId = resolveEffectiveStoreId(engine, body.storeId, actor.assignedStoreId);
        const name = (body.name || body.tournamentName || 'Torneo Relámpago TCG').trim();
        const gameFormat = body.gameFormat || 'MTG Modern';
        const totalPlayers = Math.max(1, Number(body.totalPlayers || 8));
        const entryFeeCents = Math.max(0, Number(body.entryFeeCents ?? 15_000));
        const prizeContributionCents = Math.max(0, Number(body.prizeContributionCents ?? 10_000));
        const guaranteedPoolCents = Math.max(0, Number(body.guaranteedPoolCents ?? 0));
        const topCutSize = Math.max(1, Number(body.topCutSize || 4));
        const applyTopCutSplit = Boolean(body.applyTopCutSplit);

        const calc = calculateQuickMultiGamePool({
          totalPlayers,
          entryFeeCents,
          prizeContributionCents,
          guaranteedPoolCents,
          topCutSize,
          applyTopCutSplit,
          customPercentagesBps: body.customPercentagesBps,
        });

        const trn = engine.createTournament({
          storeId,
          actorUserId: actor.userId,
          name,
          gameFormat,
          entryFeeCents,
          prizeContributionPerPlayerCents: prizeContributionCents,
          guaranteedPrizePoolCents: guaranteedPoolCents,
        });

        const rawWinners: Array<{
          position: number;
          playerUserId?: string;
          playerName?: string;
          record?: string;
        }> = body.winners || [];

        const availablePlayers = Array.from(engine.walletsByUser.values()).filter((u) => u.role === 'PLAYER');

        const standings: TournamentPrizeStanding[] = calc.payoutBreakdown.map((payout, idx) => {
          const winnerInput = rawWinners.find((w) => w.position === payout.position) || rawWinners[idx];
          let wallet: PlayerWalletState | null = null;

          if (winnerInput?.playerUserId) {
            wallet = engine.walletsByUser.get(winnerInput.playerUserId) || null;
          }
          if (!wallet && winnerInput?.playerName?.trim()) {
            wallet = engine.findOrCreatePlayer({
              fullName: winnerInput.playerName.trim(),
              storeId,
              actorUserId: actor.userId,
            });
          }
          if (!wallet) {
            wallet = availablePlayers[idx % availablePlayers.length];
          }

          return {
            position: payout.position,
            playerUserId: wallet.userId,
            playerMemberCode: wallet.memberCode,
            playerName: wallet.fullName,
            record: winnerInput?.record || `${winnerInput?.playerName ? 'Winner' : '4-1-0'}`,
            inTopSplit: applyTopCutSplit,
            percentageBps: payout.percentageBps,
            awardedCents: payout.awardedCents,
          };
        });

        for (const st of standings) {
          const fallbackStaff =
            Array.from(engine.walletsByUser.values()).find(
              (u) => u.userId !== st.playerUserId && u.role !== 'PLAYER'
            ) ?? actor;
          const issueActor = actor.userId === st.playerUserId ? fallbackStaff : actor;

          engine.issueCredit({
            storeId: trn.storeId,
            targetUserId: st.playerUserId,
            actorUserId: issueActor.userId,
            actorRole: issueActor.role,
            coAuthorizerUserId: coAuthId,
            amountCents: st.awardedCents,
            sourceType: 'TOURNAMENT_PRIZE',
            sourceLabel: `Premio Pos #${st.position} ${trn.name}${st.inTopSplit ? ' [Split]' : ''}`,
            referenceId: trn.folio,
            expiryDays: 180,
          });
        }

        trn.status = 'DISPERSED_COMPLETED';
        trn.standings = standings;
        trn.dispersedByUserId = actor.userId;
        trn.dispersedByName = `${actor.fullName} (${actor.memberCode})`;
        trn.coAuthorizedByUserId = coAuthId;
        trn.dispersedAt = new Date().toISOString();

        await saveEngineToD1(env, engine);

        return jsonResponse(200, {
          ok: true,
          tournament: trn,
          standings,
          calculation: calc,
          totalDispersedCents: calc.effectivePoolCents,
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/admin/policies') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN', 'STORE_ADMIN']);
        if (body.sharingPolicy) engine.org.sharingPolicy = body.sharingPolicy;
        if (body.p2pPolicy) engine.org.p2pPolicy = body.p2pPolicy;
        if (body.requireFourEyesThresholdCents !== undefined) {
          engine.org.requireFourEyesThresholdCents = Math.max(0, Math.round(Number(body.requireFourEyesThresholdCents)));
        }
        if (body.minSingleIssuanceCents !== undefined) {
          engine.org.minSingleIssuanceCents = Math.max(0, Math.round(Number(body.minSingleIssuanceCents)));
        }
        if (body.maxSingleIssuanceCents !== undefined) {
          engine.org.maxSingleIssuanceCents = Math.max(0, Math.round(Number(body.maxSingleIssuanceCents)));
        }

        engine.appendAuditLog({
          storeId: actor.assignedStoreId || 'store_centro',
          actorUserId: actor.userId,
          actorRole: actor.role,
          coAuthorizerId: null,
          coAuthMethod: null,
          eventAction: 'ORGANIZATION_POLICIES_UPDATED',
          targetEntityId: engine.org.id,
          payloadBefore: null,
          payloadAfter: { ...engine.org },
          reasonJustification: body.reason || 'Actualización de umbrales 4-Ojos y políticas corporativas',
        });

        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, org: engine.org });
      }

      if (request.method === 'POST' && url.pathname === '/api/admin/clawback') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', [
          'SUPER_ADMIN',
          'STORE_ADMIN',
        ]);
        const coAuthId = resolveCoAuthorizerId(
          engine,
          actor.userId,
          body.coAuthorizerId,
          body.coAuthorizerPin
        );
        const firstPlayer = Array.from(engine.walletsByUser.values()).find(
          (u) => u.role === 'PLAYER'
        );
        const targetId = body.targetUserId || firstPlayer?.userId;
        if (!targetId) {
          throw new Error('JUGADOR_NO_ENCONTRADO: Registra al menos un jugador para ejecutar Clawback.');
        }
        const resClawback = engine.clawbackErroneousPrize({
          storeId: resolveEffectiveStoreId(engine, body.storeId, actor.assignedStoreId),
          targetUserId: targetId,
          actorUserId: actor.userId,
          coAuthorizerUserId: coAuthId,
          amountToReverseCents: Number(body.amountToReverseCents || 50_000),
          reason: body.reason || 'Corrección de resultado de torneo con saldo ya gastado',
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...resClawback });
      }

      if (request.method === 'GET' && url.pathname === '/api/stores') {
        return jsonResponse(200, {
          ok: true,
          stores: Array.from(engine.stores.values()),
        });
      }

      if (request.method === 'GET' && url.pathname === '/api/stores/categories') {
        const storeId = url.searchParams.get('storeId') || '';
        const categories = engine.getStoreProductCategories(storeId);
        return jsonResponse(200, { ok: true, storeId, categories });
      }

      if (request.method === 'POST' && url.pathname === '/api/stores/categories') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN', 'STORE_ADMIN']);
        const store = engine.updateStoreProductCategories({
          actorUserId: actor.userId,
          storeId: body.storeId,
          categories: body.categories || body.productCategories || [],
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, store, categories: store.productCategories });
      }

      if (request.method === 'GET' && (url.pathname === '/api/stores/credit-sources' || url.pathname === '/api/credit-sources')) {
        const storeId = url.searchParams.get('storeId') || '';
        const creditSources = engine.getStoreCreditSources(storeId);
        return jsonResponse(200, { ok: true, storeId, creditSources });
      }

      if (request.method === 'POST' && (url.pathname === '/api/stores/credit-sources' || url.pathname === '/api/credit-sources')) {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN', 'STORE_ADMIN']);
        const store = engine.updateStoreCreditSources({
          actorUserId: actor.userId,
          storeId: body.storeId,
          creditSources: body.creditSources || [],
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, store, creditSources: store.creditSources });
      }

      if (request.method === 'POST' && url.pathname === '/api/stores/create') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN']);
        const store = engine.createStoreBranch({
          actorUserId: actor.userId,
          name: body.name,
          code: body.code,
          address: body.address,
          legalEntityTaxId: body.legalEntityTaxId,
          voucherPrefix: body.voucherPrefix,
          isActive: body.isActive,
          productCategories: body.productCategories,
          creditSources: body.creditSources,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, store });
      }

      if (request.method === 'POST' && url.pathname === '/api/stores/update') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN', 'STORE_ADMIN']);
        const store = engine.updateStoreBranch({
          actorUserId: actor.userId,
          storeId: body.storeId,
          name: body.name,
          code: body.code,
          address: body.address,
          legalEntityTaxId: body.legalEntityTaxId,
          voucherPrefix: body.voucherPrefix,
          isActive: body.isActive,
          productCategories: body.productCategories,
          creditSources: body.creditSources,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, store });
      }

      if (request.method === 'POST' && url.pathname === '/api/stores/toggle-active') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN']);
        const store = engine.toggleStoreBranchStatus({
          actorUserId: actor.userId,
          storeId: body.storeId,
          isActive: body.isActive,
          reason: body.reason,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, store });
      }

      if (request.method === 'POST' && url.pathname === '/api/stores/delete') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN']);
        const result = engine.deleteStoreBranch({
          actorUserId: actor.userId,
          storeId: body.storeId,
          reason: body.reason,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...result });
      }

      // ========================================================================
      // ENDPOINTS DE CARTAS EN RESGUARDO (VAULT CUSTODY & ESCROW)
      // ========================================================================

      if (request.method === 'GET' && url.pathname === '/api/custody/packages') {
        const { actor } = resolveSessionActor(request, engine);
        const storeId = url.searchParams.get('storeId') || undefined;
        const status = (url.searchParams.get('status') as CustodyStatus) || undefined;
        const search = url.searchParams.get('search') || undefined;
        const packages = engine.listCustodyPackages({
          actorUserId: actor.userId,
          storeId,
          status,
          search,
        });
        return jsonResponse(200, { ok: true, packages });
      }

      if (request.method === 'GET' && url.pathname === '/api/custody/catalog/purposes') {
        return jsonResponse(200, { ok: true, purposes: engine.getCustodyPurposes() });
      }

      if (request.method === 'POST' && url.pathname === '/api/custody/catalog/purposes') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN', 'STORE_ADMIN']);
        const updated = engine.updateCustodyPurposes({
          actorUserId: actor.userId,
          purposes: body.purposes || [],
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, purposes: updated });
      }

      if (request.method === 'GET' && url.pathname === '/api/custody/catalog/evidence-types') {
        return jsonResponse(200, { ok: true, evidenceTypes: engine.getCustodyEvidenceTypes() });
      }

      if (request.method === 'POST' && url.pathname === '/api/custody/catalog/evidence-types') {
        const { actor } = resolveSessionActor(request, engine, 'u_owner_1', ['SUPER_ADMIN', 'STORE_ADMIN']);
        const updated = engine.updateCustodyEvidenceTypes({
          actorUserId: actor.userId,
          evidenceTypes: body.evidenceTypes || [],
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, evidenceTypes: updated });
      }

      if (request.method === 'GET' && url.pathname.startsWith('/api/custody/packages/')) {
        const { actor } = resolveSessionActor(request, engine);
        const packageId = url.pathname.replace('/api/custody/packages/', '').trim();
        const pkg = engine.getCustodyPackage(packageId, actor.userId);
        return jsonResponse(200, { ok: true, package: pkg });
      }

      if (request.method === 'POST' && url.pathname === '/api/custody/packages/create') {
        const { actor } = resolveSessionActor(request, engine, undefined, ['SUPER_ADMIN', 'STORE_ADMIN', 'CASHIER', 'TOURNAMENT_ORGANIZER']);
        const result = engine.createCustodyPackage({
          actorUserId: actor.userId,
          storeId: body.storeId || actor.assignedStoreId || 'store_centro',
          depositorUserId: body.depositorUserId || (!body.isForThirdParty ? body.clientUserId : null) || null,
          depositorName: body.depositorName || body.clientName || 'Remitente Mostrador',
          depositorPhone: body.depositorPhone || body.clientPhone || '',
          depositorEmail: body.depositorEmail || body.clientEmail || null,
          recipientUserId: body.recipientUserId || (body.isForThirdParty ? body.clientUserId : null) || null,
          recipientName: body.recipientName || body.clientName,
          recipientPhone: body.recipientPhone || body.clientPhone,
          recipientEmail: body.recipientEmail || body.clientEmail || null,
          isForThirdParty: Boolean(body.isForThirdParty),
          clientUserId: body.clientUserId || null,
          clientName: body.clientName,
          clientPhone: body.clientPhone,
          clientEmail: body.clientEmail || null,
          purpose: body.purpose || 'SAFE_KEEPING_VAULT',
          vaultLocation: body.vaultLocation || 'Gaveta Mostrador',
          tamperSealNumber: body.tamperSealNumber || 'N/A',
          declaredValueCents: Number(body.declaredValueCents || 0),
          itemsSummary: body.itemsSummary || 'Paquete sellado',
          dueDate: body.dueDate || '',
          items: body.items || [],
          photos: body.photos || [],
          intakeSupervisorId: body.intakeSupervisorId || null,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, ...result });
      }

      if (request.method === 'POST' && url.pathname === '/api/custody/packages/photos') {
        const { actor } = resolveSessionActor(request, engine, undefined, ['SUPER_ADMIN', 'STORE_ADMIN', 'CASHIER', 'TOURNAMENT_ORGANIZER']);
        const updated = engine.attachCustodyPhoto({
          actorUserId: actor.userId,
          packageId: body.packageId,
          photoType: (body.photoType as CustodyPhotoType) || 'CONTENT_VIEW',
          caption: body.caption,
          dataUri: body.dataUri,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, package: updated });
      }

      if (request.method === 'POST' && url.pathname === '/api/custody/packages/location') {
        const { actor } = resolveSessionActor(request, engine, undefined, ['SUPER_ADMIN', 'STORE_ADMIN', 'CASHIER', 'TOURNAMENT_ORGANIZER']);
        const updated = engine.updateCustodyLocation({
          actorUserId: actor.userId,
          packageId: body.packageId,
          vaultLocation: body.vaultLocation,
          newStatus: body.newStatus,
          reason: body.reason,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, package: updated });
      }

      if (request.method === 'POST' && url.pathname === '/api/custody/packages/release') {
        const { actor } = resolveSessionActor(request, engine, undefined, ['SUPER_ADMIN', 'STORE_ADMIN', 'CASHIER']);
        const released = engine.releaseCustodyPackage({
          actorUserId: actor.userId,
          packageId: body.packageId,
          claimToken: body.claimToken,
          claimVerificationCode: body.claimVerificationCode,
          clientPinOrToken: body.clientPinOrToken,
          supervisorPin: body.supervisorPin,
          coAuthorizerId: body.coAuthorizerId,
          clientSignatureProof: body.clientSignatureProof,
          pickedUpByName: body.pickedUpByName,
          pickedUpByRole: body.pickedUpByRole,
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, package: released });
      }

      if (request.method === 'POST' && url.pathname === '/api/custody/packages/cancel') {
        const { actor } = resolveSessionActor(request, engine, undefined, ['SUPER_ADMIN', 'STORE_ADMIN']);
        const cancelled = engine.cancelCustodyPackage({
          actorUserId: actor.userId,
          packageId: body.packageId,
          reasonJustification: body.reasonJustification || 'Cancelación administrativa justificada',
        });
        await saveEngineToD1(env, engine);
        return jsonResponse(200, { ok: true, package: cancelled });
      }

      return jsonResponse(404, { error: 'Ruta API no encontrada' });
    } catch (err: any) {
      const msg = err?.message ?? 'Error desconocido';
      const status = msg.includes('PERMISO_DENEGADO_RBAC')
        ? 403
        : msg.includes('SESION_') || msg.includes('CREDENCIALES_INVALIDAS')
          ? 401
          : 400;
      return jsonResponse(status, { ok: false, error: msg });
    }
  },
};
