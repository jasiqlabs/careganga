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
 /** CG02 authoritative current branch/ancestor-area projection. This never
  * confers a CG01 action and never represents a clinical healthcare center.
  * A protected operation holds active grants until its transaction commits.
  */
 private async permittedStaffBranches(client:Pool|PoolClient,root:string,account:string):
  Promise<{id:string;name:string;manager_account_ref:string}[]>{
  // The root read fence orders an in-transaction decision against CG02
  // geography reparent/deactivation; the branch row share lock orders manager
  // reassignment/closure. Pool-backed read-only projections recheck per request.
  await client.query("SELECT id FROM access_realm WHERE id=$1 FOR SHARE",[root]);
  await client.query("SELECT id FROM cg02_staff_scope_assignment "+
   "WHERE root_realm_id=$1 AND account_ref=$2 AND ended_at IS NULL FOR SHARE",
   [root,account]);
  const rows=await client.query<{id:string;name:string;manager_account_ref:string}>(`
   WITH RECURSIVE ancestors AS(
    SELECT b.id AS branch_id,g.id AS area_id,g.parent_area_id,1 AS depth
    FROM branch b JOIN geography_area g
     ON g.root_realm_id=b.root_realm_id AND g.id=b.geography_area_id
    WHERE b.root_realm_id=$1 AND b.status='ACTIVE' AND g.status='ACTIVE'
    UNION ALL
    SELECT a.branch_id,p.id,p.parent_area_id,a.depth+1
    FROM ancestors a JOIN geography_area p
     ON p.root_realm_id=$1 AND p.id=a.parent_area_id AND p.status='ACTIVE'
    WHERE a.depth<8
   )
   SELECT b.id,b.name,b.manager_account_ref FROM branch b
   WHERE b.root_realm_id=$1 AND b.status='ACTIVE' AND
    (b.manager_account_ref=$2 OR EXISTS(
     SELECT 1 FROM cg02_staff_scope_assignment grant_scope
     WHERE grant_scope.root_realm_id=b.root_realm_id
      AND grant_scope.account_ref=$2 AND grant_scope.ended_at IS NULL
      AND ((grant_scope.scope_kind='ALL_BRANCHES')
       OR (grant_scope.scope_kind='BRANCH' AND grant_scope.branch_ref=b.id)
       OR (grant_scope.scope_kind='AREA' AND EXISTS(
        SELECT 1 FROM ancestors a WHERE a.branch_id=b.id AND a.area_id=grant_scope.area_ref)))
    ))
   ORDER BY b.name,b.id LIMIT 201 FOR SHARE OF b
  `,[root,account]);
  if(rows.rows.length>200)throw new ForbiddenException("Ask an administrator to narrow the assigned branches");
  return rows.rows;
 }
 /** Only an already-authorized domain caller may use this projection. It
  * cannot authorize root/global records, healthcare centers or an action.
  */
 async requireAssignedStaffBranch(tx:PoolClient,a:VerifiedFoundationActor,branchInput:string){
  const branch=ensureId(branchInput);
  const current=await this.permittedStaffBranches(tx,a.realmId,a.accountId);
  if(!current.some(x=>x.id===branch))
   throw new ForbiddenException("This active branch is not assigned to your account");
 }
 /** Read-only scoped labels for CG02's own permitted operating directory. */
 async currentStaffBranchRefs(client:Pool|PoolClient,root:string,account:string):Promise<string[]>{
  return (await this.permittedStaffBranches(client,root,account)).map(row=>row.id);
 }
 /** Generic action-gated branch projection for CG10/12 owner read paths.
  * Only current CG01 capabilities and existing CG02 scope determine the result.
  * Never use this projection as authority for a Foundation-null or clinical center item.
  */
 async staffBranchScope(bearer:string,action:string):Promise<{all:boolean;branchRefs:string[]}>{
  const actor=await this.sessions.requireAction(bearer,action);
  let all=false;
  try{await this.sessions.requireAction(bearer,"foundation.branches.admin");all=true;}
  catch(e){if(!(e instanceof ForbiddenException))throw e;}
  if(all)return {all:true,branchRefs:[]};
  return {all:false,branchRefs:await this.currentStaffBranchRefs(this.db,actor.realmId,actor.accountId)};
 }
 /** Used for finance account reactivation, without CG-09 reading CG-02 tables. */
 async requireFinanceActiveBranch(client:PoolClient,actor:VerifiedFoundationActor,
  branchRef:string,action:"finance.accounts.manage"|"finance.accounts.view"|"finance.journals.post"|
   "finance.reconciliation.manage"|"finance.reports.view"|"finance.vouchers.manage"|"finance.vouchers.view"|
   "finance.budgets.manage"|"finance.invoices.manage"|"finance.invoices.issue"|"finance.invoices.review"):Promise<void>{
  await this.identity.assertCurrent(client,actor,action);
  const row=await client.query<{id:string}>(`
    SELECT id FROM branch WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE'
    FOR SHARE`,[ensureId(branchRef),actor.realmId]);
  if(!row.rows[0])throw new ConflictException({code:"FINANCE_BRANCH_INACTIVE",field:"branchRef"});
  await this.requireFinanceActorBranch(client,actor,branchRef,action);
 }
 /** One current CG02 manager/administrator authorization, reusable inside a
  * protected CG03/CG09 transaction without a second bearer token or fake master.
  */
 async requireFinanceActorBranch(client:PoolClient,actor:VerifiedFoundationActor,
  branchInput:string,action:"finance.invoices.manage"|"finance.invoices.issue"|
   "finance.invoices.review"|"finance.budgets.manage"|"finance.accounts.manage"|
  "finance.accounts.view"|"finance.journals.post"|"finance.vouchers.manage"|"finance.vouchers.view"|
  "finance.reconciliation.manage"|"finance.reports.view"):Promise<void>{
  await this.identity.assertCurrent(client,actor,action);
  const branchRef=ensureId(branchInput);
  const source=await client.query<{manager_account_ref:string}>(
   "SELECT manager_account_ref FROM branch "+
   "WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE' FOR SHARE",
   [branchRef,actor.realmId]);
  if(!source.rows[0])throw new ConflictException({code:"FINANCE_BRANCH_INACTIVE",field:"branchRef"});
  if(source.rows[0].manager_account_ref===actor.accountId)return;
  const privileged=await client.query<{allowed:boolean}>(`
   SELECT EXISTS(
    SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id
    AND r.active=true LEFT JOIN role_grant g ON g.role_id=r.id
      AND g.capability_key='foundation.branches.admin'
    WHERE ar.account_id=$1 AND ar.realm_id=$2 AND ar.revoked_at IS NULL
      AND (r.is_protected=true OR g.capability_key IS NOT NULL)
   ) AS allowed`,[actor.accountId,actor.realmId]);
  if(!privileged.rows[0]?.allowed){
   const allowed=await this.permittedStaffBranches(client,actor.realmId,actor.accountId);
   if(!allowed.some(x=>x.id===branchRef))
    throw new ForbiddenException("This finance branch is not assigned to your account");
  }
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
  await this.requireFinanceActorBranch(client,actor,branchRef,action);
 }
 /** Owner-controlled permitted branch labels for past ACTIVE/INACTIVE finance accounts. */
 async financeBranchLabels(bearer:string,branchRefs:readonly string[]):Promise<Record<string,string>>{
  if(branchRefs.length>60||branchRefs.some(r=>!UUID.test(r)))
   throw new BadRequestException("The finance branch selection is invalid. Refresh the list.");
  const actor=await this.sessions.requireAction(bearer,"finance.accounts.view");
  const unique=[...new Set(branchRefs)];
  if(unique.length===0)return {};
  const scope=await this.financeReportScope(bearer,"finance.accounts.view");
  const labels=await this.db.query<{id:string;name:string}>(`
    SELECT id,name FROM branch
    WHERE root_realm_id=$1 AND id=ANY($2::uuid[])
      AND ($3::boolean OR id=ANY($4::uuid[]))
    ORDER BY name,id LIMIT 60`,[actor.realmId,unique,scope.all,scope.branchRefs]);
  return Object.fromEntries(labels.rows.map(x=>[x.id,x.name]));
 }
 /** Authoritative CG-02 branch visibility for finance reports, selectors and CSV.
  * Protected Foundation super admin and explicitly granted branch admins may
  * see all. An ordinary branch manager sees only their real assigned branch(es);
  * finance.reports.view alone never silently grants Foundation-wide money.
  */
 async financeReportScope(bearer:string,capability:"finance.reports.view"|"finance.reconciliation.manage"|"finance.reconciliation.review"|"finance.invoices.view"|"finance.invoices.manage"|"finance.invoices.review"|"finance.invoices.issue"|
  "finance.accounts.view"|"finance.accounts.manage"|"finance.journals.post"|
  "finance.vouchers.view"|"finance.vouchers.manage"|"finance.budgets.view"|
  "finance.budgets.manage"="finance.reports.view"):Promise<{all:boolean;branchRefs:string[]}>{
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
   const branches=await this.permittedStaffBranches(this.db,actor.realmId,actor.accountId);
   return {all:false,branchRefs:branches.map(x=>x.id)};
 }
 /** Current CG-02 branch scope for trusted CG-20 scheduled finance jobs.
  * CG-01 checks the stored account's live roles without a bearer; CG-02 alone
  * checks branch assignments. No session cloning, stale grants or new branch
  * ownership model. Internal background service path only.
  */
 async requireScheduledFinanceReportBranch(root:string,account:string,
  requested:string|null):Promise<void>{
   await this.sessions.requireScheduledMisAction(root,account,"finance.reports.view");
   const protectedRole=await this.db.query<{allowed:boolean}>(
    "SELECT EXISTS(SELECT 1 FROM account_role ar "+
    "JOIN role r ON r.id=ar.role_id AND r.active=true AND r.is_protected=true "+
    "WHERE ar.realm_id=$1 AND ar.account_id=$2 AND ar.revoked_at IS NULL) AS allowed",
    [root,account]);
   let all=protectedRole.rows[0]?.allowed===true;
   if(!all){
    try{
     await this.sessions.requireScheduledMisAction(
      root,account,"foundation.branches.admin");
     all=true;
    }catch(e){if(!(e instanceof ForbiddenException))throw e;}
   }
   if(all){
    if(requested){
     const original=await this.db.query(
      "SELECT 1 FROM branch WHERE id=$1 AND root_realm_id=$2 "+
      "AND status='ACTIVE'",
      [ensureId(requested),root]);
     if(!original.rowCount)
      throw new ForbiddenException("The report branch is no longer available");
    }
    return;
   }
   if(!requested)
    throw new ForbiddenException("Select a currently assigned branch");
   const branches=await this.permittedStaffBranches(this.db,root,account);
   if(!branches.some(x=>x.id===ensureId(requested)))
    throw new ForbiddenException("The assigned report branch has changed");
 }

 /** Trusted CG20 due worker only. A protected administrator receives
  * Foundation+branches; a senior delegated staff role receives the union
  * of CURRENT ACTIVE branch assignments without any Foundation-null money.
  * Sessionless background execution still checks CG01's current role.
  */
 async scheduledFinanceScope(root:string,account:string):
  Promise<{all:boolean;branchRefs:string[]}>{
  await this.sessions.requireScheduledMisAction(root,account,"finance.reports.view");
  let all=false;
  try{await this.sessions.requireScheduledMisAction(root,account,"foundation.branches.admin");all=true;}
  catch(e){if(!(e instanceof ForbiddenException))throw e;}
  if(all)return {all:true,branchRefs:[]};
  const refs=(await this.permittedStaffBranches(this.db,root,account)).map(x=>x.id);
  if(!refs.length)
   throw new ForbiddenException("No current branch is assigned to this scheduled report");
  return {all:false,branchRefs:refs};
 }
 async requireFinanceReportBranch(bearer:string,requested:string|null|undefined):Promise<void>{
   const allowed=await this.financeReportScope(bearer);
   if(!allowed.all&&(!requested||!allowed.branchRefs.includes(requested)))
     throw new ForbiddenException("Select a branch assigned to your account");
 }
 /** CG20 C46 geography stays owned by original CG02. Only active district/
  * block ancestors of CURRENT accessible active branches are exposed; this
  * never widens finance.reports.view to an entire district. Bounded recursion
  * and row limit avoid unbounded catalog/scans.
  */
 private async reportGeographyRows(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.reports.view");
  const scope=await this.financeReportScope(bearer);
  const q=await this.db.query<{
   branchRef:string;areaRef:string;name:string;level:string
  }>(
   "WITH RECURSIVE ancestors AS ("+
   "SELECT b.id AS branch_ref,g.id,g.parent_area_id,g.level,"+
   "g.display_name,g.status,1 AS depth FROM branch b "+
   "JOIN geography_area g ON g.id=b.geography_area_id "+
   "AND g.root_realm_id=b.root_realm_id "+
   "WHERE b.root_realm_id=$1 AND b.status='ACTIVE' "+
   "AND ($2::boolean OR b.id=ANY($3::uuid[])) AND g.status='ACTIVE' "+
   "UNION ALL "+
   "SELECT a.branch_ref,p.id,p.parent_area_id,p.level,"+
   "p.display_name,p.status,a.depth+1 FROM ancestors a "+
   "JOIN geography_area p ON p.id=a.parent_area_id "+
   "AND p.root_realm_id=$1 AND p.status='ACTIVE' "+
   "WHERE a.depth<8) "+
   "SELECT branch_ref AS \"branchRef\",id AS \"areaRef\","+
   "display_name AS name,level FROM ancestors "+
   "WHERE level IN('DISTRICT','BLOCK') "+
   "ORDER BY level,name,id,branch_ref LIMIT 501",
   [actor.realmId,scope.all,scope.branchRefs]);
  if(q.rows.length>500)
   throw new ForbiddenException("Narrow the active reporting geography");
  return q.rows;
 }
 async financeReportGeographies(bearer:string){
  const rows=await this.reportGeographyRows(bearer);
  const areas=new Map<string,{ref:string;name:string;level:string}>();
  for(const row of rows)if(!areas.has(row.areaRef))
   areas.set(row.areaRef,{ref:row.areaRef,name:row.name,level:row.level});
  return [...areas.values()];
 }
 async financeAreaBranchRefs(bearer:string,areaInput:string,
  branchInput?:string|null){
  const area=ensureId(areaInput),rows=await this.reportGeographyRows(bearer);
  const branches=[...new Set(rows.filter(row=>row.areaRef===area)
   .map(row=>row.branchRef))];
  if(!branches.length||branchInput&&!branches.includes(ensureId(branchInput)))
   throw new ForbiddenException("This active district or block is outside your reporting scope");
  return branchInput?[branchInput]:branches;
 }
 /** CG-09 finance uses only the actual active branch identity, not private branch files. */
 async financeBranches(bearer:string,capability:"finance.accounts.view"|"finance.vouchers.view"|"finance.vouchers.manage"|"finance.invoices.view"|"finance.invoices.manage"|"finance.budgets.view"|"finance.budgets.manage"|"finance.reports.view"="finance.accounts.view"):Promise<{branchRef:string;name:string;code:string;version:number}[]>{
   const actor=await this.sessions.requireAction(bearer,capability);
   const scope=await this.financeReportScope(bearer,capability);
   const rows=await this.db.query<{id:string;name:string;branch_code:string;version:number}>(`
     SELECT id,name,branch_code,version FROM branch
     WHERE root_realm_id=$1 AND status='ACTIVE'
       AND ($2::boolean OR id=ANY($3::uuid[]))
     ORDER BY name,id LIMIT 100`,[actor.realmId,scope.all,scope.branchRefs]);
   return rows.rows.map(b=>({branchRef:b.id,name:b.name,code:b.branch_code,version:b.version}));
 }
 /** A Foundation-wide financial year, chart or root journal may be changed
  * only by a current protected root role or explicit CG-02 branch administrator.
  * A manager's finance.accounts.manage/journals.post grant is NOT root authority.
  */
 async requireFinanceRootScope(client:PoolClient,actor:VerifiedFoundationActor,
   action:"finance.accounts.manage"|"finance.journals.post"|
    "finance.vouchers.manage"|"finance.vouchers.view"|"finance.budgets.manage"|
    "finance.reconciliation.manage"|"finance.reports.view"|"finance.invoices.manage"|"finance.invoices.review"):Promise<void>{
  await this.identity.assertCurrent(client,actor,action);
  const result=await client.query<{allowed:boolean}>(`
   SELECT EXISTS(SELECT 1 FROM account_role ar
    JOIN role r ON r.id=ar.role_id AND r.active=true
    LEFT JOIN role_grant g ON g.role_id=r.id
      AND g.capability_key='foundation.branches.admin'
    WHERE ar.account_id=$1 AND ar.realm_id=$2 AND ar.revoked_at IS NULL
      AND (r.is_protected=true OR g.capability_key IS NOT NULL)
   ) AS allowed`,[actor.accountId,actor.realmId]);
  if(!result.rows[0]?.allowed)
   throw new ForbiddenException("Foundation-wide finance requires administrator access");
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
   await this.requireFinanceActorBranch(client,actor,branchRef,action as
    "finance.accounts.manage"|"finance.journals.post"|"finance.vouchers.manage");
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
    let rootAdmin=false;
    try{await this.sessions.requireAction(bearer,"foundation.branches.admin");rootAdmin=true;}
    catch(e){if(!(e instanceof ForbiddenException))throw e;}
    if(!rootAdmin){
     // A senior delegated manager may edit only ACTIVE assigned branches.
     // This does not grant control of pending registrations or Foundation masters.
     if(row.status!=="ACTIVE"||
       !(await this.permittedStaffBranches(this.db,actor.realmId,actor.accountId))
        .some(x=>x.id===reference))
      throw new ForbiddenException("The operating branch is not assigned to your account");
    }
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
   if(row.manager_account_ref!==actor.accountId){
    let rootAdmin=false;
    try{await this.identity.assertCurrent(client,actor,"foundation.branches.admin");rootAdmin=true;}
    catch(e){if(!(e instanceof ForbiddenException))throw e;}
    if(!rootAdmin){
     if(row.status!=="ACTIVE")
      throw new ForbiddenException("The operating branch is not active");
     await this.requireAssignedStaffBranch(client,actor,branchRef);
    }
   }
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

 // CG-05 introduces these read-only current-scope projections into the CG-02 owner.
 async projectBranchScope(tx:PoolClient,a:VerifiedFoundationActor):Promise<{all:boolean;branches:{value:string;label:string;managerRef:string}[]}>{
  let all=false;
  try{await this.identity.assertCurrent(tx,a,"foundation.branches.admin");all=true;}
  catch(e){if(!(e instanceof ForbiddenException))throw e;}
  const rows=all?(await tx.query<{id:string;name:string;manager_account_ref:string}>(
   "SELECT id,name,manager_account_ref FROM branch WHERE root_realm_id=$1 "+
   "AND status='ACTIVE' ORDER BY name,id LIMIT 201 FOR SHARE",[a.realmId])).rows:
   await this.permittedStaffBranches(tx,a.realmId,a.accountId);
  if(rows.length>200)throw new ForbiddenException("Choose a narrower branch scope");
  return {all,branches:rows.map(v=>({value:v.id,label:v.name,managerRef:v.manager_account_ref}))};
 }
 async projectBranch(tx:PoolClient,a:VerifiedFoundationActor,ref:string|null):Promise<{managerRef:string|null}>{
  let all=false;
  try{await this.identity.assertCurrent(tx,a,"foundation.branches.admin");all=true;}
  catch(e){if(!(e instanceof ForbiddenException))throw e;}
  if(ref===null){if(!all)throw new ForbiddenException("Foundation-wide project management is not permitted");return {managerRef:null};}
  const q=await tx.query<{manager_account_ref:string}>(
   "SELECT manager_account_ref FROM branch WHERE id=$1 AND root_realm_id=$2 "+
   "AND status='ACTIVE' FOR SHARE",[ensureId(ref),a.realmId]);
  if(!q.rowCount)throw new ForbiddenException("Choose a permitted active branch");
  if(!all){
   const allowed=await this.permittedStaffBranches(tx,a.realmId,a.accountId);
   if(!allowed.some(x=>x.id===ref))throw new ForbiddenException("Choose a permitted active branch");
  }
  return {managerRef:q.rows[0].manager_account_ref};
 }
 async projectGeography(tx:PoolClient,a:VerifiedFoundationActor,state:string|null,district:string|null){
  if(district&&!state)throw new BadRequestException("Choose a state first");
  if(state&&!(await tx.query("SELECT 1 FROM geography_area WHERE id=$1 AND root_realm_id=$2 AND status='ACTIVE' AND level='STATE' FOR SHARE",[ensureId(state),a.realmId])).rowCount)throw new BadRequestException("Choose a current state");
  if(district&&!(await tx.query("SELECT 1 FROM geography_area WHERE id=$1 AND parent_area_id=$2 AND root_realm_id=$3 AND status='ACTIVE' AND level='DISTRICT' FOR SHARE",[ensureId(district),state,a.realmId])).rowCount)throw new BadRequestException("Choose a district in the selected state");
 }
 /** CG06 uses the original active CG02 geography hierarchy. No local block master. */
 async beneficiaryBlock(tx:PoolClient,a:VerifiedFoundationActor,state:string|null,district:string|null,block:string|null){
  await this.projectGeography(tx,a,state,district);
  if(!block)return;
  if(!district||!(await tx.query("SELECT 1 FROM geography_area WHERE id=$1 AND root_realm_id=$2 AND parent_area_id=$3 AND status='ACTIVE' AND level='BLOCK' FOR SHARE",[ensureId(block),a.realmId,district])).rowCount)
   throw new BadRequestException("Choose a block in the selected district");
 }
 async beneficiaryBlockOptions(tx:PoolClient,a:VerifiedFoundationActor,state:string|null,district:string|null){
  await this.projectGeography(tx,a,state,district);
  if(!district)return [];
  return (await tx.query<{value:string;label:string}>("SELECT id AS value,display_name AS label FROM geography_area WHERE root_realm_id=$1 AND parent_area_id=$2 AND level='BLOCK' AND status='ACTIVE' ORDER BY display_name,id LIMIT 200",[a.realmId,district])).rows;
 }
 /** A verified self applicant chooses an actual public branch preference;
  * this is not a Foundation operator grant or branch management access. */
 async membershipApplicantBranch(tx:PoolClient,a:VerifiedFoundationActor,ref:string|null){
  if(ref===null)return null;
  const result=await tx.query<{name:string}>("SELECT name FROM branch WHERE root_realm_id=$1 AND id=$2 AND status='ACTIVE' FOR SHARE",[a.realmId,ensureId(ref)]);
  if(!result.rows[0])throw new BadRequestException("Choose an active Foundation branch.");
  return result.rows[0].name;
 }
 async membershipApplicantBranches(tx:PoolClient,a:VerifiedFoundationActor){
  const q=await tx.query<{value:string;label:string}>("SELECT id AS value,name AS label FROM branch WHERE root_realm_id=$1 AND status='ACTIVE' ORDER BY name,id LIMIT 200",[a.realmId]);
  return q.rows;
 }
 async projectGeographyOptions(tx:PoolClient,a:VerifiedFoundationActor,state:string|null){
  if(state)await this.projectGeography(tx,a,state,null);
  const q=await tx.query<{id:string;display_name:string}>("SELECT id,display_name FROM geography_area WHERE root_realm_id=$1 AND status='ACTIVE' AND (($2::uuid IS NULL AND level='STATE') OR (level='DISTRICT' AND parent_area_id=$2)) ORDER BY display_name,id LIMIT 200",[a.realmId,state]);
  return q.rows.map(v=>({value:v.id,label:v.display_name}));
 }
}
