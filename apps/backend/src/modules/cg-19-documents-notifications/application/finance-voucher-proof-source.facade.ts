import {ConflictException,Inject,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

/** CG-19 owns the actual clean/revoked file status for Finance reviewers.
 * This narrow read-only contract uses the reviewer's existing transaction;
 * no CG-03 code writes file metadata, and no object bytes cross this facade.
 */
@Injectable()
export class FinanceVoucherProofSourceFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 async guardForReviewer(client:PoolClient,actor:VerifiedFoundationActor,input:{
  voucherRef:string;voucherVersion:number;fileRef:string;fileVersion:number
 }){
  await this.identity.assertCurrent(client,actor,"documents.files.view");
  const clean=await client.query<{id:string}>(`
   SELECT f.id FROM cg19_stored_file f
   JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id
   WHERE f.id=$1 AND f.realm_id=$2 AND f.voucher_id=$3 AND f.voucher_version=$4
    AND f.revision=$5 AND f.owner_kind='CG09_VOUCHER'
    AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED'
    AND i.owner_kind='CG09_VOUCHER' AND i.status='VALIDATED'
   FOR SHARE OF f,i`,
   [input.fileRef,actor.realmId,input.voucherRef,input.voucherVersion,input.fileVersion]);
  if(!clean.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_EVIDENCE_INVALID"});
 }
}
