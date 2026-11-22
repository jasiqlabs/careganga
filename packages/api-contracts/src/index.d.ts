/** CG-01 transport-only types. Authoritative validation and enforcement remain on the backend. */
export interface CG01SignInRequest { identifier:string; password:string; deviceLabel?:string }
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
export type CG01AccountStatus="ACTIVE"|"SUSPENDED"|"DEACTIVATED";
export interface CG01AccountView {
  accountRef:string;displayName:string;email:string|null;phone:string|null;status:CG01AccountStatus;
  revision:number;roleName:string|null;roleRef:string|null;roleProtected:boolean;assignedAt:string|null;
}
export interface CG01AccountList {
  accounts:CG01AccountView[];total:number;offset:number;limit:number;
  summary:{total:number;active:number;suspended:number;deactivated:number;assigned:number};
}
export interface CG01AccountOption {value:string;label:string;context:"Foundation"}
export interface CG01AccountChangeOutcome {accountRef:string;revision:number;status:string;message:string}
export interface CG01AccountCreate {
  displayName:string;mobile:string;email?:string;password:string;
  roleRef:string;requestKey:string
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
  rootPasswordReauthRequired:true;
  revision:number;
  updatedAt:string|null;
}
export interface CG01SecurityPolicyUpdate {
  maxSessionAgeSeconds:number;
  idleTimeoutSeconds:number;
  failedAttemptWindowSeconds:number;
  maxFailedAttempts:number;
  rootPasswordReauthRequired:true;
  expectedRevision:number;
  idempotencyKey:string;
  /** Fresh current-password proof for protected settings changes; never stored in audit. */
  currentPassword:string;
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
  requestKey:string;currentPassword:string;
}
export interface CG21IntegrationView {
  provider:string;purpose:string;revision:number;credentialRevision:number;
  status:"CONFIGURED_NOT_VERIFIED"|"VERIFIED"|"FAILED"|"UNAVAILABLE";
  lastCheckedAt:string|null;referencePresent:true;
}
export interface CG21IntegrationReferenceChange {
  provider:string;purpose:string;secretReference:string;
  expectedRevision:number;requestKey:string;currentPassword:string;
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
  backupReference:string;expectedVersion:0;requestKey:string;currentPassword:string;
}
export interface CG21RecoveryOutcome {
  status:"NOT_AVAILABLE"|"REQUESTED"|"REPLAY_CONFIRMED";message?:string;
  operationRef?:string;version?:number;
}

/** CG-03 / US-001: only an existing CG-01 protected role-change request. */
export interface CG03Option{value:string;label:string;}
export interface CG03CaseView{
  caseRef:string;reference:string;accountName:string;roleName:string;
  status:string;revision:number;proposalRevision:number;processVersion:number;
  currentStep:number;sourceAccountAccessRevision:string;sourceRoleRevision:number;
  submittedAt:string;previousCaseRef:string|null;
}
export interface CG03CaseDetail extends CG03CaseView{
  allowedDecisions:Array<"APPROVE"|"RETURN"|"REJECT"|"FORWARD">;
  requiresCurrentPassword:boolean;
  history:Array<{action:string;remarks:string;at:string;by:string}>;
}
export interface CG03DecisionInput {
  action:"APPROVE"|"RETURN"|"REJECT"|"FORWARD";
  remarks:string;expectedRevision:number;requestKey:string;currentPassword:string;
}
export interface CG03DecisionResult {
  status:string;caseNumber:string;revision:number;
  decisionRecorded?:boolean;sourceEffect?:string;
}
export interface CG03DecisionLookup {
  status:"CONFIRMED"|"NOT_FOUND";revision:number|null;action?:string;
}
export interface CG03ProcessView{
  active:boolean;version:number;firstReviewer:string|null;
  finalReviewer:string;requiresCurrentPassword:boolean;message:string;
}
export interface CG03CreateInput{
  targetAccountRef:string;targetRoleRef:string;requestKey:string;
  previousCaseRef?:string;
}
export interface CG03CaseOutcome extends CG03CaseView{
  result:"SUBMITTED"|"PREVIOUSLY_CONFIRMED";
}
export interface CG03Lookup{
  status:"CONFIRMED"|"NOT_FOUND";case:CG03CaseView|null;
}

/** CG-03 / US-003: approval decision and actual CG-01 role effect are separate. */
export interface CG03OwnerOutcome{
  status:"PENDING_OWNER"|"OWNER_COMPLETED"|"OWNER_BLOCKED";
  attempts:number;canRetry:boolean;
}
export interface CG03OwnerRetry{
  status:"PENDING_OWNER"|"OWNER_COMPLETED"|"OWNER_BLOCKED";
}

/** CG-19 / US-001: actual private CG-03 case evidence. References are transport
 * identifiers and must never be displayed in user-facing form controls. */
export type CG19FileState=
  "INITIATED"|"UPLOAD_READY"|"VERIFYING"|"VALIDATED"|"REJECTED"|
  "UNKNOWN"|"EXPIRED"|"STORAGE_UNAVAILABLE"|"VERIFICATION_UNAVAILABLE"|
  "EXPIRED_OR_REJECTED";
export interface CG19UploadRequest {
  caseRef:string;sourceRevision:number;requestKey:string;
  mime:"application/pdf"|"image/jpeg"|"image/png"|"image/webp";
  sizeBytes:number;sha256:string;
}
export interface CG19UploadStart {
  uploadRef:string;status:CG19FileState;message:string;
  uploadUrl?:string;uploadHeaders?:Record<string,string>;expiresAt?:string;
}
export interface CG19UploadStatus {
  uploadRef:string;status:CG19FileState;fileRef:string|null;
  cleanVerified:boolean;message?:string;
}

/** CG05 US001 operational project, no public or finance claims. */
export type CG05Option={value:string;label:string};
export type CG05Project={ref:string;code:string;title:string;category:string;summary:string;description:string;status:string;priority:string;ownerRef:string;owner:string;branchRef:string|null;branch:string|null;stateRef:string|null;state:string|null;districtRef:string|null;district:string|null;location:string;fundingSource:string;plannedStart:string|null;plannedEnd:string|null;plannedBudgetMinor:string|null;version:number;updatedAt:string;completedAt:string|null};
export type CG05ProjectFinance={status:"LINKED"|"NOT_LINKED"|"RESTRICTED"|"UNAVAILABLE";linked:number|null;approved:number|null;ceilingMinor:string|null;allocatedMinor:string|null;utilizedMinor:string|null};
export type CG05ProjectDetail=CG05Project&{canManage:boolean;finance:CG05ProjectFinance;financeStatus:string;publicStatus:string;history:{action:string;priorStatus:string|null;status:string;reason:string;at:string;actor:string}[];branchHistory:{branch:string;validFrom:string;validTo:string|null}[]};
export type CG05ProjectList={filterOptions?:{owners:CG05Option[]};items:CG05Project[];finance:CG05ProjectFinance;counts:{total:number;active:number;hold:number;completed:number;cancelled:number;planned:number;plannedBudgetMinor:string};categories:{label:string;count:number}[];recent:{title:string;action:string;status:string;at:string}[];offset:number;hasMore:boolean};
export type CG05ProjectOptions={canManageFoundation:boolean;branches:CG05Option[];owners:CG05Option[];states:CG05Option[];districts:CG05Option[]};
export type CG05ProjectDraft={code:string;title:string;category:string;summary:string;description:string;priority:string;ownerRef:string;branchRef:string;stateRef:string;districtRef:string;location:string;fundingSource:string;plannedStart:string;plannedEnd:string;plannedBudget:string;status:string};

export type CG05PublicEligibility={status:string;caseRef:string|null;caseNumber?:string;revision?:number;canReview:boolean;canWithdraw:boolean;source:{title:string;category:string;summary:string;area:string;launch:string|null;status:string;coverFileRef?:string|null;coverFileVersion?:number|null}|null};

export type CG05TaskStatus="DRAFT"|"ASSIGNED"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
export type CG05TaskAssigneeKind="UNASSIGNED"|"ACCOUNT"|"EMPLOYEE";
export type CG05Task={ref:string;code:string;projectRef:string;project:string;projectCode:string;title:string;taskType:string;description:string;priority:"LOW"|"NORMAL"|"HIGH"|"URGENT";startDate:string|null;dueDate:string|null;status:CG05TaskStatus;assigneeKind:CG05TaskAssigneeKind;assignee:string|null;location:string;branch:string|null;version:number;updatedAt:string;completedAt:string|null;overdue:boolean;assignmentCurrent:boolean;canManage?:boolean};
export type CG05TaskEvent={action:string;priorStatus?:string|null;status:string;reason:string;at:string;actor:string;assignee?:string|null};
export type CG05TaskDetail=CG05Task & {history:CG05TaskEvent[];canManage:boolean;canProgress:boolean;approvalStatus:"NOT_REQUIRED"};
export type CG05TaskList={items:CG05Task[];counts:{total:number;mine:number;completed:number;inProgress:number;overdue:number;upcoming:number;cancelled:number};statusCounts:{label:string;count:number}[];priorityCounts:{label:string;count:number}[];overdueItems:CG05Task[];recent:(CG05TaskEvent & {ref:string;code:string;title:string})[];filterOptions:{projects:{value:string;label:string}[];types:string[];assignees:string[];locations:string[]};offset:number;hasMore:boolean};
export type CG05TaskOptions={projects:{value:string;label:string}[];hasMoreProjects:boolean;assignees:{value:string;label:string;kind:"ACCOUNT"|"EMPLOYEE"}[]};

export type CG05ActivityStatus="DRAFT"|"SCHEDULED"|"ONGOING"|"COMPLETED"|"CANCELLED";
export type CG05Activity={ref:string;code:string;projectRef:string|null;project:string|null;kind:"ACTIVITY"|"EVENT";title:string;category:string;activityType:string;description:string;program:string;branchRef:string|null;branch:string|null;stateRef:string|null;state:string|null;districtRef:string|null;district:string|null;venue:string;owner:string;ownerRef:string;scheduledStart:string;scheduledEnd:string;actualStart:string|null;actualEnd:string|null;outcome:string;status:CG05ActivityStatus;version:number;updatedAt:string;ownerCurrent:boolean;scopeChanged:boolean};
export type CG05ActivityDetail=CG05Activity & {canManage:boolean;canProgress:boolean;canAttachEvidence:boolean;canReleaseEvent:boolean;history:{action:string;priorStatus:string|null;status:string;reason:string;at:string;actor:string;owner:string}[]};
export type CG05ActivityList={items:CG05Activity[];counts:{total:number;completed:number;ongoing:number;upcoming:number;cancelled:number;mine:number};categories:{label:string;count:number}[];statuses:{label:string;count:number}[];recent:{ref:string;code:string;title:string;action:string;status:string;at:string;actor:string}[];filterOptions:{projects:CG05Option[];branches:CG05Option[];categories:string[];types:string[];owners:string[];locations:string[]};offset:number;hasMore:boolean};
export type CG05ActivityOptions={projects:(CG05Option & {branchRef:string|null})[];branches:CG05Option[];canManageFoundation:boolean;selectedBranch:string|null;owners:CG05Option[];states:CG05Option[];districts:CG05Option[]};

/** Private CG05 field visits: device data is reported provenance, not independently attested GPS. */
export type CG05VisitStatus="DRAFT"|"PLANNED"|"IN_PROGRESS"|"PENDING_PROOF"|"PENDING_APPROVAL"|"RETURNED"|"REJECTED"|"COMPLETED"|"CANCELLED";
export type CG05Visit={ref:string;code:string;projectRef:string;project:string;taskRef:string|null;task:string|null;actorRef:string;actor:string;visitType:string;location:string;branchRef:string|null;branch:string|null;stateRef:string|null;state:string|null;districtRef:string|null;district:string|null;plannedAt:string;startedAt:string|null;completedAt:string|null;status:CG05VisitStatus;version:number;updatedAt:string};
export type CG05VisitCapture={kind:"CHECK_IN"|"CHECK_OUT";latitude:number|null;longitude:number|null;accuracyM:number|null;recordedAt:string;deviceRecordedAt:string|null;locationProvenance:"DEVICE_GPS"|"MANUAL_ENTERED"|"UNAVAILABLE"|"REJECTED";consentState:string};
export type CG05VisitDetail=CG05Visit&{purpose:string;report:string;captures:CG05VisitCapture[];history:{kind:string;status:CG05VisitStatus;at:string;reason:string;actor:string}[];comments:{body:string;at:string;actor:string}[];assignmentCurrent:boolean;canManage:boolean;canCapture:boolean};
export type CG05VisitList={items:CG05Visit[];counts:{status:CG05VisitStatus;count:number}[];total:number;recent:{ref:string;code:string;project:string;kind:string;status:CG05VisitStatus;at:string}[];filterOptions:{projects:CG05Option[];types:string[];actors:CG05Option[];branches:CG05Option[]};offset:number;hasMore:boolean};
export type CG05VisitOptions={projects:CG05Option[];actors:CG05Option[];tasks:CG05Option[];states:CG05Option[];districts:CG05Option[]};
export type CG05VisitReview={allowedDecisions?:("APPROVE"|"FORWARD"|"RETURN"|"REJECT")[];requiresCurrentPassword?:boolean;currentStep?:number;totalSteps?:number;status:string;caseRef:string|null;caseNumber?:string;revision?:number;canReview:boolean;sourceVersion?:number;report?:string;locationState?:"DEVICE_REPORTED"|"UNVERIFIED_LOCATION";verifiedFileCount?:number;decisions?:{action:string;remarks:string;at:string;reviewer:string;caseNumber?:string;step?:number}[]};

export type CG05OperationsSummary={asOf:string;scope:"MINE"|"PERMITTED";sections:{source:string;metrics:{label:string;value:number|string}[]}[];restricted:string[];finance:CG05ProjectFinance|null;recent:{source:string;title:string;status:string;action:string;at:string}[]};
export type CG05OperationsExport={csv:string;rows:number;restricted:string[]};

/** CG04 US001: public plan code is an opaque selection key; never render it as a label. */
export type CG04TierStatus="DRAFT"|"ACTIVE"|"INACTIVE";
export type CG04TierCategory="ANNUAL"|"LIFETIME"|"HONORARY"|"STUDENT"|"OTHER";
export type CG04TierDuration="DAY"|"MONTH"|"YEAR"|"LIFETIME";
export type CG04TierIcon="CARD"|"STAR"|"HEART"|"CROWN"|"GRADUATION"|"SHIELD"|"USERS";
export type CG04TierColor="BLUE"|"GREEN"|"AMBER"|"PURPLE"|"TEAL"|"ROSE"|"SLATE";
export type CG04TierBenefit={title:string;description:string};
export type CG04PublicTier={planCode:string;offerRevision:number;name:string;category:CG04TierCategory;feeMinor:string;currency:"INR";durationUnit:CG04TierDuration;durationCount:number;description:string;benefits:CG04TierBenefit[];icon:CG04TierIcon;color:CG04TierColor;displayOrder:number};
export type CG04Tier=CG04PublicTier&{ref:string;version:number;status:CG04TierStatus;effectiveFrom:string};
export type CG04TierWrite=Omit<CG04PublicTier,"planCode"|"offerRevision"|"feeMinor">&{price:string;status:CG04TierStatus;requestKey:string;expectedVersion?:number};
export type CG04PublicTierPage={items:CG04PublicTier[];nextCursor:string|null};
export type CG04TierPage={items:CG04Tier[];nextCursor:string|null;counts:{total:number;active:number;draft:number;inactive:number}};
export type CG04TierResult={record:CG04Tier;replayed:boolean};

/** Authenticated own applicant draft. No public roster or payment authority. */
export type CG04ApplicationDraftWrite={requestKey:string;expectedVersion?:number;planCode:string;offerRevision:number;address:string;city:string;pinCode:string;stateRef:string;districtRef:string;branchRef?:string|null;referral?:string;consent:true};
export type CG04Application={ref:string;applicationNumber:string;version:number;status:"DRAFT"|"SUBMITTED"|"RETURNED"|"REJECTED"|"APPROVED"|"CANCELLED";name:string;mobile:string;email:string|null;address:string;city:string;pinCode:string;stateRef:string;state:string;districtRef:string;district:string;branchRef:string|null;branch:string|null;referral:string;consentVersion:string;planCode:string;offerRevision:number;plan:string;feeMinor:string;currency:"INR";durationUnit:CG04TierDuration;durationCount:number;currentOffer:boolean;feeRecorded:boolean;updatedAt:string;reviewReference:string|null;reviewStatus:string|null;reviewRemarks:string|null};
export type CG04ApplicantOption={value:string;label:string};
export type CG04ApplicantOptions={contact:{name:string;mobile:string;email:string|null};branches:CG04ApplicantOption[];states:CG04ApplicantOption[];districts:CG04ApplicantOption[]};
export type CG04ApplicationResult={record:CG04Application;replayed:boolean};

export type CG04MembershipReviewSubmit={reference:string;status:string;replayed:boolean};
export type CG04MembershipEvidenceClass="MEMBER_IDENTITY_PROOF"|"MEMBER_PORTRAIT";
export type CG04MembershipEvidenceFile={fileRef:string;classification:CG04MembershipEvidenceClass;mime:string;sizeBytes:number;fileVersion:number;applicationVersion:number;createdAt:string};
export type CG04MembershipEvidenceList={files:CG04MembershipEvidenceFile[];pending:{uploadRef:string;classification:CG04MembershipEvidenceClass;status:string;expiresAt:string}[]};
export type CG04MembershipEvidenceStatus={uploadRef:string;status:string;cleanVerified:boolean;fileRef?:string|null;fileVersion?:number|null;uploadUrl?:string;uploadHeaders?:Record<string,string>;expiresAt?:string};

export type CG04MembershipPaymentStatus="NOT_DUE"|"PENDING"|"AWAITING_BANK_VERIFICATION"|"VERIFIED"|"REFUND_PENDING"|"REFUND_AWAITING_BANK_VERIFICATION"|"REFUNDED";
export type CG04MembershipFee={feeMinor:string;currency:"INR";paymentStatus:CG04MembershipPaymentStatus;verifiedMinor:string;refundRequired:boolean};
export type CG04Member={memberNumber:string;name:string;branch:string|null;plan:string;category:CG04TierCategory;feeMinor:string;currency:"INR";startsOn:string;expiresOn:string|null;status:"ACTIVE"|"EXPIRED"|"SUSPENDED"|"CANCELLED"};
export type CG04MemberProfile={member:CG04Member|null};
export type CG04MembershipActivationResult={member:CG04Member;replayed:boolean};

export type CG04RosterRow={ref:string;memberNumber:string;name:string;email:string|null;mobile:string;plan:string;category:CG04TierCategory;joinedOn:string;expiresOn:string|null;status:"ACTIVE"|"EXPIRED"|"SUSPENDED"|"CANCELLED";city:string;district:string;branch:string|null};
export type CG04RosterPage={items:CG04RosterRow[];nextCursor:string|null;hasMore:boolean;branchOptions:{value:string;label:string}[];overview:{total:number;active:number;expired:number;cancelled:number;suspended:number;byCategory:Record<string,number>}};
export type CG04RosterExport={csv:string;rows:number};
