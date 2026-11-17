import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ensureId=(v:unknown):string=>{
  if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Choose a valid branch registration");
  return v;
};
export type BranchDraftSource=Readonly<{
  registrationRef:string;root:string;revision:number;status:string;
  requestedBy:string;managerRef:string|null;stages:Record<string,Record<string,unknown>>;
}>;
export type FrozenBranchSubmission=Readonly<{
  submissionRef:string;root:string;registrationRef:string;revision:number;
  digest:string;status:string;requestedBy:string;managerRef:string;
  branchName:string;caseRef:string|null;
  reviewSummary:Readonly<{branchType:string;openingDate:string|null;
    postalAddress:string;pinCode:string;officialPhone:string;officialEmail:string;
    selectedFoundationDepartments:number;managerDisplayName:string|null}>;
  fileVersions:readonly {
    fileRef:string;revision:number;classification:string
  }[];
}>;
type DraftRow={
 id:string;root_realm_id:string;requested_by:string;manager_account_ref:string|null;
 draft_version:number;status:string;profile_payload:Record<string,Record<string,unknown>>;
};
type SubmittedRow={
 id:string;root_realm_id:string;registration_id:string;submitted_revision:number;
 immutable_payload:Record<string,Record<string,unknown>>;immutable_payload_digest:string;
 verified_file_versions:{fileRef:string;revision:number;classification:string}[];
 approval_case_ref:string|null;status:string;submitted_by:string;
};
/** Source owner: CG-02. CG-03/CG-19 may only obtain validated scoped projections,
 * not inspect or mutate CG-02 repositories directly.
 */
@Injectable()
export class BranchSourceFacade{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade){}
 /** Used for finance account reactivation, without CG-09 reading CG-02 tables. */
 async requireFinanceActiveBranch(client:PoolClient,actor:VerifiedFoundationActor,
  branchRef:string,action:"finance.accounts.manage"|"finance.journals.post"):Promise<void>{
  await this.identity.assertCurrent(client,actor,action);
  const row=await client.query<{id:string}>(`
    SELECT id FROM branch WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE'
    FOR SHARE`,[ensureId(branchRef),actor.realmId]);
  if(!row.rows[0])throw new ConflictException({code:"FINANCE_BRANCH_INACTIVE",field:"branchRef"});
 }
 /** CG-02 owner check for actual Finance invoice branch selection. */
 async requireFinanceBranchVersion(client:PoolClient,actor:VerifiedFoundationActor,
  branchRef:string,expectedVersion:number,action:"finance.invoices.manage"|"finance.budgets.manage"):Promise<void>{
  await this.identity.assertCurrent(client,actor,action);
  if(!UUID.test(branchRef)||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)
   throw new ConflictException({code:"FINANCE_BRANCH_STALE",field:"branchRef"});
  const found=await client.query<{version:number}>(
   "SELECT version FROM branch WHERE id=$1 AND root_realm_id=$2 "+
   "AND status='ACTIVE' FOR SHARE",[branchRef,actor.realmId]);
  if(!found.rows[0]||found.rows[0].version!==expectedVersion)
   throw new ConflictException({code:"FINANCE_BRANCH_STALE",field:"branchRef"});
 }
 /** Owner-controlled permitted branch labels for past ACTIVE/INACTIVE finance accounts. */
 async financeBranchLabels(bearer:string,branchRefs:readonly string[]):Promise<Record<string,string>>{
  if(branchRefs.length>60||branchRefs.some(r=>!UUID.test(r)))
   throw new BadRequestException("The finance branch selection is invalid. Refresh the list.");
  const actor=await this.sessions.requireAction(bearer,"finance.accounts.view");
  const unique=[...new Set(branchRefs)];
  if(unique.length===0)return {};
  const labels=await this.db.query<{id:string;name:string}>(`
    SELECT id,name FROM branch
    WHERE root_realm_id=$1 AND id=ANY($2::uuid[])
    ORDER BY name,id LIMIT 60`,[actor.realmId,unique]);
  return Object.fromEntries(labels.rows.map(x=>[x.id,x.name]));
 }
 /** Authoritative CG-02 branch visibility for finance reports, selectors and CSV.
  * Protected Foundation super admin and explicitly granted branch admins may
  * see all. An ordinary branch manager sees only their real assigned branch(es);
  * finance.reports.view alone never silently grants Foundation-wide money.
  */
 async financeReportScope(bearer:string,capability:"finance.reports.view"|"finance.reconciliation.manage"|"finance.reconciliation.review"|"finance.invoices.view"|"finance.invoices.manage"|"finance.invoices.review"="finance.reports.view"):Promise<{all:boolean;branchRefs:string[]}>{
   const actor=await this.sessions.requireAction(bearer,capability);
   const protectedRole=await this.db.query<{allowed:boolean}>(`
     SELECT EXISTS(SELECT 1 FROM account_role ar
       JOIN role r ON r.id=ar.role_id AND r.active=true AND r.is_protected=true
       WHERE ar.account_id=$1 AND ar.realm_id=$2 AND ar.revoked_at IS NULL) AS allowed`,
      [actor.accountId,actor.realmId]);
   let full=protectedRole.rows[0]?.allowed===true;
   if(!full){
     try{await this.sessions.requireAction(bearer,"foundation.branches.admin");full=true;}
     catch(e){if(!(e instanceof ForbiddenException))throw e;}
   }
   if(full)return {all:true,branchRefs:[]};
   const branches=await this.db.query<{id:string}>(`
     SELECT id FROM branch WHERE root_realm_id=$1 AND manager_account_ref=$2
       AND status='ACTIVE' ORDER BY id LIMIT 101`,[actor.realmId,actor.accountId]);
   if(branches.rows.length>100)
     throw new ForbiddenException("Choose a narrower authorized branch list");
   return {all:false,branchRefs:branches.rows.map(x=>x.id)};
 }
 async requireFinanceReportBranch(bearer:string,requested:string|null|undefined):Promise<void>{
   const allowed=await this.financeReportScope(bearer);
   if(!allowed.all&&(!requested||!allowed.branchRefs.includes(requested)))
     throw new ForbiddenException("Select a branch assigned to your account");
 }
 /** CG-09 finance uses only the actual active branch identity, not private branch files. */
 async financeBranches(bearer:string,capability:"finance.accounts.view"|"finance.vouchers.view"|"finance.vouchers.manage"|"finance.invoices.view"|"finance.invoices.manage"|"finance.budgets.view"|"finance.budgets.manage"|"finance.reports.view"="finance.accounts.view"):Promise<{branchRef:string;name:string;code:string;version:number}[]>{
   const actor=await this.sessions.requireAction(bearer,capability);
   const scoped=["finance.reports.view","finance.invoices.view","finance.invoices.manage"].includes(capability);
   const scope=scoped?await this.financeReportScope(bearer,capability as
    "finance.reports.view"|"finance.invoices.view"|"finance.invoices.manage"):
    {all:true,branchRefs:[] as string[]};
   const rows=await this.db.query<{id:string;name:string;branch_code:string;version:number}>(`
     SELECT id,name,branch_code,version FROM branch
     WHERE root_realm_id=$1 AND status='ACTIVE'
       AND ($2::boolean OR id=ANY($3::uuid[]))
     ORDER BY name,id LIMIT 100`,[actor.realmId,scope.all,scope.branchRefs]);
   return rows.rows.map(b=>({branchRef:b.id,name:b.name,code:b.branch_code,version:b.version}));
 }
 /** Finance transaction must recheck real CG-02 branch and current CG-01 action. */
 async financeActiveBranch(client:PoolClient,actor:VerifiedFoundationActor,
     branchRef:string,expectedVersion:number,action:string):Promise<void>{
   if(!["finance.accounts.manage","finance.journals.post","finance.vouchers.manage"].includes(action))
     throw new ForbiddenException("You do not have permission to use this branch for finance");
   await this.identity.assertCurrent(client,actor,action);
   const rows=await client.query<{version:number}>(`
     SELECT version FROM branch WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE'
     FOR SHARE`,[ensureId(branchRef),actor.realmId]);
   if(!rows.rows[0])throw new ConflictException({code:"FINANCE_BRANCH_INACTIVE",field:"branchRef"});
   if(rows.rows[0].version!==expectedVersion)
     throw new ConflictException({code:"FINANCE_BRANCH_STALE",field:"branchRef"});
 }
 private async admin(bearer:string):Promise<boolean>{
   try{await this.sessions.requireAction(bearer,"foundation.branches.admin");return true;}
   catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 async draft(bearer:string,registrationRef:unknown,expectedVersion?:number,
     requireWrite=false):Promise<BranchDraftSource>{
   const actor=await this.sessions.requireAction(bearer,
     requireWrite?"foundation.branches.manage":"foundation.branches.view");
   const admin=await this.admin(bearer);
   const ref=ensureId(registrationRef);
   const rows=await this.db.query<DraftRow>(`
     SELECT id,root_realm_id,requested_by,manager_account_ref,draft_version,status,profile_payload
     FROM branch_registration WHERE id=$1 AND root_realm_id=$2 AND
       ($3::boolean OR requested_by=$4 OR manager_account_ref=$4)
   `,[ref,actor.realmId,admin,actor.accountId]);
   const row=rows.rows[0];
   if(!row)throw new NotFoundException("Branch registration unavailable");
   if(expectedVersion!==undefined&&row.draft_version!==expectedVersion)
     throw new ConflictException("The branch draft changed. Refresh before continuing.");
   if(requireWrite&&!["DRAFT","RETURNED"].includes(row.status))
     throw new ConflictException("This registration can no longer accept new evidence.");
   return {registrationRef:row.id,root:actor.realmId,revision:row.draft_version,
     status:row.status,requestedBy:row.requested_by,managerRef:row.manager_account_ref,
     stages:row.profile_payload};
 }
 async guardDraft(client:PoolClient,actor:VerifiedFoundationActor,registrationRef:string,
     version:number,requireMutable:boolean):Promise<void>{
   await this.identity.assertCurrent(client,actor,
     requireMutable?"foundation.branches.manage":"foundation.branches.view");
   const draft=await client.query<DraftRow>(`
     SELECT id,root_realm_id,requested_by,manager_account_ref,draft_version,status,profile_payload
     FROM branch_registration WHERE id=$1 AND root_realm_id=$2 FOR SHARE
   `,[ensureId(registrationRef),actor.realmId]);
   const row=draft.rows[0];
   if(!row||row.draft_version!==version||
      (requireMutable&&!["DRAFT","RETURNED"].includes(row.status)))
     throw new ConflictException("The branch source changed. Refresh before continuing.");
   const protectedRoot=await client.query<{is_protected:boolean}>(`
     SELECT r.is_protected FROM account_role ar
     JOIN role r ON r.id=ar.role_id AND r.active
     WHERE ar.account_id=$1 AND ar.realm_id=$2 AND ar.revoked_at IS NULL
   `,[actor.accountId,actor.realmId]);
   if(!protectedRoot.rows.some(x=>x.is_protected)&&
      row.requested_by!==actor.accountId&&row.manager_account_ref!==actor.accountId)
     throw new ForbiddenException("This branch registration is not available to your role");
 }
 /** Only an ACTIVE, currently scoped CG-02 operating branch can receive
  * private replacement evidence. Never confer root privileges to its manager.
  */
 async activeBranch(bearer:string,branchRef:unknown,expectedVersion?:number,write=true){
   const actor=await this.sessions.requireAction(bearer,
     write?"foundation.branches.manage":"foundation.branches.view");
   const reference=ensureId(branchRef);
   const rows=await this.db.query<{id:string;version:number;status:string;
      manager_account_ref:string;name:string}>(`
     SELECT id,version,status,manager_account_ref,name FROM branch
     WHERE id=$1 AND root_realm_id=$2
   `,[reference,actor.realmId]);
   const row=rows.rows[0];
   if(!row||(write&&row.status!=="ACTIVE")||
     (expectedVersion!==undefined&&row.version!==expectedVersion))
     throw new ConflictException("The operating branch changed or is unavailable");
   if(row.manager_account_ref!==actor.accountId){
     await this.sessions.requireAction(bearer,"foundation.branches.admin");
   }
   return {branchRef:row.id,version:row.version,root:actor.realmId,name:row.name};
 }
 async guardActiveBranch(client:PoolClient,actor:VerifiedFoundationActor,
   branchRef:string,expectedVersion:number,write=true){
   await this.identity.assertCurrent(client,actor,
     write?"foundation.branches.manage":"foundation.branches.view");
   const rows=await client.query<{version:number;status:string;manager_account_ref:string}>(`
     SELECT version,status,manager_account_ref FROM branch
     WHERE id=$1 AND root_realm_id=$2 FOR SHARE
   `,[ensureId(branchRef),actor.realmId]);
   const row=rows.rows[0];
   if(!row||(write&&row.status!=="ACTIVE")||row.version!==expectedVersion)
     throw new ConflictException("The current branch evidence source changed");
   if(row.manager_account_ref!==actor.accountId)
     await this.identity.assertCurrent(client,actor,"foundation.branches.admin");
 }
 /** Historical evidence revocation cannot retarget a submitted snapshot.
  * Check CG-01 current grants and CG-02 scope in the same transaction.
  */
 /** The CG-02 current operating branch is the only authority for whether
  * a verified document is still attached to an ACTIVE profile. Private
  * CG-19 revocation checks this inside its file-locked transaction.
  */
 async guardNotCurrentActiveEvidence(client:PoolClient,actor:VerifiedFoundationActor,
   fileRef:string){
   const rows=await client.query<{id:string}>(`
     SELECT id FROM branch WHERE root_realm_id=$1
       AND evidence_versions @> jsonb_build_array(jsonb_build_object('fileRef',$2::text))
     LIMIT 1 FOR SHARE
   `,[actor.realmId,ensureId(fileRef)]);
   if(rows.rows[0])
     throw new ConflictException(
       "Replace this document in the approved branch profile before revoking it");
 }
 async guardHistoricalRegistration(client:PoolClient,actor:VerifiedFoundationActor,
   registrationRef:string,write=true){
   await this.identity.assertCurrent(client,actor,
     write?"foundation.branches.manage":"foundation.branches.view");
   const rows=await client.query<{requested_by:string;manager_account_ref:string|null}>(`
     SELECT requested_by,manager_account_ref FROM branch_registration
     WHERE id=$1 AND root_realm_id=$2 FOR SHARE
   `,[ensureId(registrationRef),actor.realmId]);
   const row=rows.rows[0];
   if(!row)throw new NotFoundException("Branch registration unavailable");
   if(row.requested_by!==actor.accountId&&row.manager_account_ref!==actor.accountId)
     await this.identity.assertCurrent(client,actor,"foundation.branches.admin");
 }
 /** A fresh, owner-verified submitted-source guard for CG-03 case creation.
  * No CG-03 code reads CG-02 tables or trusts an earlier HTTP preflight.
  */
 async guardSubmittedSource(client:PoolClient,actor:VerifiedFoundationActor,
   registrationRef:string,revision:number,digest:string){
   await this.guardHistoricalRegistration(client,actor,registrationRef,true);
   const rows=await client.query<{id:string}>(`
     SELECT s.id FROM branch_registration r
     JOIN branch_registration_submission s ON s.registration_id=r.id
       AND s.root_realm_id=r.root_realm_id
     WHERE r.id=$1 AND r.root_realm_id=$2 AND r.draft_version=$3
       AND r.current_submission_revision=$3
       AND r.status IN ('SUBMISSION_UNCONFIRMED','SUBMITTED','IN_REVIEW')
       AND s.submitted_revision=$3 AND s.immutable_payload_digest=$4
       AND s.status IN ('SUBMISSION_UNCONFIRMED','SUBMITTED','IN_REVIEW')
     FOR SHARE OF r,s
   `,[ensureId(registrationRef),actor.realmId,revision,digest]);
   if(!rows.rows[0])
     throw new ConflictException("Submitted branch source changed before approval case creation");
 }
 async submission(bearer:string,registrationRef:unknown,revisionInput:unknown,
     digestInput:unknown):Promise<FrozenBranchSubmission>{
   const ref=ensureId(registrationRef),revision=Number(revisionInput);
   const digest=String(digestInput);
   if(!Number.isSafeInteger(revision)||revision<1||!/^[a-f0-9]{64}$/.test(digest))
     throw new BadRequestException("The submitted branch reference is invalid");
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view");
   const admin=await this.admin(bearer);
   const rows=await this.db.query<SubmittedRow & {requested_by:string;manager_account_ref:string|null}>(`
     SELECT s.*,r.requested_by,r.manager_account_ref FROM branch_registration_submission s
     JOIN branch_registration r ON r.id=s.registration_id
       AND r.root_realm_id=s.root_realm_id
     WHERE s.root_realm_id=$1 AND s.registration_id=$2 AND s.submitted_revision=$3
       AND s.immutable_payload_digest=$4
       AND ($5::boolean OR r.requested_by=$6 OR r.manager_account_ref=$6)
   `,[actor.realmId,ref,revision,digest,admin,actor.accountId]);
   const row=rows.rows[0];
   if(!row)throw new NotFoundException("Submitted registration unavailable");
   const first=row.immutable_payload["1"]??{},managerStage=row.immutable_payload["5"]??{};
   const managerRef=managerStage.managerRef;
   if(typeof managerRef!=="string"||!UUID.test(managerRef)||
      typeof first.branchName!=="string"||first.branchName.trim().length<2)
     throw new ConflictException("The original application details are incomplete");
   const loc=row.immutable_payload["2"]??{},link=row.immutable_payload["6"]??{};
   const labelClient=await this.db.connect();
   let display:string|null=null;
   try{
     const labels=await this.identity.accountLabels(labelClient,actor,[managerRef]);
     display=labels[managerRef]??null;
   }finally{labelClient.release();}
   const plain=(value:unknown,max:number):string=>
     typeof value==="string"?value.slice(0,max):"";
   const reviewSummary={
     branchType:plain(first.branchType,80),
     openingDate:typeof first.openingDate==="string"?first.openingDate:null,
     postalAddress:plain(loc.postalAddress,700),pinCode:plain(loc.pinCode,6),
     officialPhone:plain(first.officialPhone,80),
     officialEmail:plain(first.officialEmail,180),
     selectedFoundationDepartments:Array.isArray(link.departmentRefs)?
       Math.min(link.departmentRefs.length,30):0,
     managerDisplayName:display
   };
   return {submissionRef:row.id,root:actor.realmId,registrationRef:ref,
     revision:row.submitted_revision,digest:row.immutable_payload_digest,
     status:row.status,requestedBy:row.submitted_by,managerRef,
     branchName:first.branchName,caseRef:row.approval_case_ref,
     reviewSummary,fileVersions:row.verified_file_versions};
 }
}
