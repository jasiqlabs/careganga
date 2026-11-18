import {ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

/** CG19-only reviewer evidence gate in the CG03 transaction; never returns bytes. */
@Injectable()
export class FinanceClaimBillSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 async guardForReviewer(tx:PoolClient,actor:VerifiedFoundationActor,input:{
  claimRef:string;claimVersion:number;fileRef:string;fileVersion:number
 }){
  await this.identity.assertCurrent(tx,actor,"documents.files.view");
  const rows=await tx.query<{id:string}>(
   "SELECT f.id FROM cg19_stored_file f JOIN cg19_upload_intent i "+
   "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.id=$1 AND f.realm_id=$2 AND f.claim_id=$3 AND f.claim_version=$4 "+
   "AND f.revision=$5 AND f.owner_kind='CG09_CLAIM' AND f.revoked_at IS NULL "+
   "AND f.scan_status='CLEAN_VERIFIED' AND i.owner_kind='CG09_CLAIM' "+
   "AND i.status='VALIDATED' FOR SHARE OF f,i",
   [input.fileRef,actor.realmId,input.claimRef,input.claimVersion,input.fileVersion]);
  if(!rows.rows[0])
   throw new ConflictException({code:"FINANCE_CLAIM_BILL_INVALID"});
 }
}
