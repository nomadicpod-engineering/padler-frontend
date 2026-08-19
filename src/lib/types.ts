export type Role = 'BACK_OFFICE_SUPER_ADMIN' | 'ADMIN' | 'SENIOR' | 'JUNIOR';

/** Booking mutations (cancel/complete/refund/create/reassign). Matches backend CAP_BOOKING_MUTATE. */
export function canMutateBookings(role: Role | string | undefined | null): boolean {
  return role === 'BACK_OFFICE_SUPER_ADMIN' || role === 'ADMIN' || role === 'SENIOR';
}

export function canViewAllCompanies(role: Role | string | undefined | null): boolean {
  return role === 'BACK_OFFICE_SUPER_ADMIN';
}

/** CAP_COMMAND_APPROVE — Approvals nav + approve/reject actions. */
export function canViewApprovals(role: Role | string | undefined | null): boolean {
  return role === 'BACK_OFFICE_SUPER_ADMIN' || role === 'ADMIN';
}

/** CAP_COMMAND_REQUEST — SENIOR+ can request (and list) approvals. */
export function canRequestCommands(role: Role | string | undefined | null): boolean {
  return role === 'BACK_OFFICE_SUPER_ADMIN' || role === 'ADMIN' || role === 'SENIOR';
}

/** CAP_CASE_MANAGE — create/update cases, interactions, escalate. */
export function canManageCases(role: Role | string | undefined | null): boolean {
  return role === 'BACK_OFFICE_SUPER_ADMIN' || role === 'ADMIN' || role === 'SENIOR';
}

/** CAP_COMMAND_RECONCILE — resolve UNKNOWN executions. */
export function canReconcileCommands(role: Role | string | undefined | null): boolean {
  return role === 'BACK_OFFICE_SUPER_ADMIN' || role === 'ADMIN';
}

/** CAP_TEAM_INVITE — Add Padler invite (BACK_OFFICE_SUPER_ADMIN or ADMIN). */
export function canInviteTeam(role: Role | string | undefined | null): boolean {
  return role === 'BACK_OFFICE_SUPER_ADMIN' || role === 'ADMIN';
}

/** CAP_ADMIN_ALL — Wallet config hub (BACK_OFFICE_SUPER_ADMIN only). */
export function canAccessWalletConfig(role: Role | string | undefined | null): boolean {
  return role === 'BACK_OFFICE_SUPER_ADMIN';
}

export type IncidentStatus = 'OPEN' | 'MITIGATING' | 'RESOLVED' | 'CLOSED' | string;
export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;

export interface IncidentSummary {
  id?: number;
  incidentNumber: string;
  title?: string;
  summary?: string;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  productKey?: string;
  dependencyKey?: string;
  customerImpact?: string;
  correlationKey?: string;
  affectedPartyCount?: number;
  startedAt?: string;
  resolvedAt?: string;
  createdByPadlerId?: string;
  createdAt?: string;
  linkedCaseNumbers?: string[];
}

export interface ConsumerLag {
  consumerName?: string;
  lastSequenceNo?: number;
  lastEnvelopeId?: string;
  lastProcessedAt?: string;
  lagSeconds?: number;
}

export type DeadLetterStatus = 'OPEN' | 'REPLAYED' | 'DISCARDED' | string;

export interface DeadLetter {
  id: number;
  envelopeId?: string;
  outboxId?: number;
  errorCode?: string;
  errorDetail?: string;
  attempts?: number;
  firstFailedAt?: string;
  lastFailedAt?: string;
  replayedAt?: string;
  status?: DeadLetterStatus;
}

export interface AuditEventDetail {
  envelopeId?: string;
  envelopeVersion?: string;
  eventType?: string;
  category?: string;
  sourceSystem?: string;
  sourceEventId?: string;
  idempotencyKey?: string;
  partyType?: string;
  partyKey?: string;
  customerUserId?: string;
  caseNumber?: string;
  incidentNumber?: string;
  productKey?: string;
  bookingRef?: string;
  paymentRef?: string;
  dispatchId?: string;
  requestId?: string;
  traceparent?: string;
  occurredAt?: string;
  ingestedAt?: string;
  sourceFreshnessAt?: string;
  summary?: string;
  payloadJson?: string;
  actorType?: string;
  actorId?: string;
  prevHash?: string;
  eventHash?: string;
  sequenceNo?: number;
}

export interface InviteResult {
  status?: string;
  detail?: string;
  invitationToken?: string;
  expiresAt?: string;
  resent?: boolean;
  designation?: string;
}

export interface AcceptInviteResult {
  status?: string;
  detail?: string;
  userId?: string;
  designation?: string;
}

export interface LoginTrayItem {
  occurredAt?: string;
  eventType?: string;
  status?: string;
  email?: string;
  partyType?: string;
  partyKey?: string;
  productKey?: string;
  sourceSystem?: string;
  summary?: string;
  envelopeId?: string;
  padlerId?: string;
  designation?: string;
  /** Application user role for customers. */
  role?: string;
  customerUserId?: string;
  reachOutHint?: string;
}

export interface LoginTraySettings {
  ttlDays: number;
}

export interface OnboardingStep {
  key?: string;
  label?: string;
  status?: string;
}

export interface OnboardingDocument {
  type?: string;
  label?: string;
  url?: string;
  present?: boolean;
}

export interface OnboardingJourney {
  productKey?: string;
  sourceSystem?: string;
  customerUserId?: string;
  partyLabel?: string;
  lifecycleStatus?: string;
  currentStep?: string;
  steps?: OnboardingStep[];
  documents?: OnboardingDocument[];
  actionsAllowed?: string[];
  rejectionReason?: string;
  completedAt?: string;
  dealerId?: number;
  companyId?: string;
  travellerCode?: string;
  requestedDocumentTypes?: string[];
  requestedProfileFields?: string[];
  customerUploadUrl?: string;
  uploadLinkExpiresAt?: string;
  productDeepLink?: string;
  dependencyHealth?: DependencyHealth;
  errorMessage?: string;
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  directorEmail?: string;
  directorNin?: string;
  directorBvn?: string;
  walletCreated?: boolean | null;
  ninVerified?: boolean | null;
  bvnVerified?: boolean | null;
  identityProfileKind?: string;
}

export const ONBOARDING_PRODUCT_KEYS = ['classycar', 'trip-jotter', 'capslocker', 'npod', 'drift'] as const;

export const ONBOARDING_LIFECYCLE_STATUSES = [
  'PENDING_REVIEW',
  'NEEDS_DOCS',
  'IN_PROGRESS',
  'REJECTED',
  'COMPLETE'
] as const;

export const INCIDENT_STATUSES: IncidentStatus[] = ['OPEN', 'MITIGATING', 'RESOLVED', 'CLOSED'];
export const INCIDENT_SEVERITIES: IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const INVITE_DESIGNATIONS = ['JUNIOR', 'SENIOR', 'ADMIN'] as const;

export type CaseStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'WAITING_SERVICE'
  | 'WAITING_APPROVAL'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';

export type CasePriority = 'P1' | 'P2' | 'P3' | 'P4' | string;
export type CaseSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4' | string;

export interface CaseSummary {
  id?: number;
  caseNumber: string;
  subject?: string;
  status?: CaseStatus | string;
  priority?: CasePriority;
  severity?: CaseSeverity;
  queueKey?: string;
  productKey?: string;
  issueCode?: string;
  customerUserId?: string;
  customerEmail?: string;
  customerName?: string;
  assigneePadlerId?: string;
  linkedBookingRef?: string;
  linkedPaymentRef?: string;
  slaDueAt?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface CaseInteraction {
  id?: number;
  channel?: string;
  body?: string;
  internal?: boolean;
  authorPadlerId?: string;
  authorLabel?: string;
  createdAt?: string;
}

export interface CaseDetail extends CaseSummary {
  description?: string;
  customerPhone?: string;
  organizationId?: string;
  createdByPadlerId?: string;
  linkedDispatchId?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  waitingReason?: string;
  nextFollowUpAt?: string;
  resolutionCode?: string;
  resolutionSummary?: string;
  customerImpact?: string;
  reopenCount?: number;
  version?: number;
  interactions?: CaseInteraction[];
}

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | string;

export interface CaseTask {
  id?: number;
  caseNumber?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  assigneePadlerId?: string;
  dueAt?: string;
  completedAt?: string;
  createdByPadlerId?: string;
  createdAt?: string;
}

export interface CaseAttachment {
  id?: number;
  fileName: string;
  contentType?: string;
  storageKey?: string;
  sizeBytes?: number;
  uploadedByPadlerId?: string;
  checksumSha256?: string;
  createdAt?: string;
}

export interface KnowledgeRunbook {
  id?: number;
  issueCode: string;
  title?: string;
  productKey?: string;
  customerSafeSummary?: string;
  whatThisMeans?: string;
  checksToPerform?: string;
  safeResolution?: string;
  whenToEscalate?: string;
  ownerQueueKey?: string;
  active?: boolean;
  updatedAt?: string;
}

export interface CaseAuditEvent {
  id?: number;
  action?: string;
  detail?: string;
  actorPadlerId?: string;
  actorEmail?: string;
  requestId?: string;
  createdAt?: string;
}

export interface TimelineItem {
  id?: number;
  auditEventId?: number;
  envelopeId?: string;
  partyType?: string;
  partyKey?: string;
  caseNumber?: string;
  category?: string;
  eventType?: string;
  title?: string;
  summary?: string;
  sourceSystem?: string;
  occurredAt?: string;
  ingestedAt?: string;
  sourceFreshnessAt?: string;
  sequenceNo?: number;
}

export interface TimelineResponse {
  partyType?: string;
  partyKey?: string;
  caseNumber?: string;
  items?: TimelineItem[];
}

export interface IdentityCrosswalk {
  id?: number;
  partyType?: string;
  partyKey?: string;
  customerUserId?: string;
  keycloakSub?: string;
  email?: string;
  phone?: string;
  displayName?: string;
  organizationId?: string;
  productIdsJson?: string;
  sourceFreshnessAt?: string;
}

export type DependencyHealth = 'UP' | 'DEGRADED' | 'DOWN' | 'UNCONFIGURED' | string;

export interface AdapterSnapshot {
  dependencyHealth?: DependencyHealth;
  errorCode?: string;
  errorMessage?: string;
  sourceSystem?: string;
  sourceFreshnessAt?: string;
  [key: string]: unknown;
}

export function healthBadgeClass(health?: string | null): string {
  const h = (health ?? '').toUpperCase();
  if (h === 'UP' || h === 'OK') return 'padler-badge padler-badge--ok';
  if (h === 'DEGRADED' || h === 'WARN') return 'padler-badge padler-badge--warn';
  if (h === 'DOWN' || h === 'ERROR') return 'padler-badge padler-badge--error';
  if (h === 'UNCONFIGURED') return 'padler-badge';
  return 'padler-badge padler-badge--pending';
}

export interface CrmSearchResult {
  query?: string;
  cases?: CaseSummary[];
  identities?: IdentityCrosswalk[];
}

export interface Customer360 {
  customerUserId?: string;
  identity?: {
    customerUserId?: string;
    email?: string;
    phone?: string;
    displayName?: string;
    keycloakSub?: string;
    dependencyHealth?: string;
    errorCode?: string;
    errorMessage?: string;
    [key: string]: unknown;
  };
  wallet?: {
    customerUserId?: string;
    dependencyHealth?: string;
    errorCode?: string;
    errorMessage?: string;
    wallet?: Record<string, unknown>;
    transactions?: Record<string, unknown>[];
    [key: string]: unknown;
  };
  npod?: Record<string, unknown>;
  wealth?: {
    customerUserId?: string;
    dependencyHealth?: string;
    errorCode?: string;
    errorMessage?: string;
    investments?: Record<string, unknown>[];
    totals?: Record<string, unknown>;
    [key: string]: unknown;
  };
  capslocker?: {
    customerUserId?: string;
    dependencyHealth?: string;
    errorCode?: string;
    errorMessage?: string;
    organization?: Record<string, unknown>;
    organizationWallet?: Record<string, unknown>;
    dashboardStats?: Record<string, unknown>;
    [key: string]: unknown;
  };
  openCases?: CaseSummary[];
  timeline?: TimelineItem[];
  dependencyHealthBySystem?: Record<string, string>;
  dependencyHealth?: string;
  sourceSystem?: string;
  sourceFreshnessAt?: string;
  errorCode?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' | string;

export interface ApprovalSummary {
  id?: number;
  approvalNumber: string;
  commandKey?: string;
  riskClass?: string;
  status?: ApprovalStatus;
  makerPadlerId?: string;
  makerEmail?: string;
  checkerPadlerId?: string;
  checkerEmail?: string;
  caseNumber?: string;
  customerUserId?: string;
  idempotencyKey?: string;
  payloadJson?: string;
  reason?: string;
  decisionNote?: string;
  requestedAt?: string;
  decidedAt?: string;
  expiresAt?: string;
  version?: number;
}

export interface CommandDefinition {
  id?: number;
  commandKey: string;
  displayName?: string;
  productKey?: string;
  riskClass?: string;
  requiredCapability?: string;
  requiresApproval?: boolean;
  approvalExpiryMinutes?: number;
  enabled?: boolean;
  description?: string;
}

export interface CommandExecution {
  id?: number;
  executionNumber: string;
  approvalRequestId?: number;
  commandKey?: string;
  idempotencyKey?: string;
  status?: string;
  makerPadlerId?: string;
  actorPadlerId?: string;
  caseNumber?: string;
  customerUserId?: string;
  requestPayloadJson?: string;
  beforeSnapshotJson?: string;
  afterSnapshotJson?: string;
  resultSummary?: string;
  errorCode?: string;
  errorDetail?: string;
  productReference?: string;
  correlationRequestId?: string;
  startedAt?: string;
  finishedAt?: string;
  reconcileDueAt?: string;
  reconciledAt?: string;
  version?: number;
  [key: string]: unknown;
}

export interface CommandRequestResult {
  outcome: string;
  approval?: ApprovalSummary | null;
  execution?: CommandExecution | null;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface OpsReport {
  generatedAt?: string;
  openBacklog: number;
  slaBreached: number;
  slaAtRisk: number;
  casesWithReopen: number;
  totalReopenEvents: number;
  escalationEvents: number;
  pendingApprovals: number;
  agingApprovalsOver24h: number;
  failedExecutions: number;
  unknownExecutions: number;
  backlogByStatus: NamedCount[];
  backlogByQueue: NamedCount[];
  workloadByAssignee: NamedCount[];
  contactsByChannel: NamedCount[];
  failedActionsByErrorCode: NamedCount[];
  executionsByStatus: NamedCount[];
  qualitySampleCaseNumbers: string[];
}

export interface RolloutStatus {
  mode: string;
  commandsEnabled: boolean;
  canaryCohort?: string | null;
  allowsR0: boolean;
  allowsR1: boolean;
  allowsR2: boolean;
  allowsR3: boolean;
  allowsR4: boolean;
  nextModeHint?: string;
  rollbackHint?: string;
}

export type AcceptanceCriterionStatus =
  | 'PASS'
  | 'PARTIAL'
  | 'OPS_PENDING'
  | 'DEFERRED'
  | 'FAIL'
  | 'ENABLED'
  | 'BLOCKED'
  | 'OPTIONAL'
  | string;

export interface AcceptanceCriterion {
  id: string;
  category: string;
  criterion: string;
  status: AcceptanceCriterionStatus;
  evidence?: string;
  owner?: string;
}

export interface AcceptanceCriteriaMatrix {
  phase: string;
  generatedAt?: string;
  statusCounts: Record<string, number>;
  criteria: AcceptanceCriterion[];
  note?: string;
  rolloutSnapshot?: {
    rolloutMode?: string;
    commandsEnabled?: boolean;
    highRiskCommandsAllowed?: boolean;
    adaptersConfigured?: Record<string, boolean>;
  };
}

export interface GovernanceChecklistItem {
  code: string;
  label: string;
  evidenceHint?: string;
}

export interface GovernanceCadenceItem {
  id: string;
  cadence: string;
  title: string;
  owner?: string;
  periodStart?: string | null;
  nextDueDate?: string | null;
  dueStatus: string;
  checklist: GovernanceChecklistItem[];
  relatedApis?: string[];
}

export interface GovernanceLiveSignal {
  code: string;
  label: string;
  value: number;
  severity: string;
}

export interface GovernanceCadence {
  phase: string;
  generatedAt?: string;
  rolloutMode?: string;
  highRiskCommandsAllowed?: boolean;
  liveSignals: GovernanceLiveSignal[];
  reviews: GovernanceCadenceItem[];
  note?: string;
}

/** Queues seeded by padler-admin-backend CaseService. */
export const PADLER_QUEUES = [
  { key: 'customer-support', label: 'Customer Support' },
  { key: 'finance-ops', label: 'Finance Operations' },
  { key: 'identity-privacy', label: 'Identity & Privacy' },
  { key: 'platform-sre', label: 'Platform / SRE' }
] as const;

export const CASE_STATUSES: CaseStatus[] = [
  'NEW',
  'TRIAGED',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'WAITING_SERVICE',
  'WAITING_APPROVAL',
  'RESOLVED',
  'CLOSED',
  'REOPENED'
];

export const CASE_PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;

export const TASK_STATUSES: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

export const CASE_LINK_TYPES = [
  { value: 'RELATED', label: 'Related' },
  { value: 'DUPLICATE_OF', label: 'Duplicate of' },
  { value: 'MERGED_INTO', label: 'Merged into' }
] as const;

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'REFUNDED' | 'FAILED';

export interface BookingItem {
  /** TripJotter booking row id (first seat row for grouped bookings) */
  id?: number;
  bookingReference: string;
  customerName: string;
  sourceChannel: 'TRIPJOTTER' | 'NPOD_CUSTOMER' | 'TSP_WEBSITE';
  routeLabel: string;
  /** Trip departure from Trip Jotter (string, often ISO-8601 local) */
  departureTime?: string;
  /** Display name of the transport company (e.g. when listing all companies) */
  companyName?: string;
  companyLogoUrl?: string;
  status: BookingStatus;
  amount: number;
  createdAt: string;
}

/** Full booking from Trip Jotter via Padler BFF (get-by-id). */
export interface BookingDetail {
  id: number;
  tripId?: number;
  bookingReference: string;
  customerName: string;
  sourceChannel: BookingItem['sourceChannel'];
  routeLabel: string;
  departureTime?: string;
  arrivalTime?: string;
  companyName?: string;
  companyLogoUrl?: string;
  status: BookingStatus;
  amount: number;
  seatNumber?: string;
  passengerEmail?: string;
  passengerPhone?: string;
  identificationType?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

/** `PAYMENT_STATUS` in wallet-service (string in API). */
export type PaymentStatus =
  | 'PENDING'
  | 'INITIATED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SUCCESSFUL';

/** Wallet payment row (Padler admin / list from wallet-service). */
/** Trip for admin drawer (Trip Jotter public trip DTO via BFF). */
export interface TripSeatItem {
  number: string;
  status: string;
}

export interface TripDetail {
  id: number;
  /** Same route, later trips (Padler reassign / alternatives). */
  transportCompanyId?: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  routeOrigin?: string;
  routeDestination?: string;
  transportCompanyName?: string;
  vehicleCapacity?: number;
  vehicleType?: string;
  vehicleSeatLayout?: string;
  vehicleLicensePlate?: string;
  vehicleStatus?: string;
  driverName?: string;
  driverPhone?: string;
  departureTime?: string;
  arrivalTime?: string;
  basePrice?: number;
  status?: string;
  bookedSeats?: number;
  vehicleSeats?: TripSeatItem[];
  /** LOCAL or CROSS_BORDER when present */
  tripType?: string;
}

/** One line from Trip Jotter admin booking (multi-passenger / seat). */
export interface AdminBookingLine {
  id?: number;
  seatNumber?: string;
  passengerName?: string;
  status?: string;
}

export interface PaymentRow {
  id?: number;
  reference: string;
  amount: number;
  discountAmount: number;
  discountCode?: string;
  currency: string;
  service: string;
  paymentProcessor: string;
  purpose: string;
  message?: string;
  email: string;
  payerUserId: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  /** Present when pay-by-link was initialized (e.g. Paystack). */
  authorizationUrl?: string;
}
