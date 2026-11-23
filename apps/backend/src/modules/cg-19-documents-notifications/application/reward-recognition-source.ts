import {ConflictException} from "@nestjs/common";
import type {PoolClient} from "pg";

/** Original CG19 on-platform recognition source, NOT a placeholder PDF/code.
 * Caller is original CG13 self redemption service inside the SAME transaction
 * after CG01 root-session and current CG04 recipient eligibility checks.
 * Acknowledgment by the actual authenticated recipient is delivery proof.
 */
export async function recordAcknowledgedRewardRecognition(tx:PoolClient,source:{
 root:string;redemption:string;recipient:string;requestKey:string;
}):Promise<{id:string;title:string;description:string}>{
 const match=await tx.query<{title:string;description:string;product:string;revision:number}>(
  "SELECT p.name AS title,p.description,p.product_id AS product,p.revision "+
  "FROM redemption r JOIN reward_product_revision p "+
  "ON p.root_realm_id=r.root_realm_id "+
  "AND p.product_id=r.product_id AND p.revision=r.product_revision "+
  "WHERE r.root_realm_id=$1 AND r.id=$2 AND r.recipient_account_ref=$3 "+
  "AND r.request_key=$4 AND r.state='HELD' AND r.product_type='DIGITAL' "+
  "AND p.product_type='DIGITAL' "+
  "AND p.digital_fulfillment_method='ON_PLATFORM_RECOGNITION'",
  [source.root,source.redemption,source.recipient,source.requestKey]);
 const snapshot=match.rows[0];
 if(!snapshot)throw new ConflictException(
  "This digital reward does not have a verified on-platform recognition method.");
 const created=await tx.query<{id:string}>(
  "INSERT INTO cg19_reward_recognition(realm_id,redemption_id,"+
  "recipient_account_ref,product_id,product_revision,source_key,title,description) "+
  "VALUES($1,$2,$3,$4,$5,$6,$7,$8) "+
  "RETURNING id",
  [source.root,source.redemption,source.recipient,snapshot.product,
   snapshot.revision,source.requestKey,snapshot.title,snapshot.description]);
 if(!created.rows[0])throw new ConflictException("Recognition acknowledgment outcome unavailable.");
 return {id:created.rows[0].id,title:snapshot.title,description:snapshot.description};
}
