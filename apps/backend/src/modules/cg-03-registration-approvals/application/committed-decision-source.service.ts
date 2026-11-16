import {Inject,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import type {Pool} from "pg";
export type CommittedDecisionEvent=Readonly<{
  eventRef:string;realmRef:string;caseRef:string;recipientRef:string;
  action:"APPROVE"|"RETURN"|"REJECT"|"FORWARD";
  committedAt:Date;acceptedRevision:number
}>;
/** CG-03-owned source projection. Notification recovery reads ONLY original
 * immutable committed reviewer decisions; no guessed case/status or fake events.
 * Never exposes reviewer remarks, contact, role name or private case identity.
 */
@Injectable()
export class CommittedDecisionSource{
  constructor(@Inject(DATABASE)private readonly db:Pool){}
  async after(client:PoolClient,realm:string,at:Date,id:string,limit=25):
    Promise<CommittedDecisionEvent[]>{
    const result=await client.query<{
      id:string;realm_id:string;case_id:string;proposer_id:string;
      action:"APPROVE"|"RETURN"|"REJECT"|"FORWARD";
      created_at:Date;accepted_case_revision:number
    }>(`
      SELECT d.id,d.realm_id,d.case_id,c.proposer_id,
        d.action,d.created_at,d.accepted_case_revision
      FROM cg03_case_decision d
      JOIN cg03_case c ON c.id=d.case_id AND c.realm_id=d.realm_id
      JOIN access_realm root ON root.id=d.realm_id AND root.realm_key='FOUNDATION_ROOT'
      WHERE d.realm_id=$1 AND
        (d.created_at,d.id)>($2::timestamptz,$3::uuid)
      ORDER BY d.created_at,d.id LIMIT $4
    `,[realm,at,id,Math.min(25,Math.max(1,limit))]);
    return result.rows.map(row=>({
      eventRef:row.id,realmRef:row.realm_id,caseRef:row.case_id,
      recipientRef:row.proposer_id,action:row.action,
      committedAt:row.created_at,acceptedRevision:row.accepted_case_revision
    }));
  }
  /** The after-commit wake-up is PostgreSQL NOTIFY. Delivery is best effort,
   * while the CG-19 durable decision cursor is authoritative for catch-up.
   * Any listener treats the payload solely as a hint, not a grant.
   */
  static notifyCommand(realmRef:string){
    return {text:"SELECT pg_notify('cg19_decision_committed',$1)",
      values:[realmRef]};
  }
}
