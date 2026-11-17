import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid=(v:unknown):string=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_RECONCILIATION_INVALID",field:"reconciliationRef"});
 return v;
};
/** CG-09 source owner: CG-19 may attach scanned original statement bytes only
 * to a real pending bank match recorded by its current authorized operator.
 * CG-19 does not own the bank match, balances or reviewer decision.
 */
@Injectable()
export class FinanceBankStatementSourceFacade{
 constructor(@Inject(DATABASE) private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 async guardPending(tx:PoolClient,actor:VerifiedFoundationActor,ref:string){
  await this.identity.assertCurrent(tx,actor,"finance.reconciliation.manage");
  const found=await tx.query<{id:string}>(
   "SELECT id FROM finance_bank_reconciliation WHERE id=$1 AND root_realm_id=$2 "+
   "AND status='PENDING' AND recorded_by=$3 FOR SHARE",
   [valid(ref),actor.realmId,actor.accountId]);
  if(!found.rows[0])
   throw new ConflictException({code:"FINANCE_RECONCILIATION_CONFLICT"});
 }
 async pendingForUploader(bearer:string,ref:string){
  const actor=await this.sessions.requireAction(bearer,"finance.reconciliation.manage");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.guardPending(tx,actor,ref);
   await tx.query("COMMIT");
   return {reconciliationRef:valid(ref)};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
}
