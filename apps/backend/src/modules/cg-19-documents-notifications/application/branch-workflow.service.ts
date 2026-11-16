import {BadRequestException,ConflictException,Injectable} from "@nestjs/common";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {BranchLifecycleService} from "../../cg-02-foundation-structure/application/branch-lifecycle.service";
import {BranchOperationsService} from "../../cg-02-foundation-structure/application/branch-operations.service";
import {ActiveBranchEvidenceService} from "./active-branch-evidence.service";
import {BranchApprovalService} from "../../cg-03-registration-approvals/application/branch-approval.service";
import {BranchPrivateEvidenceService} from "./branch-private-evidence.service";
import type {BranchVerifiedFile} from "./branch-private-evidence.service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value:unknown):string{
 if(typeof value!=="string"||!UUID.test(value))throw new BadRequestException("Choose a valid branch");
 return value;
}
function object(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))
   throw new BadRequestException("Check the branch registration request");
 return value as Record<string,unknown>;
}
function fileList(value:unknown):string[]{
 if(value===undefined||value===null)return [];
 if(!Array.isArray(value)||value.some(x=>typeof x!=="string"||!UUID.test(x)))
   throw new BadRequestException("Choose verified private files");
 return value as string[];
}
function sameProof(a:readonly BranchVerifiedFile[],b:readonly BranchVerifiedFile[]){
 const safe=(x:readonly BranchVerifiedFile[])=>JSON.stringify([...x].sort((p,q)=>p.fileRef.localeCompare(q.fileRef)));
 return safe(a)===safe(b);
}
/** Server-only integration owner. CG-02 writes branch records; CG-03 writes
 * decisions; CG-19 verifies file bytes. No network/provider work under locks.
 */
@Injectable()
export class BranchWorkflowService{
 constructor(private readonly sessions:SessionService,
  private readonly sources:BranchSourceFacade,
  private readonly lifecycle:BranchLifecycleService,
  private readonly approvals:BranchApprovalService,
  private readonly evidence:BranchPrivateEvidenceService,
  private readonly operations:BranchOperationsService,
  private readonly activeEvidence:ActiveBranchEvidenceService){}
 async submit(bearer:string,registrationRef:string,payload:unknown){
   const input=object(payload),reg=id(registrationRef),key=id(input.requestKey);
   const version=Number(input.expectedVersion);
   if(!Number.isSafeInteger(version)||version<1)
     throw new BadRequestException("Refresh the draft before submitting");
   // A real CG-03 process is a prerequisite, not an effect that a branch
   // manager may silently configure while submitting.
   const route=await this.approvals.processStatus(bearer);
   if(!route.configured)return {status:"REVIEW_ROUTE_UNAVAILABLE",
     message:"A Super Admin must enable branch approval before the application can be submitted."};
   const source=await this.sources.draft(bearer,reg,version,false);
   const stages=source.stages;
   const refs=[
     ...fileList(stages["1"]?.photoFiles),
     ...fileList(stages["1"]?.logoFiles),
     ...fileList(stages["3"]?.registrationFiles),
     ...fileList(stages["4"]?.agreementFiles),
     ...fileList(stages["4"]?.photoFiles)
   ];
   if(new Set(refs).size!==refs.length)
     throw new BadRequestException("Remove repeated attachments from the branch draft");
   // Actual CG-19 verified files are required; staged UUIDs are never proofs.
   const versions=await this.evidence.prevalidate(bearer,reg,refs,true);
   const frozen=await this.lifecycle.freezeSubmission(
     bearer,reg,version,key,versions,
     (client,actor)=>this.evidence.guardProof(client,actor,reg,versions));
   try{
     const approval=await this.approvals.createOrGetCase(bearer,reg,
       frozen.submissionRevision,frozen.digest,frozen.sourceKey);
     // Always attach the original immutable case, even if a reviewer has
     // already decided while the first cross-owner response was lost.
     await this.lifecycle.acceptCase(bearer,reg,
       frozen.submissionRevision,frozen.digest,approval.caseRef,
       (client,actor)=>this.approvals.guardOriginalCase(client,actor,reg,
         frozen.submissionRevision,frozen.digest,approval.caseRef));
     if(["SUBMITTED","IN_REVIEW"].includes(approval.status)){
       return {status:"SUBMITTED",reference:approval.reference,caseRef:approval.caseRef,
         submissionRevision:frozen.submissionRevision,
         message:"The original branch application is confirmed for Super Admin review."};
     }
     return {status:"DECISION_RECORDED_SOURCE_SYNC_PENDING",
       reference:approval.reference,caseRef:approval.caseRef,
       submissionRevision:frozen.submissionRevision,
       message:"The original approval case was recovered. Its prior decision must now be reconciled by an authorized Super Admin."};
   }catch{
     // CG-02 snapshot was committed, CG-03 may have committed too.
     // Truthfully preserve UNKNOWN until the original source key is reconciled.
     return {status:"SUBMISSION_UNCONFIRMED",submissionRevision:frozen.submissionRevision,
       message:"The approval application could not be confirmed. Check the original registration before retrying."};
   }
 }
 async status(bearer:string,registrationRef:string){
   const registration=await this.lifecycle.status(bearer,id(registrationRef));
   const mostRecent=registration.submissions[0];
   if(!mostRecent?.caseRef)return {...registration,approval:null};
   try{
     const approval=await this.approvals.detail(bearer,mostRecent.caseRef);
     return {...registration,approval:{reference:approval.reference,
       status:approval.status,history:approval.history,revision:approval.revision}};
   }catch{
     return {...registration,approval:null,
       message:"The approval decision is temporarily unavailable. No unverified decision is shown."};
   }
 }
 /** Typed CG-19 owner verifies any replacement object before CG-02 changes
  * the currently approved operating branch; no provider/network under locks.
  */
 async updateOperating(bearer:string,branchRef:string,payload:unknown){
   const input=object(payload),ref=id(branchRef);
   const current=await this.operations.detail(bearer,ref);
   const expected=Number(input.expectedVersion);
   if(!Number.isSafeInteger(expected)||expected<1||expected!==current.version)
     throw new ConflictException("The current branch changed. Refresh before saving.");
   const supplied=input.evidenceFiles;
   if(supplied===undefined)return this.operations.update(bearer,ref,input);
   if(!Array.isArray(supplied)||supplied.length>12||
     supplied.some(x=>typeof x!=="string"||!UUID.test(x))||
     new Set(supplied).size!==supplied.length)
     throw new BadRequestException("Choose current verified private branch files");
   const verified=await this.activeEvidence.prevalidate(bearer,ref,expected,supplied);
   return this.operations.update(bearer,ref,input,verified,
     (client,actor)=>this.activeEvidence.guardProof(client,actor,ref,expected,verified));
 }
 async processStatus(bearer:string){return this.approvals.processStatus(bear);}
 async initializeProcess(bearer:string){return this.approvals.initializeProcess(bear);}
 async cases(bearer:string,offset=0){return this.approvals.listCases(bearer,offset);}
 async caseDetail(bearer:string,caseRef:string){
   return this.approvals.detail(bearer,id(caseRef));
 }
 async decide(bearer:string,caseRef:string,payload:unknown){
   const before=await this.approvals.sourceCase(bearer,id(caseRef));
   const decided=await this.approvals.decide(bearer,caseRef,payload);
   if(!["RETURNED","REJECTED","PENDING_OWNER"].includes(decided.status))
     return {...decided,message:"The original decision was already recorded."};
   const state=decided.status as "RETURNED"|"REJECTED"|"PENDING_OWNER";
   try{
     await this.lifecycle.syncDecision(bearer,before.registrationRef,caseRef,
       state,(client,actor)=>this.approvals.guardOutcome(client,actor,caseRef,state));
   }catch{
     return {...decided,status:"DECISION_RECORDED_SOURCE_SYNC_PENDING",
       message:"The decision was recorded. Branch status confirmation is pending."};
   }
   if(state==="PENDING_OWNER"){
     try{
       const result=await this.finalize(bearer,caseRef);
       return {...decided,...result};
     }catch{
       return {...decided,status:"FINAL_APPROVED_PENDING_ACTIVATION",
         message:"Super Admin approval is recorded. Actual branch activation is still pending verification."};
     }
   }
   return {...decided,status:state,
     message:state==="RETURNED"?"Branch registration returned for correction.":
       "Branch application rejected; no branch was activated."};
 }
 /** Reconcile a previously committed CG-03 decision when the CG-02 status
  * write/response was lost. Never create or approve another decision.
  */
 async reconcile(bearer:string,caseRef:string){
   await this.sessions.requireAction(bearer,"foundation.branches.admin");
   const source=await this.approvals.sourceCase(bearer,id(caseRef));
   if(!["RETURNED","REJECTED","PENDING_OWNER","OWNER_COMPLETED"].includes(source.status))
     throw new ConflictException("There is no completed branch decision to reconcile");
   if(source.status==="OWNER_COMPLETED"){
     return this.lifecycle.status(bearer,source.registrationRef);
   }
   await this.lifecycle.syncDecision(bearer,source.registrationRef,caseRef,
     source.status as "RETURNED"|"REJECTED"|"PENDING_OWNER",
     (client,actor)=>this.approvals.guardOutcome(client,actor,caseRef,
       source.status as "RETURNED"|"REJECTED"|"PENDING_OWNER"));
   if(source.status==="PENDING_OWNER")return this.finalize(bearer,caseRef);
   return {status:source.status,message:"The original branch decision has been synchronized."};
 }
 async finalize(bearer:string,caseRef:string){
   await this.sessions.requireAction(bearer,"foundation.branches.admin");
   const source=await this.approvals.sourceCase(bearer,id(caseRef));
   const saved=await this.sources.submission(bearer,source.registrationRef,
     source.revision,source.digest);
   if(saved.caseRef!==caseRef)
     throw new ConflictException("Approved case does not match the original branch submission");
   const live=await this.evidence.prevalidate(bearer,source.registrationRef,
     saved.fileVersions.map(f=>f.fileRef),true);
   if(!sameProof(live,saved.fileVersions as BranchVerifiedFile[]))
     throw new ConflictException("The approved document versions have changed or been revoked");
   const approved=await this.approvals.proof(bearer,caseRef,
     source.registrationRef,source.revision,source.digest);
   const activated=await this.lifecycle.activate(bearer,source.registrationRef,
     source.revision,source.digest,caseRef,approved.effectKey,
     (client,actor)=>this.approvals.guardFinalDecision(client,actor,caseRef,
       source.registrationRef,source.revision,source.digest,approved.effectKey),
     (client,actor)=>this.evidence.guardProof(client,actor,source.registrationRef,live));
   try{
     await this.approvals.markCompleted(bearer,caseRef,approved.effectKey);
     return {...activated,message:"Branch activation confirmed with one original branch code."};
   }catch{
     return {...activated,status:"ACTIVE_SOURCE_SYNC_PENDING",
       message:"The branch was activated. The approval timeline still needs confirmation."};
   }
 }
}
