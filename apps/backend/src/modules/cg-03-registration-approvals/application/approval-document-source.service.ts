import {Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {ApprovalProposalService,UUID} from "./proposal.service";

/** CG-03-owned read facade for CG-19. No CG-19 query may directly join
 * approval case, reviewer or CG-01 account tables to establish authority.
 */
export type ApprovalDocumentSnapshot=Readonly<{
  realmId:string;caseRef:string;caseNumber:string;proposalRevision:number;
  caseStatus:string;accountName:string;roleName:string;
  archivalOnly:boolean;approvedGrantVerified:boolean;
}>;
@Injectable()
export class ApprovalDocumentSource{
  constructor(
    @Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly proposals:ApprovalProposalService,
    private readonly owner:ProtectedAccessOwnerService
  ){}
  async getCurrentCase(bearer:string,caseRef:string):Promise<ApprovalDocumentSnapshot>{
    if(!UUID.test(caseRef))throw new NotFoundException("Application unavailable");
    // The CG-03 owner validates current actor, scope, and case relationship.
    const caseView=await this.proposals.detail(bearer,caseRef);
    const actor=await this.sessions.verifySession(bearer);
    const isFinal=caseView.status==="OWNER_COMPLETED";
    let approvedGrantVerified=false;
    if(isFinal){
      const proof=await this.db.query<{effect_key:string}>(`
        SELECT f.effect_key FROM cg03_finalization f
        JOIN cg03_case c ON c.id=f.case_id AND c.realm_id=f.realm_id
        WHERE f.case_id=$1 AND f.realm_id=$2
          AND c.status='OWNER_COMPLETED' AND f.state='OWNER_COMPLETED'
          AND c.proposal_revision=$3
        LIMIT 1
      `,[caseRef,actor.realmId,caseView.proposalRevision]);
      if(proof.rows[0]){
        // The CG-01 idempotent grant ledger, not a CG-03 pending approval,
        // is the only proof that a private confirmation letter can be issued.
        const outcome=await this.owner.protectedEffectOutcome(proof.rows[0].effect_key);
        approvedGrantVerified=outcome.state==="CONFIRMED";
      }
    }
    return {
      realmId:actor.realmId,caseRef,caseNumber:caseView.reference,
      proposalRevision:caseView.proposalRevision,caseStatus:caseView.status,
      accountName:caseView.accountName,roleName:caseView.roleName,
      archivalOnly:!["SUBMITTED","IN_REVIEW"].includes(caseView.status),
      approvedGrantVerified
    };
  }
}
