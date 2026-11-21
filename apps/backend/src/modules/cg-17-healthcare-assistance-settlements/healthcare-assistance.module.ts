import {Module} from "@nestjs/common";
import {PartnerInvoiceVerificationService} from "./application/partner-invoice-verification.service";
import {PartnerInvoiceVerificationController} from "./http/partner-invoice-verification.controller";
import {PartnerServiceClaimService} from "./application/partner-service-claim.service";
import {PartnerServiceClaimController} from "./http/partner-service-claim.controller";
import {CenterMerchantProvisioningService} from "./application/center-merchant-provisioning.service";
import {CenterMerchantCheckoutService} from "./application/center-merchant-checkout.service";
import {CenterMerchantController} from "./http/center-merchant.controller";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {PatientsAppointmentsModule} from "../cg-15-patients-appointments/patients-appointments.module";
import {HealthNetworkModule} from "../cg-14-healthcare-network/health-network.module";
import {PublicHealthcareAssistanceService} from "./application/public-healthcare-assistance.service";
import {CenterPatientCollectionService} from "./application/center-patient-collection.service";
import {CenterPatientReceiptService} from "./application/center-patient-receipt.service";
import {CompletedConsultationLiabilityService} from "./application/completed-consultation-liability.service";
import {FoundationJournalReconciliationService} from "./application/foundation-journal-reconciliation.service";
import {FoundationLiabilityCorrectionService} from "./application/foundation-liability-correction.service";
import {MonthlyProviderSettlementService} from "./application/monthly-provider-settlement.service";
import {VerifiedProviderPayoutService} from "./application/verified-provider-payout.service";
import {MonthlyProviderSettlementController} from "./http/monthly-provider-settlement.controller";
import {FoundationJournalReconciliationController} from "./http/foundation-journal-reconciliation.controller";
import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {CompletedConsultationLiabilityController} from "./http/completed-consultation-liability.controller";
import {CenterPatientReceiptController} from "./http/center-patient-receipt.controller";
import {LabResultStorageModule} from "../cg-19-documents-notifications/lab-result-storage.module";
import {CenterPatientCollectionController} from "./http/center-patient-collection.controller";
import {PublicHealthcareAssistanceController} from "./http/public-healthcare-assistance.controller";
import {HealthcarePolicyApprovalService} from "./application/healthcare-policy-approval.service";
import {HealthcarePolicyApprovalController} from "./http/healthcare-policy-approval.controller";
import {HealthcareAssistanceReviewSourceFacade} from "./application/healthcare-assistance-review-source.facade";
import {ConsultationPatientChargeService} from "./application/consultation-patient-charge.service";
import {ConsultationPatientChargeController} from "./http/consultation-patient-charge.controller";
import {HealthcareAssistancePolicyService}
 from "./application/healthcare-assistance-policy.service";
import {HealthcareAssistancePolicyController}
 from "./http/healthcare-assistance-policy.controller";
@Module({
 imports:[IdentityAccessModule,HealthNetworkModule,PatientsAppointmentsModule,LabResultStorageModule,FinanceSourceModule],
 providers:[PartnerInvoiceVerificationService,PartnerServiceClaimService,VerifiedProviderPayoutService,MonthlyProviderSettlementService,FoundationJournalReconciliationService,FoundationLiabilityCorrectionService,CompletedConsultationLiabilityService,CenterMerchantCheckoutService,CenterMerchantProvisioningService,CenterPatientCollectionService,CenterPatientReceiptService,PublicHealthcareAssistanceService,HealthcareAssistanceReviewSourceFacade,HealthcarePolicyApprovalService,HealthcareAssistancePolicyService,ConsultationPatientChargeService],
 controllers:[PartnerInvoiceVerificationController,PartnerServiceClaimController,MonthlyProviderSettlementController,FoundationJournalReconciliationController,CompletedConsultationLiabilityController,CenterMerchantController,CenterPatientCollectionController,CenterPatientReceiptController,PublicHealthcareAssistanceController,HealthcarePolicyApprovalController,HealthcareAssistancePolicyController,ConsultationPatientChargeController],
 exports:[HealthcareAssistancePolicyService,ConsultationPatientChargeService]
})
export class HealthcareAssistanceModule{}
