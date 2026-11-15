import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {ApprovalProposalService} from "./application/proposal.service";
import {ApprovalProposalController} from "./http/proposal.controller";
@Module({
  imports:[IdentityAccessModule],
  providers:[ApprovalProposalService],
  controllers:[ApprovalProposalController],
  exports:[ApprovalProposalService]
})
export class RegistrationApprovalsModule {}
