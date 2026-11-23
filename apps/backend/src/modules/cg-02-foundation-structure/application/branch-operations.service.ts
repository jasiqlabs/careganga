import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "./branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import type {BranchFileVersion,ReadProof} from "./branch-lifecycle.service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(x:unknown)=>{
 if(typeof x!=="string"||!UUID.test(x))throw new BadRequestException("Choose an existing Foundation record");
 return x;
};
const text=(x:unknown,max:number,required=false):string=>{
 if(x===null||x===undefined||x===""){if(required)throw new BadRequestException("Complete the required information");return "";}
 if(typeof x!=="string")throw new BadRequestException("Check the business information");
 const s=x.trim().replace(/\s+/g," ");
 if(s.length>max||required&&s.length<2)
   throw new BadRequestException("Check the business information");
 return s;
};
const asObject=(x:unknown):Record<string,unknown>=>{
 if(!x||typeof x!=="object"||Array.isArray(x))throw new BadRequestException("Check the Foundation form");
 return x as Record<string,unknown>;
};
const version=(x:unknown)=>{
 if(!Number.isSafeInteger(x)||Number(x)<1||Number(x)>2147483646)
   throw new BadRequestException("Refresh the current Foundation information");
 return Number(x);
};
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const date=(x:unknown):string|null=>{
 if(x===null||x===undefined||x==="")return null;
 if(typeof x!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x)||
   Number.isNaN(Date.parse(x+"T00:00:00Z"))||
   new Date(x+"T00:00:00Z").toISOString().slice(0,10)!==x)
   throw new BadRequestException("Enter a valid date");
 return x;
};
const coordinate=(x:unknown,min:number,max:number):number|null=>{
 if(x===null||x===undefined||x==="")return null;
 if(typeof x!=="number"||!Number.isFinite(x)||x<min||x>max)
   throw new BadRequestException("Enter valid location coordinates");
 return x;
};
type Branch={
 id:string;root_realm_id:string;registration_id:string;approved_submission_id:string;
 branch_code:string;name:string;branch_type:string;opening_date:string|null;
 geography_area_id:string;postal_address:string;pin_code:string|null;latitude:string|null;
 longitude:string|null;official_phone:string;official_email:string;
 manager_account_ref:string;evidence_versions:BranchFileVersion[];
 status:"ACTIVE"|"INACTIVE"|"CLOSED";version:number;updated_at:Date;
};
type Dept={id:string;root_realm_id:string;branch_id:string;scope_kind:string;
 kind:string;name:string;description:string;opening_date:string|Date|null;
 geography_area_id:string|null;parent_department_id:string|null;
 head_account_ref:string|null;active:boolean;version:number};
type Change={recordRef:string;version:number;status:"CONFIRMED";message:string};
type Kind="BRANCH"|"DEPARTMENT"|"PARTICIPANT"|"LINK";
type Action="UPDATE_BRANCH"|"CHANGE_BRANCH_STATUS"|
 "CREATE_BRANCH_DEPARTMENT"|"UPDATE_BRANCH_DEPARTMENT"|
 "LINK_DEPARTMENT"|"UNLINK_DEPARTMENT"|
 "ASSIGN_BRANCH_PARTICIPANT"|"END_BRANCH_PARTICIPANT";
@Injectable()
export class BranchOperationsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
   private readonly sessions:SessionService,
   private readonly identity:FoundationStructureIdentityFacade,
   private readonly branches:BranchSourceFacade){}
 private async root(bearer:string){
   try{await this.sessions.requireAction(bearer,"foundation.branches.admin");return true;}
   catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 private safeError(err:unknown):never{
   if(err&&typeof err==="object"&&"code" in err){
     if(err.code==="23505")throw new ConflictException("This Foundation record already exists or changed");
     if(err.code==="23503"||err.code==="23514")
       throw new BadRequestException("Choose eligible current Foundation records");
   }
   throw err;
 }
 private async branch(client:PoolClient,actor:VerifiedFoundationActor,
     branchRef:string,admin:boolean,write=false):Promise<Branch>{
   const row=await client.query<Branch>(`
     SELECT * FROM branch WHERE id=$1 AND root_realm_id=$2
     ${write?"FOR UPDATE":"FOR SHARE"}
   `,[id(branchRef),actor.realmId]);
   if(!row.rows[0])throw new NotFoundException("Operating branch unavailable");
   if(!admin&&row.rows[0].manager_account_ref!==actor.accountId)
    await this.branches.requireAssignedStaffBranch(client,actor,branchRef);
   return row.rows[0];
 }
 private async command(client:PoolClient,actor:VerifiedFoundationActor,action:Action,
     key:string,payload:unknown):Promise<{id:string|null;original:Change|null}>{
   const requestKey=id(key),requestDigest=digest(payload);
   const created=await client.query<{id:string}>(`
     INSERT INTO branch_operation_command(root_realm_id,actor_ref,action,request_key,request_digest)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(root_realm_id,actor_ref,action,request_key) DO NOTHING RETURNING id
   `,[actor.realmId,actor.accountId,action,requestKey,requestDigest]);
   if(created.rows[0])return {id:created.rows[0].id,original:null};
   const prior=await client.query<{request_digest:string;result_ref:string|null;result_version:number|null}>(`
     SELECT request_digest,result_ref,result_version FROM branch_operation_command
     WHERE root_realm_id=$1 AND actor_ref=$2 AND action=$3 AND request_key=$4 FOR SHARE
   `,[actor.realmId,actor.accountId,action,requestKey]);
   if(!prior.rows[0]||prior.rows[0].request_digest!==requestDigest||
      !prior.rows[0].result_ref||prior.rows[0].result_version===null)
     throw new ConflictException("A different operation already uses the same request");
   return {id:null,original:{recordRef:prior.rows[0].result_ref,
     version:prior.rows[0].result_version,status:"CONFIRMED",
     message:"Original Foundation change confirmed. Refresh to view the current record."}};
 }
 private async recorded(client:PoolClient,actor:VerifiedFoundationActor,commandRef:string,
     kind:Kind,entityRef:string,action:Action,acceptedVersion:number){
   await client.query(`
     UPDATE branch_operation_command SET result_ref=$2,result_version=$3 WHERE id=$1
   `,[commandRef,entityRef,acceptedVersion]);
   await client.query(`
     INSERT INTO branch_operation_event(
       root_realm_id,actor_ref,entity_kind,entity_ref,action,version,command_ref)
     VALUES($1,$2,$3,$4,$5,$6,$7)
   `,[actor.realmId,actor.accountId,kind,entityRef,action,acceptedVersion,commandRef]);
 }
 private async perform(bearer:string,permission:string,action:Action,branchRef:string,
   input:unknown,logic:(client:PoolClient,actor:VerifiedFoundationActor,branch:Branch)=>
      Promise<{kind:Kind;id:string;version:number}>,proof?:ReadProof):Promise<Change>{
   const payload=asObject(input),actor=await this.sessions.requireAction(bearer,permission);
   const admin=await this.root(bearer);
   const key=id(payload.requestKey);
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     await this.identity.assertCurrent(client,actor,permission);
     // Shared Foundation-root read fence serializes these writes with
     // CG-02 geography reparent/deactivation (which takes a root write lock).
     const root=await client.query(`
       SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR SHARE
     `,[actor.realmId]);
     if(!root.rowCount)throw new ForbiddenException("Foundation root is unavailable");
     // Any CG-19 proof is owner-local and runs before the branch row lock.
     if(proof)await proof(client,actor);
     // Current branch ownership is mandatory even for a replay of an old
     // accepted command. A reassigned manager cannot retrieve or retry
     // another manager's historical operation via its idempotency key.
     const current=await this.branch(client,actor,branchRef,admin,true);
     const command=await this.command(client,actor,action,key,{branchRef,...payload});
     if(command.original){await client.query("COMMIT");tx=false;return command.original;}
     const result=await logic(client,actor,current);
     await this.recorded(client,actor,command.id!,result.kind,result.id,action,result.version);
     await client.query("COMMIT");tx=false;
     return {recordRef:result.id,version:result.version,status:"CONFIRMED",
       message:"Foundation change confirmed. Refresh to see current information."};
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};return this.safeError(e);}
   finally{client.release();}
 }
 private ensureActive(branch:Branch){
   if(branch.status!=="ACTIVE")throw new ConflictException(
     "Only active branches can accept new records or changes");
 }
 private async geography(client:PoolClient,root:string,areaRef:string){
   const area=await client.query<{id:string}>(`
     SELECT id FROM geography_area WHERE id=$1 AND root_realm_id=$2
       AND status='ACTIVE' AND level='BLOCK' FOR SHARE
   `,[id(areaRef),root]);
   if(!area.rowCount)throw new BadRequestException("Choose an active branch block");
 }
 private async compatibleArea(client:PoolClient,root:string,block:string,area:string|null){
   if(!area)return;
   const ancestors=await client.query<{id:string}>(`
     WITH RECURSIVE lineage AS(
       SELECT id,parent_area_id FROM geography_area
         WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE'
       UNION ALL
       SELECT g.id,g.parent_area_id FROM geography_area g
         JOIN lineage l ON l.parent_area_id=g.id
         WHERE g.root_realm_id=$2 AND g.status='ACTIVE')
     SELECT id FROM lineage WHERE id=$3 LIMIT 1
   `,[block,root,id(area)]);
   if(!ancestors.rowCount)
     throw new BadRequestException("Choose a location within this branch's active geography");
 }
 private async departmentParent(client:PoolClient,root:string,branch:string,
     parent:string|null,exclude?:string){
   if(!parent)return;
   const rows=await client.query<Dept>(`
     SELECT * FROM department WHERE id=$1 AND root_realm_id=$2
       AND scope_kind='BRANCH' AND branch_id=$3 AND active FOR SHARE
   `,[id(parent),root,branch]);
   if(!rows.rows[0]||parent===exclude)
     throw new BadRequestException("Choose an active department in the same branch");
   if(exclude){
     const cycle=await client.query(`
       WITH RECURSIVE child AS(
         SELECT id FROM department WHERE id=$1 AND root_realm_id=$3
         UNION ALL SELECT d.id FROM department d JOIN child c
           ON d.parent_department_id=c.id WHERE d.root_realm_id=$3)
       SELECT 1 FROM child WHERE id=$2 LIMIT 1
     `,[exclude,parent,root]);
     if(cycle.rowCount)throw new ConflictException("The department would contain itself");
   }
 }
 async list(bearer:string,offset=0,status?:string,search=""){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view");
   const admin=await this.root(bearer);
   if(!Number.isInteger(offset)||offset<0||offset>50000||
     status!==undefined&&!["ACTIVE","INACTIVE","CLOSED"].includes(status)||
     typeof search!=="string"||search.length>80)
     throw new BadRequestException("Check branch list filters");
   const query=search.trim();
   const allowed=admin?[]:await this.branches.currentStaffBranchRefs(
    this.db,actor.realmId,actor.accountId);
   const [rows,count,byType]=await Promise.all([
     this.db.query<Branch & {area_name:string;manager_name:string}>(`
       SELECT b.*,geo.display_name AS area_name,person.display_name AS manager_name
       FROM branch b
       JOIN geography_area geo ON geo.id=b.geography_area_id
         AND geo.root_realm_id=b.root_realm_id
       JOIN account person ON person.id=b.manager_account_ref
         AND person.realm_id=b.root_realm_id
       WHERE b.root_realm_id=$1
         AND ($2::boolean OR b.manager_account_ref=$3 OR
          (b.status='ACTIVE' AND b.id=ANY($7::uuid[])))
         AND ($4::text IS NULL OR b.status=$4)
         AND ($5::text='' OR b.name ILIKE '%'||$5||'%'
            OR b.branch_code ILIKE '%'||$5||'%'
            OR b.branch_type ILIKE '%'||$5||'%')
       ORDER BY b.name,b.id LIMIT 50 OFFSET $6
     `,[actor.realmId,admin,actor.accountId,status??null,query,offset,allowed]),
     this.db.query<{total:number;active:number;inactive:number;closed:number}>(`
       SELECT count(*)::integer AS total,
         count(*) FILTER (WHERE status='ACTIVE')::integer AS active,
         count(*) FILTER (WHERE status='INACTIVE')::integer AS inactive,
         count(*) FILTER (WHERE status='CLOSED')::integer AS closed
       FROM branch WHERE root_realm_id=$1
         AND ($2::boolean OR manager_account_ref=$3 OR
          (status='ACTIVE' AND id=ANY($4::uuid[])))
     `,[actor.realmId,admin,actor.accountId,allowed]),
     this.db.query<{branch_type:string;total:number}>(`
       SELECT branch_type,count(*)::integer AS total
       FROM branch WHERE root_realm_id=$1
         AND ($2::boolean OR manager_account_ref=$3 OR
          (status='ACTIVE' AND id=ANY($4::uuid[])))
       GROUP BY branch_type ORDER BY total DESC,branch_type LIMIT 8
     `,[actor.realmId,admin,actor.accountId,allowed])
   ]);
   return {branches:rows.rows.map(x=>({branchRef:x.id,branchName:x.name,
       branchCode:x.branch_code,status:x.status,version:x.version,
       branchType:x.branch_type,
       openingDate:x.opening_date?new Date(x.opening_date).toISOString().slice(0,10):null,
       areaName:x.area_name,managerName:x.manager_name})),
     totals:count.rows[0]??{total:0,active:0,inactive:0,closed:0},
     branchTypes:byType.rows.map(x=>({name:x.branch_type||"Unspecified",total:x.total})),
     offset,limit:50,nextOffset:rows.rows.length===50?offset+50:null};
 }
 async exportPage(bearer:string,offset=0){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view");
   const admin=await this.root(bearer);
   if(!Number.isSafeInteger(offset)||offset<0||offset>50000)
     throw new BadRequestException("Check approved branch export page");
   const allowed=admin?[]:await this.branches.currentStaffBranchRefs(
    this.db,actor.realmId,actor.accountId);
   const data=await this.db.query<{name:string;branch_code:string;branch_type:string;
     status:string;manager:string|null;geography:string;official_phone:string;
     official_email:string}>(`
     SELECT b.name,b.branch_code,b.branch_type,b.status,
       b.official_phone,b.official_email,
       manager.display_name AS manager,geo.display_name AS geography
     FROM branch b
       JOIN account manager ON manager.id=b.manager_account_ref
         AND manager.realm_id=b.root_realm_id
       JOIN geography_area geo ON geo.id=b.geography_area_id
         AND geo.root_realm_id=b.root_realm_id
     WHERE b.root_realm_id=$1 AND
       ($2::boolean OR b.manager_account_ref=$3 OR
        (b.status='ACTIVE' AND b.id=ANY($5::uuid[])))
     ORDER BY b.name,b.id LIMIT 200 OFFSET $4
   `,[actor.realmId,admin,actor.accountId,offset,allowed]);
   const cell=(value:string|null)=>{
     const safe=String(value??"");
     const formula=/^[=+@-]/.test(safe)||[9,13].includes(safe.charCodeAt(0))?"'"+safe:safe;
     return '"'+formula.replace(/"/g,'""')+'"';
   };
   const heading=["Branch","Code","Type","Status","Manager","Location","Official phone","Official email"];
   const rows=data.rows.map(row=>[row.name,row.branch_code,row.branch_type,row.status,
     row.manager,row.geography,row.official_phone,row.official_email]);
   return {csv:[heading,...rows].map(cols=>cols.map(cell).join(",")).join("\r\n"),
     count:rows.length,nextOffset:rows.length===200?offset+200:null};
 }
 async detail(bearer:string,branchRef:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view");
   const admin=await this.root(bearer);
   const client=await this.db.connect();
   try{
     const row=await this.branch(client,actor,branchRef,admin);
     const names=await this.identity.accountLabels(client,actor,[row.manager_account_ref]);
     return {branchRef:row.id,branchName:row.name,branchCode:row.branch_code,
       branchType:row.branch_type,status:row.status,version:row.version,
       openingDate:row.opening_date,geographyRef:row.geography_area_id,
       postalAddress:row.postal_address,pinCode:row.pin_code,
       latitude:row.latitude===null?null:Number(row.latitude),
       longitude:row.longitude===null?null:Number(row.longitude),
       officialPhone:row.official_phone,officialEmail:row.official_email,
       managerRef:row.manager_account_ref,managerName:names[row.manager_account_ref]??null,
       evidenceVersions:row.evidence_versions};
   }finally{client.release();}
 }
 async revisions(bearer:string,branchRef:string,offset=0){
   await this.detail(bearer,branchRef);
   if(!Number.isInteger(offset)||offset<0||offset>50000)
     throw new BadRequestException("Check branch history page");
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view");
   const rows=await this.db.query<{branch_version:number;changed_at:Date;
     before_payload:Record<string,unknown>;after_payload:Record<string,unknown>}>(`
     SELECT branch_version,changed_at,before_payload,after_payload
     FROM branch_profile_revision WHERE root_realm_id=$1 AND branch_id=$2
     ORDER BY branch_version DESC LIMIT 30 OFFSET $3
   `,[actor.realmId,id(branchRef),offset]);
   const labelHistory=(payload:Record<string,unknown>)=>({
     branchName:typeof payload.branchName==="string"?payload.branchName:null,
     status:typeof payload.status==="string"?payload.status:
       typeof payload.currentStatus==="string"?payload.currentStatus:null,
     branchType:typeof payload.branchType==="string"?payload.branchType:null,
     openingDate:typeof payload.openingDate==="string"?payload.openingDate:null
   });
   return {history:rows.rows.map(x=>({version:x.branch_version,
     changedAt:x.changed_at.toISOString(),before:labelHistory(x.before_payload),
     after:labelHistory(x.after_payload)})),
     nextOffset:rows.rows.length===30?offset+30:null};
 }
 async update(bearer:string,branchRef:string,input:unknown,
     verifiedFiles?:readonly BranchFileVersion[],proof?:ReadProof){
   const x=asObject(input),expected=version(x.expectedVersion);
   const name=text(x.branchName,160,true),branchType=text(x.branchType,80);
   const location=id(x.geographyRef);
   const post=text(x.postalAddress,700),pin=text(x.pinCode,6);
   if(pin&&!/^[0-9]{6}$/.test(pin))
     throw new BadRequestException("Enter a six-digit PIN");
   const phone=text(x.officialPhone,80),email=text(x.officialEmail,180);
   if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
     throw new BadRequestException("Enter a valid official email");
   const manager=id(x.managerRef);
   const opening=date(x.openingDate);
   const lat=coordinate(x.latitude,-90,90),long=coordinate(x.longitude,-180,180);
   if("evidenceFiles" in x&&(!proof||!verifiedFiles))
     throw new ForbiddenException("Private evidence must be verified by the secure document service");
   if(verifiedFiles&&(!proof||!Array.isArray(verifiedFiles)))
     throw new ConflictException("Verified private file proof is required");
   return this.perform(bearer,"foundation.branches.manage","UPDATE_BRANCH",branchRef,x,
     async(client,actor,branch)=>{
       this.ensureActive(branch);
       if(branch.version!==expected)
         throw new ConflictException("The branch profile changed. Refresh first.");
       await this.geography(client,actor.realmId,location);
       // Changing block must not strand any ACTIVE department underneath
       // an incompatible area hierarchy. Use one bounded existence query.
       const stranded=await client.query(`
         WITH RECURSIVE ancestors AS (
           SELECT id,parent_area_id FROM geography_area
             WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE'
           UNION ALL
           SELECT g.id,g.parent_area_id FROM geography_area g JOIN ancestors a
             ON a.parent_area_id=g.id WHERE g.root_realm_id=$2 AND g.status='ACTIVE'
         )
         SELECT 1 FROM department d WHERE d.root_realm_id=$2
           AND d.scope_kind='BRANCH' AND d.branch_id=$3 AND d.active=true
           AND d.geography_area_id IS NOT NULL AND NOT EXISTS(
             SELECT 1 FROM ancestors a WHERE a.id=d.geography_area_id)
         LIMIT 1
       `,[location,actor.realmId,branch.id]);
       if(stranded.rowCount)
         throw new ConflictException("Move existing branch departments before changing its location");
       // Local and delegated managers may maintain branch metadata, but a
       // manager transfer needs the independent protected Foundation action.
       // Existing source checks revoke the former manager's access at commit.
       if(manager!==branch.manager_account_ref)
        await this.identity.assertCurrent(client,actor,"foundation.branches.admin");
       await this.identity.eligibleOfficeholder(client,actor,manager);
       // Versioned, verified replacements never silently remove unrelated
       // originals; exactly each replaced file category changes.
       const replacing=new Set((verifiedFiles??[]).map(x=>x.classification));
       const evidence=verifiedFiles?
         [...branch.evidence_versions.filter(x=>!replacing.has(x.classification)),
           ...verifiedFiles]:branch.evidence_versions;
       const kinds=evidence.map(x=>x.classification);
       if(!kinds.includes("REGISTRATION_PROOF")||!kinds.includes("AGREEMENT"))
         throw new ConflictException("The operating branch must retain verified required evidence");
       const before=JSON.stringify({branchName:branch.name,branchType:branch.branch_type,
         status:branch.status,openingDate:branch.opening_date,
         geographyRef:branch.geography_area_id,postalAddress:branch.postal_address,
         pinCode:branch.pin_code,latitude:branch.latitude,longitude:branch.longitude,
         officialPhone:branch.official_phone,officialEmail:branch.official_email,
         managerRef:branch.manager_account_ref});
       const updated=await client.query<{version:number}>(`
         UPDATE branch SET name=$3,normalized_name=$4,branch_type=$5,opening_date=$6,
           geography_area_id=$7,postal_address=$8,pin_code=$9,latitude=$10,longitude=$11,
           official_phone=$12,official_email=$13,manager_account_ref=$14,evidence_versions=$15::jsonb,
           version=version+1,updated_by=$16,updated_at=now()
         WHERE id=$1 AND root_realm_id=$2 AND version=$17 RETURNING version
       `,[branch.id,actor.realmId,name,name.toLowerCase(),branchType,opening,location,
         post,pin||null,lat,long,phone,email,manager,JSON.stringify(evidence),
         actor.accountId,expected]);
       if(!updated.rows[0])throw new ConflictException("The branch changed");
       const after=JSON.stringify({branchName:name,branchType,openingDate:opening,
         geographyRef:location,postalAddress:post,pinCode:pin,
         latitude:lat,longitude:long,officialPhone:phone,officialEmail:email,managerRef:manager});
       await client.query(`
         INSERT INTO branch_profile_revision(branch_id,root_realm_id,branch_version,mutation_key,
           changed_by,before_payload,after_payload,evidence_versions,approved_submission_id)
         VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)
       `,[branch.id,actor.realmId,updated.rows[0].version,id(x.requestKey),
         actor.accountId,before,after,JSON.stringify(evidence),branch.approved_submission_id]);
       return {kind:"BRANCH",id:branch.id,version:updated.rows[0].version};
     },proof);
 }
 async changeStatus(bearer:string,branchRef:string,input:unknown,proof?:ReadProof){
   const x=asObject(input),expected=version(x.expectedVersion),target=x.status;
   if(!["ACTIVE","INACTIVE","CLOSED"].includes(String(target)))
     throw new BadRequestException("Choose a valid branch status");
   // Reactivation never trusts a stale uploaded document list.
   if(target==="ACTIVE"&&!proof)
     throw new ConflictException("Private branch evidence must be reverified to reactivate");
   return this.perform(bearer,"foundation.branches.admin","CHANGE_BRANCH_STATUS",branchRef,x,
     async(client,actor,branch)=>{
       if(branch.version!==expected||branch.status==="CLOSED"||
         branch.status===target)
         throw new ConflictException("Refresh the current branch status before changing it");
       const next=target as "ACTIVE"|"INACTIVE"|"CLOSED";
       if(branch.status==="INACTIVE"&&next==="ACTIVE"){
         await this.geography(client,actor.realmId,branch.geography_area_id);
         await this.identity.eligibleOfficeholder(client,actor,branch.manager_account_ref);
       }
       const updated=await client.query<{version:number}>(`
         UPDATE branch SET status=$3,closed_at=CASE WHEN $3='CLOSED' THEN now() ELSE NULL END,
           version=version+1,updated_by=$4,updated_at=now()
         WHERE id=$1 AND root_realm_id=$2 AND version=$5 RETURNING version
       `,[branch.id,actor.realmId,next,actor.accountId,expected]);
       const details={branchName:branch.name,priorStatus:branch.status,currentStatus:next};
       await client.query(`
         INSERT INTO branch_profile_revision(branch_id,root_realm_id,branch_version,mutation_key,
           changed_by,before_payload,after_payload,evidence_versions,approved_submission_id)
         VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)
       `,[branch.id,actor.realmId,updated.rows[0].version,id(x.requestKey),actor.accountId,
         JSON.stringify({status:branch.status}),
         JSON.stringify(details),JSON.stringify(branch.evidence_versions),
         branch.approved_submission_id]);
       return {kind:"BRANCH",id:branch.id,version:updated.rows[0].version};
     },proof);
 }
 async departments(bearer:string,branchRef:string,offset=0){
   if(!Number.isSafeInteger(offset)||offset<0||offset>50000)
     throw new BadRequestException("Check branch department page");
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view"),
     admin=await this.root(bearer);
   const client=await this.db.connect();
   try{
     const branch=await this.branch(client,actor,branchRef,admin);
     const rows=await client.query<Dept>(`
       SELECT * FROM department WHERE root_realm_id=$1 AND scope_kind='BRANCH'
         AND branch_id=$2 ORDER BY name,id LIMIT 100 OFFSET $3
     `,[actor.realmId,branch.id,offset]);
     const labels=await this.identity.accountLabels(client,actor,
       rows.rows.map(x=>x.head_account_ref).filter((x):x is string=>!!x));
     return {departments:rows.rows.map(x=>({departmentRef:x.id,name:x.name,
       kind:x.kind,description:x.description,active:x.active,version:x.version,
       openingDate:x.opening_date?new Date(x.opening_date).toISOString().slice(0,10):null,
       geographyRef:x.geography_area_id,parentRef:x.parent_department_id,
       headAccountRef:x.head_account_ref,
       headDisplayName:x.head_account_ref?labels[x.head_account_ref]??null:null})),
       nextOffset:rows.rows.length===100?offset+100:null};
   }finally{client.release();}
 }
 async createDepartment(bearer:string,branchRef:string,input:unknown){
   const x=asObject(input),kind=text(x.kind,20),name=text(x.name,100,true);
   if(!["DEPARTMENT","COMMITTEE"].includes(kind))
     throw new BadRequestException("Choose a department or committee");
   const parent=x.parentRef?id(x.parentRef):null,area=x.geographyRef?id(x.geographyRef):null;
   const head=x.headAccountRef?id(x.headAccountRef):null;
   const opening=date(x.openingDate),description=text(x.description,800);
   return this.perform(bearer,"foundation.branches.manage","CREATE_BRANCH_DEPARTMENT",
     branchRef,x,async(client,actor,branch)=>{
       this.ensureActive(branch);
       await this.compatibleArea(client,actor.realmId,branch.geography_area_id,area);
       await this.departmentParent(client,actor.realmId,branch.id,parent);
       if(head)await this.identity.eligibleOfficeholder(client,actor,head);
       const created=await client.query<{id:string;version:number}>(`
         INSERT INTO department(root_realm_id,scope_kind,branch_id,kind,name,normalized_name,
           description,opening_date,geography_area_id,parent_department_id,
           head_account_ref,updated_by)
         VALUES($1,'BRANCH',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id,version
       `,[actor.realmId,branch.id,kind,name,name.toLowerCase(),description,opening,
         area,parent,head,actor.accountId]);
       return {kind:"DEPARTMENT",id:created.rows[0].id,version:created.rows[0].version};
     });
 }
 async updateDepartment(bearer:string,branchRef:string,departmentRef:string,input:unknown){
   const x=asObject(input),expected=version(x.expectedVersion);
   const name=text(x.name,100,true),description=text(x.description,800);
   const opening=date(x.openingDate);
   const parent=x.parentRef?id(x.parentRef):null,area=x.geographyRef?id(x.geographyRef):null;
   const head=x.headAccountRef?id(x.headAccountRef):null;
   const active=x.active;
   if(typeof active!=="boolean")throw new BadRequestException("Choose a department status");
   return this.perform(bearer,"foundation.branches.manage","UPDATE_BRANCH_DEPARTMENT",
     branchRef,{...x,departmentRef},async(client,actor,branch)=>{
       this.ensureActive(branch);
       const row=await client.query<Dept>(`
         SELECT * FROM department WHERE id=$1 AND root_realm_id=$2
           AND scope_kind='BRANCH' AND branch_id=$3 FOR UPDATE
       `,[id(departmentRef),actor.realmId,branch.id]);
       const previous=row.rows[0];
       if(!previous||previous.version!==expected)
         throw new ConflictException("The department changed. Refresh before saving.");
       await this.compatibleArea(client,actor.realmId,branch.geography_area_id,area);
       await this.departmentParent(client,actor.realmId,branch.id,parent,previous.id);
       if(!active&&previous.active){
         const children=await client.query(`
           SELECT 1 FROM department WHERE root_realm_id=$1 AND branch_id=$2
             AND parent_department_id=$3 AND active=true LIMIT 1
         `,[actor.realmId,branch.id,previous.id]);
         if(children.rowCount)
           throw new ConflictException("Move active subdepartments before deactivating this department");
       }
       if(head)await this.identity.eligibleOfficeholder(client,actor,head);
       const result=await client.query<{version:number}>(`
         UPDATE department SET name=$3,normalized_name=$4,description=$5,
           geography_area_id=$6,parent_department_id=$7,head_account_ref=$8,
           opening_date=$9,active=$10,version=version+1,updated_by=$11,updated_at=now()
         WHERE id=$1 AND root_realm_id=$2 AND version=$12 RETURNING version
       `,[previous.id,actor.realmId,name,name.toLowerCase(),description,
         area,parent,head,opening,active,actor.accountId,expected]);
       return {kind:"DEPARTMENT",id:previous.id,version:result.rows[0].version};
     });
 }
 async links(bearer:string,branchRef:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view"),
     admin=await this.root(bearer);
   const client=await this.db.connect();
   try{
     await this.branch(client,actor,branchRef,admin);
     const result=await client.query<{id:string;foundation_department_id:string;
       name:string;kind:string;linked_at:Date;ended_at:Date|null}>(`
       SELECT l.id,l.foundation_department_id,d.name,d.kind,l.linked_at,l.ended_at
       FROM branch_department_link l JOIN department d
         ON d.id=l.foundation_department_id AND d.root_realm_id=l.root_realm_id
       WHERE l.root_realm_id=$1 AND l.branch_id=$2
       ORDER BY l.linked_at DESC,l.id DESC LIMIT 100
     `,[actor.realmId,id(branchRef)]);
     return {links:result.rows.map(x=>({linkRef:x.id,
       departmentRef:x.foundation_department_id,name:x.name,kind:x.kind,
       linkedAt:x.linked_at.toISOString(),endedAt:x.ended_at?.toISOString()??null}))};
   }finally{client.release();}
 }
 async link(bearer:string,branchRef:string,input:unknown){
   const x=asObject(input),department=id(x.departmentRef);
   return this.perform(bearer,"foundation.branches.manage","LINK_DEPARTMENT",branchRef,x,
     async(client,actor,branch)=>{
       this.ensureActive(branch);
       const result=await client.query(`
         SELECT id FROM department WHERE id=$1 AND root_realm_id=$2
           AND scope_kind='FOUNDATION' AND active FOR SHARE
       `,[department,actor.realmId]);
       if(!result.rowCount)
         throw new BadRequestException("Choose an active Foundation-wide department");
       const linked=await client.query<{id:string}>(`
         INSERT INTO branch_department_link(root_realm_id,branch_id,foundation_department_id,linked_by)
         VALUES($1,$2,$3,$4) RETURNING id
       `,[actor.realmId,branch.id,department,actor.accountId]);
       return {kind:"LINK",id:linked.rows[0].id,version:1};
     });
 }
 async unlink(bearer:string,branchRef:string,linkRef:string,input:unknown){
   const x=asObject(input);
   return this.perform(bearer,"foundation.branches.manage","UNLINK_DEPARTMENT",
     branchRef,{...x,linkRef},async(client,actor,branch)=>{
       this.ensureActive(branch);
       const existing=await client.query<{id:string}>(`
         SELECT id FROM branch_department_link
         WHERE id=$1 AND root_realm_id=$2 AND branch_id=$3 AND ended_at IS NULL FOR UPDATE
       `,[id(linkRef),actor.realmId,branch.id]);
       if(!existing.rows[0])throw new ConflictException("The original department link changed");
       await client.query(`
         UPDATE branch_department_link SET ended_at=now(),ended_by=$2 WHERE id=$1
       `,[existing.rows[0].id,actor.accountId]);
       return {kind:"LINK",id:existing.rows[0].id,version:2};
     });
 }
 async participants(bearer:string,branchRef:string,departmentRef:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view"),
     admin=await this.root(bearer);
   const client=await this.db.connect();
   try{
     const branch=await this.branch(client,actor,branchRef,admin);
     const dep=await client.query<Dept>(`
       SELECT * FROM department WHERE id=$1 AND root_realm_id=$2
         AND branch_id=$3 AND scope_kind='BRANCH'
     `,[id(departmentRef),actor.realmId,branch.id]);
     if(!dep.rows[0])throw new NotFoundException("Branch department unavailable");
     const members=await client.query<{id:string;account_ref:string;office_role:string;
       active_from:Date;active_until:Date|null}>(`
       SELECT id,account_ref,office_role,active_from,active_until
       FROM department_participation
       WHERE root_realm_id=$1 AND department_id=$2
       ORDER BY active_from DESC,id DESC LIMIT 100
     `,[actor.realmId,dep.rows[0].id]);
     const names=await this.identity.accountLabels(client,actor,members.rows.map(x=>x.account_ref));
     return {participants:members.rows.map(x=>({participationRef:x.id,accountRef:x.account_ref,
       displayName:names[x.account_ref]??null,officeRole:x.office_role,
       activeFrom:x.active_from.toISOString(),activeUntil:x.active_until?.toISOString()??null}))};
   }finally{client.release();}
 }
 async assignParticipant(bearer:string,branchRef:string,departmentRef:string,input:unknown){
   const x=asObject(input),account=id(x.accountRef),role=text(x.officeRole,80,true);
   return this.perform(bearer,"foundation.branches.manage","ASSIGN_BRANCH_PARTICIPANT",
     branchRef,{...x,departmentRef},async(client,actor,branch)=>{
       this.ensureActive(branch);
       const dep=await client.query<Dept>(`
         SELECT * FROM department WHERE id=$1 AND root_realm_id=$2
           AND branch_id=$3 AND scope_kind='BRANCH' AND active FOR SHARE
       `,[id(departmentRef),actor.realmId,branch.id]);
       if(!dep.rows[0])throw new BadRequestException("Choose an active branch committee");
       await this.identity.eligibleOfficeholder(client,actor,account);
       const added=await client.query<{id:string}>(`
         INSERT INTO department_participation(root_realm_id,department_id,account_ref,
           office_role,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id
       `,[actor.realmId,dep.rows[0].id,account,role,actor.accountId]);
       return {kind:"PARTICIPANT",id:added.rows[0].id,version:1};
     });
 }
 async endParticipant(bearer:string,branchRef:string,departmentRef:string,
     participationRef:string,input:unknown){
   const x=asObject(input);
   return this.perform(bearer,"foundation.branches.manage","END_BRANCH_PARTICIPANT",
     branchRef,{...x,departmentRef,participationRef},async(client,actor,branch)=>{
       this.ensureActive(branch);
       const dep=await client.query<Dept>(`
         SELECT * FROM department WHERE id=$1 AND root_realm_id=$2 AND
           branch_id=$3 AND scope_kind='BRANCH' FOR SHARE
       `,[id(departmentRef),actor.realmId,branch.id]);
       if(!dep.rows[0])throw new NotFoundException("Branch department unavailable");
       const ended=await client.query<{id:string}>(`
         UPDATE department_participation SET active_until=now()
         WHERE id=$1 AND root_realm_id=$2 AND department_id=$3 AND active_until IS NULL
         RETURNING id
       `,[id(participationRef),actor.realmId,dep.rows[0].id]);
       if(!ended.rows[0])throw new ConflictException("The officeholder assignment changed");
       return {kind:"PARTICIPANT",id:ended.rows[0].id,version:2};
     });
 }
}
