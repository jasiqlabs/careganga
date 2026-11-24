import {PayrollCompensationModule} from "../cg-11-payroll-compensation/payroll-compensation.module";
import {PayrollPayslipController} from "./http/payroll-payslip.controller";
import {PayrollPayslipService} from "./application/payroll-payslip.service";
import {DonationPrivateProofService} from "./application/donation-private-proof.service";
import {DonationPrivateProofController} from "./http/donation-private-proof.controller";
import {DonationReceiptMessageService} from "./application/donation-receipt-message.service";
import {DonationReceiptDocumentService} from "./application/donation-receipt-document.service";
import {DonationReceiptDocumentController,DonorOwnReceiptController} from "./http/donation-receipt-document.controller";
import {MembershipEvidenceSourceModule} from "./membership-evidence-source.module";
import {Module} from "@nestjs/common";
import {HrSourceModule} from "../cg-10-human-resources/hr-source.module";
import {HrIssuedDocumentController,HrEmployeeCardVerifierController} from "./http/hr-issued-document.controller";
import {HrIssuedDocumentService} from "./application/hr-issued-document.service";
import {ConsultationSlipSourceModule} from "../cg-15-patients-appointments/consultation-slip-source.module";
import {AppointmentSlipDocumentService} from "./application/appointment-slip-document.service";
import {AppointmentSlipController} from "./http/appointment-slip.controller";
import {HealthPublicRequestThrottleService}
 from "../cg-14-healthcare-network/application/health-public-request-throttle.service";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {BranchPrivateEvidenceService} from "./application/branch-private-evidence.service";
import {BranchWorkflowService} from "./application/branch-workflow.service";
import {ActiveBranchEvidenceService} from "./application/active-branch-evidence.service";
import {ActiveBranchEvidenceController} from "./http/active-branch-evidence.controller";
import {BranchPrivateEvidenceController} from "./http/branch-private-evidence.controller";
import {BranchWorkflowController} from "./http/branch-workflow.controller";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {FinanceBankStatementEvidenceService} from "./application/finance-bank-statement-evidence.service";
import {FinanceBankStatementEvidenceController} from "./http/finance-bank-statement-evidence.controller";
import {FinanceReceiptDocumentService} from "./application/finance-receipt-document.service";
import {MisProtectedArtifactService} from "./application/mis-protected-artifact.service";
import {MisReportNoticeService} from "./application/mis-report-notice.service";
import {FinanceReceiptDocumentController} from "./http/finance-receipt-document.controller";
import {FinanceInvoiceDocumentService} from "./application/finance-invoice-document.service";
import {FinanceInvoiceDocumentController} from "./http/finance-invoice-document.controller";
import {FinanceClaimEvidenceService} from "./application/finance-claim-evidence.service";
import {FinanceClaimEvidenceController} from "./http/finance-claim-evidence.controller";
import {FinanceVoucherEvidenceService} from "./application/finance-voucher-evidence.service";
import {FinanceVoucherEvidenceController} from "./http/finance-voucher-evidence.controller";
import {PrivateEvidenceService} from "./application/private-evidence.service";
import {CmsDraftMediaService} from "./application/cms-draft-media.service";
import {HealthDraftEvidenceService} from "./application/health-draft-evidence.service";
import {HealthDraftEvidenceController} from "./http/health-draft-evidence.controller";
import {HealthDoctorPrivateEvidenceService} from "./application/health-doctor-private-evidence.service";
import {HealthDoctorPrivateEvidenceController} from "./http/health-doctor-private-evidence.controller";
import {PatientPrivateFilesService} from "./application/patient-private-files.service";
import {PatientClinicalFileSharingService} from "./application/patient-clinical-file-sharing.service";
import {PatientClinicalFileSharingController} from "./http/patient-clinical-file-sharing.controller";
import {HealthClinicianIdentityService} from "../cg-14-healthcare-network/application/health-clinician-identity.service";
import {PatientPrivateFilesController} from "./http/patient-private-files.controller";
import {CmsPublicNoticeSource} from "./application/cms-public-notice-source.service";
import {CmsPublicNoticeSourceController} from "./http/cms-public-notice-source.controller";
import {CmsDraftMediaController,CmsPublicMediaController} from "./http/cms-draft-media.controller";
import {ProjectsSourceModule} from "../cg-05-projects-field-operations/projects-source.module";
import {BeneficiariesSourceModule} from "../cg-06-beneficiaries-assistance/beneficiaries-source.module";
import {BeneficiaryEvidenceService} from "./application/beneficiary-evidence.service";
import {BeneficiaryEvidenceController} from "./http/beneficiary-evidence.controller";
import {VisitEvidenceService} from "./application/visit-evidence.service";
import {VisitEvidenceController} from "./http/visit-evidence.controller";
import {ActivityEvidenceService} from "./application/activity-evidence.service";
import {ActivityEvidenceController} from "./http/activity-evidence.controller";
import {ProjectCoverEvidenceService} from "./application/project-cover-evidence.service";
import {CampaignMediaEvidenceService} from "./application/campaign-media-evidence.service";
import {CampaignMediaEvidenceController} from "./http/campaign-media-evidence.controller";
import {CampaignPublicMediaController} from "./http/campaign-public-media.controller";
import {CampaignPublicMediaService} from "./application/campaign-public-media.service";
import {CampaignsDonationsModule} from "../cg-07-campaigns-donations/campaigns-donations.module";
import {ProjectCoverEvidenceController} from "./http/project-cover-evidence.controller";
import {InventorySourceModule} from "../cg-12-inventory-suppliers/inventory-source.module";
import {InventoryReceiptEvidenceService} from "./application/inventory-receipt-evidence.service";
import {InventoryReceiptEvidenceController} from "./http/inventory-receipt-evidence.controller";
import {PrivateObjectStorage} from "./infrastructure/private-object-storage";
import {makePrivateStorageProvider} from "./infrastructure/private-storage-provider.factory";
import {PrivateEvidenceController} from "./http/private-evidence.controller";
import {PrivateLetterController} from "./http/private-letter.controller";
import {PrivateLetterService} from "./application/private-letter.service";
import {NotificationService} from "./application/notification.service";
import {ClientEmailTemplateService} from "./application/client-email-template.service";
import {NoticeService} from "./application/notice.service";
import {DeliveryService} from "./application/delivery.service";
import {CommunicationProviders} from "./infrastructure/channel-providers";
import {CommunicationWorker} from "./infrastructure/communication-worker";
import {SupportService} from "./application/support.service";
import {HealthCenterSupportScopeFacade} from "../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {HealthCenterContentMediaService} from "./application/health-center-content-media.service";
import {HealthCenterContentMediaController} from "./http/health-center-content-media.controller";
import {CenterSupportAttachmentService} from "./application/center-support-attachment.service";
import {CenterSupportAttachmentController,SupportAgentAttachmentController} from "./http/center-support-attachment.controller";
import {SupportController} from "./http/support.controller";
import {CommunicationsController,CommunicationProviderWebhookController} from
  "./http/communications.controller";

/** CG-19 owns private media/documents, US-002 communications and US-003
 * Foundation-only contact/helpdesk. No speculative center/CMS source.
 * Firebase or AWS S3 is selected explicitly per client deployment.
 * Missing secured credentials or a real ClamAV scanner stays unavailable.
 */
import {CsrAgreementSourceModule} from "./csr-agreement-source.module";
import {CsrAgreementEvidenceController} from "./http/csr-agreement-evidence.controller";
import {CsrFundingAgreementEvidenceController} from "./http/csr-funding-agreement-evidence.controller";
import {InventoryMovementEvidenceService} from './application/inventory-movement-evidence.service';
import {InventoryMovementEvidenceController} from './http/inventory-movement-evidence.controller';
@Module({
  imports:[PayrollCompensationModule,BeneficiariesSourceModule,CsrAgreementSourceModule,MembershipEvidenceSourceModule,ProjectsSourceModule,CampaignsDonationsModule,InventorySourceModule,HrSourceModule,IdentityAccessModule,RegistrationApprovalsModule,FoundationStructureModule,FinanceSourceModule,ConsultationSlipSourceModule],
  controllers:[PayrollPayslipController,BeneficiaryEvidenceController,CsrAgreementEvidenceController,CsrFundingAgreementEvidenceController,DonationPrivateProofController,DonationReceiptDocumentController,DonorOwnReceiptController,VisitEvidenceController,ActivityEvidenceController,ProjectCoverEvidenceController,CampaignMediaEvidenceController,CampaignPublicMediaController,InventoryMovementEvidenceController,InventoryReceiptEvidenceController,HrIssuedDocumentController,HrEmployeeCardVerifierController,PatientPrivateFilesController,PatientClinicalFileSharingController,AppointmentSlipController,SupportAgentAttachmentController,CenterSupportAttachmentController,HealthCenterContentMediaController,HealthDraftEvidenceController,HealthDoctorPrivateEvidenceController,PrivateEvidenceController,PrivateLetterController,BranchPrivateEvidenceController,BranchWorkflowController,ActiveBranchEvidenceController,FinanceVoucherEvidenceController,FinanceClaimEvidenceController,FinanceInvoiceDocumentController,FinanceReceiptDocumentController,FinanceBankStatementEvidenceController,CmsDraftMediaController,CmsPublicMediaController,CmsPublicNoticeSourceController,
    CommunicationsController,CommunicationProviderWebhookController,SupportController],
  providers:[PayrollPayslipService,BeneficiaryEvidenceService,DonationPrivateProofService,DonationReceiptMessageService,DonationReceiptDocumentService,VisitEvidenceService,ActivityEvidenceService,ProjectCoverEvidenceService,CampaignMediaEvidenceService,CampaignPublicMediaService,InventoryMovementEvidenceService,InventoryReceiptEvidenceService,HrIssuedDocumentService,PatientPrivateFilesService,PatientClinicalFileSharingService,HealthClinicianIdentityService,HealthPublicRequestThrottleService,AppointmentSlipDocumentService,HealthDraftEvidenceService,HealthDoctorPrivateEvidenceService,PrivateEvidenceService,CmsDraftMediaService,CmsPublicNoticeSource,PrivateLetterService,BranchPrivateEvidenceService,BranchWorkflowService,ActiveBranchEvidenceService,FinanceVoucherEvidenceService,FinanceClaimEvidenceService,FinanceInvoiceDocumentService,FinanceReceiptDocumentService,FinanceBankStatementEvidenceService,
    NotificationService,NoticeService,DeliveryService,ClientEmailTemplateService,
    MisProtectedArtifactService,MisReportNoticeService,
    CommunicationProviders,CommunicationWorker,SupportService,HealthCenterSupportScopeFacade,
    HealthCenterContentMediaService,CenterSupportAttachmentService,
    {provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],
  exports:[BeneficiaryEvidenceService,CsrAgreementSourceModule,ProjectCoverEvidenceService,CampaignMediaEvidenceService,InventoryMovementEvidenceService,InventoryReceiptEvidenceService,CenterSupportAttachmentService,HealthCenterContentMediaService,HealthDraftEvidenceService,HealthDoctorPrivateEvidenceService,PrivateEvidenceService,CmsDraftMediaService,CmsPublicNoticeSource,PrivateLetterService,SupportService,BranchPrivateEvidenceService,ActiveBranchEvidenceService,FinanceVoucherEvidenceService,FinanceClaimEvidenceService,FinanceInvoiceDocumentService,FinanceReceiptDocumentService,FinanceBankStatementEvidenceService,MisProtectedArtifactService,MisReportNoticeService]
})
export class DocumentsNotificationsModule{}
