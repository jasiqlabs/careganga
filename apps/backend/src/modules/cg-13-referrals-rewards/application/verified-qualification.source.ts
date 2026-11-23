import type {PoolClient} from "pg";

/** Called only by the ORIGINAL CG04 verified member/volunteer activation
 * transaction after its CG03 review and CG09 (when applicable) are committed
 * within that same transaction. The DB trigger independently verifies those
 * CG04/CG09/CG03 facts before accepting any immutable QUALIFICATION event.
 *
 * NEVER call this from a public request, simple application submission,
 * arbitrary webhook, unverified payment or a member/volunteer GET.
 */
type ApplicantKind="MEMBER"|"VOLUNTEER";
type Committed={root:string;applicantKind:ApplicantKind;application:string;applicantAccount:string};
type Pending={
 id:string;programme:string;referrerKind:ApplicantKind;
 referrerRelationship:string;referrerAccount:string;
 policyVersion:number;awardPoints:string;submittedDigest:string;
 state:"PENDING"|"HELD_FRAUD_REVIEW";
 codeValue:string;
};
type Wallet={
 id:string;earnedPoints:string;reversedPoints:string;heldPoints:string;
 spentPoints:string;qualifiedReferrals:number;currentRankName:string|null;
};
const MAX_SIGNED=9223372036854775807n;
export type QualificationOutcome="NONE"|"HELD_FRAUD_REVIEW"|"INELIGIBLE"|"PREVIOUS"|"CREDITED";

export async function creditVerifiedCG04Qualification(tx:PoolClient,src:Committed):
 Promise<QualificationOutcome>{
 const filter=src.applicantKind==="MEMBER"?"att.member_application_ref":
  "att.volunteer_application_ref";
 const found=await tx.query<Pending>(
  "SELECT att.id,att.programme_id AS programme,att.referrer_kind AS \"referrerKind\","+
  "att.referrer_relationship_ref AS \"referrerRelationship\","+
  "att.referrer_account_ref AS \"referrerAccount\","+
  "att.policy_version AS \"policyVersion\","+
  "att.award_points::text AS \"awardPoints\",att.submitted_digest AS \"submittedDigest\","+
  "att.state,code.code_value AS \"codeValue\" FROM referral_attribution att "+
  "JOIN referral_code code ON code.root_realm_id=att.root_realm_id "+
  "AND code.id=att.referral_code_ref "+
  "WHERE att.root_realm_id=$1 AND att.applicant_kind=$2 AND "+filter+"=$3 "+
  "AND att.applicant_account_ref=$4 FOR UPDATE OF att",
  [src.root,src.applicantKind,src.application,src.applicantAccount]);
 const att=found.rows[0];if(!att)return "NONE";
 // Original submission freezes one attribution. A second delivery/retry must
 // check the immutable event before re-evaluating current code eligibility.
 const previous=await tx.query(
  "SELECT 1 FROM points_event WHERE root_realm_id=$1 AND attribution_id=$2 "+
  "AND event_kind='QUALIFICATION'",[src.root,att.id]);
 if(previous.rowCount)return "PREVIOUS";
 if(att.state!=="PENDING")return "HELD_FRAUD_REVIEW";
 const stillValid=await tx.query<{current:boolean}>(
  "SELECT cg13_referral_code_current($1,$2) AS current",
  [src.root,att.codeValue]);
 if(!stillValid.rows[0]?.current)return "INELIGIBLE";
 // A returned/corrected CG04 application may have a NEW submitted digest.
 // Preserve the FIRST immutable referrer and policy, but freeze the CURRENT
 // independently approved source and reject a changed/removed referral code.
 const owner=src.applicantKind==="MEMBER"?"membership_application":"volunteer_application";
 const latest=await tx.query<{digest:string;referral:string}>(
  "SELECT submitted_digest AS digest,referral_input AS referral FROM "+owner+
  " WHERE root_realm_id=$1 AND id=$2 AND applicant_account_ref=$3 "+
  "AND status='APPROVED' AND submitted_digest IS NOT NULL",
  [src.root,src.application,src.applicantAccount]);
 if(!latest.rows[0]?.digest||latest.rows[0].referral!==att.codeValue)return "INELIGIBLE";
 // A wallet must belong to the ORIGINAL referrer relationship, not the
 // applicant. This is independent of a future US003 redemption/stock hold.
 await tx.query(
  "INSERT INTO points_account(root_realm_id,programme_id,referrer_kind,"+
  "referrer_relationship_ref,referrer_account_ref) VALUES($1,$2,$3,$4,$5) "+
  "ON CONFLICT(root_realm_id,programme_id,referrer_kind,referrer_relationship_ref) DO NOTHING",
  [src.root,att.programme,att.referrerKind,att.referrerRelationship,att.referrerAccount]);
 const selected=await tx.query<Wallet>(
  "SELECT id,earned_points::text AS \"earnedPoints\","+
  "reversed_points::text AS \"reversedPoints\","+
  "held_points::text AS \"heldPoints\",spent_points::text AS \"spentPoints\","+
  "qualified_referrals AS \"qualifiedReferrals\","+
  "current_rank_name AS \"currentRankName\" FROM points_account "+
  "WHERE root_realm_id=$1 AND programme_id=$2 AND referrer_kind=$3 "+
  "AND referrer_relationship_ref=$4 AND referrer_account_ref=$5 FOR UPDATE",
  [src.root,att.programme,att.referrerKind,att.referrerRelationship,att.referrerAccount]);
 const wallet=selected.rows[0];
 if(!wallet)throw Error("Original referral points account cannot be verified");
 const award=BigInt(att.awardPoints),earned=BigInt(wallet.earnedPoints)+award;
 if(earned>MAX_SIGNED)throw Error("Referral points ledger capacity reached");
 const eligible=earned-BigInt(wallet.reversedPoints)-
  BigInt(wallet.heldPoints)-BigInt(wallet.spentPoints);
 const available=eligible>0n?eligible:0n;
 const count=wallet.qualifiedReferrals+1;
 if(!Number.isSafeInteger(count)||count>2147483647)
  throw Error("Referral qualification count capacity reached");
 // Only an ORIGINAL committed CG04 source can pass the immutable SQL trigger.
 const event=await tx.query<{id:string}>(
  "INSERT INTO points_event(root_realm_id,points_account_id,attribution_id,"+
  "event_kind,policy_version,points_delta,qualifying_source_digest) "+
  "VALUES($1,$2,$3,'QUALIFICATION',$4,$5,$6) "+
  "ON CONFLICT(root_realm_id,attribution_id,event_kind) DO NOTHING RETURNING id",
  [src.root,wallet.id,att.id,att.policyVersion,att.awardPoints,latest.rows[0].digest]);
 if(!event.rows[0])return "PREVIOUS";
 const ranked=await tx.query<{name:string;sort:number}>(
  "SELECT rank_name AS name,sort_order AS sort FROM referral_rank_rule "+
  "WHERE root_realm_id=$1 AND programme_id=$2 AND policy_version=$3 "+
  "AND minimum_verified_referrals<=$4 AND minimum_eligible_points<=$5::bigint "+
  "ORDER BY sort_order DESC LIMIT 1",
  [src.root,att.programme,att.policyVersion,count,available.toString()]);
 const rank=ranked.rows[0];
 if(!rank)throw Error("Original effective referral rank rules are unavailable");
 await tx.query(
  "UPDATE points_account SET earned_points=$3,qualified_referrals=$4,"+
  "current_rank_name=$5,current_rank_sort=$6,current_rank_policy_version=$7,"+
  "revision=revision+1,updated_at=now() "+
  "WHERE root_realm_id=$1 AND id=$2",
  [src.root,wallet.id,earned.toString(),count,rank.name,rank.sort,att.policyVersion]);
 await tx.query(
  "INSERT INTO reward_rank_event(root_realm_id,points_account_id,"+
  "qualifying_points_event_id,policy_version,prior_rank_name,"+
  "resulting_rank_name,resulting_rank_sort,qualified_referrals_snapshot,"+
  "eligible_points_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
  [src.root,wallet.id,event.rows[0].id,att.policyVersion,wallet.currentRankName,
   rank.name,rank.sort,count,available.toString()]);
 return "CREDITED";
}
