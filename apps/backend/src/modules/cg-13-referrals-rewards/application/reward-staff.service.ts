import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from
 "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {InventoryCatalogService} from
 "../../cg-12-inventory-suppliers/application/inventory-catalog.service";
import {prepareRewardIssueDraft} from
 "../../cg-12-inventory-suppliers/application/reward-stock-source";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** CG13 authorized staff bridge: prepares the ORIGINAL CG12 stock_operation_draft.
 * Existing CG12 Stock Operations + CG19 clean verified movement evidence actually
 * confirm ISSUE. No new stock issue, review master, or "Delivered" flag.
 */
@Injectable()
export class RewardStaffService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly inventory:InventoryCatalogService){}
 async prepareIssue(token:string,redemptionInput:unknown){
  if(typeof redemptionInput!=="string"||!UUID.test(redemptionInput))
   throw new BadRequestException("Choose an actual physical reward request.");
  const actor=await this.sessions.requireAction(token,"inventory.stock.issue");
  const tx:PoolClient=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await tx.query("SET LOCAL lock_timeout='3s'");
   await this.identity.assertCurrent(tx,actor,"inventory.stock.issue");
   await this.identity.assertCurrent(tx,actor,"rewards.catalog.view");
   await this.identity.assertRootSelfSessionCurrent(tx,actor);
   const result=await prepareRewardIssueDraft(tx,actor,this.inventory,
    redemptionInput.toLowerCase());
   await tx.query("COMMIT");
   return {...result,notice:result.status==="CONFIRMED"?
    "The original warehouse issue was already confirmed. Recipient handover is still required.":
    "Real warehouse issue draft prepared. Open your existing Stock Operations screen to verify any required proof and confirm the original ISSUE."};
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   throw e;
  }finally{tx.release();}
 }
}
