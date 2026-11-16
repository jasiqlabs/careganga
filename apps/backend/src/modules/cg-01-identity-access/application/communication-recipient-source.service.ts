import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";

/** CG-01 owns all Foundation recipient identity/contact verification.
 * CG-19 may read this projection but never updates account verification
 * fields or trusts a browser-provided address/number.
 */
export type FoundationRecipient=Readonly<{
  accountRef:string;realmRef:string;displayName:string;active:boolean;
  email:string|null;emailVerified:boolean;
  mobile:string|null;mobileVerified:boolean;
}>;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
@Injectable()
export class CommunicationRecipientSource{
  constructor(@Inject(DATABASE)private readonly db:Pool){}
  async get(client:PoolClient,realm:string,account:string):
    Promise<FoundationRecipient|null>{
    if(!UUID.test(realm)||!UUID.test(account))
      throw new BadRequestException("Invalid recipient");
    const out=await client.query<{
      id:string;realm_id:string;display_name:string;normalized_email:string;
      contact_phone:string|null;email_verified_at:Date|null;
      contact_phone_verified_at:Date|null;status:string
    }>(`
      SELECT a.id,a.realm_id,a.display_name,a.normalized_email,
        a.contact_phone,a.email_verified_at,a.contact_phone_verified_at,a.status
      FROM account a JOIN access_realm root ON root.id=a.realm_id
      WHERE a.id=$1 AND a.realm_id=$2 AND root.realm_key='FOUNDATION_ROOT'
      FOR SHARE OF a
    `,[account,realm]);
    const row=out.rows[0];if(!row)return null;
    return {accountRef:row.id,realmRef:row.realm_id,
      displayName:row.display_name,active:row.status==="ACTIVE",
      email:row.email_verified_at?row.normalized_email:null,
      emailVerified:!!row.email_verified_at,
      mobile:row.contact_phone_verified_at?row.contact_phone:null,
      mobileVerified:!!row.contact_phone_verified_at};
  }
  /** Identity-owned eligible support-agent projection. Neither CG-19 nor the
   * browser guesses account eligibility from a broad account dropdown.
   */
  async supportAgentOptions(client:PoolClient,realm:string,search:string,max=30):
    Promise<Array<{value:string;label:string}>>{
    if(!UUID.test(realm)||search.length>70||max<1||max>30)
      throw new BadRequestException("Check permitted support agents");
    const found=await client.query<{id:string;display_name:string}>(`
      SELECT a.id,a.display_name FROM account a
      JOIN access_realm root ON root.id=a.realm_id
        AND root.realm_key='FOUNDATION_ROOT'
      WHERE a.realm_id=$1 AND a.status='ACTIVE'
        AND a.display_name ILIKE '%'||$2||'%'
        AND EXISTS (
          SELECT 1 FROM account_role ar JOIN role rl ON rl.id=ar.role_id
            AND rl.realm_id=a.realm_id AND rl.active
          WHERE ar.account_id=a.id AND ar.realm_id=a.realm_id
            AND ar.revoked_at IS NULL AND
            (rl.is_protected OR EXISTS (
              SELECT 1 FROM role_grant g WHERE g.role_id=rl.id
                AND g.capability_key='support.cases.view'))
        )
      ORDER BY a.display_name,a.id LIMIT $3
    `,[realm,search.trim(),max]);
    return found.rows.map(x=>({value:x.id,label:x.display_name}));
  }
  async isSupportAgent(client:PoolClient,realm:string,account:string):Promise<boolean>{
    if(!UUID.test(realm)||!UUID.test(account))
      throw new BadRequestException("Choose a permitted support operator");
    const eligible=await client.query(`
      SELECT 1 FROM account a
      JOIN access_realm root ON root.id=a.realm_id
        AND root.realm_key='FOUNDATION_ROOT'
      WHERE a.id=$1 AND a.realm_id=$2 AND a.status='ACTIVE'
        AND EXISTS(
          SELECT 1 FROM account_role ar JOIN role rl ON rl.id=ar.role_id
            AND rl.realm_id=a.realm_id AND rl.active
          WHERE ar.account_id=a.id AND ar.realm_id=a.realm_id
            AND ar.revoked_at IS NULL AND
            (rl.is_protected OR EXISTS(
              SELECT 1 FROM role_grant g WHERE g.role_id=rl.id
                AND g.capability_key='support.cases.view'))
        ) FOR SHARE OF a
    `,[account,realm]);
    return !!eligible.rowCount;
  }
  async audience(client:PoolClient,realm:string,
    kind:"ALL_ACTIVE"|"ROLE"|"INDIVIDUAL",ref:string|null,
    max=1000):Promise<string[]>{
    if(!UUID.test(realm)||((kind==="ROLE"||kind==="INDIVIDUAL")&&!ref))
      throw new BadRequestException("Invalid Foundation audience");
    let rows:{id:string}[];
    if(kind==="INDIVIDUAL"){
      const q=await client.query<{id:string}>(`
        SELECT a.id FROM account a JOIN access_realm ar ON ar.id=a.realm_id
        WHERE a.id=$1 AND a.realm_id=$2 AND a.status='ACTIVE'
          AND ar.realm_key='FOUNDATION_ROOT'
      `,[ref,realm]);rows=q.rows;
    }else if(kind==="ROLE"){
      const q=await client.query<{id:string}>(`
        SELECT a.id FROM account a JOIN account_role assignment
          ON assignment.account_id=a.id AND assignment.realm_id=a.realm_id
          AND assignment.revoked_at IS NULL
        JOIN role rl ON rl.id=assignment.role_id AND rl.realm_id=a.realm_id
          AND rl.active
        JOIN access_realm ar ON ar.id=a.realm_id AND ar.realm_key='FOUNDATION_ROOT'
        WHERE a.realm_id=$1 AND a.status='ACTIVE' AND rl.id=$2
        ORDER BY a.id LIMIT $3
      `,[realm,ref,max+1]);rows=q.rows;
    }else{
      const q=await client.query<{id:string}>(`
        SELECT a.id FROM account a JOIN access_realm ar ON ar.id=a.realm_id
        WHERE a.realm_id=$1 AND a.status='ACTIVE' AND ar.realm_key='FOUNDATION_ROOT'
        ORDER BY a.id LIMIT $2
      `,[realm,max+1]);rows=q.rows;
    }
    if(rows.length>max)throw new BadRequestException("Audience exceeds the 1000-recipient limit");
    return rows.map(row=>row.id);
  }
}
