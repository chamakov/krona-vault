-- =============================================================================
-- controlCredito - Esquema Nuclear PostgreSQL 16 (Double-Entry Ledger + Vouchers + Audit)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tipos Enumerados Estrictos
CREATE TYPE sharing_policy_type AS ENUM (
    'ORG_POOLED_SAME_ENTITY', -- Default: misma razón social, saldo compartido, rastreo de centro de costo por tienda
    'INTER_STORE_CLEARING',   -- Escalamiento: franquicias o razones sociales separadas con CxC/CxP automático
    'STORE_ISOLATED'          -- Aislado: crédito solo válido en la tienda donde se ganó
);

CREATE TYPE p2p_policy_type AS ENUM (
    'DISABLED',               -- Default: prohibido transferir crédito entre jugadores
    'FAMILY_WHITELIST_ONLY',  -- Preparado: solo cuentas vinculadas autorizadas por un gerente
    'ENABLED_WITH_LIMITS'     -- Preparado: permitido con comisión %, tope mensual y regla de 1 solo salto
);

CREATE TYPE user_role_type AS ENUM (
    'SUPER_ADMIN',
    'STORE_ADMIN',
    'TOURNAMENT_ORGANIZER',
    'CASHIER',
    'AUDITOR',
    'PLAYER'
);

CREATE TYPE account_category AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE balance_direction AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE wallet_status AS ENUM ('ACTIVE', 'FROZEN_DISPUTE', 'SELF_LOCKED', 'MERGED_INACTIVE');
CREATE TYPE lot_status AS ENUM ('PENDING_COOLDOWN', 'ACTIVE', 'ESCROW_PREORDER', 'DEPLETED', 'EXPIRED', 'VOIDED');

CREATE TYPE credit_source_type AS ENUM (
    'TOURNAMENT_PRIZE',
    'TOURNAMENT_PARTICIPATION',
    'RAFFLE_DOOR_PRIZE',
    'JUDGE_STAFF_BOUNTY',
    'SINGLES_TRADE_IN',
    'PROMOTIONAL_BONUS',
    'REFUND_RESTORE',
    'P2P_TRANSFER_IN',
    'MANUAL_ADJUSTMENT'
);

CREATE TYPE ledger_operation_type AS ENUM (
    'TOURNAMENT_PRIZE_ISSUE',
    'TRADE_IN_ISSUE',
    'PROMOTIONAL_ISSUE',
    'STAFF_BOUNTY_ISSUE',
    'POS_REDEMPTION',
    'PREORDER_ESCROW_HOLD',
    'PREORDER_ESCROW_RELEASE',
    'REDEMPTION_REFUND',
    'CLAWBACK_REVERSAL',
    'LOT_EXPIRATION_BREAKAGE',
    'P2P_TRANSFER',
    'ACCOUNT_MERGE',
    'MANUAL_ADJUSTMENT',
    'INTERSTORE_SETTLEMENT'
);

-- 2. Organizaciones (Multi-Tenant) y Políticas Globales Parametrizables
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    tax_id VARCHAR(50),
    currency_code CHAR(3) NOT NULL DEFAULT 'MXN',
    -- Por defecto comparten la misma entidad pero está preparado para escalar a cualquier modelo
    sharing_policy sharing_policy_type NOT NULL DEFAULT 'ORG_POOLED_SAME_ENTITY',
    -- Por defecto deshabilitado, pero listo para activarse por configuración
    p2p_policy p2p_policy_type NOT NULL DEFAULT 'DISABLED',
    p2p_fee_bps INTEGER NOT NULL DEFAULT 0 CHECK (p2p_fee_bps >= 0 AND p2p_fee_bps <= 5000),
    p2p_monthly_limit_cents BIGINT NOT NULL DEFAULT 200000,
    require_four_eyes_threshold_cents BIGINT NOT NULL DEFAULT 100000, -- $1,000.00 MXN
    require_pos_voucher_print BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 3. Sucursales (Stores)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(32) NOT NULL,
    name VARCHAR(150) NOT NULL,
    legal_entity_tax_id VARCHAR(50) NOT NULL,
    address TEXT,
    timezone VARCHAR(64) NOT NULL DEFAULT 'America/Mexico_City',
    voucher_prefix VARCHAR(16) NOT NULL DEFAULT 'VCH',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (organization_id, code)
);

-- 4. Usuarios y Asignación de Roles Multi-Tienda (RBAC + ABAC)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    member_code VARCHAR(32) NOT NULL, -- Ej: CC-8492
    email VARCHAR(255),
    phone VARCHAR(40),
    full_name VARCHAR(200) NOT NULL,
    alias VARCHAR(80),
    password_hash TEXT,
    pin_6_hash TEXT,                  -- Hash Argon2id del PIN transaccional de 6 dígitos
    totp_device_secret TEXT,          -- Semilla compartida para QR Dinámico TOTP offline
    static_card_version INTEGER NOT NULL DEFAULT 1,
    external_gaming_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    merged_into_user_id UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (organization_id, member_code),
    UNIQUE (organization_id, email)
);

CREATE TABLE user_store_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    store_id UUID REFERENCES stores(id), -- NULL = permiso a nivel de toda la Organización
    role user_role_type NOT NULL,
    max_daily_issue_cents BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, store_id, role)
);

-- 5. Catálogo de Cuentas Contables (Chart of Accounts)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    store_id UUID REFERENCES stores(id),
    code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    account_type account_category NOT NULL,
    normal_balance balance_direction NOT NULL,
    is_system_account BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (organization_id, store_id, code)
);

-- 6. Billeteras de Jugadores (Wallets)
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    player_user_id UUID NOT NULL REFERENCES users(id),
    liability_account_id UUID NOT NULL UNIQUE REFERENCES accounts(id),
    cached_available_cents BIGINT NOT NULL DEFAULT 0 CHECK (cached_available_cents >= 0),
    cached_escrow_cents BIGINT NOT NULL DEFAULT 0 CHECK (cached_escrow_cents >= 0),
    debt_balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (debt_balance_cents >= 0), -- Para Clawbacks cuando ya gastó el premio
    status wallet_status NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (organization_id, player_user_id)
);

-- 7. Políticas de Restricción de Uso de Crédito
CREATE TABLE restriction_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    priority_rank SMALLINT NOT NULL DEFAULT 100, -- Mayor valor = se consume primero en FEFO
    allow_cross_store BOOLEAN NOT NULL DEFAULT TRUE,
    allow_tournament_entry BOOLEAN NOT NULL DEFAULT TRUE,
    max_tournament_entry_pct SMALLINT NOT NULL DEFAULT 100 CHECK (max_tournament_entry_pct BETWEEN 0 AND 100),
    allowed_product_categories TEXT[] DEFAULT NULL,
    apply_list_price_only BOOLEAN NOT NULL DEFAULT FALSE,
    default_expiry_days INTEGER,
    UNIQUE (organization_id, code)
);

-- 8. Libro Diario (Journal Entries - Inmutable)
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    initiating_store_id UUID NOT NULL REFERENCES stores(id),
    idempotency_key VARCHAR(128) NOT NULL,
    operation_type ledger_operation_type NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    reversed_entry_id UUID UNIQUE REFERENCES journal_entries(id),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    co_authorized_by_user_id UUID REFERENCES users(id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (organization_id, idempotency_key),
    -- Regla Anti-Auto-Atención cuando aplica
    CONSTRAINT chk_maker_checker_distinct CHECK (
        co_authorized_by_user_id IS NULL OR created_by_user_id <> co_authorized_by_user_id
    )
);

-- 9. Líneas del Mayor (Ledger Lines - Partida Doble Inmutable)
CREATE TABLE ledger_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    wallet_id UUID REFERENCES wallets(id),
    debit_cents BIGINT NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
    credit_cents BIGINT NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_exclusively_debit_or_credit CHECK (
        (debit_cents > 0 AND credit_cents = 0) OR
        (credit_cents > 0 AND debit_cents = 0)
    )
);

CREATE INDEX idx_ledger_lines_entry ON ledger_lines (journal_entry_id);
CREATE INDEX idx_ledger_lines_wallet ON ledger_lines (wallet_id, created_at) WHERE wallet_id IS NOT NULL;

-- 10. Lotes de Crédito (Credit Lots para FEFO, Restricciones, Preventas y Transferencias)
CREATE TABLE credit_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    issuing_store_id UUID NOT NULL REFERENCES stores(id),
    origin_journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
    restriction_policy_id UUID NOT NULL REFERENCES restriction_policies(id),
    source_type credit_source_type NOT NULL,
    initial_amount_cents BIGINT NOT NULL CHECK (initial_amount_cents > 0),
    remaining_amount_cents BIGINT NOT NULL CHECK (remaining_amount_cents >= 0 AND remaining_amount_cents <= initial_amount_cents),
    locked_preorder_cents BIGINT NOT NULL DEFAULT 0 CHECK (locked_preorder_cents >= 0),
    is_retransferable BOOLEAN NOT NULL DEFAULT TRUE, -- Pasa a FALSE tras 1 salto P2P
    transferred_from_user_id UUID REFERENCES users(id),
    merged_from_user_id UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    expiration_paused_at TIMESTAMPTZ, -- Se activa mientras está en preventa activa
    status lot_status NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_credit_lots_fefo ON credit_lots (wallet_id, status, expires_at ASC NULLS LAST, created_at ASC)
    WHERE status = 'ACTIVE' AND remaining_amount_cents > 0;

-- 11. Desglose de Consumo de Lotes
CREATE TABLE credit_lot_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_lot_id UUID NOT NULL REFERENCES credit_lots(id),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
    ledger_line_id UUID NOT NULL REFERENCES ledger_lines(id),
    issuing_store_id UUID NOT NULL REFERENCES stores(id),
    redeeming_store_id UUID NOT NULL REFERENCES stores(id),
    amount_cents BIGINT NOT NULL CHECK (amount_cents <> 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 12. Vouchers Físicos Justificativos de Caja (Tickets Térmicos 58mm/80mm)
CREATE TABLE physical_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    journal_entry_id UUID NOT NULL UNIQUE REFERENCES journal_entries(id),
    voucher_folio VARCHAR(64) NOT NULL,          -- Ej: VCH-SUC01-20261017-0042
    voucher_type VARCHAR(32) NOT NULL,           -- 'REDEMPTION', 'TOURNAMENT_PRIZE', 'REFUND', 'PREORDER_HOLD'
    external_pos_ticket_ref VARCHAR(100),        -- Folio del ticket en el POS principal de la tienda
    player_user_id UUID NOT NULL REFERENCES users(id),
    cashier_user_id UUID NOT NULL REFERENCES users(id),
    shift_id UUID,
    total_purchase_reported_cents BIGINT NOT NULL CHECK (total_purchase_reported_cents >= 0),
    credit_applied_cents BIGINT NOT NULL CHECK (credit_applied_cents > 0),
    remaining_cash_or_card_cents BIGINT NOT NULL CHECK (remaining_cash_or_card_cents >= 0),
    wallet_balance_before_cents BIGINT NOT NULL,
    wallet_balance_after_cents BIGINT NOT NULL,
    concept_notes TEXT NOT NULL,
    auth_method_used VARCHAR(40) NOT NULL,       -- 'QR_DYNAMIC_TOTP', 'PUSH_2FA', 'PIN_OFFLINE_2FA'
    cryptographic_seal VARCHAR(64) NOT NULL,     -- Sello corto verificable impreso en el ticket
    print_count INTEGER NOT NULL DEFAULT 1,      -- >1 marca como "COPIA REIMPRESA - NO VALIDA PARA ARQUEO"
    last_printed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (organization_id, voucher_folio)
);

-- 13. Auditoría Forense Inmutable con Cadena de Hash (Hash-Chaining SHA-256)
CREATE TABLE security_audit_logs (
    seq_id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    store_id UUID REFERENCES stores(id),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    actor_role VARCHAR(32) NOT NULL,
    actor_ip VARCHAR(64) NOT NULL,
    actor_device_fp VARCHAR(128) NOT NULL,
    co_authorizer_id UUID REFERENCES users(id),
    co_auth_method VARCHAR(32),
    event_category VARCHAR(32) NOT NULL,
    event_action VARCHAR(64) NOT NULL,
    target_entity_type VARCHAR(32) NOT NULL,
    target_entity_id VARCHAR(128) NOT NULL,
    payload_before JSONB,
    payload_after JSONB NOT NULL,
    reason_code VARCHAR(64),
    reason_justification TEXT,
    prev_hash CHAR(64) NOT NULL,
    row_hash CHAR(64) NOT NULL UNIQUE,
    server_hmac CHAR(64) NOT NULL
);

-- =============================================================================
-- TRIGGERS DE INTEGRIDAD E INMUTABILIDAD CONTABLE Y FORENSE
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_immutable_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VIOLACION DE INMUTABILIDAD: La tabla % es estrictamente Append-Only. Operacion % bloqueada.', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_journal_entries
BEFORE UPDATE OR DELETE OR TRUNCATE ON journal_entries
FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_mutation();

CREATE TRIGGER trg_immutable_ledger_lines
BEFORE UPDATE OR DELETE OR TRUNCATE ON ledger_lines
FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_mutation();

CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE OR TRUNCATE ON security_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_mutation();

-- Trigger Diferido para Garantizar Partida Doble (Suma Debe == Suma Haber)
CREATE OR REPLACE FUNCTION verify_journal_entry_balanced()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debit BIGINT;
    v_total_credit BIGINT;
    v_line_count INT;
BEGIN
    SELECT COALESCE(SUM(debit_cents), 0),
           COALESCE(SUM(credit_cents), 0),
           COUNT(*)
      INTO v_total_debit, v_total_credit, v_line_count
      FROM ledger_lines
     WHERE journal_entry_id = NEW.id;

    IF v_line_count < 2 THEN
        RAISE EXCEPTION 'Asiento contable inválido (%): requiere mínimo 2 líneas (tiene %).', NEW.id, v_line_count;
    END IF;

    IF v_total_debit <> v_total_credit THEN
        RAISE EXCEPTION 'Asiento descuadrado (%): Total Debe (%) != Total Haber (%).', NEW.id, v_total_debit, v_total_credit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_double_entry_balance
AFTER INSERT ON journal_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_journal_entry_balanced();
