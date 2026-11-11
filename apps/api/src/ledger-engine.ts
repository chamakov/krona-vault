import { randomUUID, createHash } from 'node:crypto';
import {
  createDynamicQrToken,
  verifyDynamicQrToken,
  generatePlayerTotpPin,
  generateVoucherCryptographicSeal,
  generateCustodyReceiptSeal,
  computeAuditHashChainLink,
  hashCredential,
  verifyCredentialHash,
  createSessionToken,
  verifySessionToken,
  GENESIS_AUDIT_HASH,
  generateAuthenticatorSecret,
  formatBase32Secret,
  generateStandardTotpCode,
  verifyStandardTotpCode,
  generateOtpAuthUri,
} from '../../../packages/crypto-totp/src/index.ts';
import type {
  OrganizationSettings,
  StoreBranch,
  StoreProductCategory,
  StoreCreditSource,
  UserRoleType,
  CreditLot,
  PhysicalVoucher,
  ProductCategoryType,
  CreditSourceType,
  TournamentPrizeStanding,
  TournamentCategoryRecord,
  PokemonCategoryName,
  ParsedPokeStandings,
  CustodyPurposeItem,
  CustodyEvidenceTypeItem,
} from '../../../packages/shared-types/src/index.ts';

export const DEFAULT_CUSTODY_PURPOSES: CustodyPurposeItem[] = [
  {
    code: 'SAFE_KEEPING_VAULT',
    name: 'Guarda en Bóveda / Caja Fuerte',
    description: 'Guarda y custodia física en caja de seguridad de la tienda',
    defaultLocation: 'Caja Fuerte B - Casillero 04',
    isEnabled: true,
  },
  {
    code: 'GRADING_SUBMISSION',
    name: 'Envío a Calificar (PSA, BGS, CGC)',
    description: 'Recepción y consolidación de cartas para envío a graduación / encapsulado',
    defaultLocation: 'Gaveta Envíos PSA',
    isEnabled: true,
  },
  {
    code: 'CONSIGNMENT_ESCROW',
    name: 'Consignación / Escrow P2P en Vitrina',
    description: 'Cartas en exhibición para venta o intercambio seguro entre jugadores',
    defaultLocation: 'Vitrina Principal - Estante 2',
    isEnabled: true,
  },
  {
    code: 'DETAILED_APPRAISAL_PENDING',
    name: 'Valuación Minuciosa y Autenticidad',
    description: 'Recepción para autenticación con lupa/microscopio o cotización detallada',
    defaultLocation: 'Mostrador Taller de Valuación',
    isEnabled: true,
  },
  {
    code: 'TOURNAMENT_DECK_QUARANTINE',
    name: 'Cuarentena de Baraja (Tournament Deck Check)',
    description: 'Resguardo temporal para revisión de micas y lista de baraja por el Juez',
    defaultLocation: 'Mesa de Jueces L1/L2',
    isEnabled: true,
  },
];

export const DEFAULT_CUSTODY_EVIDENCE_TYPES: CustodyEvidenceTypeItem[] = [
  {
    code: 'PACKAGE_FRONT',
    name: 'Frontal del Sobre / Caja',
    description: 'Vista frontal del paquete, sobre o caja cerrada del cliente',
    isEnabled: true,
  },
  {
    code: 'PACKAGE_BACK',
    name: 'Reverso del Sobre / Paquete',
    description: 'Vista posterior del empaque, cierres y dobleces',
    isEnabled: true,
  },
  {
    code: 'CONTENT_VIEW',
    name: 'Contenido de Cartas / Toploaders',
    description: 'Fotografía de las cartas dentro del paquete o protectores rígidos',
    isEnabled: true,
  },
  {
    code: 'SEAL_VIEW',
    name: 'Etiqueta / Sello de Seguridad',
    description: 'Sello adhesivo, cinta o etiqueta del paquete',
    isEnabled: true,
  },
  {
    code: 'RECEIPT_STUB',
    name: 'Talón / Comprobante Físico',
    description: 'Fotografía del comprobante impreso o talón firmado',
    isEnabled: true,
  },
  {
    code: 'OTHER',
    name: 'Otra Evidencia Fotográfica',
    description: 'Detalles específicos de condición, esquinas o empaque exterior',
    isEnabled: true,
  },
];

export const DEFAULT_PRODUCT_CATEGORIES: StoreProductCategory[] = [
  { code: 'SEALED_PRODUCT', name: 'Producto Sellado (Sobres / Cajas / Bundles)', isEnabled: true },
  { code: 'SINGLES', name: 'Cartas Sueltas / Singles TCG', isEnabled: true },
  { code: 'ACCESSORIES', name: 'Accesorios (Micas / Deckboxes / Playmats)', isEnabled: true },
  { code: 'TOURNAMENT_ENTRY', name: 'Inscripción a Torneo', isEnabled: true },
  { code: 'SNACKS_DRINKS', name: 'Snacks y Bebidas', isEnabled: true },
];

export const DEFAULT_CREDIT_SOURCES: StoreCreditSource[] = [
  {
    code: 'SINGLES_TRADE_IN',
    name: 'Compra de Cartas Sueltas (Singles Trade-In)',
    description: 'Adquisición de cartas individuales con cargo a inventario de singles',
    defaultAccountCode: '1105',
    defaultExpiryDays: 180,
    isEnabled: true,
  },
  {
    code: 'RAFFLE_DOOR_PRIZE',
    name: 'Rifa / Door Prize de Torneo',
    description: 'Premios de asistencia, rifas entre rondas o dinámicas de comunidad',
    defaultAccountCode: '5102',
    defaultExpiryDays: 180,
    isEnabled: true,
  },
  {
    code: 'JUDGE_STAFF_BONUS',
    name: 'Compensación de Juez / Staff',
    description: 'Remuneración de jueces L1/L2, árbitros y apoyo logístico en torneos',
    defaultAccountCode: '5103',
    defaultExpiryDays: 365,
    isEnabled: true,
  },
  {
    code: 'PROMOTIONAL_BONUS',
    name: 'Bono Promocional / Campaña',
    description: 'Crédito de bienvenida o promociones temporales (prioridad FEFO alta)',
    defaultAccountCode: '5104',
    defaultExpiryDays: 90,
    isEnabled: true,
  },
  {
    code: 'BULK_BUYBACK',
    name: 'Compra de Lotes / Bulk TCG',
    description: 'Recepción de cajas de cartas comunes, infrecuentes y bulk en mostrador',
    defaultAccountCode: '1105',
    defaultExpiryDays: 180,
    isEnabled: true,
  },
  {
    code: 'LEAGUE_ACHIEVEMENT',
    name: 'Logros y Temporada de Liga',
    description: 'Abonos por clasificación mensual de jugadores en liga de tienda',
    defaultAccountCode: '5102',
    defaultExpiryDays: 180,
    isEnabled: true,
  },
  {
    code: 'MANUAL_ADJUSTMENT',
    name: 'Ajuste Manual Contable Autorizado',
    description: 'Ajuste auditado con requerimiento de co-autorización 4-Ojos',
    defaultAccountCode: '5105',
    defaultExpiryDays: 180,
    isEnabled: true,
  },
];

export type PermissionCode =
  | 'portal:nexus:view'
  | 'portal:wallet:view_own'
  | 'portal:pos:operate'
  | 'portal:trade_in:operate'
  | 'portal:tournaments:operate'
  | 'portal:stores:manage'
  | 'portal:users:manage_staff'
  | 'portal:users:register_player'
  | 'portal:audit:view'
  | 'portal:profile:manage_own'
  | 'portal:custody:operate'
  | 'custody:package:view'
  | 'custody:package:intake'
  | 'custody:photo:upload'
  | 'custody:package:inspect'
  | 'custody:package:release'
  | 'custody:package:cancel'
  | 'ledger:credit:issue'
  | 'pos:credit:redeem'
  | 'pos:voucher:reprint'
  | 'pos:refund:execute'
  | 'pos:preorder:manage'
  | 'pos:shift:close_z'
  | 'admin:accounts:merge'
  | 'admin:clawback:execute'
  | 'admin:policies:update'
  | 'admin:four_eyes:coauthorize'
  | 'admin:roles:impersonate';

export interface ActiveSessionRecord {
  sid: string;
  userId: string;
  memberCode: string;
  role: UserRoleType;
  storeId: string | null;
  authMode: 'PASSWORD' | 'PIN' | 'SUPERADMIN_IMPERSONATION';
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface RoleCapabilitySpec {
  role: UserRoleType;
  title: string;
  scope: 'GLOBAL' | 'STORE' | 'PERSONAL';
  defaultHomePortal: string;
  allowedPortals: string[];
  permissions: PermissionCode[];
  canCreateRoles: UserRoleType[];
  canIssueCredit: boolean;
  canRedeemPos: boolean;
  canManageTournaments: boolean;
  canCoAuthorizeFourEyes: boolean;
  isReadOnlyAuditor: boolean;
  summary: string;
}

export const ROLE_DEFINITION_MATRIX: Record<UserRoleType, RoleCapabilitySpec> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    title: 'Director Corporativo / SuperAdmin',
    scope: 'GLOBAL',
    defaultHomePortal: '/',
    allowedPortals: ['/', '/wallet', '/pos', '/trade-in', '/tournaments', '/custody', '/stores', '/users', '/profile', '/audit'],
    permissions: [
      'portal:nexus:view',
      'portal:wallet:view_own',
      'portal:pos:operate',
      'portal:trade_in:operate',
      'portal:tournaments:operate',
      'portal:stores:manage',
      'portal:users:manage_staff',
      'portal:users:register_player',
      'portal:audit:view',
      'portal:profile:manage_own',
      'portal:custody:operate',
      'custody:package:view',
      'custody:package:intake',
      'custody:photo:upload',
      'custody:package:inspect',
      'custody:package:release',
      'custody:package:cancel',
      'ledger:credit:issue',
      'pos:credit:redeem',
      'pos:voucher:reprint',
      'pos:refund:execute',
      'pos:preorder:manage',
      'pos:shift:close_z',
      'admin:accounts:merge',
      'admin:clawback:execute',
      'admin:policies:update',
      'admin:four_eyes:coauthorize',
      'admin:roles:impersonate',
    ],
    canCreateRoles: ['SUPER_ADMIN', 'STORE_ADMIN', 'TOURNAMENT_ORGANIZER', 'CASHIER', 'AUDITOR', 'PLAYER'],
    canIssueCredit: true,
    canRedeemPos: true,
    canManageTournaments: true,
    canCoAuthorizeFourEyes: true,
    isReadOnlyAuditor: false,
    summary: 'Control total multi-tienda, políticas corporativas, alta de cualquier rol, gestión de sucursales, Clawbacks, fusiones, resguardo y co-firma Four-Eyes global.',
  },
  STORE_ADMIN: {
    role: 'STORE_ADMIN',
    title: 'Gerente de Sucursal',
    scope: 'STORE',
    defaultHomePortal: '/',
    allowedPortals: ['/', '/wallet', '/pos', '/trade-in', '/tournaments', '/custody', '/stores', '/users', '/profile', '/audit'],
    permissions: [
      'portal:nexus:view',
      'portal:wallet:view_own',
      'portal:pos:operate',
      'portal:trade_in:operate',
      'portal:tournaments:operate',
      'portal:stores:manage',
      'portal:users:manage_staff',
      'portal:users:register_player',
      'portal:audit:view',
      'portal:profile:manage_own',
      'portal:custody:operate',
      'custody:package:view',
      'custody:package:intake',
      'custody:photo:upload',
      'custody:package:inspect',
      'custody:package:release',
      'custody:package:cancel',
      'ledger:credit:issue',
      'pos:credit:redeem',
      'pos:voucher:reprint',
      'pos:refund:execute',
      'pos:preorder:manage',
      'pos:shift:close_z',
      'admin:accounts:merge',
      'admin:clawback:execute',
      'admin:four_eyes:coauthorize',
    ],
    canCreateRoles: ['TOURNAMENT_ORGANIZER', 'CASHIER', 'AUDITOR', 'PLAYER'],
    canIssueCredit: true,
    canRedeemPos: true,
    canManageTournaments: true,
    canCoAuthorizeFourEyes: true,
    isReadOnlyAuditor: false,
    summary: 'Administra su sucursal, da de alta staff local, autoriza devoluciones, resguardo de cartas, Corte Z y firma 4-Ojos.',
  },
  TOURNAMENT_ORGANIZER: {
    role: 'TOURNAMENT_ORGANIZER',
    title: 'Juez Certificado / Organizador (TO)',
    scope: 'STORE',
    defaultHomePortal: '/tournaments',
    allowedPortals: ['/tournaments', '/trade-in', '/custody', '/users', '/profile'],
    permissions: [
      'portal:tournaments:operate',
      'portal:trade_in:operate',
      'portal:custody:operate',
      'custody:package:view',
      'custody:package:intake',
      'custody:photo:upload',
      'custody:package:inspect',
      'portal:users:register_player',
      'portal:profile:manage_own',
      'ledger:credit:issue',
    ],
    canCreateRoles: ['PLAYER'],
    canIssueCredit: true,
    canRedeemPos: false,
    canManageTournaments: true,
    canCoAuthorizeFourEyes: false,
    isReadOnlyAuditor: false,
    summary: 'Calcula pozos por ocupación, clasificaciones TOM/RK9, pactos Top Cut, dispersa premios, emite Trade-In y gestiona resguardo de barajas (Deck Checks).',
  },
  CASHIER: {
    role: 'CASHIER',
    title: 'Cajero de Mostrador POS',
    scope: 'STORE',
    defaultHomePortal: '/pos',
    allowedPortals: ['/pos', '/trade-in', '/custody', '/users', '/profile'],
    permissions: [
      'portal:pos:operate',
      'portal:trade_in:operate',
      'portal:custody:operate',
      'custody:package:view',
      'custody:package:intake',
      'custody:photo:upload',
      'custody:package:inspect',
      'custody:package:release',
      'portal:users:register_player',
      'portal:profile:manage_own',
      'pos:credit:redeem',
      'pos:voucher:reprint',
      'pos:refund:execute',
      'pos:preorder:manage',
    ],
    canCreateRoles: ['PLAYER'],
    canIssueCredit: false,
    canRedeemPos: true,
    canManageTournaments: false,
    canCoAuthorizeFourEyes: false,
    isReadOnlyAuditor: false,
    summary: 'Opera la terminal POS: cobra con 2FA, emite vouchers térmicos, gestiona recepción y entrega de cartas en resguardo con comprobante y da de alta jugadores.',
  },
  AUDITOR: {
    role: 'AUDITOR',
    title: 'Auditor Contable / Fiscal (Solo Lectura)',
    scope: 'GLOBAL',
    defaultHomePortal: '/audit',
    allowedPortals: ['/audit', '/custody', '/profile'],
    permissions: [
      'portal:audit:view',
      'portal:custody:operate',
      'custody:package:view',
      'portal:profile:manage_own',
    ],
    canCreateRoles: [],
    canIssueCredit: false,
    canRedeemPos: false,
    canManageTournaments: false,
    canCoAuthorizeFourEyes: false,
    isReadOnlyAuditor: true,
    summary: 'Inspección forense de solo lectura: Libro Mayor, verificador de vouchers, auditoría de paquetes en custodia y cadena SHA-256.',
  },
  PLAYER: {
    role: 'PLAYER',
    title: 'Jugador / Competidor TCG',
    scope: 'PERSONAL',
    defaultHomePortal: '/wallet',
    allowedPortals: ['/wallet', '/profile'],
    permissions: [
      'portal:wallet:view_own',
      'custody:package:view',
      'portal:profile:manage_own',
    ],
    canCreateRoles: [],
    canIssueCredit: false,
    canRedeemPos: false,
    canManageTournaments: false,
    canCoAuthorizeFourEyes: false,
    isReadOnlyAuditor: false,
    summary: 'Acceso personal a su billetera móvil KRONA Pass™ (/wallet), resguardos personales activos, QR 30s, PIN Offline y autoprotección.',
  },
};

export type CustodyPurpose =
  | 'SAFE_KEEPING_VAULT'
  | 'GRADING_SUBMISSION'
  | 'CONSIGNMENT_ESCROW'
  | 'DETAILED_APPRAISAL_PENDING'
  | 'TOURNAMENT_DECK_QUARANTINE'
  | (string & {});

export type CustodyStatus =
  | 'RECEIVED'
  | 'IN_VAULT'
  | 'READY_FOR_PICKUP'
  | 'RELEASED'
  | 'CANCELLED_ERROR';

export type CustodyPhotoType =
  | 'PACKAGE_FRONT'
  | 'PACKAGE_BACK'
  | 'CONTENT_VIEW'
  | 'SEAL_VIEW'
  | 'SEAL_LABEL'
  | 'RECEIPT_STUB'
  | 'OTHER'
  | (string & {});

export interface CustodyPhotoEvidence {
  id: string;
  photoType: CustodyPhotoType;
  caption?: string;
  dataUri: string;
  sha256Hash: string;
  capturedAt: string;
}

export interface CustodyCardItem {
  id: string;
  game?: string;
  cardName: string;
  condition?: string;
  quantity: number;
  declaredItemValueCents?: number;
  setName?: string;
  isFoil?: boolean;
  notes?: string;
}

export interface CustodyPackageRecord {
  id: string;
  folio: string;
  storeId: string;
  storeCode: string;
  clientUserId: string;
  clientMemberCode: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  // Quién Deja (Remitente / Depositor)
  depositorUserId?: string | null;
  depositorMemberCode?: string | null;
  depositorName: string;
  depositorPhone?: string | null;
  depositorEmail?: string | null;
  // Quién Recibe (Destinatario Titular / Recipient)
  recipientUserId?: string | null;
  recipientMemberCode?: string | null;
  recipientName: string;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  // Resguardo para terceros (P2P / Escrow)
  isForThirdParty: boolean;
  // Control de entrega
  pickedUpByName?: string | null;
  pickedUpByRole?: string | null;
  purpose: CustodyPurpose;
  status: CustodyStatus;
  statusReason?: string | null;
  vaultLocation: string;
  tamperSealNumber: string;
  declaredValueCents: number;
  isHighValue: boolean;
  itemsSummary: string;
  totalCardsCount: number;
  items: CustodyCardItem[];
  photos: CustodyPhotoEvidence[];
  packageContentDigest: string;
  claimVerificationCode: string;
  claimTokenHash: string;
  receiptToken: string;
  receiptFolio: string;
  receiptPrintCount: number;
  dueDate: string;
  intakeTimestamp: string;
  intakeStaffId: string;
  intakeStaffName: string;
  intakeSupervisorId?: string | null;
  releaseStaffId?: string | null;
  releaseStaffName?: string | null;
  releasedAt?: string | null;
  coAuthorizerId?: string | null;
  coAuthorizerName?: string | null;
  clientSignatureProof?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentParticipantRecord {
  playerUserId: string;
  playerMemberCode: string;
  playerName: string;
  playerAlias: string;
  enrolledAt: string;
  enrolledByUserId: string;
  enrolledByName: string;
  checkedIn: boolean;
  matchRecord: string;
}

export interface TournamentRecord {
  id: string;
  folio: string;
  name: string;
  gameFormat: string;
  gameType?: 'POKEMON_TCG' | 'POKEMON_VGC' | 'POKEMON_GO' | 'MAGIC' | 'YUGIOH' | 'ONE_PIECE' | 'LORCANA' | 'OTHER' | string;
  storeId: string;
  storeCode: string;
  storeName: string;
  status: 'OPEN_REGISTRATION' | 'DISPERSED_COMPLETED' | 'CANCELLED';
  entryFeeCents: number;
  prizeContributionPerPlayerCents: number;
  guaranteedPrizePoolCents: number;
  calculatedPrizePoolCents: number;
  participants: TournamentParticipantRecord[];
  categories?: TournamentCategoryRecord[];
  unifyCategoriesPool?: boolean;
  unifySeniorJunior?: boolean;
  sourceStandingsRaw?: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  applyTop4Split?: boolean;
  standings?: TournamentPrizeStanding[];
  dispersedByUserId?: string;
  dispersedByName?: string;
  coAuthorizedByUserId?: string | null;
  coAuthorizedByName?: string | null;
  dispersedAt?: string;
}


export interface LedgerLineRecord {
  id: string;
  journalEntryId: string;
  storeId: string;
  storeCode: string;
  accountCode: string;
  accountName: string;
  walletId?: string;
  debitCents: number;
  creditCents: number;
}

export interface JournalEntryRecord {
  id: string;
  organizationId: string;
  initiatingStoreId: string;
  initiatingStoreCode?: string;
  idempotencyKey: string;
  operationType: string;
  referenceId: string;
  description: string;
  createdByUserId: string;
  createdByMemberCode?: string;
  createdByFullName?: string;
  createdByRole?: UserRoleType;
  coAuthorizedByUserId: string | null;
  coAuthorizedByMemberCode?: string | null;
  coAuthorizedByName?: string | null;
  postedAt: string;
  createdAt?: string;
  lines: LedgerLineRecord[];
}

export interface AuditLogRecord {
  seqId: number;
  seqNo?: number;
  eventId: string;
  createdAt: string;
  orgId: string;
  storeId: string;
  storeCode?: string;
  actorUserId: string;
  actorMemberCode?: string;
  actorFullName?: string;
  actorAlias?: string;
  actorRole: UserRoleType;
  coAuthorizerId: string | null;
  coAuthorizerMemberCode?: string | null;
  coAuthorizerName?: string | null;
  coAuthMethod: string | null;
  eventAction: string;
  targetEntityId: string;
  targetMemberCode?: string | null;
  targetFullName?: string | null;
  payloadBefore: Record<string, unknown>;
  payloadAfter: Record<string, unknown>;
  reasonJustification: string;
  prevHash: string;
  rowHash: string;
  serverHmac: string;
}

export interface PlayerWalletState {
  walletId: string;
  userId: string;
  memberCode: string;
  fullName: string;
  alias: string;
  email: string;
  phone: string;
  role: UserRoleType;
  assignedStoreId: string | null;
  passwordHash: string;
  securityPinHash: string | null;
  deviceSecret: string;
  authenticatorSecret?: string | null;
  authenticatorSyncedAt?: string | null;
  availableBalanceCents: number;
  escrowPreorderCents: number;
  debtBalanceCents: number;
  status: 'ACTIVE' | 'FROZEN_DISPUTE' | 'SELF_LOCKED' | 'SUSPENDED' | 'MERGED_INACTIVE';
  mergedIntoUserId?: string;
  createdAt: string;
  createdByUserId: string;
  lastLoginAt: string | null;
  lots: CreditLot[];
}

export interface PreorderHoldRecord {
  id: string;
  storeId: string;
  playerUserId: string;
  preorderRef: string;
  amountCents: number;
  status: 'HELD' | 'CANCELLED' | 'FULFILLED';
  lockedLots: Array<{
    lotId: string;
    amountCents: number;
    originalExpiresAt: string | null;
    pausedAt: string;
  }>;
}

export interface PosRedemptionRecord {
  voucherFolio: string;
  storeId: string;
  playerUserId: string;
  totalTicketCents: number;
  creditAppliedCents: number;
  cashOrCardPaidCents: number;
  refundedCreditCents: number;
  refundedCashCents: number;
  consumedLots: Array<{
    lotId: string;
    issuingStoreId: string;
    amountCents: number;
    originalExpiresAt: string | null;
    allowedCategories: ProductCategoryType[] | null;
    priorityRank: number;
  }>;
}

export interface StoreShiftClosureReport {
  closureId: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  closedAt: string;
  closedByUserId: string;
  vouchersCount: number;
  firstVoucherFolio: string | null;
  lastVoucherFolio: string | null;
  totalCreditRedeemedCents: number;
  totalCashOrCardComplementCents: number;
  totalCreditRefundedCents: number;
  totalCreditIssuedInStoreCents: number;
  reprintedVouchersAlert: Array<{
    voucherFolio: string;
    printCount: number;
    creditAppliedCents: number;
    externalPosTicketRef: string;
  }>;
  interStoreReceivableCents: number;
  interStorePayableCents: number;
  closingLedgerHash: string;
  thermalClosureText: string;
}

export class ControlCreditoEngine {
  public org: OrganizationSettings;
  public stores: Map<string, StoreBranch> = new Map();
  public walletsByUser: Map<string, PlayerWalletState> = new Map();
  public tournaments: Map<string, TournamentRecord> = new Map();
  public journalEntries: JournalEntryRecord[] = [];
  public idempotencyKeys: Set<string> = new Set();
  public vouchers: Map<string, PhysicalVoucher> = new Map();
  public redemptionsByVoucher: Map<string, PosRedemptionRecord> = new Map();
  public preorderHolds: Map<string, PreorderHoldRecord> = new Map();
  public shiftClosures: StoreShiftClosureReport[] = [];
  public auditLogs: AuditLogRecord[] = [];
  public usedQrNonces: Map<string, number> = new Map();
  public activeSessions: Map<string, ActiveSessionRecord> = new Map();
  public custodyPackages: Map<string, CustodyPackageRecord> = new Map();
  public custodyPurposes: CustodyPurposeItem[] = JSON.parse(JSON.stringify(DEFAULT_CUSTODY_PURPOSES));
  public custodyEvidenceTypes: CustodyEvidenceTypeItem[] = JSON.parse(JSON.stringify(DEFAULT_CUSTODY_EVIDENCE_TYPES));
  private voucherSequence: number = 0;
  private tournamentSequence: number = 0;
  private custodySequence: number = 0;
  private readonly hsmSecret: string;

  constructor(hsmSecret: string = 'prod_hsm_secret_control_credito_2026') {
    this.hsmSecret = hsmSecret;
    this.org = {
      id: 'org_main_01',
      name: 'Red de Tiendas TCG & Hobby',
      taxId: 'RTT260101AAA',
      currencyCode: 'MXN',
      sharingPolicy: 'ORG_POOLED_SAME_ENTITY',
      p2pPolicy: 'DISABLED',
      p2pFeeBps: 500,
      p2pMonthlyLimitCents: 200_000,
      requireFourEyesThresholdCents: 100_000,
      minSingleIssuanceCents: 100,
      maxSingleIssuanceCents: 5_000_000,
      requirePosVoucherPrint: true,
    };

    this.registerStore({
      id: 'store_centro',
      organizationId: this.org.id,
      code: 'SUC-CENTRO',
      name: 'Sucursal Centro (Matriz)',
      legalEntityTaxId: 'RTT260101AAA',
      address: 'Av. Central #104, Local B',
      voucherPrefix: 'VCH-CEN',
      isActive: true,
    });

    this.registerStore({
      id: 'store_norte',
      organizationId: this.org.id,
      code: 'SUC-NORTE',
      name: 'Sucursal Plaza Norte',
      legalEntityTaxId: 'RTT260101AAA',
      address: 'Blvd. Norte #890, Nivel 2',
      voucherPrefix: 'VCH-NOR',
      isActive: true,
    });
  }

  public getHsmSecret(): string {
    return this.hsmSecret;
  }

  public registerStore(store: StoreBranch): void {
    if (!store.productCategories || store.productCategories.length === 0) {
      store.productCategories = DEFAULT_PRODUCT_CATEGORIES.map((c) => ({ ...c }));
    }
    if (!store.creditSources || store.creditSources.length === 0) {
      store.creditSources = DEFAULT_CREDIT_SOURCES.map((c) => ({ ...c }));
    }
    this.stores.set(store.id, store);
  }

  /**
   * Da de alta una nueva sucursal comercial (Exclusivo SUPER_ADMIN)
   */
  public createStoreBranch(params: {
    actorUserId: string;
    name: string;
    code?: string;
    address?: string;
    legalEntityTaxId?: string;
    voucherPrefix?: string;
    isActive?: boolean;
    productCategories?: StoreProductCategory[];
    creditSources?: StoreCreditSource[];
  }): StoreBranch {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) {
      throw new Error(`ACTOR_NO_ENCONTRADO: El usuario actor ${params.actorUserId} no existe.`);
    }
    if (actor.role !== 'SUPER_ADMIN') {
      throw new Error(`PERMISO_DENEGADO_RBAC: Solo un SUPER_ADMIN puede dar de alta nuevas sucursales.`);
    }

    const cleanName = (params.name || '').trim();
    if (!cleanName) {
      throw new Error(`NOMBRE_INVALIDO: El nombre de la sucursal es obligatorio.`);
    }

    let code = (params.code || '').trim().toUpperCase();
    if (!code) {
      const slug = cleanName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
      code = `SUC-${slug || Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (!code.startsWith('SUC-')) {
      code = `SUC-${code}`;
    }

    for (const existing of this.stores.values()) {
      if (existing.code === code) {
        throw new Error(`CODIGO_DUPLICADO: Ya existe una sucursal con el código ${code}.`);
      }
    }

    let vPrefix = (params.voucherPrefix || '').trim().toUpperCase();
    if (!vPrefix) {
      vPrefix = `VCH-${code.replace('SUC-', '').slice(0, 4)}`;
    }
    if (!vPrefix.startsWith('VCH-')) {
      vPrefix = `VCH-${vPrefix}`;
    }

    const storeId = `store_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${randomUUID().slice(0, 6)}`;
    const newStore: StoreBranch = {
      id: storeId,
      organizationId: this.org.id,
      code,
      name: cleanName,
      legalEntityTaxId: (params.legalEntityTaxId || this.org.taxId || 'RTT260101AAA').trim().toUpperCase(),
      address: (params.address || 'Sede sin dirección física registrada').trim(),
      voucherPrefix: vPrefix,
      isActive: params.isActive !== false,
      productCategories: params.productCategories?.length
        ? params.productCategories.map((c) => ({ ...c }))
        : DEFAULT_PRODUCT_CATEGORIES.map((c) => ({ ...c })),
      creditSources: params.creditSources?.length
        ? params.creditSources.map((c) => ({ ...c }))
        : DEFAULT_CREDIT_SOURCES.map((c) => ({ ...c })),
    };

    this.stores.set(newStore.id, newStore);

    this.appendAuditLog({
      storeId: newStore.id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'STORE_BRANCH_CREATED',
      targetEntityId: newStore.id,
      payloadBefore: {},
      payloadAfter: { store: newStore },
      reasonJustification: `Alta de nueva sucursal comercial ${newStore.name} (${newStore.code}) por SUPER_ADMIN`,
    });

    return newStore;
  }

  /**
   * Modifica parámetros operativos de una sucursal (SUPER_ADMIN o STORE_ADMIN asignado)
   */
  public updateStoreBranch(params: {
    actorUserId: string;
    storeId: string;
    name?: string;
    code?: string;
    address?: string;
    legalEntityTaxId?: string;
    voucherPrefix?: string;
    isActive?: boolean;
    productCategories?: StoreProductCategory[];
    creditSources?: StoreCreditSource[];
  }): StoreBranch {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) {
      throw new Error(`ACTOR_NO_ENCONTRADO: El usuario actor ${params.actorUserId} no existe.`);
    }
    const store = this.stores.get(params.storeId);
    if (!store) {
      throw new Error(`TIENDA_NO_ENCONTRADA: La sucursal ${params.storeId} no existe.`);
    }

    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const isStoreAdminOfThis = actor.role === 'STORE_ADMIN' && actor.assignedStoreId === params.storeId;
    if (!isSuperAdmin && !isStoreAdminOfThis) {
      throw new Error(`PERMISO_DENEGADO_RBAC: No tienes privilegios para editar la configuración de esta sucursal.`);
    }

    const beforeState = { ...store };

    if (params.name !== undefined) {
      const cleanName = params.name.trim();
      if (!cleanName) throw new Error(`NOMBRE_INVALIDO: El nombre no puede estar vacío.`);
      store.name = cleanName;
    }

    if (params.code !== undefined && isSuperAdmin) {
      let cleanCode = params.code.trim().toUpperCase();
      if (!cleanCode.startsWith('SUC-')) cleanCode = `SUC-${cleanCode}`;
      for (const [id, s] of this.stores.entries()) {
        if (id !== store.id && s.code === cleanCode) {
          throw new Error(`CODIGO_DUPLICADO: Ya existe otra sucursal con el código ${cleanCode}.`);
        }
      }
      store.code = cleanCode;
    }

    if (params.address !== undefined) {
      store.address = params.address.trim();
    }

    if (params.legalEntityTaxId !== undefined) {
      store.legalEntityTaxId = params.legalEntityTaxId.trim().toUpperCase();
    }

    if (params.voucherPrefix !== undefined && isSuperAdmin) {
      let vPrefix = params.voucherPrefix.trim().toUpperCase();
      if (!vPrefix.startsWith('VCH-')) vPrefix = `VCH-${vPrefix}`;
      store.voucherPrefix = vPrefix;
    }

    if (params.isActive !== undefined && isSuperAdmin) {
      store.isActive = Boolean(params.isActive);
    }

    if (params.productCategories !== undefined) {
      store.productCategories = params.productCategories
        .map((c) => ({
          code: String(c.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          name: String(c.name || '').trim(),
          description: c.description ? String(c.description).trim() : undefined,
          isEnabled: c.isEnabled !== false,
        }))
        .filter((c) => c.code && c.name);
    }

    if (params.creditSources !== undefined) {
      store.creditSources = params.creditSources
        .map((c) => ({
          code: String(c.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          name: String(c.name || '').trim(),
          description: c.description ? String(c.description).trim() : undefined,
          defaultAccountCode: c.defaultAccountCode ? String(c.defaultAccountCode).trim() : '5101',
          defaultExpiryDays: typeof c.defaultExpiryDays === 'number' ? Math.max(0, c.defaultExpiryDays) : 180,
          isEnabled: c.isEnabled !== false,
        }))
        .filter((c) => c.code && c.name);
    }

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'STORE_BRANCH_UPDATED',
      targetEntityId: store.id,
      payloadBefore: beforeState as any,
      payloadAfter: { ...store } as any,
      reasonJustification: `Actualización de parámetros operativos de la sucursal ${store.name} (${store.code})`,
    });

    return store;
  }

  /**
   * Obtiene las categorías de producto configuradas para una sucursal (o defaults si no tiene)
   */
  public getStoreProductCategories(storeId: string): StoreProductCategory[] {
    const store = this.stores.get(storeId);
    if (!store || !store.productCategories || store.productCategories.length === 0) {
      return DEFAULT_PRODUCT_CATEGORIES.map((c) => ({ ...c }));
    }
    return store.productCategories;
  }

  /**
   * Actualiza el catálogo de categorías de producto de una sucursal (personalización FEFO)
   */
  public updateStoreProductCategories(params: {
    actorUserId: string;
    storeId: string;
    categories: StoreProductCategory[];
  }): StoreBranch {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) {
      throw new Error(`ACTOR_NO_ENCONTRADO: El usuario actor ${params.actorUserId} no existe.`);
    }
    const store = this.stores.get(params.storeId);
    if (!store) {
      throw new Error(`TIENDA_NO_ENCONTRADA: La sucursal ${params.storeId} no existe.`);
    }
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const isStoreAdminOfThis = actor.role === 'STORE_ADMIN' && actor.assignedStoreId === params.storeId;
    if (!isSuperAdmin && !isStoreAdminOfThis) {
      throw new Error(`PERMISO_DENEGADO_RBAC: Solo un Administrador de la Sede o SUPER_ADMIN puede personalizar las categorías de producto.`);
    }

    const beforeCategories = store.productCategories ? [...store.productCategories] : [];
    const sanitized = (params.categories || [])
      .map((c) => ({
        code: String(c.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        name: String(c.name || '').trim(),
        description: c.description ? String(c.description).trim() : undefined,
        isEnabled: c.isEnabled !== false,
      }))
      .filter((c) => c.code && c.name);

    if (sanitized.length === 0) {
      throw new Error('CATEGORIAS_INVALIDAS: Debe existir al menos una categoría de producto válida en la sucursal.');
    }

    store.productCategories = sanitized;

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'STORE_CATEGORIES_UPDATED',
      targetEntityId: store.id,
      payloadBefore: { productCategories: beforeCategories },
      payloadAfter: { productCategories: sanitized },
      reasonJustification: `Actualización de catálogo de categorías de producto de la sucursal ${store.name}`,
    });

    return store;
  }

  /**
   * Obtiene los orígenes contables de crédito configurados para una sucursal (o defaults si no tiene)
   */
  public getStoreCreditSources(storeId: string): StoreCreditSource[] {
    const store = this.stores.get(storeId);
    if (!store || !store.creditSources || store.creditSources.length === 0) {
      return DEFAULT_CREDIT_SOURCES.map((c) => ({ ...c }));
    }
    return store.creditSources;
  }

  /**
   * Actualiza el catálogo de orígenes contables de crédito de una sucursal
   */
  public updateStoreCreditSources(params: {
    actorUserId: string;
    storeId: string;
    creditSources: StoreCreditSource[];
  }): StoreBranch {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) {
      throw new Error(`ACTOR_NO_ENCONTRADO: El usuario actor ${params.actorUserId} no existe.`);
    }
    const store = this.stores.get(params.storeId);
    if (!store) {
      throw new Error(`TIENDA_NO_ENCONTRADA: La sucursal ${params.storeId} no existe.`);
    }
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const isStoreAdminOfThis = actor.role === 'STORE_ADMIN' && actor.assignedStoreId === params.storeId;
    if (!isSuperAdmin && !isStoreAdminOfThis) {
      throw new Error(`PERMISO_DENEGADO_RBAC: Solo un Administrador de la Sede o SUPER_ADMIN puede personalizar los orígenes contables de crédito.`);
    }

    const beforeSources = store.creditSources ? [...store.creditSources] : [];
    const sanitized = (params.creditSources || [])
      .map((c) => ({
        code: String(c.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        name: String(c.name || '').trim(),
        description: c.description ? String(c.description).trim() : undefined,
        defaultAccountCode: c.defaultAccountCode ? String(c.defaultAccountCode).trim() : '5101',
        defaultExpiryDays: typeof c.defaultExpiryDays === 'number' ? Math.max(0, c.defaultExpiryDays) : 180,
        isEnabled: c.isEnabled !== false,
      }))
      .filter((c) => c.code && c.name);

    if (sanitized.length === 0) {
      throw new Error('ORIGENES_INVALIDOS: Debe existir al menos un origen contable de crédito válido en la sucursal.');
    }

    store.creditSources = sanitized;

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'STORE_CREDIT_SOURCES_UPDATED',
      targetEntityId: store.id,
      payloadBefore: { creditSources: beforeSources },
      payloadAfter: { creditSources: sanitized },
      reasonJustification: `Actualización de catálogo de orígenes contables de crédito de la sucursal ${store.name}`,
    });

    return store;
  }

  /**
   * Pausa/reactiva (baja/alta lógica) una sucursal (Exclusivo SUPER_ADMIN)
   */
  public toggleStoreBranchStatus(params: {
    actorUserId: string;
    storeId: string;
    isActive?: boolean;
    reason?: string;
  }): StoreBranch {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor || actor.role !== 'SUPER_ADMIN') {
      throw new Error(`PERMISO_DENEGADO_RBAC: Solo un SUPER_ADMIN puede activar o desactivar sucursales.`);
    }
    const store = this.stores.get(params.storeId);
    if (!store) {
      throw new Error(`TIENDA_NO_ENCONTRADA: La sucursal ${params.storeId} no existe.`);
    }

    const newStatus = params.isActive !== undefined ? Boolean(params.isActive) : !store.isActive;
    const beforeState = { ...store };
    store.isActive = newStatus;

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: newStatus ? 'STORE_BRANCH_ACTIVATED' : 'STORE_BRANCH_DEACTIVATED',
      targetEntityId: store.id,
      payloadBefore: beforeState as any,
      payloadAfter: { ...store } as any,
      reasonJustification: params.reason || (newStatus ? 'Reactivación operativa de sucursal' : 'Baja lógica / Cierre temporal de sucursal'),
    });

    return store;
  }

  /**
   * Elimina permanentemente una sucursal siempre y cuando NO tenga historial contable ni personal asignado
   */
  public deleteStoreBranch(params: {
    actorUserId: string;
    storeId: string;
    reason?: string;
  }): { success: boolean; deletedStoreId: string; storeName: string } {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor || actor.role !== 'SUPER_ADMIN') {
      throw new Error(`PERMISO_DENEGADO_RBAC: Solo un SUPER_ADMIN puede eliminar una sucursal.`);
    }
    const store = this.stores.get(params.storeId);
    if (!store) {
      throw new Error(`TIENDA_NO_ENCONTRADA: La sucursal ${params.storeId} no existe.`);
    }

    const assignedUsers = Array.from(this.walletsByUser.values()).filter(
      (u) => u.assignedStoreId === params.storeId
    );
    if (assignedUsers.length > 0) {
      throw new Error(
        `TIENDA_CON_USUARIOS: La sucursal tiene ${assignedUsers.length} usuario(s) asignado(s). Reasigna su personal a otra sede o utiliza la desactivación (baja lógica).`
      );
    }

    const hasVouchers = Array.from(this.vouchers.values()).some(
      (v) => v.storeId === params.storeId
    );
    if (hasVouchers) {
      throw new Error(
        `TIENDA_CON_HISTORIAL_VOUCHERS: La sucursal tiene vouchers térmicos emitidos en el libro contable. Utiliza la desactivación en lugar de eliminación para cumplir con las normas de auditoría.`
      );
    }

    const hasTournaments = Array.from(this.tournaments.values()).some(
      (t) => t.storeId === params.storeId
    );
    if (hasTournaments) {
      throw new Error(
        `TIENDA_CON_HISTORIAL_TORNEOS: La sucursal tiene torneos registrados. Desactiva la tienda en lugar de eliminarla.`
      );
    }

    const storeName = store.name;
    const storeCode = store.code;
    this.stores.delete(params.storeId);

    this.appendAuditLog({
      storeId: params.storeId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'STORE_BRANCH_DELETED',
      targetEntityId: params.storeId,
      payloadBefore: { ...store } as any,
      payloadAfter: { deleted: true },
      reasonJustification: params.reason || `Eliminación permanente de sucursal sin historial ${storeName} (${storeCode})`,
    });

    return { success: true, deletedStoreId: params.storeId, storeName };
  }

  /**
   * Obtiene la primera sucursal activa existente en el motor para evitar fallbacks quemados
   */
  public getFirstAvailableStoreId(): string {
    const active = Array.from(this.stores.values()).find((s) => s.isActive);
    if (active) return active.id;
    const first = Array.from(this.stores.values())[0];
    if (first) return first.id;
    return 'store_centro';
  }

  public registerUser(params: {
    userId: string;
    memberCode: string;
    fullName: string;
    alias: string;
    role: UserRoleType;
    email?: string;
    phone?: string;
    assignedStoreId?: string | null;
    password?: string;
    securityPin?: string | null;
    createdByUserId?: string;
    deviceSecret?: string;
    authenticatorSecret?: string | null;
    authenticatorSyncedAt?: string | null;
  }): PlayerWalletState {
    const cleanAlias = params.alias.startsWith('@') ? params.alias : `@${params.alias}`;
    const defaultEmail =
      params.email ?? `${cleanAlias.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@kronavault.mx`;
    const defaultStore =
      params.assignedStoreId !== undefined
        ? params.assignedStoreId
        : params.role === 'SUPER_ADMIN' || params.role === 'AUDITOR'
          ? null
          : this.getFirstAvailableStoreId();

    const wallet: PlayerWalletState = {
      walletId: `wal_${params.userId}`,
      userId: params.userId,
      memberCode: params.memberCode,
      fullName: params.fullName,
      alias: cleanAlias,
      email: defaultEmail,
      phone: params.phone ?? '+52 55 0000 0000',
      role: params.role,
      assignedStoreId: defaultStore,
      passwordHash: hashCredential(params.password ?? 'krona2026'),
      securityPinHash: params.securityPin?.trim() ? hashCredential(params.securityPin.trim()) : null,
      deviceSecret: params.deviceSecret ?? `sec_${params.userId}_${randomUUID().slice(0, 8)}`,
      authenticatorSecret: params.authenticatorSecret ?? null,
      authenticatorSyncedAt: params.authenticatorSyncedAt ?? null,
      availableBalanceCents: 0,
      escrowPreorderCents: 0,
      debtBalanceCents: 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      createdByUserId: params.createdByUserId ?? 'SYSTEM_SEED',
      lastLoginAt: null,
      lots: [],
    };
    this.walletsByUser.set(params.userId, wallet);
    return wallet;
  }

  /**
   * Bloqueo de emergencia de cuenta (Self-Lock por robo de celular/gafete) y rotación de semilla TOTP
   */
  public toggleWalletSecurityLock(params: {
    storeId: string;
    targetUserId: string;
    actorUserId: string;
    actorRole: UserRoleType;
    lock: boolean;
    rotateSecret?: boolean;
    reason: string;
  }): PlayerWalletState {
    const wallet = this.walletsByUser.get(params.targetUserId);
    if (!wallet) throw new Error('JUGADOR_NO_ENCONTRADO');
    if (wallet.status === 'FROZEN_DISPUTE' && !params.lock) {
      throw new Error('NO_DESBLOQUEABLE_CON_DISPUTA: La cuenta tiene saldo deudor por Clawback.');
    }

    const prevStatus = wallet.status;
    wallet.status = params.lock ? 'SELF_LOCKED' : 'ACTIVE';
    if (params.rotateSecret) {
      wallet.deviceSecret = `sec_${wallet.userId}_${randomUUID().slice(0, 12)}`;
    }

    this.appendAuditLog({
      storeId: params.storeId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: params.lock ? 'WALLET_EMERGENCY_LOCKED' : 'WALLET_UNLOCKED',
      targetEntityId: wallet.walletId,
      payloadBefore: { status: prevStatus },
      payloadAfter: { status: wallet.status, secretRotated: Boolean(params.rotateSecret) },
      reasonJustification: params.reason,
    });

    return wallet;
  }

  /**
   * Calcula y distribuye un Pozo de Torneo con soporte para Splits de Suma Cero en Top Cut
   */
  public calculateTournamentSplit(
    totalPoolCents: number,
    standings: Array<{
      position: number;
      playerUserId: string;
      playerMemberCode: string;
      playerName: string;
      record: string;
      defaultPercentageBps: number;
      inTopSplit: boolean;
    }>
  ): TournamentPrizeStanding[] {
    const splitGroup = standings.filter((s) => s.inTopSplit);
    const totalSplitBps = splitGroup.reduce((acc, s) => acc + s.defaultPercentageBps, 0);

    let allocatedTotal = 0;
    const result: TournamentPrizeStanding[] = standings.map((s) => {
      const effectiveBps = s.inTopSplit
        ? Math.floor(totalSplitBps / splitGroup.length)
        : s.defaultPercentageBps;
      const awardedCents = Math.floor((totalPoolCents * effectiveBps) / 10_000);
      allocatedTotal += awardedCents;
      return {
        position: s.position,
        playerUserId: s.playerUserId,
        playerMemberCode: s.playerMemberCode,
        playerName: s.playerName,
        record: s.record,
        inTopSplit: s.inTopSplit,
        percentageBps: effectiveBps,
        awardedCents,
      };
    });

    const remainder = totalPoolCents - allocatedTotal;
    if (remainder !== 0 && result.length > 0) {
      result[0].awardedCents += remainder;
    }

    return result;
  }

  /**
   * Emite crédito a un jugador (Premio de Torneo, Rifa, Bono de Juez, Trade-in)
   */
  public issueCredit(params: {
    storeId: string;
    targetUserId: string;
    actorUserId: string;
    actorRole: UserRoleType;
    coAuthorizerUserId?: string;
    amountCents: number;
    sourceType: CreditSourceType;
    sourceLabel: string;
    referenceId?: string;
    expiryDays: number | null;
    allowedCategories?: ProductCategoryType[] | null;
    priorityRank?: number;
    idempotencyKey?: string;
  }): { journalEntry: JournalEntryRecord; lot: CreditLot | null; debtAbsorbedCents: number } {
    if (params.amountCents <= 0) {
      throw new Error('MONTO_INVALIDO: El monto a emitir debe ser mayor a 0 centavos.');
    }
    const minCents = this.org.minSingleIssuanceCents ?? 100;
    const maxCents = this.org.maxSingleIssuanceCents ?? 5_000_000;
    if (params.amountCents < minCents) {
      throw new Error(`MONTO_MENOR_AL_MINIMO: El monto mínimo de emisión configurado es de $${(minCents / 100).toFixed(2)} MXN.`);
    }
    if (params.amountCents > maxCents) {
      throw new Error(`MONTO_SUPERA_MAXIMO: El monto excede el límite máximo permitido por operación ($${(maxCents / 100).toFixed(2)} MXN).`);
    }
    if (params.actorUserId === params.targetUserId) {
      throw new Error(
        'CONFLICTO_DE_INTERES_ABAC: Un miembro del staff no puede emitirse crédito a sí mismo.'
      );
    }
    if (params.actorRole === 'CASHIER' || params.actorRole === 'AUDITOR' || params.actorRole === 'PLAYER') {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${params.actorRole} no puede emitir crédito.`);
    }
    if (
      (params.amountCents >= this.org.requireFourEyesThresholdCents ||
        params.sourceType === 'MANUAL_ADJUSTMENT') &&
      (!params.coAuthorizerUserId || params.coAuthorizerUserId === params.actorUserId)
    ) {
      throw new Error(
        `REQUIERE_AUTORIZACION_2_PASOS_GERENCIAL: Montos iguales o mayores al umbral configurado ($${(this.org.requireFourEyesThresholdCents / 100).toFixed(2)} MXN) o ajustes manuales requieren co-firma de un segundo supervisor (Four-Eyes).`
      );
    }

    const store = this.stores.get(params.storeId);
    if (!store) throw new Error('SUCURSAL_NO_ENCONTRADA');
    const wallet = this.walletsByUser.get(params.targetUserId);
    if (!wallet) throw new Error('JUGADOR_NO_ENCONTRADO');
    if (wallet.status === 'MERGED_INACTIVE') {
      throw new Error('CUENTA_FUSIONADA_INACTIVA: No se puede abonar a una cuenta secundaria fusionada.');
    }

    const beforeSnapshot = {
      availableBalanceCents: wallet.availableBalanceCents,
      debtBalanceCents: wallet.debtBalanceCents,
      status: wallet.status,
    };

    let debtAbsorbedCents = 0;
    let netCreditToLotCents = params.amountCents;
    if (wallet.debtBalanceCents > 0) {
      debtAbsorbedCents = Math.min(wallet.debtBalanceCents, params.amountCents);
      wallet.debtBalanceCents -= debtAbsorbedCents;
      netCreditToLotCents -= debtAbsorbedCents;
      if (wallet.debtBalanceCents === 0 && wallet.status === 'FROZEN_DISPUTE') {
        wallet.status = 'ACTIVE';
      }
    }

    const matchedSource = store.creditSources?.find((s) => s.code === params.sourceType);
    let expenseAccount: { code: string; name: string };

    if (matchedSource?.defaultAccountCode) {
      const code = matchedSource.defaultAccountCode;
      const accountName =
        code === '1105'
          ? 'Inventario Singles / Bulk (Trade-In)'
          : code === '5102'
            ? 'Gasto Promocional / Rifas / Subsidios'
            : code === '5103'
              ? 'Honorarios en Especie (Jueces / Staff)'
              : code === '5104'
                ? 'Gasto de Fidelización y Campañas'
                : code === '5105'
                  ? 'Ajustes Contables Auditados'
                  : code === '5101'
                    ? 'Costo de Premios de Torneos (OP)'
                    : `Cuenta de Egreso (${code})`;
      expenseAccount = { code, name: accountName };
    } else {
      expenseAccount =
        params.sourceType === 'SINGLES_TRADE_IN' || params.sourceType === 'BULK_BUYBACK'
          ? { code: '1105', name: 'Inventario Singles (Trade-In)' }
          : params.sourceType === 'JUDGE_STAFF_BOUNTY' || params.sourceType === 'JUDGE_STAFF_BONUS'
            ? { code: '5103', name: 'Honorarios en Especie (Jueces / Staff)' }
            : params.sourceType === 'PROMOTIONAL_BONUS'
              ? { code: '5104', name: 'Gasto de Fidelización y Campañas' }
              : params.sourceType === 'RAFFLE_DOOR_PRIZE' || params.sourceType === 'LEAGUE_ACHIEVEMENT'
                ? { code: '5102', name: 'Gasto Promocional / Rifas / Subsidios' }
                : params.sourceType === 'MANUAL_ADJUSTMENT'
                  ? { code: '5105', name: 'Ajustes Contables Auditados' }
                  : { code: '5101', name: 'Costo de Premios de Torneos (OP)' };
    }

    const entryId = `je_${randomUUID().slice(0, 12)}`;
    const lines: LedgerLineRecord[] = [
      {
        id: `ll_${randomUUID().slice(0, 10)}`,
        journalEntryId: entryId,
        storeId: store.id,
        storeCode: store.code,
        accountCode: expenseAccount.code,
        accountName: expenseAccount.name,
        debitCents: params.amountCents,
        creditCents: 0,
      },
    ];

    if (debtAbsorbedCents > 0) {
      lines.push({
        id: `ll_${randomUUID().slice(0, 10)}`,
        journalEntryId: entryId,
        storeId: store.id,
        storeCode: store.code,
        accountCode: '1205',
        accountName: 'Cuentas por Cobrar en Disputa (Clawback)',
        walletId: wallet.walletId,
        debitCents: 0,
        creditCents: debtAbsorbedCents,
      });
    }

    if (netCreditToLotCents > 0) {
      lines.push({
        id: `ll_${randomUUID().slice(0, 10)}`,
        journalEntryId: entryId,
        storeId: store.id,
        storeCode: store.code,
        accountCode: '2101',
        accountName: 'Pasivo Crédito de Tienda (Jugadores)',
        walletId: wallet.walletId,
        debitCents: 0,
        creditCents: netCreditToLotCents,
      });
    }

    const journalEntry = this.commitBalancedJournalEntry({
      id: entryId,
      initiatingStoreId: store.id,
      idempotencyKey: params.idempotencyKey ?? `issue_${params.referenceId ?? randomUUID().slice(0, 8)}_${params.targetUserId}_${randomUUID().slice(0, 8)}`,
      operationType:
        params.sourceType === 'SINGLES_TRADE_IN'
          ? 'TRADE_IN_ISSUE'
          : params.sourceType === 'PROMOTIONAL_BONUS' || params.sourceType === 'RAFFLE_DOOR_PRIZE'
            ? 'PROMOTIONAL_ISSUE'
            : 'TOURNAMENT_PRIZE_ISSUE',
      referenceId: params.referenceId ?? `ref_${randomUUID().slice(0, 8)}`,
      description: `${params.sourceLabel} (${store.code})`,
      createdByUserId: params.actorUserId,
      coAuthorizedByUserId: params.coAuthorizerUserId ?? null,
      lines,
    });

    let lot: CreditLot | null = null;
    if (netCreditToLotCents > 0) {
      const expiresAt =
        params.expiryDays !== null
          ? new Date(Date.now() + params.expiryDays * 86_400_000).toISOString()
          : null;

      lot = {
        id: `lot_${randomUUID().slice(0, 10)}`,
        walletId: wallet.walletId,
        issuingStoreId: store.id,
        issuingStoreCode: store.code,
        sourceType: params.sourceType,
        sourceLabel: params.sourceLabel,
        initialAmountCents: netCreditToLotCents,
        remainingAmountCents: netCreditToLotCents,
        lockedPreorderCents: 0,
        priorityRank: params.priorityRank ?? (params.sourceType === 'PROMOTIONAL_BONUS' ? 200 : 100),
        allowedCategories: params.allowedCategories ?? null,
        expiresAt,
        expirationPausedAt: null,
        isRetransferable: true,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      wallet.lots.push(lot);
      wallet.availableBalanceCents += netCreditToLotCents;
    }

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      coAuthorizerId: params.coAuthorizerUserId ?? null,
      coAuthMethod: params.coAuthorizerUserId ? 'FOUR_EYES_2FA' : null,
      eventAction: 'CREDIT_ISSUED',
      targetEntityId: wallet.walletId,
      payloadBefore: beforeSnapshot,
      payloadAfter: {
        availableBalanceCents: wallet.availableBalanceCents,
        debtBalanceCents: wallet.debtBalanceCents,
        issuedCents: params.amountCents,
        debtAbsorbedCents,
      },
      reasonJustification: params.sourceLabel,
    });

    return { journalEntry, lot, debtAbsorbedCents };
  }

  /**
   * Redime crédito en Punto de Venta (POS) tomando saldo a cuenta (Pago Total o Mixto),
   * valida Autorización en 2 Pasos del Jugador, aplica FEFO y emite Voucher Físico Térmico.
   */
  public redeemCreditAtPos(params: {
    redeemingStoreId: string;
    playerUserId: string;
    cashierUserId: string;
    cashierRole: UserRoleType;
    totalTicketCents: number;
    creditToApplyCents: number;
    productCategory: ProductCategoryType;
    externalPosTicketRef: string;
    conceptNotes: string;
    idempotencyKey?: string;
    playerAuthProof: {
      method: 'QR_DYNAMIC_TOTP' | 'PIN_OFFLINE_2FA' | 'PUSH_2FA';
      qrToken?: string;
      totpPin?: string;
      timestampMs?: number;
    };
  }): {
    journalEntry: JournalEntryRecord;
    voucher: PhysicalVoucher;
    consumedLots: Array<{ lotId: string; issuingStoreId: string; amountCents: number }>;
  } {
    if (params.cashierUserId === params.playerUserId) {
      throw new Error('CONFLICTO_DE_INTERES_ABAC: El cajero no puede cobrarse a sí mismo.');
    }
    const redeemingStore = this.stores.get(params.redeemingStoreId);
    if (!redeemingStore) throw new Error('SUCURSAL_NO_ENCONTRADA');

    const wallet = this.walletsByUser.get(params.playerUserId);
    if (!wallet) throw new Error('JUGADOR_NO_ENCONTRADO');

    if (wallet.status !== 'ACTIVE' || wallet.debtBalanceCents > 0) {
      throw new Error(
        `WALLET_BLOQUEADA: La cuenta del jugador está en estado ${wallet.status} (Deuda pendiente: $${(wallet.debtBalanceCents / 100).toFixed(2)}).`
      );
    }

    if (wallet.availableBalanceCents <= 0) {
      throw new Error('SALDO_INSUFICIENTE: El cliente no cuenta con saldo disponible ($0.00 MXN).');
    }

    if (params.creditToApplyCents <= 0 || params.creditToApplyCents > params.totalTicketCents) {
      throw new Error('MONTO_CREDITO_INVALIDO: El crédito a aplicar debe ser > 0 y <= total del ticket.');
    }

    const idemKey =
      params.idempotencyKey ??
      `pos_${redeemingStore.code}_${params.externalPosTicketRef}_${randomUUID().slice(0, 8)}`;
    if (this.idempotencyKeys.has(idemKey)) {
      throw new Error(
        `OPERACION_DUPLICADA_IDEMPOTENCIA: La clave de operación ${idemKey} ya fue procesada (prevención de doble cobro en caja).`
      );
    }

    const nowMs = params.playerAuthProof.timestampMs ?? Date.now();
    let verifiedQrNonce: string | null = null;
    if (params.playerAuthProof.method === 'QR_DYNAMIC_TOTP') {
      if (!params.playerAuthProof.qrToken) {
        throw new Error('FALTA_QR_DINAMICO: Se requiere escanear el QR dinámico del jugador.');
      }
      const check = verifyDynamicQrToken(params.playerAuthProof.qrToken, wallet.deviceSecret, nowMs);
      if (!check.valid || !check.payload) {
        throw new Error(`AUTENTICACION_2FA_FALLIDA: ${check.reason}`);
      }
      // Purgar nonces con más de 2 minutos de antigüedad (mitigación Memory Leak / DoS)
      for (const [nonce, ts] of this.usedQrNonces.entries()) {
        if (nowMs - ts > 120_000) {
          this.usedQrNonces.delete(nonce);
        }
      }
      if (this.usedQrNonces.has(check.payload.nonce)) {
        throw new Error('REPLAY_ATTACK_DETECTED: Este código QR dinámico ya fue utilizado.');
      }
      verifiedQrNonce = check.payload.nonce;
    } else if (params.playerAuthProof.method === 'PIN_OFFLINE_2FA') {
      const pin = (params.playerAuthProof.totpPin || '').trim();
      const expectedBunker = generatePlayerTotpPin(wallet.deviceSecret, wallet.memberCode, nowMs).totpPin;
      const isBunkerMatch = pin === expectedBunker;
      const isAuthenticatorMatch = Boolean(
        wallet.authenticatorSecret &&
        wallet.authenticatorSyncedAt &&
        verifyStandardTotpCode(pin, wallet.authenticatorSecret)
      );
      const isSecurityPinMatch = Boolean(
        wallet.securityPinHash &&
        verifyCredentialHash(pin, wallet.securityPinHash)
      );

      if (!isBunkerMatch && !isAuthenticatorMatch && !isSecurityPinMatch) {
        throw new Error('PIN_TOTP_2FA_INCORRECTO: El código de 6 dígitos ingresado (Authenticator, PIN Bunker o PIN de Seguridad) no coincide.');
      }
    }

    const eligibleLots = wallet.lots
      .filter((lot) => {
        if (lot.status !== 'ACTIVE' || lot.remainingAmountCents <= 0) return false;
        if (this.org.sharingPolicy === 'STORE_ISOLATED' && lot.issuingStoreId !== redeemingStore.id) {
          return false;
        }
        if (lot.allowedCategories && !lot.allowedCategories.includes(params.productCategory)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (b.priorityRank !== a.priorityRank) return b.priorityRank - a.priorityRank;
        if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
        if (a.expiresAt) return -1;
        if (b.expiresAt) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });

    const totalEligibleCents = eligibleLots.reduce((sum, l) => sum + l.remainingAmountCents, 0);
    if (totalEligibleCents < params.creditToApplyCents) {
      throw new Error(
        `SALDO_ELEGIBLE_INSUFICIENTE: El jugador tiene $${(totalEligibleCents / 100).toFixed(2)} aplicables para la categoría ${params.productCategory}, pero se intentó cobrar $${(params.creditToApplyCents / 100).toFixed(2)}.`
      );
    }

    const balanceBeforeCents = wallet.availableBalanceCents;
    let remainingToConsume = params.creditToApplyCents;
    const consumedLotsDetailed: PosRedemptionRecord['consumedLots'] = [];

    for (const lot of eligibleLots) {
      if (remainingToConsume <= 0) break;
      const take = Math.min(lot.remainingAmountCents, remainingToConsume);
      lot.remainingAmountCents -= take;
      if (lot.remainingAmountCents === 0) {
        lot.status = 'DEPLETED';
      }
      remainingToConsume -= take;
      consumedLotsDetailed.push({
        lotId: lot.id,
        issuingStoreId: lot.issuingStoreId,
        amountCents: take,
        originalExpiresAt: lot.expiresAt,
        allowedCategories: lot.allowedCategories,
        priorityRank: lot.priorityRank,
      });
    }

    wallet.availableBalanceCents -= params.creditToApplyCents;
    const balanceAfterCents = wallet.availableBalanceCents;

    if (verifiedQrNonce) {
      this.usedQrNonces.set(verifiedQrNonce, nowMs);
    }

    const entryId = `je_${randomUUID().slice(0, 12)}`;
    const lines: LedgerLineRecord[] = [];

    for (const consumed of consumedLotsDetailed) {
      const issuingStore = this.stores.get(consumed.issuingStoreId)!;
      lines.push({
        id: `ll_${randomUUID().slice(0, 10)}`,
        journalEntryId: entryId,
        storeId: issuingStore.id,
        storeCode: issuingStore.code,
        accountCode: '2101',
        accountName: 'Pasivo Crédito de Tienda (Jugadores)',
        walletId: wallet.walletId,
        debitCents: consumed.amountCents,
        creditCents: 0,
      });

      if (
        this.org.sharingPolicy === 'INTER_STORE_CLEARING' &&
        issuingStore.id !== redeemingStore.id
      ) {
        lines.push({
          id: `ll_${randomUUID().slice(0, 10)}`,
          journalEntryId: entryId,
          storeId: issuingStore.id,
          storeCode: issuingStore.code,
          accountCode: '2201',
          accountName: `CxP Inter-Sucursal hacia ${redeemingStore.code}`,
          debitCents: 0,
          creditCents: consumed.amountCents,
        });
        lines.push({
          id: `ll_${randomUUID().slice(0, 10)}`,
          journalEntryId: entryId,
          storeId: redeemingStore.id,
          storeCode: redeemingStore.code,
          accountCode: '1201',
          accountName: `CxC Inter-Sucursal desde ${issuingStore.code}`,
          debitCents: consumed.amountCents,
          creditCents: 0,
        });
      }
    }

    lines.push({
      id: `ll_${randomUUID().slice(0, 10)}`,
      journalEntryId: entryId,
      storeId: redeemingStore.id,
      storeCode: redeemingStore.code,
      accountCode: '4101',
      accountName: 'Ingresos por Redención de Crédito en POS',
      debitCents: 0,
      creditCents: params.creditToApplyCents,
    });

    const journalEntry = this.commitBalancedJournalEntry({
      id: entryId,
      initiatingStoreId: redeemingStore.id,
      idempotencyKey: idemKey,
      operationType: 'POS_REDEMPTION',
      referenceId: params.externalPosTicketRef,
      description: `Cobro POS (${params.externalPosTicketRef}): ${params.conceptNotes}`,
      createdByUserId: params.cashierUserId,
      coAuthorizedByUserId: params.playerUserId,
      lines,
    });

    this.voucherSequence += 1;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const voucherFolio = `${redeemingStore.voucherPrefix}-${dateStr}-${this.voucherSequence.toString().padStart(4, '0')}`;
    const cryptographicSeal = generateVoucherCryptographicSeal({
      voucherFolio,
      storeCode: redeemingStore.code,
      memberCode: wallet.memberCode,
      creditAppliedCents: params.creditToApplyCents,
      journalEntryId: journalEntry.id,
      hsmSecret: this.hsmSecret,
    });

    const voucher: PhysicalVoucher = {
      id: `vch_${randomUUID().slice(0, 10)}`,
      voucherFolio,
      storeId: redeemingStore.id,
      storeCode: redeemingStore.code,
      storeName: redeemingStore.name,
      journalEntryId: journalEntry.id,
      voucherType: 'REDEMPTION',
      externalPosTicketRef: params.externalPosTicketRef,
      playerUserId: wallet.userId,
      playerMemberCode: wallet.memberCode,
      playerName: wallet.fullName,
      playerAlias: wallet.alias,
      cashierUserId: params.cashierUserId,
      cashierName: this.walletsByUser.get(params.cashierUserId)
        ? `${this.walletsByUser.get(params.cashierUserId)!.fullName} (${this.walletsByUser.get(params.cashierUserId)!.memberCode})`
        : 'Operador POS Verificado',
      totalPurchaseReportedCents: params.totalTicketCents,
      creditAppliedCents: params.creditToApplyCents,
      remainingCashOrCardCents: params.totalTicketCents - params.creditToApplyCents,
      walletBalanceBeforeCents: balanceBeforeCents,
      walletBalanceAfterCents: balanceAfterCents,
      conceptNotes: params.conceptNotes,
      authMethodUsed: params.playerAuthProof.method,
      cryptographicSeal,
      printCount: 1,
      createdAt: new Date().toISOString(),
    };

    this.vouchers.set(voucher.voucherFolio, voucher);
    this.redemptionsByVoucher.set(voucher.voucherFolio, {
      voucherFolio: voucher.voucherFolio,
      storeId: redeemingStore.id,
      playerUserId: wallet.userId,
      totalTicketCents: params.totalTicketCents,
      creditAppliedCents: params.creditToApplyCents,
      cashOrCardPaidCents: params.totalTicketCents - params.creditToApplyCents,
      refundedCreditCents: 0,
      refundedCashCents: 0,
      consumedLots: consumedLotsDetailed,
    });

    this.appendAuditLog({
      storeId: redeemingStore.id,
      actorUserId: params.cashierUserId,
      actorRole: params.cashierRole,
      coAuthorizerId: wallet.userId,
      coAuthMethod: params.playerAuthProof.method,
      eventAction: 'POS_REDEMPTION_WITH_VOUCHER',
      targetEntityId: wallet.walletId,
      payloadBefore: { availableBalanceCents: balanceBeforeCents },
      payloadAfter: {
        availableBalanceCents: balanceAfterCents,
        creditAppliedCents: params.creditToApplyCents,
        voucherFolio: voucher.voucherFolio,
        externalPosTicketRef: params.externalPosTicketRef,
      },
      reasonJustification: `${params.externalPosTicketRef} - ${params.conceptNotes}`,
    });

    return {
      journalEntry,
      voucher,
      consumedLots: consumedLotsDetailed.map((c) => ({
        lotId: c.lotId,
        issuingStoreId: c.issuingStoreId,
        amountCents: c.amountCents,
      })),
    };
  }

  /**
   * Verificador Criptográfico de Voucher Físico en Papel (para Auditoría / Corte de Caja):
   * Comprueba que un voucher físico presentado en la gaveta no haya sido falsificado ni alterado en monto.
   */
  public verifyPhysicalVoucherAuthenticity(params: {
    voucherFolio: string;
    reportedCreditCents: number;
    providedSeal: string;
  }): { authentic: boolean; reason: string; voucher?: PhysicalVoucher } {
    const voucher = this.vouchers.get(params.voucherFolio.trim());
    if (!voucher) {
      return { authentic: false, reason: 'FOLIO_INEXISTENTE_EN_BASE_DE_DATOS' };
    }
    const expectedSeal = generateVoucherCryptographicSeal({
      voucherFolio: voucher.voucherFolio,
      storeCode: voucher.storeCode,
      memberCode: voucher.playerMemberCode,
      creditAppliedCents: params.reportedCreditCents,
      journalEntryId: voucher.journalEntryId,
      hsmSecret: this.hsmSecret,
    });

    if (expectedSeal !== params.providedSeal.trim().toUpperCase()) {
      return {
        authentic: false,
        reason: 'SELLO_O_MONTO_ALTERADO_FALSIFICACION_DETECTADA',
        voucher,
      };
    }

    if (voucher.printCount > 1) {
      return {
        authentic: true,
        reason: `VOUCHER_AUTENTICO_PERO_TIENE_${voucher.printCount}_IMPRESIONES_VERIFICAR_ORIGINAL`,
        voucher,
      };
    }

    return { authentic: true, reason: 'VOUCHER_ORIGINAL_100_POR_CIENTO_INTEGRO', voucher };
  }

  /**
   * Genera el Corte de Caja / Arqueo de Vouchers del Turno (`StoreShiftClosureReport`)
   * con desglose de todos los vouchers físicos que deben estar en la gaveta, alertas de reimpresión,
   * y saldos de compensación inter-sucursal (CxC / CxP).
   */
  public generateStoreShiftClosure(
    storeId: string,
    actorUserId: string
  ): StoreShiftClosureReport {
    const store = this.stores.get(storeId);
    if (!store) throw new Error('SUCURSAL_NO_ENCONTRADA');

    const storeVouchers = Array.from(this.vouchers.values()).filter((v) => v.storeId === storeId);
    const storeRedemptions = Array.from(this.redemptionsByVoucher.values()).filter(
      (r) => r.storeId === storeId
    );

    const totalCreditRedeemedCents = storeVouchers.reduce((s, v) => s + v.creditAppliedCents, 0);
    const totalCashOrCardComplementCents = storeVouchers.reduce(
      (s, v) => s + v.remainingCashOrCardCents,
      0
    );
    const totalCreditRefundedCents = storeRedemptions.reduce(
      (s, r) => s + r.refundedCreditCents,
      0
    );

    const totalCreditIssuedInStoreCents = this.journalEntries
      .filter(
        (je) =>
          je.initiatingStoreId === storeId &&
          (je.operationType === 'TOURNAMENT_PRIZE_ISSUE' ||
            je.operationType === 'TRADE_IN_ISSUE' ||
            je.operationType === 'PROMOTIONAL_ISSUE')
      )
      .reduce(
        (s, je) =>
          s +
          je.lines
            .filter((l) => l.accountCode === '2101' || l.accountCode === '1205')
            .reduce((acc, l) => acc + l.creditCents, 0),
        0
      );

    // Calcular posición Inter-Sucursal (cuánto redimió esta tienda de otras vs cuánto redimieron otras de esta)
    let interStoreReceivableCents = 0; // A favor de esta tienda
    let interStorePayableCents = 0;    // A cargo de esta tienda

    for (const r of this.redemptionsByVoucher.values()) {
      for (const c of r.consumedLots) {
        if (r.storeId === storeId && c.issuingStoreId !== storeId) {
          interStoreReceivableCents += c.amountCents;
        } else if (r.storeId !== storeId && c.issuingStoreId === storeId) {
          interStorePayableCents += c.amountCents;
        }
      }
    }

    const reprintedVouchersAlert = storeVouchers
      .filter((v) => v.printCount > 1)
      .map((v) => ({
        voucherFolio: v.voucherFolio,
        printCount: v.printCount,
        creditAppliedCents: v.creditAppliedCents,
        externalPosTicketRef: v.externalPosTicketRef,
      }));

    const closingLedgerHash =
      this.auditLogs.length > 0
        ? this.auditLogs[this.auditLogs.length - 1].rowHash
        : GENESIS_AUDIT_HASH;

    const fmt = (cents: number) => `$${(cents / 100).toFixed(2)} ${this.org.currencyCode}`;
    const closedAt = new Date().toISOString();

    const thermalClosureText = [
      '========================================',
      '       CORTE Z — CIERRE DE TURNO        ',
      '========================================',
      `SUCURSAL: ${store.name} (${store.code})`,
      `FECHA CIERRE: ${closedAt.replace('T', ' ').slice(0, 19)}`,
      `VOUCHERS EMITIDOS: ${storeVouchers.length}`,
      `RANGO FOLIOS: ${storeVouchers[0]?.voucherFolio ?? 'N/A'} -> ${storeVouchers[storeVouchers.length - 1]?.voucherFolio ?? 'N/A'}`,
      '----------------------------------------',
      `CRÉDITO REDIMIDO BRUTO: ${fmt(totalCreditRedeemedCents).padStart(15)}`,
      `DEVOLUCIONES CRÉDITO:   ${('-' + fmt(totalCreditRefundedCents)).padStart(15)}`,
      `CRÉDITO NETO EN CAJA:   ${fmt(totalCreditRedeemedCents - totalCreditRefundedCents).padStart(15)}`,
      `COBRADO EFECT/TARJ POS: ${fmt(totalCashOrCardComplementCents).padStart(15)}`,
      '----------------------------------------',
      `CRÉDITO EMITIDO HOY:    ${fmt(totalCreditIssuedInStoreCents).padStart(15)}`,
      `CxC INTER-SUCURSAL (+): ${fmt(interStoreReceivableCents).padStart(15)}`,
      `CxP INTER-SUCURSAL (-): ${fmt(interStorePayableCents).padStart(15)}`,
      '----------------------------------------',
      `ALERTAS REIMPRESIÓN:    ${reprintedVouchersAlert.length} voucher(s)`,
      ...reprintedVouchersAlert.map(
        (a) => `  ! ${a.voucherFolio} (#${a.printCount} imp) ${fmt(a.creditAppliedCents)}`
      ),
      '----------------------------------------',
      `HASH AUDITORÍA: ${closingLedgerHash.slice(0, 20)}...`,
      '========================================',
      '                                        ',
      '   _____________        _____________   ',
      '    Firma Cajero         Firma Gerente  ',
      '========================================',
    ].join('\n');

    const report: StoreShiftClosureReport = {
      closureId: `cls_${randomUUID().slice(0, 8)}`,
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
      closedAt,
      closedByUserId: actorUserId,
      vouchersCount: storeVouchers.length,
      firstVoucherFolio: storeVouchers[0]?.voucherFolio ?? null,
      lastVoucherFolio: storeVouchers[storeVouchers.length - 1]?.voucherFolio ?? null,
      totalCreditRedeemedCents,
      totalCashOrCardComplementCents,
      totalCreditRefundedCents,
      totalCreditIssuedInStoreCents,
      reprintedVouchersAlert,
      interStoreReceivableCents,
      interStorePayableCents,
      closingLedgerHash,
      thermalClosureText,
    };

    this.shiftClosures.push(report);
    return report;
  }

  /**
   * Devolución de Mercancía con Regla Anti-Cash-Out
   */
  public refundPosPurchase(params: {
    voucherFolio: string;
    refundAmountCents: number;
    actorUserId: string;
    coAuthorizerUserId: string;
    reason: string;
  }): {
    refundedToStoreCreditCents: number;
    refundedToCashCents: number;
    restoredLot: CreditLot | null;
  } {
    if (params.actorUserId === params.coAuthorizerUserId) {
      throw new Error('REQUIERE_FOUR_EYES: Toda devolución requiere autorización de supervisor.');
    }
    const redemption = this.redemptionsByVoucher.get(params.voucherFolio);
    if (!redemption) throw new Error('VOUCHER_NO_ENCONTRADO');

    const maxRefundable =
      redemption.totalTicketCents - (redemption.refundedCreditCents + redemption.refundedCashCents);
    if (params.refundAmountCents <= 0 || params.refundAmountCents > maxRefundable) {
      throw new Error('MONTO_DEVOLUCION_EXCEDE_COMPRA_ORIGINAL');
    }

    const remainingCreditToRestore =
      redemption.creditAppliedCents - redemption.refundedCreditCents;
    const refundedToStoreCreditCents = Math.min(
      params.refundAmountCents,
      remainingCreditToRestore
    );
    const refundedToCashCents = params.refundAmountCents - refundedToStoreCreditCents;

    redemption.refundedCreditCents += refundedToStoreCreditCents;
    redemption.refundedCashCents += refundedToCashCents;

    const wallet = this.walletsByUser.get(redemption.playerUserId)!;
    const store = this.stores.get(redemption.storeId)!;
    let restoredLot: CreditLot | null = null;

    if (refundedToStoreCreditCents > 0) {
      const originSample = redemption.consumedLots[0];
      restoredLot = {
        id: `lot_ref_${randomUUID().slice(0, 8)}`,
        walletId: wallet.walletId,
        issuingStoreId: originSample.issuingStoreId,
        issuingStoreCode: this.stores.get(originSample.issuingStoreId)!.code,
        sourceType: 'REFUND_RESTORE',
        sourceLabel: `Reembolso Voucher ${params.voucherFolio}`,
        initialAmountCents: refundedToStoreCreditCents,
        remainingAmountCents: refundedToStoreCreditCents,
        lockedPreorderCents: 0,
        priorityRank: originSample.priorityRank,
        allowedCategories: originSample.allowedCategories,
        expiresAt: originSample.originalExpiresAt,
        expirationPausedAt: null,
        isRetransferable: false,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      wallet.lots.push(restoredLot);
      wallet.availableBalanceCents += refundedToStoreCreditCents;

      const entryId = `je_${randomUUID().slice(0, 12)}`;
      this.commitBalancedJournalEntry({
        id: entryId,
        initiatingStoreId: store.id,
        idempotencyKey: `refund_${params.voucherFolio}_${randomUUID().slice(0, 8)}`,
        operationType: 'REDEMPTION_REFUND',
        referenceId: params.voucherFolio,
        description: `Devolución Anti-Cash-Out (${params.voucherFolio}): ${params.reason}`,
        createdByUserId: params.actorUserId,
        coAuthorizedByUserId: params.coAuthorizerUserId,
        lines: [
          {
            id: `ll_${randomUUID().slice(0, 10)}`,
            journalEntryId: entryId,
            storeId: store.id,
            storeCode: store.code,
            accountCode: '4101',
            accountName: 'Reverso Ingresos por Redención de Crédito',
            debitCents: refundedToStoreCreditCents,
            creditCents: 0,
          },
          {
            id: `ll_${randomUUID().slice(0, 10)}`,
            journalEntryId: entryId,
            storeId: store.id,
            storeCode: store.code,
            accountCode: '2101',
            accountName: 'Pasivo Crédito de Tienda (Jugadores)',
            walletId: wallet.walletId,
            debitCents: 0,
            creditCents: refundedToStoreCreditCents,
          },
        ],
      });
    }

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: params.actorUserId,
      actorRole: 'STORE_ADMIN',
      coAuthorizerId: params.coAuthorizerUserId,
      coAuthMethod: 'FOUR_EYES_2FA',
      eventAction: 'POS_PURCHASE_REFUNDED',
      targetEntityId: wallet.walletId,
      payloadBefore: { voucherFolio: params.voucherFolio },
      payloadAfter: {
        refundedToStoreCreditCents,
        refundedToCashCents,
        restoredOriginalExpiresAt: restoredLot?.expiresAt ?? null,
      },
      reasonJustification: params.reason,
    });

    return { refundedToStoreCreditCents, refundedToCashCents, restoredLot };
  }

  /**
   * Reserva de Crédito para Preventa (Pre-Order Escrow)
   */
  public holdCreditForPreorder(params: {
    storeId: string;
    playerUserId: string;
    cashierUserId: string;
    preorderRef: string;
    amountCents: number;
    nowIso?: string;
  }): PreorderHoldRecord {
    const wallet = this.walletsByUser.get(params.playerUserId)!;
    const store = this.stores.get(params.storeId)!;
    if (wallet.availableBalanceCents < params.amountCents) {
      throw new Error('SALDO_INSUFICIENTE_PARA_PREVENTA');
    }

    const pausedAt = params.nowIso ?? new Date().toISOString();
    let remainingToLock = params.amountCents;
    const lockedLots: PreorderHoldRecord['lockedLots'] = [];

    for (const lot of wallet.lots) {
      if (remainingToLock <= 0) break;
      if (lot.status === 'ACTIVE' && lot.remainingAmountCents > 0) {
        const take = Math.min(lot.remainingAmountCents, remainingToLock);
        lot.remainingAmountCents -= take;
        lot.lockedPreorderCents += take;
        lot.expirationPausedAt = pausedAt;
        if (lot.remainingAmountCents === 0) {
          lot.status = 'ESCROW_PREORDER';
        }
        remainingToLock -= take;
        lockedLots.push({
          lotId: lot.id,
          amountCents: take,
          originalExpiresAt: lot.expiresAt,
          pausedAt,
        });
      }
    }

    wallet.availableBalanceCents -= params.amountCents;
    wallet.escrowPreorderCents += params.amountCents;

    const entryId = `je_${randomUUID().slice(0, 12)}`;
    this.commitBalancedJournalEntry({
      id: entryId,
      initiatingStoreId: store.id,
      idempotencyKey: `preorder_hold_${params.preorderRef}_${randomUUID().slice(0, 6)}`,
      operationType: 'PREORDER_ESCROW_HOLD',
      referenceId: params.preorderRef,
      description: `Reserva de Crédito en Preventa ${params.preorderRef}`,
      createdByUserId: params.cashierUserId,
      coAuthorizedByUserId: wallet.userId,
      lines: [
        {
          id: `ll_${randomUUID().slice(0, 10)}`,
          journalEntryId: entryId,
          storeId: store.id,
          storeCode: store.code,
          accountCode: '2101',
          accountName: 'Pasivo Crédito Disponible',
          walletId: wallet.walletId,
          debitCents: params.amountCents,
          creditCents: 0,
        },
        {
          id: `ll_${randomUUID().slice(0, 10)}`,
          journalEntryId: entryId,
          storeId: store.id,
          storeCode: store.code,
          accountCode: '2103',
          accountName: 'Anticipos de Preventas (Pre-Order Hold)',
          walletId: wallet.walletId,
          debitCents: 0,
          creditCents: params.amountCents,
        },
      ],
    });

    const hold: PreorderHoldRecord = {
      id: `hold_${randomUUID().slice(0, 8)}`,
      storeId: store.id,
      playerUserId: wallet.userId,
      preorderRef: params.preorderRef,
      amountCents: params.amountCents,
      status: 'HELD',
      lockedLots,
    };
    this.preorderHolds.set(params.preorderRef, hold);
    return hold;
  }

  /**
   * Cancelación de Preventa
   */
  public cancelPreorderHold(params: {
    preorderRef: string;
    cancelledByStore: boolean;
    actorUserId: string;
  }): { releasedCents: number; graceExtendedDays: number } {
    const hold = this.preorderHolds.get(params.preorderRef);
    if (!hold || hold.status !== 'HELD') throw new Error('PREVENTA_NO_ACTIVA');

    const wallet = this.walletsByUser.get(hold.playerUserId)!;
    const graceExtendedDays = params.cancelledByStore ? 30 : 0;

    for (const locked of hold.lockedLots) {
      const lot = wallet.lots.find((l) => l.id === locked.lotId);
      if (lot) {
        lot.lockedPreorderCents -= locked.amountCents;
        lot.remainingAmountCents += locked.amountCents;
        lot.expirationPausedAt = null;
        lot.status = 'ACTIVE';
        if (locked.originalExpiresAt) {
          const baseMs = new Date(locked.originalExpiresAt).getTime();
          lot.expiresAt = new Date(baseMs + graceExtendedDays * 86_400_000).toISOString();
        }
      }
    }

    wallet.escrowPreorderCents -= hold.amountCents;
    wallet.availableBalanceCents += hold.amountCents;
    hold.status = 'CANCELLED';

    const store = this.stores.get(hold.storeId) ?? Array.from(this.stores.values())[0]!;
    const entryId = `je_${randomUUID().slice(0, 12)}`;
    this.commitBalancedJournalEntry({
      id: entryId,
      initiatingStoreId: store.id,
      idempotencyKey: `preorder_cancel_${params.preorderRef}_${randomUUID().slice(0, 6)}`,
      operationType: 'PREORDER_ESCROW_RELEASE',
      referenceId: params.preorderRef,
      description: `Cancelación y Devolución de Reserva en Preventa ${params.preorderRef}`,
      createdByUserId: params.actorUserId,
      coAuthorizedByUserId: wallet.userId,
      lines: [
        {
          id: `ll_${randomUUID().slice(0, 10)}`,
          journalEntryId: entryId,
          storeId: store.id,
          storeCode: store.code,
          accountCode: '2103',
          accountName: 'Anticipos de Preventas (Pre-Order Hold)',
          walletId: wallet.walletId,
          debitCents: hold.amountCents,
          creditCents: 0,
        },
        {
          id: `ll_${randomUUID().slice(0, 10)}`,
          journalEntryId: entryId,
          storeId: store.id,
          storeCode: store.code,
          accountCode: '2101',
          accountName: 'Pasivo Crédito Disponible',
          walletId: wallet.walletId,
          debitCents: 0,
          creditCents: hold.amountCents,
        },
      ],
    });

    const actorUser = this.walletsByUser.get(params.actorUserId);
    this.appendAuditLog({
      storeId: store.id,
      actorUserId: params.actorUserId,
      actorRole: actorUser?.role ?? 'STORE_ADMIN',
      coAuthorizerId: wallet.userId,
      coAuthMethod: 'CLIENT_SIGNATURE_ESCROW',
      eventAction: 'PREORDER_ESCROW_CANCELLED',
      targetEntityId: params.preorderRef,
      payloadBefore: {
        preorderRef: params.preorderRef,
        amountCents: hold.amountCents,
        status: 'HELD',
      },
      payloadAfter: {
        preorderRef: params.preorderRef,
        amountCents: hold.amountCents,
        status: 'CANCELLED',
        releasedCents: hold.amountCents,
        graceExtendedDays,
      },
      reasonJustification: params.cancelledByStore
        ? 'Cancelación de preventa por la tienda: 30 días de gracia otorgados a los lotes'
        : 'Cancelación voluntaria de preventa por el jugador',
    });

    return { releasedCents: hold.amountCents, graceExtendedDays };
  }

  /**
   * Fusión de Cuentas Duplicadas (`mergePlayerAccounts`)
   */
  public mergePlayerAccounts(params: {
    storeId: string;
    primaryUserId: string;
    secondaryUserId: string;
    adminMakerId: string;
    adminCheckerId: string;
  }): { primaryAvailableCents: number; primaryDebtCents: number } {
    if (params.adminMakerId === params.adminCheckerId) {
      throw new Error('REQUIERE_FOUR_EYES: La fusión de cuentas requiere dos administradores.');
    }
    const primary = this.walletsByUser.get(params.primaryUserId)!;
    const secondary = this.walletsByUser.get(params.secondaryUserId)!;

    for (const lot of secondary.lots) {
      if (lot.status === 'ACTIVE' && lot.remainingAmountCents > 0) {
        lot.walletId = primary.walletId;
        primary.lots.push(lot);
        primary.availableBalanceCents += lot.remainingAmountCents;
      }
    }
    secondary.availableBalanceCents = 0;

    if (secondary.debtBalanceCents > 0) {
      primary.debtBalanceCents += secondary.debtBalanceCents;
      secondary.debtBalanceCents = 0;
    }

    if (primary.debtBalanceCents > 0 && primary.availableBalanceCents > 0) {
      const offset = Math.min(primary.availableBalanceCents, primary.debtBalanceCents);
      let toDrain = offset;
      for (const lot of primary.lots) {
        if (toDrain <= 0) break;
        if (lot.status === 'ACTIVE' && lot.remainingAmountCents > 0) {
          const take = Math.min(lot.remainingAmountCents, toDrain);
          lot.remainingAmountCents -= take;
          if (lot.remainingAmountCents === 0) lot.status = 'DEPLETED';
          toDrain -= take;
        }
      }
      primary.availableBalanceCents -= offset;
      primary.debtBalanceCents -= offset;
    }

    primary.status = primary.debtBalanceCents > 0 ? 'FROZEN_DISPUTE' : 'ACTIVE';
    secondary.status = 'MERGED_INACTIVE';
    secondary.mergedIntoUserId = primary.userId;

    this.appendAuditLog({
      storeId: params.storeId,
      actorUserId: params.adminMakerId,
      actorRole: 'STORE_ADMIN',
      coAuthorizerId: params.adminCheckerId,
      coAuthMethod: 'FOUR_EYES_2FA',
      eventAction: 'PLAYER_ACCOUNTS_MERGED',
      targetEntityId: primary.walletId,
      payloadBefore: { secondaryUserId: secondary.userId },
      payloadAfter: {
        primaryAvailableCents: primary.availableBalanceCents,
        primaryDebtCents: primary.debtBalanceCents,
      },
      reasonJustification: `Fusión de cuenta duplicada ${secondary.memberCode} -> ${primary.memberCode}`,
    });

    return {
      primaryAvailableCents: primary.availableBalanceCents,
      primaryDebtCents: primary.debtBalanceCents,
    };
  }

  /**
   * Expiración de Lotes Vencidos (Breakage Contable)
   */
  public expireOverdueLots(nowIso: string, actorUserId: string): { expiredTotalCents: number; expiredLotsCount: number } {
    let expiredTotalCents = 0;
    let expiredLotsCount = 0;

    for (const wallet of this.walletsByUser.values()) {
      for (const lot of wallet.lots) {
        if (
          lot.status === 'ACTIVE' &&
          lot.remainingAmountCents > 0 &&
          lot.expiresAt !== null &&
          lot.expirationPausedAt === null &&
          lot.expiresAt <= nowIso
        ) {
          const expiredAmount = lot.remainingAmountCents;
          lot.remainingAmountCents = 0;
          lot.status = 'EXPIRED';
          wallet.availableBalanceCents -= expiredAmount;
          expiredTotalCents += expiredAmount;
          expiredLotsCount += 1;

          const store = this.stores.get(lot.issuingStoreId)!;
          const entryId = `je_${randomUUID().slice(0, 12)}`;
          this.commitBalancedJournalEntry({
            id: entryId,
            initiatingStoreId: store.id,
            idempotencyKey: `expire_${lot.id}`,
            operationType: 'LOT_EXPIRATION_BREAKAGE',
            referenceId: lot.id,
            description: `Vencimiento de Lote (Breakage): ${lot.sourceLabel}`,
            createdByUserId: actorUserId,
            coAuthorizedByUserId: null,
            lines: [
              {
                id: `ll_${randomUUID().slice(0, 10)}`,
                journalEntryId: entryId,
                storeId: store.id,
                storeCode: store.code,
                accountCode: '2101',
                accountName: 'Pasivo Crédito de Tienda (Jugadores)',
                walletId: wallet.walletId,
                debitCents: expiredAmount,
                creditCents: 0,
              },
              {
                id: `ll_${randomUUID().slice(0, 10)}`,
                journalEntryId: entryId,
                storeId: store.id,
                storeCode: store.code,
                accountCode: '4201',
                accountName: 'Ingresos por Breakage (Expiración de Crédito)',
                debitCents: 0,
                creditCents: expiredAmount,
              },
            ],
          });
        }
      }
    }

    return { expiredTotalCents, expiredLotsCount };
  }

  /**
   * Reimprime un Voucher Físico incrementando `printCount` y dejando rastro forense
   */
  public reprintPhysicalVoucher(
    voucherFolio: string,
    actorUserId: string,
    actorRole: UserRoleType,
    reason: string
  ): PhysicalVoucher {
    const voucher = this.vouchers.get(voucherFolio);
    if (!voucher) throw new Error('VOUCHER_NO_ENCONTRADO');

    const prevCount = voucher.printCount;
    voucher.printCount += 1;

    this.appendAuditLog({
      storeId: voucher.storeId,
      actorUserId,
      actorRole,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'VOUCHER_REPRINTED',
      targetEntityId: voucher.id,
      payloadBefore: { printCount: prevCount },
      payloadAfter: { printCount: voucher.printCount },
      reasonJustification: reason,
    });

    return voucher;
  }

  /**
   * Caso Borde Crítico: Reversión de Premio Erróneo (Clawback) cuando el jugador YA gastó parte del saldo.
   */
  public clawbackErroneousPrize(params: {
    storeId: string;
    targetUserId: string;
    actorUserId: string;
    coAuthorizerUserId: string;
    amountToReverseCents: number;
    reason: string;
  }): { drainedFromBalanceCents: number; newDebtCents: number; journalEntry: JournalEntryRecord } {
    if (params.actorUserId === params.coAuthorizerUserId) {
      throw new Error('REQUIERE_FOUR_EYES: Un Clawback requiere aprobación de un segundo supervisor.');
    }
    const store = this.stores.get(params.storeId)!;
    const wallet = this.walletsByUser.get(params.targetUserId)!;

    const beforeBalance = wallet.availableBalanceCents;
    const drainedFromBalanceCents = Math.min(wallet.availableBalanceCents, params.amountToReverseCents);
    const deficitCents = params.amountToReverseCents - drainedFromBalanceCents;

    let remainingToDrain = drainedFromBalanceCents;
    for (const lot of wallet.lots) {
      if (remainingToDrain <= 0) break;
      if (lot.status === 'ACTIVE' && lot.remainingAmountCents > 0) {
        const cut = Math.min(lot.remainingAmountCents, remainingToDrain);
        lot.remainingAmountCents -= cut;
        if (lot.remainingAmountCents === 0) lot.status = 'VOIDED';
        remainingToDrain -= cut;
      }
    }

    wallet.availableBalanceCents -= drainedFromBalanceCents;
    if (deficitCents > 0) {
      wallet.debtBalanceCents += deficitCents;
      wallet.status = 'FROZEN_DISPUTE';
    }

    const entryId = `je_${randomUUID().slice(0, 12)}`;
    const lines: LedgerLineRecord[] = [];

    if (drainedFromBalanceCents > 0) {
      lines.push({
        id: `ll_${randomUUID().slice(0, 10)}`,
        journalEntryId: entryId,
        storeId: store.id,
        storeCode: store.code,
        accountCode: '2101',
        accountName: 'Pasivo Crédito de Tienda (Jugadores)',
        walletId: wallet.walletId,
        debitCents: drainedFromBalanceCents,
        creditCents: 0,
      });
    }
    if (deficitCents > 0) {
      lines.push({
        id: `ll_${randomUUID().slice(0, 10)}`,
        journalEntryId: entryId,
        storeId: store.id,
        storeCode: store.code,
        accountCode: '1205',
        accountName: 'Cuentas por Cobrar en Disputa (Clawback)',
        walletId: wallet.walletId,
        debitCents: deficitCents,
        creditCents: 0,
      });
    }
    lines.push({
      id: `ll_${randomUUID().slice(0, 10)}`,
      journalEntryId: entryId,
      storeId: store.id,
      storeCode: store.code,
      accountCode: '5101',
      accountName: 'Reverso Costo de Premios de Torneos (OP)',
      debitCents: 0,
      creditCents: params.amountToReverseCents,
    });

    const journalEntry = this.commitBalancedJournalEntry({
      id: entryId,
      initiatingStoreId: store.id,
      idempotencyKey: `clawback_${params.targetUserId}_${randomUUID().slice(0, 8)}`,
      operationType: 'CLAWBACK_REVERSAL',
      referenceId: params.targetUserId,
      description: `Reversión de Premio (Clawback): ${params.reason}`,
      createdByUserId: params.actorUserId,
      coAuthorizedByUserId: params.coAuthorizerUserId,
      lines,
    });

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: params.actorUserId,
      actorRole: 'STORE_ADMIN',
      coAuthorizerId: params.coAuthorizerUserId,
      coAuthMethod: 'FOUR_EYES_2FA',
      eventAction: 'PRIZE_CLAWBACK_EXECUTED',
      targetEntityId: wallet.walletId,
      payloadBefore: { availableBalanceCents: beforeBalance },
      payloadAfter: {
        availableBalanceCents: wallet.availableBalanceCents,
        debtBalanceCents: wallet.debtBalanceCents,
        status: wallet.status,
      },
      reasonJustification: params.reason,
    });

    return { drainedFromBalanceCents, newDebtCents: wallet.debtBalanceCents, journalEntry };
  }

  /**
   * Transferencia P2P entre jugadores
   */
  public transferCreditP2P(params: {
    storeId: string;
    fromUserId: string;
    toUserId: string;
    amountCents: number;
  }): { transferredNetCents: number; feeBurnedCents: number } {
    if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) {
      throw new Error('MONTO_TRANSFERENCIA_INVALIDO: El monto a transferir debe ser un número entero mayor a $0.00 MXN.');
    }
    if (this.org.p2pPolicy === 'DISABLED') {
      throw new Error(
        'P2P_DESHABILITADO: Las transferencias de crédito entre jugadores están desactivadas por política de la tienda.'
      );
    }
    if (params.fromUserId === params.toUserId) {
      throw new Error('AUTO_TRANSFERENCIA_INVALIDA');
    }
    const sender = this.walletsByUser.get(params.fromUserId)!;
    const receiver = this.walletsByUser.get(params.toUserId)!;

    const transferableLots = sender.lots.filter(
      (l) => l.status === 'ACTIVE' && l.remainingAmountCents > 0 && l.isRetransferable
    );
    const transferableTotal = transferableLots.reduce((s, l) => s + l.remainingAmountCents, 0);
    if (transferableTotal < params.amountCents) {
      throw new Error(
        'SALDO_TRANSFERIBLE_INSUFICIENTE: El crédito recibido previamente por transferencia no puede re-transferirse (Regla de 1 solo salto).'
      );
    }

    let remaining = params.amountCents;
    let earliestExpiry: string | null = null;
    for (const lot of transferableLots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.remainingAmountCents, remaining);
      lot.remainingAmountCents -= take;
      if (lot.remainingAmountCents === 0) lot.status = 'DEPLETED';
      if (lot.expiresAt && (!earliestExpiry || lot.expiresAt < earliestExpiry)) {
        earliestExpiry = lot.expiresAt;
      }
      remaining -= take;
    }

    sender.availableBalanceCents -= params.amountCents;
    const feeBurnedCents = Math.floor((params.amountCents * this.org.p2pFeeBps) / 10_000);
    const transferredNetCents = params.amountCents - feeBurnedCents;

    receiver.lots.push({
      id: `lot_${randomUUID().slice(0, 10)}`,
      walletId: receiver.walletId,
      issuingStoreId: params.storeId,
      issuingStoreCode: this.stores.get(params.storeId)!.code,
      sourceType: 'P2P_TRANSFER_IN',
      sourceLabel: `Transferencia recibida de ${sender.memberCode}`,
      initialAmountCents: transferredNetCents,
      remainingAmountCents: transferredNetCents,
      lockedPreorderCents: 0,
      priorityRank: 150,
      allowedCategories: null,
      expiresAt: earliestExpiry,
      expirationPausedAt: null,
      isRetransferable: false,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });
    receiver.availableBalanceCents += transferredNetCents;

    return { transferredNetCents, feeBurnedCents };
  }

  /**
   * Formatea el Voucher Físico Térmico (58mm / 80mm) listo para imprimir en caja
   */
  public renderThermalVoucherText(voucherFolio: string): string {
    const v = this.vouchers.get(voucherFolio);
    if (!v) throw new Error('VOUCHER_NO_ENCONTRADO: No existe ningún voucher emitido con el folio especificado.');

    const fmt = (cents: number) => `$${(cents / 100).toFixed(2)} ${this.org.currencyCode}`;
    const copyBanner =
      v.printCount === 1
        ? '      [ ORIGINAL - PÓLIZA DE CAJA ]     '
        : `*** COPIA REIMPRESA #${v.printCount} - NO VÁLIDA PARA ARQUEO ***`;

    return [
      '========================================',
      '     KRONA VAULT™ — VOUCHER TÉRMICO     ',
      '      COMPROBANTE DE USO DE SALDO       ',
      '========================================',
      copyBanner,
      '----------------------------------------',
      `SUCURSAL: ${v.storeName} (${v.storeCode})`,
      `FECHA:    ${v.createdAt.replace('T', ' ').slice(0, 19)}`,
      `FOLIO VOUCHER:  ${v.voucherFolio}`,
      `TICKET POS REF: ${v.externalPosTicketRef}`,
      '----------------------------------------',
      `JUGADOR:  ${v.playerName} (${v.playerAlias})`,
      `ID WALLET: ${v.playerMemberCode}`,
      `CAJERO:   ${v.cashierName}`,
      '----------------------------------------',
      `CONCEPTO: ${v.conceptNotes}`,
      '----------------------------------------',
      `TOTAL COMPRA POS:      ${fmt(v.totalPurchaseReportedCents).padStart(16)}`,
      `CRÉDITO TOMADO:        ${('-' + fmt(v.creditAppliedCents)).padStart(16)}`,
      `POR COBRAR EN CAJA:    ${fmt(v.remainingCashOrCardCents).padStart(16)}`,
      '----------------------------------------',
      `SALDO ANTERIOR:        ${fmt(v.walletBalanceBeforeCents).padStart(16)}`,
      `NUEVO SALDO DISP.:     ${fmt(v.walletBalanceAfterCents).padStart(16)}`,
      '----------------------------------------',
      `AUTH 2FA: ${v.authMethodUsed}`,
      `SELLO CRIPTOGRÁFICO:   ${v.cryptographicSeal.slice(0, 16)}...`,
      '========================================',
      '                                        ',
      '     ______________________________     ',
      '       Firma Conformidad / Cajero       ',
      '  *Engrapar al Corte Z físico de caja*  ',
      '========================================',
    ].join('\n');
  }

  /**
   * Búsqueda flexible de usuario por ID, Código de Miembro, Alias o Email
   */
  public findUserByIdentifier(identifier: string): PlayerWalletState | undefined {
    const q = (identifier || '').trim().toLowerCase();
    return Array.from(this.walletsByUser.values()).find(
      (u) =>
        u.userId.toLowerCase() === q ||
        u.memberCode.toLowerCase() === q ||
        u.alias.toLowerCase() === q ||
        u.email.toLowerCase() === q
    );
  }

  /**
   * Autenticación de Usuario por memberCode / alias / email + contraseña o PIN de seguridad
   */
  public authenticateUser(params: {
    identifier: string;
    secret: string;
    mode: 'PASSWORD' | 'PIN';
    storeId?: string;
  }): { user: PlayerWalletState; token: string } {
    const found = this.findUserByIdentifier(params.identifier);

    if (!found) {
      throw new Error('CREDENCIALES_INVALIDAS: Usuario no encontrado en el padrón.');
    }
    if (found.status === 'SUSPENDED' || found.status === 'MERGED_INACTIVE') {
      throw new Error(`ACCESO_BLOQUEADO: La cuenta ${found.memberCode} está en estado ${found.status}.`);
    }

    let authenticated = false;
    if (params.mode === 'PIN') {
      const inputPin = (params.secret || '').trim();
      if (found.securityPinHash && verifyCredentialHash(inputPin, found.securityPinHash)) {
        authenticated = true;
      } else if (
        found.authenticatorSecret &&
        found.authenticatorSyncedAt &&
        verifyStandardTotpCode(inputPin, found.authenticatorSecret)
      ) {
        authenticated = true;
      }

      if (!authenticated) {
        if (!found.securityPinHash && !found.authenticatorSyncedAt) {
          throw new Error(
            'PIN_NO_CONFIGURADO: Esta cuenta aún no tiene configurado un PIN de seguridad ni Authenticator. Inicia sesión con contraseña y configúralos en Mi Perfil.'
          );
        }
        this.appendAuditLog({
          storeId: params.storeId || found.assignedStoreId || this.getFirstAvailableStoreId(),
          actorUserId: found.userId,
          actorRole: found.role,
          coAuthorizerId: null,
          coAuthMethod: null,
          eventAction: 'USER_LOGIN_FAILED',
          targetEntityId: found.walletId,
          payloadBefore: { mode: params.mode },
          payloadAfter: { success: false },
          reasonJustification: `Intento fallido de inicio de sesión (${params.mode})`,
        });
        throw new Error('CREDENCIALES_INVALIDAS: PIN de seguridad o código Authenticator incorrecto.');
      }
    } else {
      if (!found.passwordHash || !verifyCredentialHash(params.secret || '', found.passwordHash)) {
        this.appendAuditLog({
          storeId: params.storeId || found.assignedStoreId || this.getFirstAvailableStoreId(),
          actorUserId: found.userId,
          actorRole: found.role,
          coAuthorizerId: null,
          coAuthMethod: null,
          eventAction: 'USER_LOGIN_FAILED',
          targetEntityId: found.walletId,
          payloadBefore: { mode: params.mode },
          payloadAfter: { success: false },
          reasonJustification: `Intento fallido de inicio de sesión (${params.mode})`,
        });
        throw new Error('CREDENCIALES_INVALIDAS: Contraseña incorrecta.');
      }
    }

    found.lastLoginAt = new Date().toISOString();
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 12 * 3600;
    const sid = `ses_${randomUUID().slice(0, 12)}`;
    const token = createSessionToken(
      {
        sid,
        uid: found.userId,
        mc: found.memberCode,
        role: found.role,
        storeId: found.assignedStoreId,
        iat: nowSec,
        exp: expSec,
      },
      this.hsmSecret
    );

    this.activeSessions.set(sid, {
      sid,
      userId: found.userId,
      memberCode: found.memberCode,
      role: found.role,
      storeId: found.assignedStoreId,
      authMode: params.mode,
      issuedAt: new Date(nowSec * 1000).toISOString(),
      expiresAt: new Date(expSec * 1000).toISOString(),
      revokedAt: null,
    });

    this.appendAuditLog({
      storeId: params.storeId || found.assignedStoreId || this.getFirstAvailableStoreId(),
      actorUserId: found.userId,
      actorRole: found.role,
      coAuthorizerId: null,
      coAuthMethod: params.mode,
      eventAction: 'USER_LOGIN_SUCCESS',
      targetEntityId: found.walletId,
      payloadBefore: {},
      payloadAfter: { sid, role: found.role, assignedStoreId: found.assignedStoreId },
      reasonJustification: `Inicio de sesión exitoso (${found.fullName} · ${found.role})`,
    });

    return { user: found, token };
  }

  /**
   * Emite sesión directa (Impersonation auditado por SUPER_ADMIN o entorno de pruebas) y la registra en memoria
   */
  public issueSessionForUser(userId: string): { user: PlayerWalletState; token: string } {
    const found = this.walletsByUser.get(userId);
    if (!found) throw new Error('USUARIO_NO_ENCONTRADO');
    if (found.status === 'SUSPENDED' || found.status === 'MERGED_INACTIVE') {
      throw new Error(`ACCESO_BLOQUEADO: La cuenta ${found.memberCode} está en estado ${found.status}.`);
    }
    found.lastLoginAt = new Date().toISOString();
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 12 * 3600;
    const sid = `ses_${randomUUID().slice(0, 12)}`;
    const token = createSessionToken(
      {
        sid,
        uid: found.userId,
        mc: found.memberCode,
        role: found.role,
        storeId: found.assignedStoreId,
        iat: nowSec,
        exp: expSec,
      },
      this.hsmSecret
    );

    this.activeSessions.set(sid, {
      sid,
      userId: found.userId,
      memberCode: found.memberCode,
      role: found.role,
      storeId: found.assignedStoreId,
      authMode: 'SUPERADMIN_IMPERSONATION',
      issuedAt: new Date(nowSec * 1000).toISOString(),
      expiresAt: new Date(expSec * 1000).toISOString(),
      revokedAt: null,
    });

    return { user: found, token };
  }

  /**
   * Valida criptográficamente el token Y verifica que la sesión exista y esté activa en memoria del servidor
   */
  public verifyActiveSession(token: string): {
    valid: boolean;
    reason?: string;
    user?: PlayerWalletState;
    session?: ActiveSessionRecord;
  } {
    if (!token || !token.trim()) {
      return { valid: false, reason: 'TOKEN_VACIO' };
    }
    const verified = verifySessionToken(token.trim(), this.hsmSecret);
    if (!verified.valid || !verified.payload) {
      return { valid: false, reason: verified.reason || 'FIRMA_TOKEN_INVALIDA' };
    }
    const session = this.activeSessions.get(verified.payload.sid);
    if (!session) {
      return { valid: false, reason: 'SESION_NO_ACTIVA_EN_SERVIDOR' };
    }
    if (session.revokedAt) {
      return { valid: false, reason: 'SESION_REVOCADA' };
    }
    const user = this.walletsByUser.get(session.userId);
    if (!user) {
      this.activeSessions.delete(session.sid);
      return { valid: false, reason: 'USUARIO_SESION_NO_EXISTE' };
    }
    if (user.status === 'SUSPENDED' || user.status === 'MERGED_INACTIVE') {
      this.activeSessions.delete(session.sid);
      return { valid: false, reason: `CUENTA_BLOQUEADA_${user.status}` };
    }
    // Sincronizar rol y tienda en vivo si cambiaron administrativamente
    session.role = user.role;
    session.storeId = user.assignedStoreId;
    return { valid: true, user, session };
  }

  /**
   * Revoca explícitamente una sesión activa (Logout real en servidor)
   */
  public revokeSession(token: string): boolean {
    if (!token || !token.trim()) return false;
    const verified = verifySessionToken(token.trim(), this.hsmSecret);
    if (!verified.valid || !verified.payload) return false;
    const session = this.activeSessions.get(verified.payload.sid);
    if (!session) return false;
    session.revokedAt = new Date().toISOString();
    this.activeSessions.delete(session.sid);

    const user = this.walletsByUser.get(session.userId);
    if (user) {
      this.appendAuditLog({
        storeId: user.assignedStoreId || this.getFirstAvailableStoreId(),
        actorUserId: user.userId,
        actorRole: user.role,
        coAuthorizerId: null,
        coAuthMethod: null,
        eventAction: 'USER_LOGOUT',
        targetEntityId: user.walletId,
        payloadBefore: { sid: session.sid, active: true },
        payloadAfter: { sid: session.sid, active: false, revokedAt: session.revokedAt },
        reasonJustification: `Cierre de sesión explícito (${user.fullName} · ${user.role})`,
      });
    }
    return true;
  }

  /**
   * Revoca todas las sesiones activas de un usuario específico (ej. al suspenderlo o cambiar credenciales)
   */
  public revokeAllUserSessions(userId: string): number {
    let count = 0;
    for (const [sid, ses] of this.activeSessions.entries()) {
      if (ses.userId === userId) {
        this.activeSessions.delete(sid);
        count++;
      }
    }
    return count;
  }

  /**
   * Verifica si un rol posee un permiso atómico en la matriz RBAC
   */
  public hasPermission(role: UserRoleType, permission: PermissionCode): boolean {
    const spec = ROLE_DEFINITION_MATRIX[role];
    if (!spec) return false;
    return spec.permissions.includes(permission);
  }

  /**
   * Verifica la co-autorización Four-Eyes de un supervisor (STORE_ADMIN o SUPER_ADMIN) mediante su PIN
   */
  public verifySupervisorPin(
    actorUserId: string,
    supervisorIdOrCode: string,
    supervisorPin?: string
  ): PlayerWalletState {
    const q = (supervisorIdOrCode || '').trim().toLowerCase();
    const sup = Array.from(this.walletsByUser.values()).find(
      (u) =>
        u.userId.toLowerCase() === q ||
        u.memberCode.toLowerCase() === q ||
        u.alias.toLowerCase() === q
    );
    if (!sup) {
      throw new Error('CO_AUTORIZADOR_NO_ENCONTRADO');
    }
    const otherAdminsExist = Array.from(this.walletsByUser.values()).some(
      (u) => u.userId !== actorUserId && (u.role === 'SUPER_ADMIN' || u.role === 'STORE_ADMIN')
    );
    if (sup.userId === actorUserId && (sup.role !== 'SUPER_ADMIN' || otherAdminsExist)) {
      throw new Error('CONFLICTO_FOUR_EYES: El operador no puede co-autorizarse a sí mismo.');
    }
    if (sup.role !== 'SUPER_ADMIN' && sup.role !== 'STORE_ADMIN') {
      throw new Error('ROL_CO_AUTORIZADOR_INSUFICIENTE: Se requiere STORE_ADMIN o SUPER_ADMIN.');
    }
    if (!supervisorPin || !supervisorPin.trim()) {
      throw new Error('PIN_SUPERVISOR_REQUERIDO: Se requiere el PIN de seguridad o código 2FA del supervisor co-autorizador.');
    }
    const cleanPin = supervisorPin.trim();
    let pinMatches = false;
    if (sup.securityPinHash && verifyCredentialHash(cleanPin, sup.securityPinHash)) {
      pinMatches = true;
    } else if (
      sup.authenticatorSecret &&
      sup.authenticatorSyncedAt &&
      verifyStandardTotpCode(cleanPin, sup.authenticatorSecret)
    ) {
      pinMatches = true;
    }
    if (!pinMatches) {
      if (!sup.securityPinHash && !sup.authenticatorSyncedAt) {
        throw new Error('PIN_SUPERVISOR_NO_CONFIGURADO: El co-autorizador no tiene configurado un PIN ni Authenticator.');
      }
      throw new Error('PIN_SUPERVISOR_INCORRECTO: El PIN o código Authenticator del co-autorizador no coincide.');
    }
    return sup;
  }

  /**
   * Alta de nuevo usuario (Staff o Jugador) validando estrictamente la Matriz RBAC de menor privilegio
   */
  public createUserWithRBAC(params: {
    actorUserId: string;
    fullName: string;
    alias: string;
    memberCode?: string;
    role: UserRoleType;
    email?: string;
    phone?: string;
    assignedStoreId?: string | null;
    password?: string;
    securityPin?: string;
  }): PlayerWalletState {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_SESION_NO_VALIDO');

    const cap = ROLE_DEFINITION_MATRIX[actor.role];
    if (!cap.canCreateRoles.includes(params.role)) {
      throw new Error(
        `ESCALACION_PRIVILEGIOS_BLOQUEADA: El rol ${actor.role} no tiene permiso para dar de alta cuentas con rol ${params.role}.`
      );
    }

    const prefix = params.role === 'PLAYER' ? 'CC' : 'STF';
    const nextCode =
      params.memberCode?.trim() || `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    const duplicate = Array.from(this.walletsByUser.values()).find(
      (u) =>
        u.memberCode.toLowerCase() === nextCode.toLowerCase() ||
        u.alias.toLowerCase() ===
          (params.alias.startsWith('@') ? params.alias : `@${params.alias}`).toLowerCase()
    );
    if (duplicate) {
      throw new Error(`USUARIO_DUPLICADO: Ya existe un registro con código o alias similar (${duplicate.memberCode}).`);
    }

    const effectiveStore =
      actor.role === 'STORE_ADMIN' && actor.assignedStoreId
        ? actor.assignedStoreId
        : params.assignedStoreId !== undefined
          ? params.assignedStoreId || null
          : params.role === 'SUPER_ADMIN' || params.role === 'AUDITOR' || params.role === 'PLAYER'
            ? null
            : this.getFirstAvailableStoreId();

    const created = this.registerUser({
      userId: `u_${params.role.toLowerCase()}_${Date.now()}_${randomUUID().slice(0, 4)}`,
      memberCode: nextCode,
      fullName: params.fullName.trim(),
      alias: params.alias.trim(),
      role: params.role,
      email: params.email?.trim() || undefined,
      phone: params.phone?.trim() || undefined,
      assignedStoreId:
        params.role === 'SUPER_ADMIN' || params.role === 'AUDITOR' ? null : effectiveStore,
      password: params.password || 'krona2026',
      securityPin: params.securityPin?.trim() || undefined,
      createdByUserId: actor.userId,
    });

    this.appendAuditLog({
      storeId: effectiveStore || actor.assignedStoreId || this.getFirstAvailableStoreId(),
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'USER_CREATED_IAM',
      targetEntityId: created.walletId,
      payloadBefore: {},
      payloadAfter: {
        userId: created.userId,
        memberCode: created.memberCode,
        fullName: created.fullName,
        role: created.role,
        assignedStoreId: created.assignedStoreId,
      },
      reasonJustification: `Alta de usuario ${created.fullName} (${created.role}) ejecutada por ${actor.fullName}`,
    });

    return created;
  }

  /**
   * Actualización administrativa de rol, sucursal asignada o estado de un usuario
   */
  public adminUpdateUser(params: {
    actorUserId: string;
    targetUserId: string;
    newRole?: UserRoleType;
    newAssignedStoreId?: string | null;
    newStatus?: 'ACTIVE' | 'SUSPENDED' | 'SELF_LOCKED';
    reason: string;
  }): PlayerWalletState {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor || (actor.role !== 'SUPER_ADMIN' && actor.role !== 'STORE_ADMIN')) {
      throw new Error('PERMISO_DENEGADO_RBAC: Solo SUPER_ADMIN o STORE_ADMIN pueden modificar roles/estados.');
    }
    const target = this.walletsByUser.get(params.targetUserId);
    if (!target) throw new Error('USUARIO_OBJETIVO_NO_ENCONTRADO');

    if (actor.userId === target.userId && (params.newRole || params.newStatus === 'SUSPENDED')) {
      throw new Error('PROTECCION_AUTO_BLOQUEO: No puedes degradar tu propio rol ni suspender tu propia sesión.');
    }
    if (actor.role === 'STORE_ADMIN' && params.newRole === 'SUPER_ADMIN') {
      throw new Error('ESCALACION_PRIVILEGIOS_BLOQUEADA: STORE_ADMIN no puede promover a SUPER_ADMIN.');
    }
    if (target.status === 'FROZEN_DISPUTE' && params.newStatus === 'ACTIVE' && target.debtBalanceCents > 0) {
      throw new Error('CUENTA_CON_DEUDA_CLAWBACK: No se puede reactivar mientras tenga saldo deudor en Cta 1205.');
    }

    const before = {
      role: target.role,
      assignedStoreId: target.assignedStoreId,
      status: target.status,
    };

    if (params.newRole) target.role = params.newRole;
    if (params.newAssignedStoreId !== undefined) target.assignedStoreId = params.newAssignedStoreId;
    if (params.newStatus) {
      target.status = params.newStatus;
      if (params.newStatus === 'SUSPENDED') {
        this.revokeAllUserSessions(target.userId);
      }
    }

    this.appendAuditLog({
      storeId: actor.assignedStoreId || this.getFirstAvailableStoreId(),
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'USER_IAM_UPDATED',
      targetEntityId: target.walletId,
      payloadBefore: before,
      payloadAfter: {
        role: target.role,
        assignedStoreId: target.assignedStoreId,
        status: target.status,
      },
      reasonJustification: params.reason || 'Actualización administrativa de usuario',
    });

    return target;
  }

  /**
   * Configuración de Perfil Personal (/profile): Nombre, Alias, Email, Teléfono y Credenciales
   */
  public updateOwnProfile(params: {
    userId: string;
    fullName?: string;
    alias?: string;
    email?: string;
    phone?: string;
    newPassword?: string;
    newSecurityPin?: string;
  }): PlayerWalletState {
    const user = this.walletsByUser.get(params.userId);
    if (!user) throw new Error('USUARIO_NO_ENCONTRADO');

    const before = {
      fullName: user.fullName,
      alias: user.alias,
      email: user.email,
      phone: user.phone,
    };

    if (params.fullName?.trim()) user.fullName = params.fullName.trim();
    if (params.alias?.trim()) {
      user.alias = params.alias.trim().startsWith('@')
        ? params.alias.trim()
        : `@${params.alias.trim()}`;
    }
    if (params.email?.trim()) user.email = params.email.trim();
    if (params.phone?.trim()) user.phone = params.phone.trim();

    let credentialsChanged = false;
    if (params.newPassword?.trim()) {
      user.passwordHash = hashCredential(params.newPassword.trim());
      credentialsChanged = true;
    }
    if (params.newSecurityPin?.trim()) {
      user.securityPinHash = hashCredential(params.newSecurityPin.trim());
      credentialsChanged = true;
    }

    this.appendAuditLog({
      storeId: user.assignedStoreId || this.getFirstAvailableStoreId(),
      actorUserId: user.userId,
      actorRole: user.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: credentialsChanged ? 'USER_PROFILE_AND_CREDENTIALS_UPDATED' : 'USER_PROFILE_UPDATED',
      targetEntityId: user.walletId,
      payloadBefore: before,
      payloadAfter: {
        fullName: user.fullName,
        alias: user.alias,
        email: user.email,
        phone: user.phone,
        credentialsRotated: credentialsChanged,
      },
      reasonJustification: 'Actualización de perfil personal y credenciales desde /profile',
    });

    return user;
  }

  /**
   * Obtiene o inicializa los datos de configuración de 2FA Authenticator (Google / Microsoft Authenticator)
   */
  public getOrInitAuthenticatorSetup(userId: string): {
    secret: string;
    formattedSecret: string;
    otpauthUri: string;
    otpAuthUri?: string;
    isSynced: boolean;
    syncedAt: string | null;
    hasAuthenticator?: boolean;
    authenticatorSyncedAt?: string | null;
    memberCode: string;
    issuer: string;
  } {
    const user = this.walletsByUser.get(userId);
    if (!user) throw new Error('USUARIO_NO_ENCONTRADO');

    let secret = user.authenticatorSecret;
    if (!secret) {
      secret = generateAuthenticatorSecret();
      user.authenticatorSecret = secret;
      user.authenticatorSyncedAt = null;
    }

    const formattedSecret = formatBase32Secret(secret);
    const otpauthUri = generateOtpAuthUri({
      secret,
      accountName: `${user.memberCode} (${user.alias})`,
      issuer: 'KRONA VAULT',
    });

    return {
      secret,
      formattedSecret,
      otpauthUri,
      otpAuthUri: otpauthUri,
      isSynced: Boolean(user.authenticatorSyncedAt),
      syncedAt: user.authenticatorSyncedAt || null,
      hasAuthenticator: Boolean(user.authenticatorSyncedAt),
      authenticatorSyncedAt: user.authenticatorSyncedAt || null,
      memberCode: user.memberCode,
      issuer: 'KRONA VAULT',
    };
  }

  /**
   * Verifica el código de 6 dígitos ingresado desde la app y activa la sincronización 2FA
   */
  public verifyAndActivateAuthenticator(params: {
    userId: string;
    token: string;
    secret?: string;
  }): { success: boolean; syncedAt: string } {
    const user = this.walletsByUser.get(params.userId);
    if (!user) throw new Error('USUARIO_NO_ENCONTRADO');

    const effectiveSecret = params.secret?.trim() || user.authenticatorSecret;
    if (!effectiveSecret) {
      throw new Error('CONFIGURACION_2FA_NO_INICIALIZADA: Solicita primero la clave de sincronización.');
    }

    const isValid = verifyStandardTotpCode(params.token, effectiveSecret);
    if (!isValid) {
      throw new Error(
        'CODIGO_2FA_INVALIDO: El código de 6 dígitos ingresado no coincide con tu aplicación Authenticator. Revisa que la hora de tu dispositivo esté sincronizada e intenta de nuevo.'
      );
    }

    const nowIso = new Date().toISOString();
    user.authenticatorSecret = effectiveSecret;
    user.authenticatorSyncedAt = nowIso;

    this.appendAuditLog({
      storeId: user.assignedStoreId || this.getFirstAvailableStoreId(),
      actorUserId: user.userId,
      actorRole: user.role,
      coAuthorizerId: null,
      coAuthMethod: 'TOTP_AUTHENTICATOR',
      eventAction: 'USER_2FA_AUTHENTICATOR_SYNCED',
      targetEntityId: user.walletId,
      payloadBefore: {},
      payloadAfter: { syncedAt: nowIso },
      reasonJustification: 'Sincronización exitosa de Google / Microsoft Authenticator (RFC 6238)',
    });

    return { success: true, syncedAt: nowIso };
  }

  /**
   * Desvincula la aplicación Authenticator 2FA de la cuenta
   */
  public disableAuthenticator(userId: string): { success: boolean } {
    const user = this.walletsByUser.get(userId);
    if (!user) throw new Error('USUARIO_NO_ENCONTRADO');

    user.authenticatorSecret = null;
    user.authenticatorSyncedAt = null;

    this.appendAuditLog({
      storeId: user.assignedStoreId || this.getFirstAvailableStoreId(),
      actorUserId: user.userId,
      actorRole: user.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'USER_2FA_AUTHENTICATOR_DISABLED',
      targetEntityId: user.walletId,
      payloadBefore: {},
      payloadAfter: { disabled: true },
      reasonJustification: 'Desvinculación de app Authenticator 2FA',
    });

    return { success: true };
  }

  /**
   * Ciclo de Vida de Torneos — Fase 1: Crear un Torneo Persistido
   */
  public createTournament(params: {
    storeId: string;
    actorUserId: string;
    name: string;
    gameFormat: string;
    entryFeeCents: number;
    prizeContributionPerPlayerCents: number;
    guaranteedPrizePoolCents: number;
  }): TournamentRecord {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!ROLE_DEFINITION_MATRIX[actor.role].canManageTournaments) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no puede crear torneos.`);
    }
    const store = this.stores.get(params.storeId);
    if (!store) throw new Error('SUCURSAL_NO_ENCONTRADA');

    this.tournamentSequence += 1;
    const folio = `TRN-${store.code.replace('SUC-', '')}-${this.tournamentSequence.toString().padStart(3, '0')}`;
    const id = `trn_${Date.now()}_${this.tournamentSequence}`;

    const trn: TournamentRecord = {
      id,
      folio,
      name: params.name.trim(),
      gameFormat: params.gameFormat || 'MTG Modern',
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
      status: 'OPEN_REGISTRATION',
      entryFeeCents: Math.max(0, Number(params.entryFeeCents || 0)),
      prizeContributionPerPlayerCents: Math.max(0, Number(params.prizeContributionPerPlayerCents || 0)),
      guaranteedPrizePoolCents: Math.max(0, Number(params.guaranteedPrizePoolCents || 0)),
      calculatedPrizePoolCents: Math.max(0, Number(params.guaranteedPrizePoolCents || 0)),
      participants: [],
      createdByUserId: actor.userId,
      createdByName: `${actor.fullName} (${actor.memberCode})`,
      createdAt: new Date().toISOString(),
    };

    this.tournaments.set(trn.id, trn);

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'TOURNAMENT_CREATED',
      targetEntityId: trn.folio,
      payloadBefore: {},
      payloadAfter: {
        folio: trn.folio,
        name: trn.name,
        gameFormat: trn.gameFormat,
        guaranteedPrizePoolCents: trn.guaranteedPrizePoolCents,
      },
      reasonJustification: `Apertura de torneo ${trn.name} (${trn.folio})`,
    });

    return trn;
  }

  /**
   * Ciclo de Vida de Torneos — Fase 2: Inscribir Jugador Real y Recalcular Pozo Dinámico
   */
  public enrollPlayerInTournament(params: {
    tournamentId: string;
    actorUserId: string;
    playerUserId: string;
    matchRecord?: string;
  }): TournamentRecord {
    const trn = this.tournaments.get(params.tournamentId);
    if (!trn) throw new Error('TORNEO_NO_ENCONTRADO');
    if (trn.status !== 'OPEN_REGISTRATION') {
      throw new Error('TORNEO_CERRADO: Solo se pueden inscribir jugadores en estado OPEN_REGISTRATION.');
    }
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    const player = this.walletsByUser.get(params.playerUserId);
    if (!player || player.role !== 'PLAYER') throw new Error('JUGADOR_NO_VALIDO');
    if (player.status !== 'ACTIVE') {
      throw new Error(`JUGADOR_NO_ELEGIBLE: El jugador ${player.memberCode} está en estado ${player.status}.`);
    }

    const existing = trn.participants.find((p) => p.playerUserId === player.userId);
    if (existing) {
      if (params.matchRecord) existing.matchRecord = params.matchRecord;
      return trn;
    }

    trn.participants.push({
      playerUserId: player.userId,
      playerMemberCode: player.memberCode,
      playerName: player.fullName,
      playerAlias: player.alias,
      enrolledAt: new Date().toISOString(),
      enrolledByUserId: actor.userId,
      enrolledByName: actor.fullName,
      checkedIn: true,
      matchRecord: params.matchRecord || '0-0-0',
    });

    trn.calculatedPrizePoolCents = Math.max(
      trn.guaranteedPrizePoolCents,
      trn.participants.length * trn.prizeContributionPerPlayerCents
    );

    this.appendAuditLog({
      storeId: trn.storeId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'TOURNAMENT_PLAYER_ENROLLED',
      targetEntityId: trn.folio,
      payloadBefore: { participantsCount: trn.participants.length - 1 },
      payloadAfter: {
        participantsCount: trn.participants.length,
        enrolledPlayer: player.memberCode,
        calculatedPrizePoolCents: trn.calculatedPrizePoolCents,
      },
      reasonJustification: `Check-in de ${player.fullName} (${player.memberCode}) en ${trn.folio}`,
    });

    return trn;
  }

  /**
   * Busca un jugador por memberCode, nombre completo o alias; si no existe, lo da de alta automáticamente
   */
  public findOrCreatePlayer(params: {
    fullName: string;
    memberCode?: string;
    storeId?: string;
    actorUserId: string;
  }): PlayerWalletState {
    const cleanName = params.fullName.trim();
    const lowerName = cleanName.toLowerCase();
    const cleanCode = params.memberCode?.trim().toUpperCase();

    // 1. Coincidencia por código de miembro
    if (cleanCode) {
      const matchByCode = Array.from(this.walletsByUser.values()).find(
        (u) => u.memberCode.toUpperCase() === cleanCode
      );
      if (matchByCode) return matchByCode;
    }

    // 2. Coincidencia por nombre completo o alias
    const matchByName = Array.from(this.walletsByUser.values()).find((u) => {
      const uFull = u.fullName.toLowerCase();
      const uAlias = u.alias.toLowerCase().replace('@', '');
      return (
        uFull === lowerName ||
        (uFull.length > 4 && lowerName.length > 4 && (uFull.includes(lowerName) || lowerName.includes(uFull))) ||
        uAlias === lowerName.replace(/[@\s]/g, '')
      );
    });
    if (matchByName) return matchByName;

    // 3. Crear nuevo jugador si no existe
    const actor =
      this.walletsByUser.get(params.actorUserId) ||
      this.walletsByUser.get('u_to_1') ||
      Array.from(this.walletsByUser.values())[0];

    const cleanAlias = `@${cleanName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'player'}${Math.floor(100 + Math.random() * 900)}`;
    const newCode =
      cleanCode && !Array.from(this.walletsByUser.values()).some((u) => u.memberCode === cleanCode)
        ? cleanCode
        : `CC-${Math.floor(1000 + Math.random() * 9000)}`;

    const effectiveStore = params.storeId || actor.assignedStoreId || this.getFirstAvailableStoreId();

    const created = this.registerUser({
      userId: `u_player_${Date.now()}_${randomUUID().slice(0, 4)}`,
      memberCode: newCode,
      fullName: cleanName,
      alias: cleanAlias,
      role: 'PLAYER',
      assignedStoreId: effectiveStore,
      password: 'krona' + Math.floor(1000 + Math.random() * 9000),
      createdByUserId: actor.userId,
    });

    this.appendAuditLog({
      storeId: effectiveStore,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'PLAYER_AUTO_REGISTERED_FROM_TOURNAMENT',
      targetEntityId: created.memberCode,
      targetUserId: created.userId,
      targetMemberCode: created.memberCode,
      targetFullName: created.fullName,
      payloadBefore: {},
      payloadAfter: {
        userId: created.userId,
        memberCode: created.memberCode,
        fullName: created.fullName,
      },
      reasonJustification: `Alta express automática de jugador importado desde torneo: ${created.fullName}`,
    });

    return created;
  }

  /**
   * Crea un torneo estructurado por categorías (Master, Senior, Junior, etc.) con cálculo de pozo por ocupación
   */
  public createCategoryTournament(params: {
    storeId: string;
    actorUserId: string;
    name: string;
    gameFormat: string;
    gameType?: 'POKEMON_TCG' | 'POKEMON_VGC' | 'POKEMON_GO' | 'MAGIC' | 'YUGIOH' | 'ONE_PIECE' | 'LORCANA' | 'OTHER' | string;
    categories: Array<{
      name: string;
      entryFeeCents: number;
      prizeContributionCents: number;
      maxParticipants?: number;
      registeredCount?: number;
      guaranteedPoolCents?: number;
      topCutSize?: number;
    }>;
    unifyCategoriesPool?: boolean;
    unifySeniorJunior?: boolean;
    sourceStandingsRaw?: string;
  }): TournamentRecord {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!ROLE_DEFINITION_MATRIX[actor.role].canManageTournaments) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no puede gestionar torneos.`);
    }
    const store = this.stores.get(params.storeId);
    if (!store) throw new Error('SUCURSAL_NO_ENCONTRADA');

    this.tournamentSequence += 1;
    const folio = `TRN-${store.code.replace('SUC-', '')}-${this.tournamentSequence.toString().padStart(3, '0')}`;
    const id = `trn_${Date.now()}_${this.tournamentSequence}`;

    const categories: TournamentCategoryRecord[] = params.categories.map((cat, idx) => {
      const regCount = Math.max(0, Number(cat.registeredCount || 0));
      const contrib = Math.max(0, Number(cat.prizeContributionCents || 0));
      const guar = Math.max(0, Number(cat.guaranteedPoolCents || 0));
      const calculatedPoolCents = Math.max(guar, regCount * contrib);
      return {
        id: `cat_${idx + 1}_${cat.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name: cat.name,
        entryFeeCents: Math.max(0, Number(cat.entryFeeCents || 0)),
        prizeContributionCents: contrib,
        maxParticipants: cat.maxParticipants,
        registeredCount: regCount,
        guaranteedPoolCents: guar,
        calculatedPoolCents,
        topCutSize: cat.topCutSize || 4,
      };
    });

    const totalCalculatedPoolCents = categories.reduce((sum, c) => sum + c.calculatedPoolCents, 0);
    const totalGuaranteedPoolCents = categories.reduce((sum, c) => sum + c.guaranteedPoolCents, 0);

    const trn: TournamentRecord = {
      id,
      folio,
      name: params.name.trim(),
      gameFormat: params.gameFormat || 'Pokémon TCG',
      gameType: params.gameType || 'POKEMON_TCG',
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
      status: 'OPEN_REGISTRATION',
      entryFeeCents: categories[0]?.entryFeeCents || 0,
      prizeContributionPerPlayerCents: categories[0]?.prizeContributionCents || 0,
      guaranteedPrizePoolCents: totalGuaranteedPoolCents,
      calculatedPrizePoolCents: totalCalculatedPoolCents,
      participants: [],
      categories,
      unifyCategoriesPool: Boolean(params.unifyCategoriesPool),
      unifySeniorJunior: Boolean(params.unifySeniorJunior),
      sourceStandingsRaw: params.sourceStandingsRaw,
      createdByUserId: actor.userId,
      createdByName: `${actor.fullName} (${actor.memberCode})`,
      createdAt: new Date().toISOString(),
    };

    this.tournaments.set(trn.id, trn);

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'CATEGORY_TOURNAMENT_CREATED',
      targetEntityId: trn.folio,
      payloadBefore: {},
      payloadAfter: {
        folio: trn.folio,
        name: trn.name,
        categories: categories.map((c) => ({
          name: c.name,
          occupancy: c.registeredCount,
          poolCents: c.calculatedPoolCents,
        })),
        unifyCategoriesPool: trn.unifyCategoriesPool,
        totalCalculatedPoolCents: trn.calculatedPrizePoolCents,
      },
      reasonJustification: `Apertura de torneo por categorías ${trn.name} (${trn.folio})`,
    });

    return trn;
  }

  /**
   * Dispersa premios de un torneo por categorías (o pozo unificado) con partida doble y verificación Zero-Sum
   */
  public disperseCategoryTournament(params: {
    tournamentId: string;
    actorUserId: string;
    coAuthorizerUserId?: string | null;
    coAuthorizerPin?: string | null;
    categoryDispersions: Array<{
      categoryName: string;
      poolCents: number;
      standings: TournamentPrizeStanding[];
    }>;
  }): {
    tournament: TournamentRecord;
    totalDispersedCents: number;
    journalEntryIds: string[];
    standings: TournamentPrizeStanding[];
  } {
    const trn = this.tournaments.get(params.tournamentId);
    if (!trn) throw new Error('TORNEO_NO_ENCONTRADO');
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!ROLE_DEFINITION_MATRIX[actor.role].canManageTournaments) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no puede liquidar torneos.`);
    }

    const coAuthId = params.coAuthorizerUserId || null;
    const coAuthUser = coAuthId ? this.walletsByUser.get(coAuthId) : null;

    let totalDispersedCents = 0;
    const journalEntryIds: string[] = [];
    const allStandings: TournamentPrizeStanding[] = [];

    for (const catDisp of params.categoryDispersions) {
      for (const st of catDisp.standings) {
        if (st.awardedCents <= 0) continue;

        // Validar que el actor no se auto-premie sin co-autorización
        const fallbackStaff =
          Array.from(this.walletsByUser.values()).find(
            (u) => u.userId !== st.playerUserId && u.role !== 'PLAYER'
          ) ?? actor;
        const issueActor = actor.userId === st.playerUserId ? fallbackStaff : actor;

        const creditResult = this.issueCredit({
          storeId: trn.storeId,
          targetUserId: st.playerUserId,
          actorUserId: issueActor.userId,
          actorRole: issueActor.role,
          coAuthorizerUserId: coAuthId ?? undefined,
          amountCents: st.awardedCents,
          sourceType: 'TOURNAMENT_PRIZE',
          sourceLabel: `Premio Pos #${st.position} (${catDisp.categoryName}) - ${trn.name}${st.inTopSplit ? ' [Split]' : ''}`,
          referenceId: `${trn.folio}-${catDisp.categoryName.toUpperCase()}`,
          expiryDays: 180,
        });

        totalDispersedCents += st.awardedCents;
        journalEntryIds.push(creditResult.journalEntry.id);
        allStandings.push(st);
      }
    }

    trn.status = 'DISPERSED_COMPLETED';
    trn.standings = allStandings;
    trn.dispersedByUserId = actor.userId;
    trn.dispersedByName = `${actor.fullName} (${actor.memberCode})`;
    trn.coAuthorizedByUserId = coAuthId;
    trn.coAuthorizedByName = coAuthUser
      ? `${coAuthUser.fullName} (${coAuthUser.memberCode})`
      : coAuthId;
    trn.dispersedAt = new Date().toISOString();

    return {
      tournament: trn,
      totalDispersedCents,
      journalEntryIds,
      standings: allStandings,
    };
  }

  /**
   * Buscador Forense Filtrable ("¿Quién Hizo Qué, Cuándo, Dónde y Sobre Quién?")
   */
  public queryForensicAudit(filters: {

    actorQuery?: string;
    roleFilter?: string;
    actionFilter?: string;
    targetOrRefQuery?: string;
  }): AuditLogRecord[] {
    const aq = (filters.actorQuery || '').trim().toLowerCase();
    const rf = (filters.roleFilter || '').trim().toUpperCase();
    const af = (filters.actionFilter || '').trim().toUpperCase();
    const tq = (filters.targetOrRefQuery || '').trim().toLowerCase();

    return [...this.auditLogs].reverse().filter((log) => {
      if (aq) {
        const hayActor =
          log.actorUserId.toLowerCase().includes(aq) ||
          (log.actorMemberCode || '').toLowerCase().includes(aq) ||
          (log.actorFullName || '').toLowerCase().includes(aq) ||
          (log.actorAlias || '').toLowerCase().includes(aq) ||
          (log.coAuthorizerId || '').toLowerCase().includes(aq) ||
          (log.coAuthorizerName || '').toLowerCase().includes(aq);
        if (!hayActor) return false;
      }
      if (rf && rf !== 'ALL' && log.actorRole !== rf) {
        return false;
      }
      if (af && af !== 'ALL' && !log.eventAction.toUpperCase().includes(af)) {
        return false;
      }
      if (tq) {
        const rawJson = JSON.stringify(log.payloadAfter).toLowerCase();
        const hayTarget =
          log.targetEntityId.toLowerCase().includes(tq) ||
          (log.targetMemberCode || '').toLowerCase().includes(tq) ||
          (log.targetFullName || '').toLowerCase().includes(tq) ||
          log.reasonJustification.toLowerCase().includes(tq) ||
          rawJson.includes(tq);
        if (!hayTarget) return false;
      }
      return true;
    });
  }

  /**
   * Verifica matemáticamente toda la cadena Hash-Chain de auditoría y la partida doble del Ledger
   */
  public verifySystemIntegrity(): {
    ledgerBalanced: boolean;
    auditChainIntact: boolean;
    totalJournalEntries: number;
    totalAuditEvents: number;
    journalEntriesCount: number;
    auditRowsCount: number;
    totalDebitsCents: number;
    totalCreditsCents: number;
    headAuditHash: string;
  } {
    let totalDebitsCents = 0;
    let totalCreditsCents = 0;

    for (const entry of this.journalEntries) {
      const sumDebit = entry.lines.reduce((s, l) => s + l.debitCents, 0);
      const sumCredit = entry.lines.reduce((s, l) => s + l.creditCents, 0);
      totalDebitsCents += sumDebit;
      totalCreditsCents += sumCredit;
      if (sumDebit !== sumCredit || entry.lines.length < 2) {
        return {
          ledgerBalanced: false,
          auditChainIntact: false,
          totalJournalEntries: this.journalEntries.length,
          totalAuditEvents: this.auditLogs.length,
          journalEntriesCount: this.journalEntries.length,
          auditRowsCount: this.auditLogs.length,
          totalDebitsCents,
          totalCreditsCents,
          headAuditHash: GENESIS_AUDIT_HASH,
        };
      }
    }

    let expectedPrevHash = GENESIS_AUDIT_HASH;
    for (const log of this.auditLogs) {
      if (log.prevHash !== expectedPrevHash) {
        return {
          ledgerBalanced: true,
          auditChainIntact: false,
          totalJournalEntries: this.journalEntries.length,
          totalAuditEvents: this.auditLogs.length,
          journalEntriesCount: this.journalEntries.length,
          auditRowsCount: this.auditLogs.length,
          totalDebitsCents,
          totalCreditsCents,
          headAuditHash: expectedPrevHash,
        };
      }
      const recomputed = computeAuditHashChainLink(
        {
          seqId: log.seqId,
          timestampIso: log.createdAt,
          orgId: log.orgId,
          storeId: log.storeId,
          actorUserId: log.actorUserId,
          coAuthorizerId: log.coAuthorizerId,
          eventAction: log.eventAction,
          payloadBeforeJson: JSON.stringify(log.payloadBefore),
          payloadAfterJson: JSON.stringify(log.payloadAfter),
          prevHash: log.prevHash,
        },
        this.hsmSecret
      );
      if (recomputed.rowHash !== log.rowHash || recomputed.serverHmac !== log.serverHmac) {
        return {
          ledgerBalanced: true,
          auditChainIntact: false,
          totalJournalEntries: this.journalEntries.length,
          totalAuditEvents: this.auditLogs.length,
          journalEntriesCount: this.journalEntries.length,
          auditRowsCount: this.auditLogs.length,
          totalDebitsCents,
          totalCreditsCents,
          headAuditHash: expectedPrevHash,
        };
      }
      expectedPrevHash = log.rowHash;
    }

    return {
      ledgerBalanced: true,
      auditChainIntact: true,
      totalJournalEntries: this.journalEntries.length,
      totalAuditEvents: this.auditLogs.length,
      journalEntriesCount: this.journalEntries.length,
      auditRowsCount: this.auditLogs.length,
      totalDebitsCents,
      totalCreditsCents,
      headAuditHash: expectedPrevHash,
    };
  }

  // ============================================================================
  // GESTIÓN DE CARTAS EN RESGUARDO (VAULT CUSTODY & ESCROW)
  // ============================================================================

  /**
   * Registra un nuevo paquete de cartas en resguardo físico en bóveda, emitiendo
   * el Comprobante de Recepción VaultSeal™ (físico y digital) obligatorio para su posterior retiro.
   */
  public createCustodyPackage(params: {
    actorUserId: string;
    storeId: string;
    // Remitente (Quién deja las cartas)
    depositorUserId?: string | null;
    depositorName?: string | null;
    depositorPhone?: string | null;
    depositorEmail?: string | null;
    // Destinatario (Quién recibe / retira las cartas)
    recipientUserId?: string | null;
    recipientName?: string | null;
    recipientPhone?: string | null;
    recipientEmail?: string | null;
    isForThirdParty?: boolean;
    // Compatibilidad retroactiva
    clientUserId?: string | null;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string | null;
    purpose: CustodyPurpose;
    vaultLocation: string;
    tamperSealNumber?: string;
    declaredValueCents?: number;
    itemsSummary: string;
    dueDate?: string;
    items?: Array<{
      game?: string;
      cardName: string;
      condition?: string;
      quantity?: number;
      declaredItemValueCents?: number;
      estimatedValueCents?: number;
      setName?: string;
      isFoil?: boolean;
      notes?: string;
    }>;
    photos?: Array<{
      photoType: CustodyPhotoType;
      caption?: string;
      dataUri: string;
    }>;
    intakeSupervisorId?: string | null;
  }): { custodyPackage: CustodyPackageRecord; package: CustodyPackageRecord; claimToken: string } {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!this.hasPermission(actor.role, 'custody:package:intake')) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no tiene permiso custody:package:intake.`);
    }

    const store = this.stores.get(params.storeId) || Array.from(this.stores.values())[0];
    if (!store) throw new Error('SUCURSAL_NO_ENCONTRADA');

    // 1. Resolver Remitente (Quién deja las cartas)
    let depositorUser: PlayerWalletState | null = null;
    if (params.depositorUserId) {
      depositorUser = this.walletsByUser.get(params.depositorUserId) || null;
    } else if (params.clientUserId && !params.isForThirdParty) {
      depositorUser = this.walletsByUser.get(params.clientUserId) || null;
    }

    const depositorName = (params.depositorName?.trim() || depositorUser?.fullName || params.clientName?.trim() || 'Remitente Mostrador');
    const depositorPhone = (params.depositorPhone?.trim() || depositorUser?.phone || params.clientPhone?.trim() || '');
    const depositorEmail = (params.depositorEmail?.trim() || depositorUser?.email || params.clientEmail || null);
    const depositorMemberCode = depositorUser?.memberCode || `DEP-${Math.floor(1000 + Math.random() * 9000)}`;

    // 2. Resolver Destinatario (Quién recibe / retira las cartas)
    let recipientUser: PlayerWalletState | null = null;
    if (params.recipientUserId) {
      recipientUser = this.walletsByUser.get(params.recipientUserId) || null;
    } else if (params.clientUserId && params.isForThirdParty) {
      recipientUser = this.walletsByUser.get(params.clientUserId) || null;
    } else if (!params.isForThirdParty && !params.recipientName) {
      recipientUser = depositorUser;
    }

    const isForThirdParty = Boolean(
      params.isForThirdParty ||
      (params.recipientName && params.recipientName.trim().toLowerCase() !== depositorName.toLowerCase()) ||
      (params.recipientUserId && params.recipientUserId !== (depositorUser?.userId || params.depositorUserId))
    );

    const recipientName = (params.recipientName?.trim() || recipientUser?.fullName || (isForThirdParty ? 'Destinatario Designado' : depositorName));
    const recipientPhone = (params.recipientPhone?.trim() || recipientUser?.phone || (isForThirdParty ? '' : depositorPhone));
    const recipientEmail = (params.recipientEmail?.trim() || recipientUser?.email || (isForThirdParty ? null : depositorEmail));
    const recipientMemberCode = recipientUser?.memberCode || (isForThirdParty ? `REC-${Math.floor(1000 + Math.random() * 9000)}` : depositorMemberCode);

    // Compatibilidad retroactiva: clientName y clientUserId corresponden al destinatario titular
    const clientUser = recipientUser || depositorUser || (params.clientUserId ? this.walletsByUser.get(params.clientUserId) : null);
    const clientName = recipientName;
    const clientPhone = recipientPhone || depositorPhone;
    const clientEmail = recipientEmail || depositorEmail;
    const memberCode = recipientMemberCode || depositorMemberCode;

    this.custodySequence += 1;
    const storePrefix = store.code.replace('SUC-', '');
    const folio = `CUST-${storePrefix}-${new Date().getFullYear()}-${this.custodySequence.toString().padStart(4, '0')}`;
    const id = `cust_${Date.now()}_${this.custodySequence}`;

    const secretEntropy = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const claimToken = `vct_${id}_${secretEntropy}`;
    const claimTokenHash = createHash('sha256').update(claimToken).digest('hex');

    const sealNumber = params.tamperSealNumber?.trim() || 'N/A';
    const declaredValue = Math.max(0, params.declaredValueCents || 0);

    const sealResult = generateCustodyReceiptSeal({
      folio,
      storeCode: store.code,
      clientMemberCode: memberCode,
      tamperSealNumber: sealNumber,
      declaredValueCents: declaredValue,
      hsmSecret: this.hsmSecret,
    });

    const items: CustodyCardItem[] = (params.items || []).map((it, idx) => ({
      id: `item_${id}_${idx + 1}`,
      game: it.game || 'TCG',
      cardName: it.cardName.trim(),
      condition: it.condition || 'NM',
      quantity: Math.max(1, it.quantity || 1),
      declaredItemValueCents: Math.max(0, it.declaredItemValueCents || it.estimatedValueCents || 0),
      setName: it.setName?.trim() || undefined,
      isFoil: Boolean(it.isFoil),
      notes: it.notes?.trim() || undefined,
    }));

    const photos: CustodyPhotoEvidence[] = (params.photos || []).map((ph, idx) => ({
      id: `ph_${id}_${idx + 1}`,
      photoType: ph.photoType,
      caption: ph.caption?.trim() || undefined,
      dataUri: ph.dataUri,
      sha256Hash: createHash('sha256').update(ph.dataUri).digest('hex'),
      capturedAt: new Date().toISOString(),
    }));

    const digestPayload = `${folio}|${sealNumber}|${declaredValue}|${items.length}|${photos.map((p) => p.sha256Hash).join(',')}`;
    const packageContentDigest = createHash('sha256').update(digestPayload).digest('hex');

    const dueDate = params.dueDate || '';
    const isHighValue = declaredValue >= 1_000_000; // >= $10,000 MXN

    const pkg: CustodyPackageRecord = {
      id,
      folio,
      storeId: store.id,
      storeCode: store.code,
      clientUserId: clientUser?.userId || id,
      clientMemberCode: memberCode,
      clientName,
      clientPhone,
      clientEmail: params.clientEmail || clientUser?.email || null,
      depositorUserId: depositorUser?.userId || null,
      depositorMemberCode,
      depositorName,
      depositorPhone,
      depositorEmail,
      recipientUserId: recipientUser?.userId || null,
      recipientMemberCode,
      recipientName,
      recipientPhone,
      recipientEmail,
      isForThirdParty,
      pickedUpByName: null,
      pickedUpByRole: null,
      purpose: params.purpose,
      status: 'RECEIVED',
      statusReason: isForThirdParty 
        ? `Ingreso en mostrador por ${depositorName} para retiro por ${recipientName}`
        : 'Ingreso inicial en mostrador con comprobante emitido',
      vaultLocation: params.vaultLocation?.trim() || 'Gaveta Mostrador',
      tamperSealNumber: sealNumber,
      declaredValueCents: declaredValue,
      isHighValue,
      itemsSummary: params.itemsSummary?.trim() || (items.length > 0 ? `${items.length} carta(s)` : 'Lote sin detallar'),
      totalCardsCount: items.reduce((acc, it) => acc + it.quantity, 0) || 1,
      items,
      photos,
      packageContentDigest,
      claimVerificationCode: sealResult.claimVerificationCode,
      claimTokenHash,
      receiptToken: sealResult.receiptToken,
      receiptFolio: `REC-${folio}`,
      receiptPrintCount: 1,
      dueDate,
      intakeTimestamp: new Date().toISOString(),
      intakeStaffId: actor.userId,
      intakeStaffName: actor.fullName,
      intakeSupervisorId: params.intakeSupervisorId || null,
      releaseStaffId: null,
      releaseStaffName: null,
      releasedAt: null,
      coAuthorizerId: null,
      coAuthorizerName: null,
      clientSignatureProof: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.custodyPackages.set(id, pkg);

    this.appendAuditLog({
      storeId: store.id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: params.intakeSupervisorId || null,
      coAuthMethod: params.intakeSupervisorId ? 'SUPERVISOR_COAUTH' : null,
      eventAction: 'CUSTODY_PACKAGE_INTAKE',
      targetEntityId: id,
      payloadBefore: {},
      payloadAfter: {
        folio,
        clientName,
        depositorName,
        recipientName,
        isForThirdParty,
        declaredValueCents: pkg.declaredValueCents,
        tamperSealNumber: pkg.tamperSealNumber,
        vaultLocation: pkg.vaultLocation,
        claimVerificationCode: sealResult.claimVerificationCode,
        photosCount: photos.length,
        isHighValue,
      },
      reasonJustification: isForThirdParty
        ? `Ingreso de cartas en resguardo modalidad ${params.purpose} (De: ${depositorName} -> Para: ${recipientName})`
        : `Ingreso de cartas en resguardo modalidad ${params.purpose} (Precinto #${pkg.tamperSealNumber})`,
    });

    return { custodyPackage: pkg, package: pkg, claimToken };
  }

  /**
   * Adjunta fotografías adicionales de evidencia forense a un paquete en custodia
   */
  public attachCustodyPhoto(params: {
    actorUserId: string;
    packageId: string;
    photoType: CustodyPhotoType;
    caption?: string;
    dataUri: string;
  }): CustodyPackageRecord {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!this.hasPermission(actor.role, 'custody:photo:upload')) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no tiene permiso custody:photo:upload.`);
    }

    const pkg = this.custodyPackages.get(params.packageId);
    if (!pkg) throw new Error('PAQUETE_RESGUARDO_NO_ENCONTRADO');
    if (pkg.status === 'RELEASED' || pkg.status === 'CANCELLED_ERROR') {
      throw new Error(`ESTADO_INVALIDO: No se pueden adjuntar fotos a un paquete con estado ${pkg.status}.`);
    }

    const sha256Hash = createHash('sha256').update(params.dataUri).digest('hex');
    const photo: CustodyPhotoEvidence = {
      id: `ph_${pkg.id}_${pkg.photos.length + 1}`,
      photoType: params.photoType,
      caption: params.caption?.trim() || undefined,
      dataUri: params.dataUri,
      sha256Hash,
      capturedAt: new Date().toISOString(),
    };

    pkg.photos.push(photo);
    const digestPayload = `${pkg.folio}|${pkg.tamperSealNumber}|${pkg.declaredValueCents}|${pkg.items.length}|${pkg.photos.map((p) => p.sha256Hash).join(',')}`;
    pkg.packageContentDigest = createHash('sha256').update(digestPayload).digest('hex');
    pkg.updatedAt = new Date().toISOString();

    this.appendAuditLog({
      storeId: pkg.storeId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'CUSTODY_PHOTOS_ATTACHED',
      targetEntityId: pkg.id,
      payloadBefore: { photosCount: pkg.photos.length - 1 },
      payloadAfter: { photosCount: pkg.photos.length, photoType: params.photoType, sha256Hash },
      reasonJustification: `Evidencia fotográfica ${params.photoType} agregada al resguardo ${pkg.folio}`,
    });

    return pkg;
  }

  /**
   * Actualiza la ubicación física en bóveda / gaveta o el estado de inspección
   */
  public updateCustodyLocation(params: {
    actorUserId: string;
    packageId: string;
    vaultLocation: string;
    newStatus?: 'IN_VAULT' | 'READY_FOR_PICKUP';
    reason?: string;
  }): CustodyPackageRecord {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!this.hasPermission(actor.role, 'custody:package:inspect')) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no tiene permiso custody:package:inspect.`);
    }

    const pkg = this.custodyPackages.get(params.packageId);
    if (!pkg) throw new Error('PAQUETE_RESGUARDO_NO_ENCONTRADO');
    if (pkg.status === 'RELEASED' || pkg.status === 'CANCELLED_ERROR') {
      throw new Error(`ESTADO_INVALIDO: No se puede mover un paquete en estado ${pkg.status}.`);
    }

    const beforeLocation = pkg.vaultLocation;
    const beforeStatus = pkg.status;

    pkg.vaultLocation = params.vaultLocation.trim();
    if (params.newStatus) {
      pkg.status = params.newStatus;
    }
    pkg.statusReason = params.reason || `Ubicado en ${pkg.vaultLocation}`;
    pkg.updatedAt = new Date().toISOString();

    this.appendAuditLog({
      storeId: pkg.storeId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'CUSTODY_LOCATION_MOVED',
      targetEntityId: pkg.id,
      payloadBefore: { vaultLocation: beforeLocation, status: beforeStatus },
      payloadAfter: { vaultLocation: pkg.vaultLocation, status: pkg.status },
      reasonJustification: params.reason || `Reubicación en bóveda a ${pkg.vaultLocation}`,
    });

    return pkg;
  }

  /**
   * Entrega / libera el paquete al cliente tras la presentación estricta del
   * Comprobante de Recepción (QR digital o Código Físico) y validación de seguridad.
   */
  public releaseCustodyPackage(params: {
    actorUserId: string;
    packageId: string;
    claimToken?: string;
    claimVerificationCode?: string;
    clientPinOrToken?: string;
    supervisorPin?: string;
    coAuthorizerId?: string;
    clientSignatureProof?: string;
    pickedUpByName?: string;
    pickedUpByRole?: 'DESTINATARIO_TITULAR' | 'REMITENTE_DEPOSITOR' | 'REPRESENTANTE_AUTORIZADO' | string;
  }): CustodyPackageRecord {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!this.hasPermission(actor.role, 'custody:package:release')) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no tiene permiso custody:package:release.`);
    }

    const pkg = this.custodyPackages.get(params.packageId);
    if (!pkg) throw new Error('PAQUETE_RESGUARDO_NO_ENCONTRADO');

    if (pkg.status === 'RELEASED') {
      throw new Error('PAQUETE_YA_ENTREGADO: Este paquete ya fue retirado previamente.');
    }
    if (pkg.status === 'CANCELLED_ERROR') {
      throw new Error('PAQUETE_ANULADO: Este paquete se encuentra marcado como anulado por error.');
    }

    // 1. Validación estricta del Comprobante de Recepción
    let voucherValid = false;
    if (params.claimToken) {
      const hash = createHash('sha256').update(params.claimToken.trim()).digest('hex');
      if (hash === pkg.claimTokenHash) {
        voucherValid = true;
      }
    } else if (params.claimVerificationCode) {
      const cleanInput = params.claimVerificationCode.toUpperCase().replace(/[\s-]/g, '');
      const cleanStored = pkg.claimVerificationCode.toUpperCase().replace(/[\s-]/g, '');
      if (cleanInput === cleanStored) {
        voucherValid = true;
      }
    }

    if (!voucherValid) {
      throw new Error(
        'COMPROBANTE_RESGUARDO_INVALIDO: Se debe presentar el Comprobante de Recepción legítimo (Físico o QR Digital) emitido durante el ingreso.'
      );
    }

    // 2. Control Four-Eyes obligatorio para paquetes de Alto Valor (> $10,000 MXN)
    let coAuthorizerUser: PlayerWalletState | null = null;
    if (pkg.isHighValue) {
      if (!params.coAuthorizerId || !params.supervisorPin) {
        throw new Error(
          'FOUR_EYES_REQUERIDO_ALTO_VALOR: Este paquete excede el umbral de alto valor ($10,000 MXN) y requiere la co-firma obligatoria de un Gerente (STORE_ADMIN o SUPER_ADMIN).'
        );
      }
      coAuthorizerUser = this.verifySupervisorPin(
        actor.userId,
        params.coAuthorizerId,
        params.supervisorPin
      );
    }

    // 3. Validación opcional de credencial/PIN del cliente si está registrado (destinatario o remitente)
    const recipientUser = pkg.recipientUserId ? this.walletsByUser.get(pkg.recipientUserId) : null;
    const depositorUser = pkg.depositorUserId ? this.walletsByUser.get(pkg.depositorUserId) : null;
    const clientUser = recipientUser || depositorUser || this.walletsByUser.get(pkg.clientUserId);
    if (clientUser && params.clientPinOrToken) {
      const pinMatches = (recipientUser?.securityPinHash && verifyCredentialHash(params.clientPinOrToken, recipientUser.securityPinHash)) ||
                         (depositorUser?.securityPinHash && verifyCredentialHash(params.clientPinOrToken, depositorUser.securityPinHash)) ||
                         (clientUser?.securityPinHash && verifyCredentialHash(params.clientPinOrToken, clientUser.securityPinHash));
      const isTotp = (recipientUser?.authenticatorSecret && verifyStandardTotpCode(params.clientPinOrToken, recipientUser.authenticatorSecret)) ||
                     (depositorUser?.authenticatorSecret && verifyStandardTotpCode(params.clientPinOrToken, depositorUser.authenticatorSecret)) ||
                     (clientUser?.authenticatorSecret && verifyStandardTotpCode(params.clientPinOrToken, clientUser.authenticatorSecret));
      if (!pinMatches && !isTotp) {
        throw new Error('PIN_CLIENTE_INCORRECTO: El código de autorización 2FA del cliente es inválido.');
      }
    }

    const pickedUpByName = params.pickedUpByName?.trim() || pkg.recipientName || pkg.clientName;
    const pickedUpByRole = params.pickedUpByRole?.trim() || (
      pickedUpByName.toLowerCase() === pkg.recipientName.toLowerCase()
        ? 'DESTINATARIO_TITULAR'
        : (pkg.depositorName && pickedUpByName.toLowerCase() === pkg.depositorName.toLowerCase() ? 'REMITENTE_DEPOSITOR' : 'REPRESENTANTE_AUTORIZADO')
    );

    pkg.status = 'RELEASED';
    pkg.statusReason = `Entregado a ${pickedUpByName} (${pickedUpByRole}) tras presentar comprobante verificado`;
    pkg.releasedAt = new Date().toISOString();
    pkg.releaseStaffId = actor.userId;
    pkg.releaseStaffName = actor.fullName;
    pkg.coAuthorizerId = coAuthorizerUser?.userId || null;
    pkg.coAuthorizerName = coAuthorizerUser?.fullName || null;
    pkg.pickedUpByName = pickedUpByName;
    pkg.pickedUpByRole = pickedUpByRole;
    pkg.clientSignatureProof = params.clientSignatureProof?.trim() || `FIRMA_CONFORMIDAD_${pickedUpByName.toUpperCase().replace(/\s+/g, '_')}`;
    pkg.updatedAt = new Date().toISOString();

    this.appendAuditLog({
      storeId: pkg.storeId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: coAuthorizerUser?.userId || null,
      coAuthMethod: coAuthorizerUser ? 'FOUR_EYES_SUPERVISOR_PIN' : null,
      eventAction: 'CUSTODY_PACKAGE_RELEASED',
      targetEntityId: pkg.id,
      payloadBefore: { status: 'RECEIVED', releasedAt: null },
      payloadAfter: {
        status: 'RELEASED',
        releasedAt: pkg.releasedAt,
        releaseStaffName: actor.fullName,
        coAuthorizerName: coAuthorizerUser?.fullName || null,
        pickedUpByName,
        pickedUpByRole,
        clientSignatureProof: pkg.clientSignatureProof,
      },
      reasonJustification: `Entrega definitiva de cartas en resguardo ${pkg.folio} a ${pickedUpByName} (${pickedUpByRole}) [Destinatario titular: ${pkg.recipientName}]`,
    });

    return pkg;
  }

  /**
   * Cancela o anula un registro de custodia (solo permitido a SUPER_ADMIN o STORE_ADMIN)
   */
  public cancelCustodyPackage(params: {
    actorUserId: string;
    packageId: string;
    reasonJustification: string;
  }): CustodyPackageRecord {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!this.hasPermission(actor.role, 'custody:package:cancel')) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no tiene permiso para anular paquetes en resguardo.`);
    }

    const pkg = this.custodyPackages.get(params.packageId);
    if (!pkg) throw new Error('PAQUETE_RESGUARDO_NO_ENCONTRADO');
    if (pkg.status === 'RELEASED') {
      throw new Error('NO_SE_PUEDE_CANCELAR: El paquete ya fue retirado por el cliente.');
    }

    const beforeStatus = pkg.status;
    pkg.status = 'CANCELLED_ERROR';
    pkg.statusReason = params.reasonJustification.trim();
    pkg.updatedAt = new Date().toISOString();

    this.appendAuditLog({
      storeId: pkg.storeId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'CUSTODY_PACKAGE_CANCELLED',
      targetEntityId: pkg.id,
      payloadBefore: { status: beforeStatus },
      payloadAfter: { status: 'CANCELLED_ERROR', reasonJustification: params.reasonJustification },
      reasonJustification: params.reasonJustification,
    });

    return pkg;
  }

  /**
   * Consulta listado de paquetes en resguardo según sucursal, estado y rol
   */
  public listCustodyPackages(params: {
    actorUserId: string;
    storeId?: string;
    status?: CustodyStatus;
    search?: string;
  }): CustodyPackageRecord[] {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!this.hasPermission(actor.role, 'custody:package:view')) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no tiene permiso custody:package:view.`);
    }

    let list = Array.from(this.custodyPackages.values());

    // Row-Level Security: Jugadores solo ven sus propios paquetes (como destinatario o como remitente)
    if (actor.role === 'PLAYER') {
      list = list.filter((p) =>
        p.clientUserId === actor.userId ||
        p.depositorUserId === actor.userId ||
        p.recipientUserId === actor.userId
      );
    } else if (params.storeId) {
      list = list.filter((p) => p.storeId === params.storeId);
    }

    if (params.status) {
      list = list.filter((p) => p.status === params.status);
    }

    if (params.search) {
      const q = params.search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.folio.toLowerCase().includes(q) ||
          p.tamperSealNumber.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q) ||
          (p.depositorName && p.depositorName.toLowerCase().includes(q)) ||
          (p.recipientName && p.recipientName.toLowerCase().includes(q)) ||
          (p.pickedUpByName && p.pickedUpByName.toLowerCase().includes(q)) ||
          p.clientMemberCode.toLowerCase().includes(q) ||
          (p.depositorMemberCode && p.depositorMemberCode.toLowerCase().includes(q)) ||
          (p.recipientMemberCode && p.recipientMemberCode.toLowerCase().includes(q)) ||
          p.vaultLocation.toLowerCase().includes(q) ||
          p.claimVerificationCode.toLowerCase().includes(q)
      );
    }

    // Ordenar descendente por fecha de ingreso
    list.sort((a, b) => new Date(b.intakeTimestamp).getTime() - new Date(a.intakeTimestamp).getTime());
    return list;
  }

  /**
   * Obtiene un paquete de custodia por ID
   */
  public getCustodyPackage(packageId: string, actorUserId: string): CustodyPackageRecord {
    const actor = this.walletsByUser.get(actorUserId);
    if (!actor) throw new Error('ACTOR_NO_ENCONTRADO');
    if (!this.hasPermission(actor.role, 'custody:package:view')) {
      throw new Error(`PERMISO_DENEGADO_RBAC: El rol ${actor.role} no tiene permiso custody:package:view.`);
    }

    const pkg = this.custodyPackages.get(packageId);
    if (!pkg) throw new Error('PAQUETE_RESGUARDO_NO_ENCONTRADO');

    if (
      actor.role === 'PLAYER' &&
      pkg.clientUserId !== actor.userId &&
      pkg.depositorUserId !== actor.userId &&
      pkg.recipientUserId !== actor.userId
    ) {
      throw new Error('ACCESO_DENEGADO: No tienes autorización para consultar el resguardo de otro cliente.');
    }

    return pkg;
  }

  /**
   * Consulta el catálogo de propósitos / modalidades de resguardo
   */
  public getCustodyPurposes(): (CustodyPurposeItem & { id: string; label: string; active: boolean })[] {
    return this.custodyPurposes.map((p) => ({
      ...p,
      id: p.code,
      label: p.name,
      active: p.isEnabled,
    }));
  }

  /**
   * Actualiza el catálogo de propósitos / modalidades de resguardo
   */
  public updateCustodyPurposes(params: {
    actorUserId: string;
    purposes: any[];
  }): (CustodyPurposeItem & { id: string; label: string; active: boolean })[] {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) {
      throw new Error(`ACTOR_NO_ENCONTRADO: El usuario actor ${params.actorUserId} no existe.`);
    }
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'STORE_ADMIN') {
      throw new Error('PERMISO_DENEGADO_RBAC: Solo administradores pueden personalizar las modalidades de resguardo.');
    }

    const beforePurposes = [...this.custodyPurposes];
    const sanitized: CustodyPurposeItem[] = (params.purposes || [])
      .map((p: any) => ({
        code: String(p.code || p.id || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        name: String(p.name || p.label || '').trim(),
        description: String(p.description || '').trim(),
        defaultLocation: p.defaultLocation ? String(p.defaultLocation).trim() : undefined,
        isEnabled: p.isEnabled !== undefined ? p.isEnabled !== false : p.active !== false,
      }))
      .filter((p) => p.code && p.name);

    if (sanitized.length === 0) {
      throw new Error('CATALOGO_INVALIDO: Debe existir al menos una modalidad de resguardo activa.');
    }

    this.custodyPurposes = sanitized;

    const defaultStore = Array.from(this.stores.values())[0];
    this.appendAuditLog({
      storeId: defaultStore ? defaultStore.id : 'ORG',
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'CUSTODY_PURPOSES_CATALOG_UPDATED',
      targetEntityId: 'CUSTODY_PURPOSES',
      payloadBefore: { purposes: beforePurposes },
      payloadAfter: { purposes: this.custodyPurposes },
      reasonJustification: `Actualización de catálogo de modalidades de resguardo (${sanitized.length} modalidades)`,
    });

    return this.getCustodyPurposes();
  }

  /**
   * Consulta el catálogo de tipos de evidencia fotográfica
   */
  public getCustodyEvidenceTypes(): (CustodyEvidenceTypeItem & { id: string; label: string; active: boolean })[] {
    return this.custodyEvidenceTypes.map((t) => ({
      ...t,
      id: t.code,
      label: t.name,
      active: t.isEnabled,
    }));
  }

  /**
   * Actualiza el catálogo de tipos de evidencia fotográfica
   */
  public updateCustodyEvidenceTypes(params: {
    actorUserId: string;
    evidenceTypes: any[];
  }): (CustodyEvidenceTypeItem & { id: string; label: string; active: boolean })[] {
    const actor = this.walletsByUser.get(params.actorUserId);
    if (!actor) {
      throw new Error(`ACTOR_NO_ENCONTRADO: El usuario actor ${params.actorUserId} no existe.`);
    }
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'STORE_ADMIN') {
      throw new Error('PERMISO_DENEGADO_RBAC: Solo administradores pueden personalizar los tipos de evidencia.');
    }

    const beforeTypes = [...this.custodyEvidenceTypes];
    const sanitized: CustodyEvidenceTypeItem[] = (params.evidenceTypes || [])
      .map((t: any) => ({
        code: String(t.code || t.id || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        name: String(t.name || t.label || '').trim(),
        description: String(t.description || '').trim(),
        isEnabled: t.isEnabled !== undefined ? t.isEnabled !== false : t.active !== false,
      }))
      .filter((t) => t.code && t.name);

    if (sanitized.length === 0) {
      throw new Error('CATALOGO_INVALIDO: Debe existir al menos un tipo de evidencia fotográfica.');
    }

    this.custodyEvidenceTypes = sanitized;

    const defaultStore = Array.from(this.stores.values())[0];
    this.appendAuditLog({
      storeId: defaultStore ? defaultStore.id : 'ORG',
      actorUserId: actor.userId,
      actorRole: actor.role,
      coAuthorizerId: null,
      coAuthMethod: null,
      eventAction: 'CUSTODY_EVIDENCE_TYPES_CATALOG_UPDATED',
      targetEntityId: 'CUSTODY_EVIDENCE_TYPES',
      payloadBefore: { evidenceTypes: beforeTypes },
      payloadAfter: { evidenceTypes: this.custodyEvidenceTypes },
      reasonJustification: `Actualización de catálogo de tipos de evidencia (${sanitized.length} tipos)`,
    });

    return this.getCustodyEvidenceTypes();
  }

  private commitBalancedJournalEntry(params: {
    id: string;
    initiatingStoreId: string;
    idempotencyKey: string;
    operationType: string;
    referenceId: string;
    description: string;
    createdByUserId: string;
    coAuthorizedByUserId: string | null;
    lines: LedgerLineRecord[];
  }): JournalEntryRecord {
    if (this.idempotencyKeys.has(params.idempotencyKey)) {
      throw new Error(`OPERACION_DUPLICADA_IDEMPOTENCIA: ${params.idempotencyKey}`);
    }
    const totalDebit = params.lines.reduce((s, l) => s + l.debitCents, 0);
    const totalCredit = params.lines.reduce((s, l) => s + l.creditCents, 0);
    if (params.lines.length < 2 || totalDebit !== totalCredit) {
      throw new Error(
        `VIOLACION_PARTIDA_DOBLE: Debe (${totalDebit}) !== Haber (${totalCredit})`
      );
    }
    this.idempotencyKeys.add(params.idempotencyKey);

    const creator = this.walletsByUser.get(params.createdByUserId);
    const coAuth = params.coAuthorizedByUserId
      ? this.walletsByUser.get(params.coAuthorizedByUserId)
      : null;
    const store = this.stores.get(params.initiatingStoreId);
    const nowIso = new Date().toISOString();

    const record: JournalEntryRecord = {
      id: params.id,
      organizationId: this.org.id,
      initiatingStoreId: params.initiatingStoreId,
      initiatingStoreCode: store?.code ?? params.initiatingStoreId,
      idempotencyKey: params.idempotencyKey,
      operationType: params.operationType,
      referenceId: params.referenceId,
      description: params.description,
      createdByUserId: params.createdByUserId,
      createdByMemberCode: creator?.memberCode ?? params.createdByUserId,
      createdByFullName: creator?.fullName ?? params.createdByUserId,
      createdByRole: creator?.role,
      coAuthorizedByUserId: params.coAuthorizedByUserId,
      coAuthorizedByMemberCode: coAuth?.memberCode ?? params.coAuthorizedByUserId,
      coAuthorizedByName: coAuth?.fullName ?? params.coAuthorizedByUserId,
      postedAt: nowIso,
      createdAt: nowIso,
      lines: params.lines,
    };
    this.journalEntries.push(record);
    return record;
  }

  public appendAuditLog(params: {
    storeId: string;
    actorUserId: string;
    actorRole: UserRoleType;
    coAuthorizerId: string | null;
    coAuthMethod: string | null;
    eventAction: string;
    targetEntityId: string;
    targetUserId?: string;
    targetMemberCode?: string;
    targetFullName?: string;
    payloadBefore: Record<string, unknown> | null;
    payloadAfter: Record<string, unknown>;
    reasonJustification: string;
  }): AuditLogRecord {
    const seqId = this.auditLogs.length + 1;
    const createdAt = new Date().toISOString();
    const prevHash =
      this.auditLogs.length > 0
        ? this.auditLogs[this.auditLogs.length - 1].rowHash
        : GENESIS_AUDIT_HASH;

    // Clonación profunda inmutable para evitar que mutaciones en memoria de objetos referenciados
    // (ej. store, wallet, package) rompan la verificación posterior del hash chain
    const beforeClone = JSON.parse(JSON.stringify(params.payloadBefore ?? {}));
    const afterClone = JSON.parse(JSON.stringify(params.payloadAfter ?? {}));
    const payloadBeforeJson = JSON.stringify(beforeClone);
    const payloadAfterJson = JSON.stringify(afterClone);

    const { rowHash, serverHmac } = computeAuditHashChainLink(
      {
        seqId,
        timestampIso: createdAt,
        orgId: this.org.id,
        storeId: params.storeId,
        actorUserId: params.actorUserId,
        coAuthorizerId: params.coAuthorizerId,
        eventAction: params.eventAction,
        payloadBeforeJson,
        payloadAfterJson,
        prevHash,
      },
      this.hsmSecret
    );

    const actor = this.walletsByUser.get(params.actorUserId);
    const coAuth = params.coAuthorizerId ? this.walletsByUser.get(params.coAuthorizerId) : null;
    const store = this.stores.get(params.storeId);
    const targetUser = Array.from(this.walletsByUser.values()).find(
      (u) => u.walletId === params.targetEntityId || u.userId === params.targetEntityId
    );

    const record: AuditLogRecord = {
      seqId,
      seqNo: seqId,
      eventId: `evt_${randomUUID().slice(0, 10)}`,
      createdAt,
      orgId: this.org.id,
      storeId: params.storeId,
      storeCode: store?.code ?? params.storeId,
      actorUserId: params.actorUserId,
      actorMemberCode: actor?.memberCode ?? params.actorUserId,
      actorFullName: actor?.fullName ?? params.actorUserId,
      actorAlias: actor?.alias ?? '',
      actorRole: params.actorRole,
      coAuthorizerId: params.coAuthorizerId,
      coAuthorizerMemberCode: coAuth?.memberCode ?? null,
      coAuthorizerName: coAuth?.fullName ?? null,
      coAuthMethod: params.coAuthMethod,
      eventAction: params.eventAction,
      targetEntityId: params.targetEntityId,
      targetMemberCode: params.targetMemberCode ?? targetUser?.memberCode ?? null,
      targetFullName: params.targetFullName ?? targetUser?.fullName ?? null,
      payloadBefore: beforeClone,
      payloadAfter: afterClone,
      reasonJustification: params.reasonJustification,
      prevHash,
      rowHash,
      serverHmac,
    };

    this.auditLogs.push(record);
    return record;
  }

  /**
   * Reinicia el motor a un estado 100% limpio con un único usuario propietario (SUPER_ADMIN)
   */
  public resetToCleanSingleUser(ownerParams?: {
    userId?: string;
    memberCode?: string;
    fullName?: string;
    alias?: string;
    email?: string;
    phone?: string;
    password?: string;
    securityPin?: string;
  }): PlayerWalletState {
    this.walletsByUser.clear();
    this.tournaments.clear();
    this.journalEntries = [];
    this.idempotencyKeys.clear();
    this.vouchers.clear();
    this.redemptionsByVoucher.clear();
    this.preorderHolds.clear();
    this.shiftClosures = [];
    this.auditLogs = [];
    this.usedQrNonces.clear();
    this.activeSessions.clear();
    this.voucherSequence = 0;
    this.tournamentSequence = 0;

    if (this.stores.size === 0) {
      this.registerStore({
        id: 'store_centro',
        organizationId: this.org.id,
        code: 'SUC-CENTRO',
        name: 'Sucursal Centro (Matriz)',
        legalEntityTaxId: 'RTT260101AAA',
        address: 'Av. Central #104, Local B',
        voucherPrefix: 'VCH-CEN',
        isActive: true,
      });
      this.registerStore({
        id: 'store_norte',
        organizationId: this.org.id,
        code: 'SUC-NORTE',
        name: 'Sucursal Plaza Norte',
        legalEntityTaxId: 'RTT260101AAA',
        address: 'Blvd. Norte #890, Nivel 2',
        voucherPrefix: 'VCH-NOR',
        isActive: true,
      });
    }

    return this.registerUser({
      userId: ownerParams?.userId ?? 'u_owner_1',
      memberCode: ownerParams?.memberCode ?? 'CC-0001',
      fullName: ownerParams?.fullName ?? 'Chamakov (Super Admin)',
      alias: ownerParams?.alias ?? '@chamakov',
      email: ownerParams?.email ?? 'admin@kronavault.mx',
      phone: ownerParams?.phone ?? '+52 55 1000 0001',
      role: 'SUPER_ADMIN',
      assignedStoreId: null,
      password: ownerParams?.password ?? 'krona2026',
      securityPin: ownerParams?.securityPin ?? '123456',
    });
  }

  /**
   * Serializa el estado completo del motor para persistencia en Cloudflare D1 o archivo local JSON/SQLite
   */
  public exportSnapshot(): EngineStateSnapshot {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      org: this.org,
      stores: Array.from(this.stores.values()),
      wallets: Array.from(this.walletsByUser.values()),
      tournaments: Array.from(this.tournaments.values()),
      journalEntries: this.journalEntries,
      idempotencyKeys: Array.from(this.idempotencyKeys.values()),
      vouchers: Array.from(this.vouchers.values()),
      redemptions: Array.from(this.redemptionsByVoucher.values()),
      preorderHolds: Array.from(this.preorderHolds.values()),
      shiftClosures: this.shiftClosures,
      auditLogs: this.auditLogs,
      usedQrNonces: Array.from(this.usedQrNonces.keys()),
      activeSessions: Array.from(this.activeSessions.values()),
      custodyPackages: Array.from(this.custodyPackages.values()),
      custodyPurposes: this.custodyPurposes,
      custodyEvidenceTypes: this.custodyEvidenceTypes,
      voucherSequence: this.voucherSequence,
      tournamentSequence: this.tournamentSequence,
      custodySequence: this.custodySequence,
    };
  }

  /**
   * Hidrata el motor desde un snapshot persistido en Cloudflare D1 o disco local
   */
  public importSnapshot(snapshot: EngineStateSnapshot): void {
    if (snapshot.org) {
      this.org = {
        ...snapshot.org,
        requireFourEyesThresholdCents: snapshot.org.requireFourEyesThresholdCents ?? 100_000,
        minSingleIssuanceCents: snapshot.org.minSingleIssuanceCents ?? 100,
        maxSingleIssuanceCents: snapshot.org.maxSingleIssuanceCents ?? 5_000_000,
      };
    }
    if (Array.isArray(snapshot.stores)) {
      this.stores = new Map(snapshot.stores.map((s) => [s.id, s]));
    }
    if (Array.isArray(snapshot.wallets)) {
      this.walletsByUser = new Map(snapshot.wallets.map((w) => [w.userId, w]));
    }
    if (Array.isArray(snapshot.tournaments)) {
      this.tournaments = new Map(snapshot.tournaments.map((t) => [t.id, t]));
    }
    if (Array.isArray(snapshot.journalEntries)) {
      this.journalEntries = snapshot.journalEntries;
    }
    if (Array.isArray(snapshot.idempotencyKeys)) {
      this.idempotencyKeys = new Set(snapshot.idempotencyKeys);
    }
    if (Array.isArray(snapshot.vouchers)) {
      this.vouchers = new Map(snapshot.vouchers.map((v) => [v.voucherFolio, v]));
    }
    if (Array.isArray(snapshot.redemptions)) {
      this.redemptionsByVoucher = new Map(snapshot.redemptions.map((r) => [r.voucherFolio, r]));
    }
    if (Array.isArray(snapshot.preorderHolds)) {
      this.preorderHolds = new Map(snapshot.preorderHolds.map((h) => [h.preorderRef, h]));
    }
    if (Array.isArray(snapshot.shiftClosures)) {
      this.shiftClosures = snapshot.shiftClosures;
    }
    if (Array.isArray(snapshot.auditLogs)) {
      this.auditLogs = snapshot.auditLogs;
    }
    if (Array.isArray(snapshot.usedQrNonces)) {
      this.usedQrNonces = new Map(snapshot.usedQrNonces.map((n: string) => [n, Date.now()]));
    }
    if (Array.isArray(snapshot.activeSessions)) {
      this.activeSessions = new Map(snapshot.activeSessions.map((s) => [s.sid, s]));
    }
    if (Array.isArray(snapshot.custodyPackages)) {
      this.custodyPackages = new Map(snapshot.custodyPackages.map((c) => [c.id, c]));
    }
    if (Array.isArray(snapshot.custodyPurposes) && snapshot.custodyPurposes.length > 0) {
      this.custodyPurposes = snapshot.custodyPurposes;
    }
    if (Array.isArray(snapshot.custodyEvidenceTypes) && snapshot.custodyEvidenceTypes.length > 0) {
      this.custodyEvidenceTypes = snapshot.custodyEvidenceTypes;
    }
    if (typeof snapshot.voucherSequence === 'number') {
      this.voucherSequence = snapshot.voucherSequence;
    }
    if (typeof snapshot.tournamentSequence === 'number') {
      this.tournamentSequence = snapshot.tournamentSequence;
    }
    if (typeof snapshot.custodySequence === 'number') {
      this.custodySequence = snapshot.custodySequence;
    }
  }
}

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
  custodyPurposes?: CustodyPurposeItem[];
  custodyEvidenceTypes?: CustodyEvidenceTypeItem[];
  voucherSequence: number;
  tournamentSequence: number;
  custodySequence?: number;
}

function logPayloadOrEmpty(p: Record<string, unknown>): Record<string, unknown> {
  return p ?? {};
}


