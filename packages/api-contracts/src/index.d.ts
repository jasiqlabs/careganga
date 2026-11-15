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
  accountRef:string;displayName:string;email:string;status:CG01AccountStatus;
  revision:number;roleName:string|null;roleRef:string|null;assignedAt:string|null;
  deliveryStatus:"PENDING"|"CLAIMED"|"PROVIDER_ACCEPTED"|"UNKNOWN"|"UNAVAILABLE"|null;
}
export interface CG01AccountList {
  accounts:CG01AccountView[];total:number;offset:number;limit:number;
  summary:{total:number;active:number;invited:number;suspended:number;deactivated:number};
}
export interface CG01AccountOption {value:string;label:string;context:"Foundation"}
export interface CG01AccountChangeOutcome {accountRef:string;revision:number;status:string;message:string}
export interface CG01AccountInvite {
  displayName:string;email:string;roleRef:string;requestKey:string
}
export interface CG01AccountAssignment {
  roleRef:string;expectedRevision:number;requestKey:string
}
export interface CG01AccountStatusChange {
  status:"ACTIVE"|"SUSPENDED"|"DEACTIVATED";expectedRevision:number;requestKey:string
}
