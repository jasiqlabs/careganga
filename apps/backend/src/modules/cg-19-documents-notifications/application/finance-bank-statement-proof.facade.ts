import {BadRequestException,ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** CG-19 file authority. CG-09 reviewer can consume only a frozen, clean,
 * same-bank-item version; the original file stays within CG-19 storage.
 */
@Injectable()
export class FinanceBankStatementProofFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 async guardForReviewer(client:PoolClient,actor:VerifiedFoundationActor,
  input:{reconciliationRef:string;fileRef:string;fileVersion:number}){
  await this.identity.assertCurrent(client,actor,"documents.files.view");
  if(!UUID.test(input.reconciliationRef)||!UUID.test(input.fileRef)||
   !Number.isSafeInteger(input.fileVersion)||input.fileVersion<1)
   throw new BadRequestException({code:"FINANCE_RECONCILIATION_EVIDENCE_INVALID"});
  const actual=await client.query(
   "SELECT f.id FROM cg19_stored_file f JOIN cg19_upload_intent i "+
   "ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
   "WHERE f.id=$1 AND f.realm_id=$2 AND f.reconciliation_id=$3 AND "+
   "f.revision=$4 AND f.owner_kind='CG09_BANK_STATEMENT' "+
   "AND i.owner_kind='CG09_BANK_STATEMENT' AND i.reconciliation_id=$3 "+
   "AND i.status='VALIDATED' AND f.scan_status='CLEAN_VERIFIED' "+
   "AND f.revoked_at IS NULL FOR SHARE OF f,i",
   [input.fileRef,actor.realmId,input.reconciliationRef,input.fileVersion]);
  if(!actual.rows[0])
   throw new ConflictException({code:"FINANCE_RECONCILIATION_EVIDENCE_INVALID"});
 }
}
