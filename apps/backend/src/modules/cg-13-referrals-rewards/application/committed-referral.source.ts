import type {PoolClient} from "pg";

/** This typed source function is called only from the genuine CG03/CG04
 * COMMITTED application submission TX. It MUST NOT be called by any public
 * request or draft-save path. Invalid/expired code never blocks enrollment.
 */
export type ReferralApplicationKind="MEMBER"|"VOLUNTEER";
type CommittedReferralInput={
 root:string;applicantAccount:string;application:string;
 kind:ReferralApplicationKind;applicationRevision:number;
 submittedDigest:string;originalSubmitKey:string;code:string|null;
};
type Source={
 programme:string;codeRef:string;referrerAccount:string;referrerKind:string;
 referrerRelationship:string;policyVersion:number;qualifyingEvent:string;
 awardPoints:string;
};
const CODE=/^[A-Za-z0-9_-]{32}$/;
export async function recordCommittedReferralAttribution(
 tx:PoolClient,source:CommittedReferralInput):Promise<"NONE"|"RECORDED"|"PREVIOUS">{
 if(!source.code||!CODE.test(source.code))return "NONE";
 // CG04 renewal is NOT a new qualifying signup; do not freeze a new
 // attribution for an already-issued original member identity.
 if(source.kind==="MEMBER"){
  const existing=await tx.query(
   "SELECT 1 FROM member WHERE root_realm_id=$1 AND account_ref=$2 LIMIT 1",
   [source.root,source.applicantAccount]);
  if(existing.rowCount)return "NONE";
 }
 // Current encrypted CG01 identity and signed CG04 submitted source are
 // already verified by the calling owner. This function independently binds
 // application, account, original source digest and policy inside that TX.
 const current=await tx.query<Source>(
  "SELECT p.id AS programme,c.id AS \"codeRef\","+
  "c.referrer_account_ref AS \"referrerAccount\","+
  "c.referrer_kind AS \"referrerKind\","+
  "c.referrer_relationship_ref AS \"referrerRelationship\","+
  "policy.version_no AS \"policyVersion\","+
  "policy.qualifying_event AS \"qualifyingEvent\","+
  "policy.award_points::text AS \"awardPoints\" "+
  "FROM referral_code c JOIN referral_program p "+
  "ON p.root_realm_id=c.root_realm_id AND p.id=c.programme_id "+
  "JOIN LATERAL (SELECT pv.version_no,pv.qualifying_event,pv.award_points "+
  "FROM referral_policy_version pv WHERE pv.root_realm_id=p.root_realm_id "+
  "AND pv.programme_id=p.id AND pv.effective_from<=now() "+
  "ORDER BY pv.effective_from DESC,pv.version_no DESC LIMIT 1) policy ON true "+
  "WHERE c.root_realm_id=$1 AND c.code_value=$2 AND p.status='ACTIVE' "+
  "AND (p.audience=$3 OR p.audience='BOTH') "+
  "AND policy.qualifying_event=$4 "+
  "AND cg13_referral_code_current(c.root_realm_id,c.code_value) "+
  "FOR SHARE OF c,p",
  [source.root,source.code,source.kind,
   source.kind==="MEMBER"?"MEMBERSHIP_ACTIVATED_VERIFIED":"VOLUNTEER_APPROVED_ACTIVE"]);
 const row=current.rows[0];
 if(!row||row.referrerAccount===source.applicantAccount)return "NONE";
 // Original owner already locks the actual application and a per-applicant
 // advisory key. A second different CG04 application must not hijack the
 // FIRST committed eligible source for the same programme and account.
 const prior=await tx.query<{id:string}>(
  "SELECT id FROM referral_attribution WHERE root_realm_id=$1 "+
  "AND programme_id=$2 AND applicant_account_ref=$3 FOR SHARE",
  [source.root,row.programme,source.applicantAccount]);
 if(prior.rows.length)return "PREVIOUS";
 const circular=await tx.query<{id:string}>(
  "SELECT id FROM referral_attribution WHERE root_realm_id=$1 "+
  "AND programme_id=$2 AND applicant_account_ref=$3 AND referrer_account_ref=$4 "+
  "LIMIT 1 FOR SHARE",
  [source.root,row.programme,row.referrerAccount,source.applicantAccount]);
 const state=circular.rows.length?"HELD_FRAUD_REVIEW":"PENDING";
 const result=await tx.query<{id:string}>(
  "INSERT INTO referral_attribution(root_realm_id,programme_id,applicant_kind,"+
  "member_application_ref,volunteer_application_ref,applicant_account_ref,"+
  "referral_code_ref,referrer_account_ref,referrer_kind,referrer_relationship_ref,"+
  "application_revision,submitted_digest,original_submit_key,policy_version,"+
  "qualifying_event,award_points,state) "+
  "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) "+
  "ON CONFLICT DO NOTHING RETURNING id",
  [source.root,row.programme,source.kind,
   source.kind==="MEMBER"?source.application:null,
   source.kind==="VOLUNTEER"?source.application:null,
   source.applicantAccount,row.codeRef,row.referrerAccount,row.referrerKind,
   row.referrerRelationship,source.applicationRevision,source.submittedDigest,
   source.originalSubmitKey,row.policyVersion,row.qualifyingEvent,
   row.awardPoints,state]);
 return result.rows.length?"RECORDED":"PREVIOUS";
}
