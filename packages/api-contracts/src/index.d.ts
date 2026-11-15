/** CG-01 transport-only types. Authoritative validation and enforcement remain on the backend. */
export interface CG01SignInRequest { email:string; password:string; totp:string; deviceLabel?:string }
export interface CG01SessionCreated { sessionToken:string; expiresAt:string; displayName:string }
export interface CG01SessionView { displayName:string; roleName:string; scope:"Foundation" }
export interface CG01SafeError { status:"error"; message:string; requestId:string }

/** CG-01 roles/permissions are server-authorized; client metadata is informational. */
export interface CG01Capability {
  key:string;businessLabel:string;group:string;assignable:boolean;sensitive:boolean;
}
export interface CG01RoleSummary {
  roleRef:string;name:string;description:string;colorKey:string|null;
  protected:boolean;active:boolean;revision:number;assignedCount:number;actionKeys:string[];
}
export interface CG01RoleChange {
  name:string;description:string;colorKey:string|null;actionKeys:string[];
  requestKey:string;expectedRevision?:number;
}
export interface CG01RoleChangeOutcome {roleRef:string;revision:number;message:string}
export interface CG01AuditEvent {
  eventRef:string;occurredAt:string;actorDisplay:string;actionLabel:string;
  targetDisplay:string;outcome:"Confirmed"|"Denied"|"Pending";source:"CG-01";
}

/** US-003 original Foundation-root staff identity; refs are opaque transport-only. */
export type CG01AccountStatus="INVITED"|"ACTIVE"|"SUSPENDED"|"DEACTIVATED";
export interface CG01AccountView {
  accountRef:string;displayName:string;email:string;phone:string|null;status:CG01AccountStatus;
  revision:number;roleName:string|null;roleRef:string|null;roleProtected:boolean;assignedAt:string|null;
  deliveryStatus:"PENDING"|"CLAIMED"|"PROVIDER_ACCEPTED"|"UNKNOWN"|"UNAVAILABLE"|null;
}
export interface CG01AccountList {
  accounts:CG01AccountView[];total:number;offset:number;limit:number;
  summary:{total:number;active:number;invited:number;suspended:number;deactivated:number;assigned:number};
}
export interface CG01AccountOption {value:string;label:string;context:"Foundation"}
export interface CG01AccountChangeOutcome {accountRef:string;revision:number;status:string;message:string}
export interface CG01AccountInvite {
  displayName:string;email:string;phone?:string;roleRef:string;requestKey:string
}
export interface CG01AccountAssignment {
  roleRef:string;expectedRevision:number;requestKey:string
}
export interface CG01AccountStatusChange {
  status:"ACTIVE"|"SUSPENDED"|"DEACTIVATED";expectedRevision:number;requestKey:string
}

/** US-004 CG-01-only protected Foundation-root security policy. */
export interface CG01SecurityPolicy {
  maxSessionAgeSeconds:number;
  idleTimeoutSeconds:number;
  failedAttemptWindowSeconds:number;
  maxFailedAttempts:number;
  rootMfaRequired:true;
  revision:number;
  updatedAt:string|null;
}
export interface CG01SecurityPolicyUpdate {
  maxSessionAgeSeconds:number;
  idleTimeoutSeconds:number;
  failedAttemptWindowSeconds:number;
  maxFailedAttempts:number;
  rootMfaRequired:true;
  expectedRevision:number;
  idempotencyKey:string;
  /** One fresh six-digit one-use CG-01 authenticator proof, never stored in audit. */
  totp:string;
}
export interface CG01SecurityPolicyOutcome {
  status:"SAVED"|"REPLAY_CONFIRMED";
  revision:number;
}

/** CG-21 / US-001 operational settings: only actual registered keys, not auth/CMS. */
export interface CG21SettingView {
  key:"audit.default_page_size";value:number;revision:number;updatedAt:string|null;
}
export interface CG21SettingRevision {
  revision:number;value:number;changedAt:string;changedBy:string;
}
export interface CG21SettingChange {
  key:"audit.default_page_size";value:number;expectedRevision:number;
  requestKey:string;totp:string;
}
export interface CG21IntegrationView {
  provider:string;purpose:string;revision:number;credentialRevision:number;
  status:"CONFIGURED_NOT_VERIFIED"|"VERIFIED"|"FAILED"|"UNAVAILABLE";
  lastCheckedAt:string|null;referencePresent:true;
}
export interface CG21IntegrationReferenceChange {
  provider:string;purpose:string;secretReference:string;
  expectedRevision:number;requestKey:string;totp:string;
}
export interface CG21CommandLookup {
  status:"CONFIRMED"|"NOT_FOUND";revision:number|null;
}
export interface CG21IntegrationReadiness {
  status:"NOT_CONFIGURED"|"UNAVAILABLE"|"VERIFIED"|"FAILED";
  provider:string;purpose:string;verified:boolean;
  credentialRevision?:number;message?:string;
}

/** CG-21 / US-002 source-owned redacted audit; never a duplicate identity ledger. */
export type CG21AuditSource="CG-01"|"CG-21";
export interface CG21AuditEvent {
  eventRef:string;source:CG21AuditSource;occurredAt:string;
  actionLabel:string;actorDisplay:string;targetDisplay:string;outcome:string;
}
export interface CG21AuditPage{
  events:CG21AuditEvent[];nextCursor:string|null;
  coverage:"COMPLETE"|"PARTIAL";unavailableSources:CG21AuditSource[];
  limit:number;source:"ALL"|CG21AuditSource;from:string;to:string;
}
export interface CG21AuditDetail {
  source:CG21AuditSource;occurredAt:string;actionLabel:string;
  actorDisplay:string;targetDisplay:string;outcome:string;
}
export interface CG21AuditCsv {
  filename:string;csv:string;rows:number;coverage:"COMPLETE";truncated:boolean;
}
export interface CG21RecoveryAvailability {
  status:"AVAILABLE"|"NOT_AVAILABLE";message:string;
}
export interface CG21RecoveryOperation{
  operationRef:string;status:"REQUESTED"|"PRIVILEGED_AUTHORIZED"|"RUNNING"|
    "VERIFIED_SUCCEEDED"|"FAILED"|"UNKNOWN";
  version:number;backupReferencePresent:boolean;
  requestedAt:string;updatedAt:string;
}
export interface CG21RecoveryRequest {
  backupReference:string;expectedVersion:0;requestKey:string;totp:string;
}
export interface CG21RecoveryOutcome {
  status:"NOT_AVAILABLE"|"REQUESTED"|"REPLAY_CONFIRMED";message?:string;
  operationRef?:string;version?:number;
}
