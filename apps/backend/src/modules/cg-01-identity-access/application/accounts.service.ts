import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { RecoveryDelivery } from "../infrastructure/recovery-delivery";
import { SessionService } from "./session.service";
import type { VerifiedFoundationActor } from "../public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const conflict=(code:string)=>new ConflictException({code});
const checkRef=(value:unknown):string=>{
  if(typeof value!=="string"||!UUID.test(value))throw new BadRequestException("Check the selected account or role");
  return value;
};
const checkRevision=(value:unknown):number=>{
  if(!Number.isSafeInteger(value)||Number(value)<1||Number(value)>2147483647)
    throw new BadRequestException("Refresh the account before saving");
  return Number(value);
};
type AccountRow={
  id:string;realm_id:string;display_name:string;normalized_email:string;status:string;
  revision:number;access_version:string;role_id:string|null;role_name:string|null;
  assigned_at:Date|null;delivery_status:string|null;is_protected:boolean|null;
};
type CommandResult={accountRef:string;revision:number;status:string;message:string};
type AccountChange={requestKey:string;expectedRevision:number};
type Invite={displayName:string;email:string;roleRef:string;requestKey:string};
@Injectable()
export class AccountsService {
  constructor(@Inject(DATABASE) private readonly db:Pool,
    private readonly sessions:SessionService,private readonly delivery:RecoveryDelivery){}

  private async actor(bearer:string,permission:string){
    return this.sessions.requireAction(bearer,permission);
  }
  async list(bearer:string,query:{search?:string;status?:string;roleRef?:string;offset?:number;limit?:number}={}){
    const actor=await this.actor(bearer,"accounts.view");
    const search=(query.search??"").trim().toLowerCase();
    const status=query.status??"all",roleRef=query.roleRef??"";
    const offset=query.offset??0,limit=query.limit??20;
    if(search.length>80||!["all","INVITED","ACTIVE","SUSPENDED","DEACTIVATED"].includes(status)
       ||(roleRef!==""&&!UUID.test(roleRef))||!Number.isInteger(offset)||offset<0||offset>10000
       ||!Number.isInteger(limit)||limit<1||limit>50)throw new BadRequestException();
    // Escape LIKE wildcards: user searches must not bypass bounded data projections.
    const term=search?"%"+search.replace(/[\\%_]/g,"\\$&")+"%":"";
    const conditions=String.raw`a.realm_id=$1 AND ($2='' OR lower(a.display_name) LIKE $2 OR a.normalized_email LIKE $2)
      AND ($3='all' OR a.status=$3)
      AND ($4='' OR EXISTS(SELECT 1 FROM account_role xr
         WHERE xr.account_id=a.id AND xr.role_id=$4::uuid AND xr.revoked_at IS NULL))`;
    const params=[actor.realmId,term,status,roleRef];
    const records=await this.db.query<{
      id:string;display_name:string;normalized_email:string;status:string;revision:number;
      role_id:string|null;role_name:string|null;assigned_at:Date|null;delivery_status:string|null;
    }>(String.raw`
      SELECT a.id,a.display_name,a.normalized_email,a.status,a.revision,
        ar.role_id,r.name AS role_name,ar.assigned_at,
        (SELECT c.delivery_status FROM auth_challenge c
          WHERE c.account_id=a.id AND c.kind='INVITATION'
          ORDER BY c.created_at DESC,c.id DESC LIMIT 1) AS delivery_status
      FROM account a
      LEFT JOIN LATERAL(
        SELECT role_id,assigned_at FROM account_role
        WHERE account_id=a.id AND realm_id=a.realm_id AND revoked_at IS NULL
        LIMIT 1) ar ON true
      LEFT JOIN role r ON r.id=ar.role_id
      WHERE ${conditions}
      ORDER BY a.display_name,a.id LIMIT $5 OFFSET $6`,[...params,limit,offset]);
    const count=await this.db.query<{n:string}>(String.raw`
      SELECT count(*)::text AS n FROM account a WHERE ${conditions} `,params);
    const summary=await this.db.query<{total:string;active:string;invited:string;suspended:string;deactivated:string}>(String.raw`
      SELECT count(*)::text total,
       count(*) FILTER(WHERE status='ACTIVE')::text active,
       count(*) FILTER(WHERE status='INVITED')::text invited,
       count(*) FILTER(WHERE status='SUSPENDED')::text suspended,
       count(*) FILTER(WHERE status='DEACTIVATED')::text deactivated
      FROM account WHERE realm_id=$1`,[actor.realmId]);
    const m=summary.rows[0];
    return {accounts:records.rows.map(r=>({
      accountRef:r.id,displayName:r.display_name,email:r.normalized_email,
      status:r.status,revision:Number(r.revision),
      roleRef:r.role_id,roleName:r.role_name,assignedAt:r.assigned_at?.toISOString()??null,
      deliveryStatus:r.delivery_status
    })),total:Number(count.rows[0].n),offset,limit,summary:{
      total:Number(m.total),active:Number(m.active),invited:Number(m.invited),
      suspended:Number(m.suspended),deactivated:Number(m.deactivated)
    }};
  }
  async options(bearer:string,search=""){
    let actor:VerifiedFoundationActor;
    try{actor=await this.actor(bearer,"accounts.select");}
    catch(e){if(!(e instanceof ForbiddenException))throw e;actor=await this.actor(bearer,"roles.assign");}
    if(typeof search!=="string"||search.length>80)throw new BadRequestException();
    const term=search.trim().toLowerCase().replace(/[\\%_]/g,"\\$&");
    const result=await this.db.query<{id:string;display_name:string}>(String.raw`
      SELECT a.id,a.display_name FROM account a WHERE a.realm_id=$1 AND a.status IN('ACTIVE','INVITED')
      AND NOT EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
        WHERE ar.account_id=a.id AND ar.revoked_at IS NULL AND r.is_protected)
      AND ($2='' OR lower(a.display_name) LIKE $2)
      ORDER BY a.display_name,a.id LIMIT 30`,
      [actor.realmId,term?"%"+term+"%":""]);
    return {options:result.rows.map(x=>({value:x.id,label:x.display_name,context:"Foundation"}))};
  }

  private async authorize(client:PoolClient,actor:VerifiedFoundationActor,permission:string){
    const current=await client.query<{protected_role:boolean;has_grant:boolean}>(String.raw`
      SELECT r.is_protected AS protected_role,
        EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id AND g.capability_key=$4) AS has_grant
      FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
        AND a.access_version=s.account_access_version AND a.realm_id=$3
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active
      WHERE s.id=$1 AND a.id=$2 AND s.revoked_at IS NULL AND s.expires_at>now()
        AND s.last_seen_at>now()-interval '30 minutes' AND s.mfa_verified_at IS NOT NULL
      FOR SHARE OF s,a,ar,r`,[actor.activeSessionId,actor.accountId,actor.realmId,permission]);
    if(!current.rowCount||(!current.rows[0].protected_role&&!current.rows[0].has_grant))
      throw new ForbiddenException("Access is no longer available");
  }

  private async command(client:PoolClient,actor:VerifiedFoundationActor,action:"INVITE"|"ASSIGN"|"REVOKE"|"STATUS",
      requestKey:string,payload:unknown):Promise<{id:string|null;replay:CommandResult|null}>{
    const requestHash=digest(JSON.stringify(payload));
    const r=await client.query<{id:string}>(String.raw`
      INSERT INTO account_command(realm_id,actor_account_id,action,request_key,request_digest)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(actor_account_id,action,request_key) DO NOTHING
      RETURNING id`,[actor.realmId,actor.accountId,action,requestKey,requestHash]);
    if(r.rowCount)return {id:r.rows[0].id,replay:null};
    const old=await client.query<{target_account_id:string;result_revision:number;result_status:string;request_digest:string}>(String.raw`
      SELECT target_account_id,result_revision,result_status,request_digest
      FROM account_command WHERE actor_account_id=$1 AND action=$2 AND request_key=$3 FOR SHARE`,
      [actor.accountId,action,requestKey]);
    if(!old.rowCount||old.rows[0].request_digest!==requestHash||!old.rows[0].target_account_id)
      throw conflict("REPLAY_CONFLICT");
    return {id:null,replay:{accountRef:old.rows[0].target_account_id,
      revision:old.rows[0].result_revision,status:old.rows[0].result_status,
      message:"Previously confirmed. Check the latest account state."}};
  }
  private async audit(client:PoolClient,actor:VerifiedFoundationActor,target:string,action:string,
      displayName:string,correlationRef:string){
    await client.query(String.raw`
      INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,action_key,outcome,
        safe_context,correlation_ref) VALUES($1,$2,$3,$4,'SUCCESS',$5::jsonb,$6)`,
      [actor.realmId,actor.accountId,target,action,JSON.stringify({targetDisplay:displayName.slice(0,160)}),correlationRef]);
  }
  private async perform(bearer:string,permission:string,action:"INVITE"|"ASSIGN"|"REVOKE"|"STATUS",
    requestKey:string,payload:unknown,correlationRef:string,
    work:(client:PoolClient,actor:VerifiedFoundationActor)=>Promise<{
      accountRef:string;revision:number;status:string;displayName:string;inviteToken?:string;contact?:string;
    }>):Promise<CommandResult>{
    checkRef(requestKey);
    const actor=await this.actor(bearer,permission);
    const client=await this.db.connect();
    let delivery: {token:string;contact:string;id:string}|null=null;
    try{
      await client.query("BEGIN");
      await this.authorize(client,actor,permission);
      const command=await this.command(client,actor,action,requestKey,payload);
      if(command.replay){await client.query("COMMIT");return command.replay;}
      const result=await work(client,actor);
      await this.audit(client,actor,result.accountRef,"identity.account."+action.toLowerCase(),
        result.displayName,correlationRef);
      await client.query(String.raw`
        UPDATE account_command SET target_account_id=$2,result_revision=$3,result_status=$4 WHERE id=$1`,
        [command.id,result.accountRef,result.revision,result.status]);
      await client.query("COMMIT");
      if(result.inviteToken&&result.contact) delivery={
        token:result.inviteToken,contact:result.contact,id:result.accountRef
      };
      // Persisted outcome is authoritative. Provider failure never reverses the invite.
      if(delivery){
        try{
          const sent=await this.delivery.submitInvitation(delivery.contact,delivery.token);
          await this.db.query(String.raw`
            UPDATE auth_challenge SET delivery_status=$2,delivery_attempts=1,
            provider_accepted_at=CASE WHEN $2='PROVIDER_ACCEPTED' THEN now() ELSE NULL END
            WHERE account_id=$1 AND kind='INVITATION' AND consumed_at IS NULL
              AND delivery_status='PENDING'`,[delivery.id,sent]);
        }catch{ /* Delivery outcome may be unknown; stored invite remains pending. */ }
      }
      return {accountRef:result.accountRef,revision:result.revision,status:result.status,
        message:delivery?"Invitation saved. Email provider delivery is unconfirmed.":
          "Account change confirmed."};
    }catch(e){
      try{await client.query("ROLLBACK");}catch{/* outcome may be committed; never hide prior error */}
      if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
        throw conflict("DUPLICATE_ACCOUNT_OR_ASSIGNMENT");
      throw e;
    }finally{client.release();}
  }

  private async eligibleRole(client:PoolClient,roleRef:string,realmId:string){
    const selected=await client.query<{id:string}>(String.raw`
      SELECT r.id FROM role r WHERE r.id=$1 AND r.realm_id=$2
        AND r.active AND NOT r.is_protected
        AND NOT EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id
          AND g.capability_key IN ('roles.manage','identity.security-policy.manage'))
      FOR SHARE OF r`,[roleRef,realmId]);
    if(!selected.rowCount)throw new ForbiddenException("Choose an eligible custom role");
  }
  async invite(bearer:string,input:Invite,correlationRef:string):Promise<CommandResult>{
    if(!input||typeof input!=="object")throw new BadRequestException();
    const displayName=typeof input.displayName==="string"?input.displayName.trim().replace(/\s+/g," "):"";
    const email=typeof input.email==="string"?input.email.trim().toLowerCase():"";
    if(displayName.length<2||displayName.length>160||email.length>254||!EMAIL.test(email))
      throw new BadRequestException("Check the staff name and work email");
    const roleRef=checkRef(input.roleRef);
    // Explicit role selection is a separate authority from account creation.
    await this.actor(bearer,"roles.assign");
    return this.perform(bearer,"accounts.invite","INVITE",input.requestKey,
      {displayName,email,roleRef},correlationRef,async(client,actor)=>{
      await this.authorize(client,actor,"roles.assign");
      await this.eligibleRole(client,roleRef,actor.realmId);
      const created=await client.query<{id:string;revision:number}>(String.raw`
        INSERT INTO account(realm_id,display_name,normalized_email,status)
        VALUES($1,$2,$3,'INVITED') RETURNING id,revision`,
        [actor.realmId,displayName,email]);
      const id=created.rows[0].id;
      await client.query(String.raw`
        INSERT INTO account_role(account_id,role_id,realm_id,assigned_by)
        VALUES($1,$2,$3,$4)`,[id,roleRef,actor.realmId,actor.accountId]);
      const token=randomBytes(32).toString("base64url");
      await client.query(String.raw`
        INSERT INTO auth_challenge(account_id,kind,digest,request_key,expires_at)
        VALUES($1,'INVITATION',$2,$3,now()+interval '24 hours')`,
        [id,digest(token),digest("invite:"+input.requestKey)]);
      return {accountRef:id,revision:created.rows[0].revision,
        status:"INVITED",displayName,inviteToken:token,contact:email};
    });
  }
  private async lockTarget(client:PoolClient,actor:VerifiedFoundationActor,targetRef:string){
    const r=await client.query<AccountRow>(String.raw`
      SELECT a.*,ar.role_id,r.name AS role_name,r.is_protected,ar.assigned_at
      FROM account a
      LEFT JOIN LATERAL(SELECT role_id,assigned_at FROM account_role
        WHERE account_id=a.id AND realm_id=a.realm_id AND revoked_at IS NULL LIMIT 1) ar ON true
      LEFT JOIN role r ON r.id=ar.role_id
      WHERE a.id=$1 AND a.realm_id=$2 FOR UPDATE OF a`,[targetRef,actor.realmId]);
    if(!r.rowCount)throw new NotFoundException("Account was not found");
    const row=r.rows[0];
    if(row.is_protected||row.id===actor.accountId)throw new ForbiddenException("Protected accounts cannot be changed here");
    return row;
  }
  async assign(bearer:string,targetRef:string,input:AccountChange&{roleRef:string},
    correlationRef:string):Promise<CommandResult>{
    const target=checkRef(targetRef),roleRef=checkRef(input.roleRef),expected=checkRevision(input.expectedRevision);
    return this.perform(bearer,"roles.assign","ASSIGN",input.requestKey,
      {target,roleRef,expected},correlationRef,async(client,actor)=>{
        const account=await this.lockTarget(client,actor,target);
        if(account.status==="DEACTIVATED")throw new ForbiddenException("Deactivated accounts cannot be assigned");
        if(account.revision!==expected)throw conflict("STALE_ACCOUNT");
        await this.eligibleRole(client,roleRef,actor.realmId);
        if(account.role_id===roleRef)throw conflict("ROLE_ALREADY_ASSIGNED");
        await client.query(String.raw`
          UPDATE account_role SET revoked_at=now(),revision=revision+1
          WHERE account_id=$1 AND realm_id=$2 AND revoked_at IS NULL`,[target,actor.realmId]);
        await client.query(String.raw`
          INSERT INTO account_role(account_id,role_id,realm_id,assigned_by)
          VALUES($1,$2,$3,$4)`,[target,roleRef,actor.realmId,actor.accountId]);
        const updated=await this.bump(client,target);
        return {accountRef:target,revision:updated,status:account.status,displayName:account.display_name};
      });
  }
  async revoke(bearer:string,targetRef:string,input:AccountChange,correlationRef:string){
    const target=checkRef(targetRef),expected=checkRevision(input.expectedRevision);
    return this.perform(bearer,"roles.assign","REVOKE",input.requestKey,
      {target,expected},correlationRef,async(client,actor)=>{
      const account=await this.lockTarget(client,actor,target);
      if(account.revision!==expected)throw conflict("STALE_ACCOUNT");
      if(!account.role_id)throw conflict("ROLE_ALREADY_REVOKED");
      await client.query(String.raw`
        UPDATE account_role SET revoked_at=now(),revision=revision+1
        WHERE account_id=$1 AND realm_id=$2 AND revoked_at IS NULL`,[target,actor.realmId]);
      const rev=await this.bump(client,target);
      return {accountRef:target,revision:rev,status:account.status,displayName:account.display_name};
    });
  }
  async status(bearer:string,targetRef:string,input:AccountChange&{status:string},
    correlationRef:string){
    const target=checkRef(targetRef),expected=checkRevision(input.expectedRevision);
    if(!["ACTIVE","SUSPENDED","DEACTIVATED"].includes(input.status))throw new BadRequestException();
    return this.perform(bearer,"accounts.status.manage","STATUS",input.requestKey,
      {target,expected,status:input.status},correlationRef,async(client,actor)=>{
      const account=await this.lockTarget(client,actor,target);
      if(account.revision!==expected)throw conflict("STALE_ACCOUNT");
      if(account.status==="INVITED"||account.status==="DEACTIVATED"&&input.status!=="DEACTIVATED")
        throw new ForbiddenException("This account is not eligible for that status change");
      if(account.status===input.status)throw conflict("ACCOUNT_ALREADY_IN_STATUS");
      const update=await client.query<{revision:number}>(String.raw`
        UPDATE account SET status=$2,revision=revision+1,access_version=access_version+1,
          updated_at=now() WHERE id=$1 RETURNING revision`,[target,input.status]);
      await client.query("UPDATE auth_session SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL",[target]);
      return {accountRef:target,revision:update.rows[0].revision,
        status:input.status,displayName:account.display_name};
    });
  }
  private async bump(client:PoolClient,id:string):Promise<number>{
    const x=await client.query<{revision:number}>(String.raw`
      UPDATE account SET revision=revision+1,access_version=access_version+1,
        updated_at=now() WHERE id=$1 RETURNING revision`,[id]);
    await client.query("UPDATE auth_session SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL",[id]);
    return x.rows[0].revision;
  }
}
