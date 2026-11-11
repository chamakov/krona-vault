export type SharingPolicyType =
  | 'ORG_POOLED_SAME_ENTITY'
  | 'INTER_STORE_CLEARING'
  | 'STORE_ISOLATED';

export type P2PTransferPolicyType =
  | 'DISABLED'
  | 'FAMILY_WHITELIST_ONLY'
  | 'ENABLED_WITH_LIMITS';

export type UserRoleType =
  | 'SUPER_ADMIN'
  | 'STORE_ADMIN'
  | 'TOURNAMENT_ORGANIZER'
  | 'CASHIER'
  | 'AUDITOR'
  | 'PLAYER';

export interface StoreCreditSource {
  code: string;
  name: string;
  description?: string;
  defaultAccountCode?: string;
  defaultExpiryDays?: number;
  isEnabled: boolean;
}

export type CreditSourceType =
  | 'TOURNAMENT_PRIZE'
  | 'TOURNAMENT_PARTICIPATION'
  | 'RAFFLE_DOOR_PRIZE'
  | 'JUDGE_STAFF_BOUNTY'
  | 'SINGLES_TRADE_IN'
  | 'PROMOTIONAL_BONUS'
  | 'REFUND_RESTORE'
  | 'P2P_TRANSFER_IN'
  | 'MANUAL_ADJUSTMENT'
  | (string & {});

export interface StoreProductCategory {
  code: string;
  name: string;
  description?: string;
  isEnabled: boolean;
}

export type ProductCategoryType =
  | 'SEALED_PRODUCT'
  | 'SINGLES'
  | 'ACCESSORIES'
  | 'TOURNAMENT_ENTRY'
  | 'PREORDER_DEPOSIT'
  | 'SNACKS_DRINKS'
  | (string & {});

export interface OrganizationSettings {
  id: string;
  name: string;
  taxId: string;
  currencyCode: 'MXN' | 'USD' | 'EUR';
  /** Default: ORG_POOLED_SAME_ENTITY (misma entidad con centro de costos por sucursal; escalable a INTER_STORE_CLEARING) */
  sharingPolicy: SharingPolicyType;
  /** Default: DISABLED (bloqueado por defecto; activable por feature flag) */
  p2pPolicy: P2PTransferPolicyType;
  p2pFeeBps: number;
  p2pMonthlyLimitCents: number;
  requireFourEyesThresholdCents: number;
  minSingleIssuanceCents?: number;
  maxSingleIssuanceCents?: number;
  requirePosVoucherPrint: boolean;
}

export interface StoreBranch {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  legalEntityTaxId: string;
  address: string;
  voucherPrefix: string;
  isActive: boolean;
  productCategories?: StoreProductCategory[];
  creditSources?: StoreCreditSource[];
}

export interface CreditLot {
  id: string;
  walletId: string;
  issuingStoreId: string;
  issuingStoreCode: string;
  sourceType: CreditSourceType;
  sourceLabel: string;
  initialAmountCents: number;
  remainingAmountCents: number;
  lockedPreorderCents: number;
  priorityRank: number;
  allowedCategories: ProductCategoryType[] | null;
  expiresAt: string | null;
  expirationPausedAt: string | null;
  isRetransferable: boolean;
  status: 'PENDING_COOLDOWN' | 'ACTIVE' | 'ESCROW_PREORDER' | 'DEPLETED' | 'EXPIRED' | 'VOIDED';
  createdAt: string;
}

export interface PhysicalVoucher {
  id: string;
  voucherFolio: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  journalEntryId: string;
  voucherType: 'REDEMPTION' | 'TOURNAMENT_PRIZE' | 'REFUND' | 'PREORDER_HOLD';
  externalPosTicketRef: string;
  playerUserId: string;
  playerMemberCode: string;
  playerName: string;
  playerAlias: string;
  cashierUserId: string;
  cashierName: string;
  totalPurchaseReportedCents: number;
  creditAppliedCents: number;
  remainingCashOrCardCents: number;
  walletBalanceBeforeCents: number;
  walletBalanceAfterCents: number;
  conceptNotes: string;
  authMethodUsed: 'QR_DYNAMIC_TOTP' | 'PUSH_2FA' | 'PIN_OFFLINE_2FA' | 'FOUR_EYES_SUPERVISOR';
  cryptographicSeal: string;
  printCount: number;
  createdAt: string;
}

export interface TournamentPrizeStanding {
  position: number;
  playerUserId: string;
  playerMemberCode: string;
  playerName: string;
  record: string;
  inTopSplit: boolean;
  percentageBps: number;
  awardedCents: number;
}

export type PokemonCategoryName = 'Master' | 'Senior' | 'Junior' | 'General' | string;

export interface TournamentCategoryRecord {
  id: string;
  name: PokemonCategoryName;
  entryFeeCents: number;
  prizeContributionCents: number;
  maxParticipants?: number;
  registeredCount: number; // Occupancy
  guaranteedPoolCents: number;
  calculatedPoolCents: number;
  customPoolCents?: number;
  customPoolPercentage?: number;
  payoutScheme?: 'STANDARD' | 'EQUAL_SPLIT' | 'CUSTOM';
  customPercentagesBps?: number[];
  topCutSize: number; // 1 | 2 | 4 | 8 | 16 o personalizado
  standings?: TournamentPrizeStanding[];
}

export interface ParsedPokeEntry {
  rank: number;
  playerName: string;
  playerIdentifier?: string; // POP ID / Registration ID
  matchPoints: number;
  opponentWinPercentage: number;
  record?: string;
  wins?: number;
  losses?: number;
  ties?: number;
}

export interface ParsedPokeCategory {
  category: string;
  entries: ParsedPokeEntry[];
  occupancy: number;
  calculatedPoolCents: number;
  customPoolCents?: number;
  customPoolPercentage?: number;
  payoutScheme?: 'STANDARD' | 'EQUAL_SPLIT' | 'CUSTOM';
  customPercentagesBps?: number[];
  suggestedTopCutSize?: number;
}

export interface ParsedPokeStandings {
  tournamentName: string;
  totalRounds?: number | null;
  categories: ParsedPokeCategory[];
  totalOccupancy: number;
  unifiedPoolCents: number;
}

export interface CustodyPurposeItem {
  code: string;
  name: string;
  description: string;
  defaultLocation?: string;
  isEnabled: boolean;
}

export interface CustodyEvidenceTypeItem {
  code: string;
  name: string;
  description: string;
  isEnabled: boolean;
}

export type CustodyPurpose =
  | 'GRADING_SUBMISSION'
  | 'CONSIGNMENT_ESCROW'
  | 'DETAILED_APPRAISAL_PENDING'
  | 'TOURNAMENT_DECK_QUARANTINE'
  | 'SAFE_KEEPING_VAULT'
  | string;

export type CustodyStatus =
  | 'RECEIVED'
  | 'IN_VAULT'
  | 'READY_FOR_PICKUP'
  | 'RELEASED'
  | 'CANCELLED_ERROR';

export type CustodyPhotoType =
  | 'SEAL_VIEW'
  | 'FRONT_VIEW'
  | 'BACK_VIEW'
  | 'CONTENT_VIEW'
  | string;

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
  game: string;
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
  // Quién Recibe (Destinatario Autorizado / Recipient)
  recipientUserId?: string | null;
  recipientMemberCode?: string | null;
  recipientName: string;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  // Indicador si es a nombre de otra persona (P2P / Escrow)
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

