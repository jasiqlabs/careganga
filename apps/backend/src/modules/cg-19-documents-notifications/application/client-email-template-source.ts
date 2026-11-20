/** CareGanga client-provided Master Email v2.0 (29-Oct-2026).
 * Source checked against 22-page DOCX and 52 identifiers.
 * These are DRAFT SEEDS ONLY. No source event, recipient or approved PDF is
 * inferred by a template being present. Never send from this catalog.
 * Legal 80G/identity/validity and placeholder values come from verified owners.
 */
export type ClientEmailSource=Readonly<{
  code:string;title:string;owner:string;trigger:string;recipient:string;
  subject:string;body:string;attachmentRule:string;
  placeholders:readonly string[]
}>;
export const CLIENT_EMAIL_SOURCE:readonly ClientEmailSource[]=
[
  {
    "code": "CG-MEM-001",
    "title": "Application submitted / admin notification",
    "owner": "MEM",
    "trigger": "Member application successfully submitted.",
    "recipient": "Applicant and designated Membership Admin notification address.",
    "subject": "Membership Application Received — {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nWe have received your membership application.\nApplication ID: {#APPLICATION_ID#}\nMembership type: {#MEMBERSHIP_TYPE#}\nSubmission date: {#SUBMISSION_DATE#}\nCurrent status: {#APPLICATION_STATUS#}\n\nYour application is awaiting review. Track status: {#STATUS_LINK#}.\n\nRegards,\nMembership Team\nCareGanga Foundation",
    "attachmentRule": "Applicant confirmation: no attachment. Internal admin notification may include secure portal link, not unnecessary personal documents.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME",
      "MEMBERSHIP_TYPE",
      "SUBMISSION_DATE",
      "APPLICATION_STATUS",
      "STATUS_LINK"
    ]
  },
  {
    "code": "CG-MEM-002",
    "title": "Membership payment successful + receipt",
    "owner": "MEM",
    "trigger": "Payment provider confirms success and official receipt PDF is generated.",
    "recipient": "Applicant/member.",
    "subject": "Membership Payment Confirmed — Receipt {#RECEIPT_NUMBER#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour membership payment has been confirmed.\nApplication ID: {#APPLICATION_ID#}\nMembership type: {#MEMBERSHIP_TYPE#}\nAmount: {#AMOUNT#}\nTransaction/reference number: {#TRANSACTION_ID#}\nReceipt number: {#RECEIPT_NUMBER#}\nPayment date: {#PAYMENT_DATE#}\n\nPlease find your official membership payment receipt attached.\n\nRegards,\nFinance & Accounts Team\nCareGanga Foundation",
    "attachmentRule": "Attach: Membership Payment Receipt PDF. Send only after provider-confirmed success.",
    "placeholders": [
      "RECEIPT_NUMBER",
      "RECIPIENT_NAME",
      "APPLICATION_ID",
      "MEMBERSHIP_TYPE",
      "AMOUNT",
      "TRANSACTION_ID",
      "PAYMENT_DATE"
    ]
  },
  {
    "code": "CG-MEM-003",
    "title": "Documents received",
    "owner": "MEM",
    "trigger": "Member uploads required documents successfully.",
    "recipient": "Applicant.",
    "subject": "Membership Documents Received — {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nWe have received the documents submitted for application {#APPLICATION_ID#}.\nDocument status: Received — verification pending.\n\nReceipt of documents does not mean the documents are verified or the membership is approved. We will notify you when\nthe status changes.\n\nRegards,\nMembership Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME"
    ]
  },
  {
    "code": "CG-MEM-004",
    "title": "Documents verified",
    "owner": "MEM",
    "trigger": "Reviewer saves the document verification result as Verified; final application decision is still pending.",
    "recipient": "Applicant.",
    "subject": "Membership Documents Verified — {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nThe documents submitted for application {#APPLICATION_ID#} have been verified.\nCurrent application status: {#APPLICATION_STATUS#}.\n\nThis email confirms document verification only. Final membership approval will be communicated separately.\n\nRegards,\nMembership Team",
    "attachmentRule": "No attachment. Do not imply final membership approval.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME",
      "APPLICATION_STATUS"
    ]
  },
  {
    "code": "CG-MEM-005",
    "title": "Documents rejected / correction required",
    "owner": "MEM",
    "trigger": "Reviewer rejects one or more documents and saves a recipient-visible reason.",
    "recipient": "Applicant.",
    "subject": "Action Required — Membership Documents — {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nOne or more documents submitted for application {#APPLICATION_ID#} could not be accepted.\nDocument(s): {#DOCUMENT_LIST#}\nReason: {#REJECTION_REASON#}\nRequired action: {#ACTION_REQUIRED#}\nResubmission link: {#SECURE_UPLOAD_LINK#}\nDeadline, if applicable: {#DUE_DATE#}\n\nPlease submit the corrected documents through the official portal.\n\nRegards,\nMembership Team",
    "attachmentRule": "No attachment. Use approved, recipient-visible reason only.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME",
      "DOCUMENT_LIST",
      "REJECTION_REASON",
      "ACTION_REQUIRED",
      "SECURE_UPLOAD_LINK",
      "DUE_DATE"
    ]
  },
  {
    "code": "CG-MEM-006",
    "title": "Application sent back",
    "owner": "MEM",
    "trigger": "Authorised reviewer changes application status to Sent Back.",
    "recipient": "Applicant.",
    "subject": "Membership Application Sent Back — {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour application {#APPLICATION_ID#} has been sent back for additional information or correction.\nReason: {#REASON#}\nAction required: {#ACTION_REQUIRED#}\nSubmit here: {#PORTAL_LINK#}\n\nYour application is not finally approved or rejected. Please resubmit the required information.\n\nRegards,\nMembership Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME",
      "REASON",
      "ACTION_REQUIRED",
      "PORTAL_LINK"
    ]
  },
  {
    "code": "CG-MEM-007",
    "title": "Final membership approval + full document pack",
    "owner": "MEM",
    "trigger": "Final approval is saved, Member ID and all three approved PDFs are generated.",
    "recipient": "Approved member.",
    "subject": "Membership Approved — Member ID {#MEMBER_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nCongratulations. Your CareGanga Foundation membership has been approved.\n\nMember ID: {#MEMBER_ID#}\nMembership type: {#MEMBERSHIP_TYPE#}\nIssue date: {#ISSUE_DATE#}\nValidity: {#VALIDITY_PERIOD#}\nExpiry date: {#EXPIRY_DATE_OR_NA#}\nApproval date: {#APPROVAL_DATE#}\n\nPlease find these approved documents attached:\n1. Member ID Card\n2. Welcome Letter\n3. Membership Certificate\n\nPlease check that the details are correct and contact the Membership Team if any correction is required.\n\nRegards,\nMembership Team\nCareGanga Foundation",
    "attachmentRule": "Attach all three PDFs. Lifetime membership: Expiry Date = N/A / No expiry. Do not send until all required files exist.",
    "placeholders": [
      "MEMBER_ID",
      "RECIPIENT_NAME",
      "MEMBERSHIP_TYPE",
      "ISSUE_DATE",
      "VALIDITY_PERIOD",
      "EXPIRY_DATE_OR_NA",
      "APPROVAL_DATE"
    ]
  },
  {
    "code": "CG-MEM-008",
    "title": "Application rejected",
    "owner": "MEM",
    "trigger": "Authorised final rejection saved.",
    "recipient": "Applicant.",
    "subject": "Membership Application Decision — {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nWe regret to inform you that application {#APPLICATION_ID#} has not been approved.\nReason: {#REJECTION_REASON#}\n\nFurther action or appeal route, if available: {#NEXT_STEPS#}\n\nRegards,\nMembership Team",
    "attachmentRule": "No attachment. Rejection reason must be approved for disclosure.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME",
      "REJECTION_REASON",
      "NEXT_STEPS"
    ]
  },
  {
    "code": "CG-MEM-009",
    "title": "General Membership renewal reminder",
    "owner": "MEM",
    "trigger": "Configured reminder milestone before expiry; membership not renewed.",
    "recipient": "Active General Member.",
    "subject": "Membership Renewal Reminder — Expires {#EXPIRY_DATE#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour General Membership is due to expire on {#EXPIRY_DATE#}.\nPlease renew before expiry using: {#RENEWAL_LINK#}\n\nMember ID: {#MEMBER_ID#}\n\nRegards,\nMembership Team",
    "attachmentRule": "Schedule at policy milestones such as 30 days and 7 days. Exclude Lifetime Membership and already-renewed members.",
    "placeholders": [
      "EXPIRY_DATE",
      "RECIPIENT_NAME",
      "RENEWAL_LINK",
      "MEMBER_ID"
    ]
  },
  {
    "code": "CG-MEM-010",
    "title": "Renewal payment confirmed",
    "owner": "MEM",
    "trigger": "Renewal payment confirmed by provider; new validity saved.",
    "recipient": "Member.",
    "subject": "Membership Renewal Confirmed — {#MEMBER_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour membership renewal payment has been confirmed.\nMember ID: {#MEMBER_ID#}\nAmount: {#AMOUNT#}\nTransaction/reference number: {#TRANSACTION_ID#}\nReceipt number: {#RECEIPT_NUMBER#}\nNew expiry date: {#NEW_EXPIRY_DATE#}\n\nYour official renewal receipt is attached.\n\nRegards,\nFinance & Accounts Team",
    "attachmentRule": "Attach Renewal Payment Receipt PDF. Cancel any pending expiry reminders.",
    "placeholders": [
      "MEMBER_ID",
      "RECIPIENT_NAME",
      "AMOUNT",
      "TRANSACTION_ID",
      "RECEIPT_NUMBER",
      "NEW_EXPIRY_DATE"
    ]
  },
  {
    "code": "CG-MEM-011",
    "title": "Renewal rejected / renewal sent back",
    "owner": "MEM",
    "trigger": "Renewal review requires correction or is rejected.",
    "recipient": "Member.",
    "subject": "Membership Renewal Update — {#MEMBER_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour renewal request for Member ID {#MEMBER_ID#} needs attention.\nStatus: {#RENEWAL_STATUS#}\nReason: {#REASON#}\nRequired action: {#ACTION_REQUIRED#}\nRenewal portal: {#PORTAL_LINK#}\n\nRegards,\nMembership Team",
    "attachmentRule": "No attachment unless a specific approved notice is required. C. Volunteer email templates",
    "placeholders": [
      "MEMBER_ID",
      "RECIPIENT_NAME",
      "RENEWAL_STATUS",
      "REASON",
      "ACTION_REQUIRED",
      "PORTAL_LINK"
    ]
  },
  {
    "code": "CG-VOL-001",
    "title": "Volunteer application submitted",
    "owner": "VOL",
    "trigger": "Free volunteer application saved.",
    "recipient": "",
    "subject": "Volunteer Application Received — {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nThank you for applying to volunteer with CareGanga Foundation.\nApplication ID: {#APPLICATION_ID#}\nSubmission date: {#SUBMISSION_DATE#}\nStatus: {#APPLICATION_STATUS#}\n\nVolunteer registration is free. We will notify you when the application status changes.\n\nRegards,\nVolunteer Team",
    "attachmentRule": "No attachment; do not trigger a payment request.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME",
      "SUBMISSION_DATE",
      "APPLICATION_STATUS"
    ]
  },
  {
    "code": "CG-VOL-002",
    "title": "Volunteer documents received",
    "owner": "VOL",
    "trigger": "Volunteer documents uploaded.",
    "recipient": "",
    "subject": "Volunteer Documents Received — {#APPLICATION_ID#}",
    "body": "We have received the documents submitted for application {#APPLICATION_ID#}. Verification is pending. Document\nreceipt does not mean final approval.\n\nRegards,\nVolunteer Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "APPLICATION_ID"
    ]
  },
  {
    "code": "CG-VOL-003",
    "title": "Volunteer documents verified",
    "owner": "VOL",
    "trigger": "Required documents verified.",
    "recipient": "",
    "subject": "Volunteer Documents Verified — {#APPLICATION_ID#}",
    "body": "The documents submitted for volunteer application {#APPLICATION_ID#} have been verified. Current application status:\n{#APPLICATION_STATUS#}. Final approval will be communicated separately.\n\nRegards,\nVolunteer Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "APPLICATION_ID",
      "APPLICATION_STATUS"
    ]
  },
  {
    "code": "CG-VOL-004",
    "title": "Volunteer documents rejected / sent back",
    "owner": "VOL",
    "trigger": "Reviewer rejects document or sends application back.",
    "recipient": "",
    "subject": "Action Required — Volunteer Application {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour volunteer application needs correction.\nReason: {#REASON#}\nRequired action: {#ACTION_REQUIRED#}\nSecure upload / portal: {#PORTAL_LINK#}\n\nPlease resubmit the requested information. Volunteer registration is free.\n\nRegards,\nVolunteer Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME",
      "REASON",
      "ACTION_REQUIRED",
      "PORTAL_LINK"
    ]
  },
  {
    "code": "CG-VOL-005",
    "title": "Volunteer application approved + full document pack",
    "owner": "VOL",
    "trigger": "Final approval saved and all required PDFs generated.",
    "recipient": "",
    "subject": "Volunteer Application Approved — Volunteer ID {#VOLUNTEER_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour volunteer application has been approved.\n\nVolunteer ID: {#VOLUNTEER_ID#}\nIssue/approval date: {#ISSUE_DATE#}\nAssigned role: {#VOLUNTEER_ROLE#}\nBranch/department: {#BRANCH_NAME#} / {#DEPARTMENT_NAME#}\nValidity/expiry: {#EXPIRY_DATE_OR_NA#}\n\nAttached are your approved:\n1. Volunteer ID Card\n2. Welcome Letter\n3. Volunteer Certificate\n\nRegards,\nVolunteer Team\nCareGanga Foundation",
    "attachmentRule": "Attach Volunteer ID Card PDF, Welcome Letter PDF and Volunteer Certificate PDF.",
    "placeholders": [
      "VOLUNTEER_ID",
      "RECIPIENT_NAME",
      "ISSUE_DATE",
      "VOLUNTEER_ROLE",
      "BRANCH_NAME",
      "DEPARTMENT_NAME",
      "EXPIRY_DATE_OR_NA"
    ]
  },
  {
    "code": "CG-VOL-006",
    "title": "Volunteer application rejected",
    "owner": "VOL",
    "trigger": "Authorised final rejection saved.",
    "recipient": "",
    "subject": "Volunteer Application Decision — {#APPLICATION_ID#}",
    "body": "Your volunteer application {#APPLICATION_ID#} was not approved.\nReason: {#REJECTION_REASON#}\n\nNext steps, if applicable: {#NEXT_STEPS#}\n\nRegards,\nVolunteer Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "APPLICATION_ID",
      "REJECTION_REASON",
      "NEXT_STEPS"
    ]
  },
  {
    "code": "CG-VOL-007",
    "title": "Volunteer renewal reminder",
    "owner": "VOL",
    "trigger": "Only if volunteer status/certificate has an expiry date and the Foundation's policy requires renewal.",
    "recipient": "",
    "subject": "Volunteer Status Renewal Reminder — {#VOLUNTEER_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour volunteer registration/certificate is due for renewal by {#EXPIRY_DATE#}.\nPlease review the renewal instructions here: {#RENEWAL_LINK#}.\n\nVolunteer ID: {#VOLUNTEER_ID#}\n\nRegards,\nVolunteer Team",
    "attachmentRule": "Configure only if a formal volunteer renewal/expiry policy exists; do not invent a renewal fee. D. Donation, duplicate donation and refund templates",
    "placeholders": [
      "VOLUNTEER_ID",
      "RECIPIENT_NAME",
      "EXPIRY_DATE",
      "RENEWAL_LINK"
    ]
  },
  {
    "code": "CG-DON-001",
    "title": "Donation successful + donation slip",
    "owner": "DON",
    "trigger": "Payment provider confirms successful donation transaction; donation record is created. There is no donation",
    "recipient": "",
    "subject": "Donation Received — Receipt {#DONATION_RECEIPT_NO#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nThank you for supporting CareGanga Foundation.\nDonation ID: {#DONATION_ID#}\nDonor name: {#DONOR_NAME#}\nAmount: {#AMOUNT#}\nTransaction/reference number: {#TRANSACTION_ID#}\nPayment date: {#PAYMENT_DATE#}\nPayment method: {#PAYMENT_METHOD#}\nDonation receipt number: {#DONATION_RECEIPT_NO#}\nCampaign/project, if selected: {#CAMPAIGN_NAME#}\n\nYour donation slip/receipt is attached.\n\nRegards,\nFinance & Accounts Team\nCareGanga Foundation",
    "attachmentRule": "Attach Donation Slip/Receipt PDF. No donation approval workflow. Tax wording only if legally approved.",
    "placeholders": [
      "DONATION_RECEIPT_NO",
      "RECIPIENT_NAME",
      "DONATION_ID",
      "DONOR_NAME",
      "AMOUNT",
      "TRANSACTION_ID",
      "PAYMENT_DATE",
      "PAYMENT_METHOD",
      "CAMPAIGN_NAME"
    ]
  },
  {
    "code": "CG-DON-002",
    "title": "Possible duplicate donation/payment detected",
    "owner": "DON",
    "trigger": "System detects duplicate transaction reference or likely duplicate charge; create a case for review.",
    "recipient": "",
    "subject": "Donation Payment Check — Reference {#CASE_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nWe have detected a possible duplicate donation payment and are checking the transaction records.\nCase ID: {#CASE_ID#}\nDonation ID(s): {#DONATION_ID_LIST#}\nTransaction reference(s): {#TRANSACTION_ID_LIST#}\nCurrent status: {#STATUS#}\n\nPlease do not make another payment to resolve this query. We will update you after checking the payment provider's\nrecords.\n\nRegards,\nFinance & Accounts Team",
    "attachmentRule": "Do not issue a second receipt for the same transaction. If two distinct successful transactions exist, create distinct donation records/receipts according to policy.",
    "placeholders": [
      "CASE_ID",
      "RECIPIENT_NAME",
      "DONATION_ID_LIST",
      "TRANSACTION_ID_LIST",
      "STATUS"
    ]
  },
  {
    "code": "CG-DON-003",
    "title": "Duplicate payment confirmed / next steps",
    "owner": "DON",
    "trigger": "Finance confirms whether a duplicate charge exists from provider records.",
    "recipient": "",
    "subject": "Update on Possible Duplicate Donation — {#CASE_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nWe have reviewed the possible duplicate payment report.\nFinding: {#DUPLICATE_FINDING#}\nTransaction reference(s): {#TRANSACTION_ID_LIST#}\nNext step: {#NEXT_ACTION#}\n\nIf a refund is applicable, it will be processed through the separate refund workflow and confirmed after provider\nprocessing.\n\nRegards,\nFinance & Accounts Team",
    "attachmentRule": "No attachment unless a corrected/official receipt or provider confirmation is generated.",
    "placeholders": [
      "CASE_ID",
      "RECIPIENT_NAME",
      "DUPLICATE_FINDING",
      "TRANSACTION_ID_LIST",
      "NEXT_ACTION"
    ]
  },
  {
    "code": "CG-REF-001",
    "title": "Refund request received",
    "owner": "REF",
    "trigger": "Refund request saved against an eligible donation/payment.",
    "recipient": "",
    "subject": "Refund Request Received — {#REFUND_REQUEST_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nWe have received your refund request.\nRefund Request ID: {#REFUND_REQUEST_ID#}\nOriginal transaction: {#TRANSACTION_ID#}\nDonation ID: {#DONATION_ID#}\nAmount requested: {#AMOUNT#}\nCurrent status: {#REFUND_STATUS#}\n\nWe will review the request and update you.\n\nRegards,\nFinance & Accounts Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "REFUND_REQUEST_ID",
      "RECIPIENT_NAME",
      "TRANSACTION_ID",
      "DONATION_ID",
      "AMOUNT",
      "REFUND_STATUS"
    ]
  },
  {
    "code": "CG-REF-002",
    "title": "Refund approved / processing",
    "owner": "REF",
    "trigger": "Authorised refund decision saved and provider processing initiated.",
    "recipient": "",
    "subject": "Refund Approved for Processing — {#REFUND_REQUEST_ID#}",
    "body": "Your refund request {#REFUND_REQUEST_ID#} has been approved for processing.\nAmount: {#AMOUNT#}\nCurrent status: {#REFUND_STATUS#}\n\nApproval does not mean the money has reached your account. We will notify you after the payment provider confirms\nprocessing.\n\nRegards,\nFinance & Accounts Team",
    "attachmentRule": "No completion receipt yet.",
    "placeholders": [
      "REFUND_REQUEST_ID",
      "AMOUNT",
      "REFUND_STATUS"
    ]
  },
  {
    "code": "CG-REF-003",
    "title": "Refund rejected",
    "owner": "REF",
    "trigger": "Authorised refund rejection saved.",
    "recipient": "",
    "subject": "Refund Request Decision — {#REFUND_REQUEST_ID#}",
    "body": "Your refund request {#REFUND_REQUEST_ID#} was not approved.\nReason: {#REJECTION_REASON#}\nNext steps or review route, if available: {#NEXT_STEPS#}\n\nRegards,\nFinance & Accounts Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "REFUND_REQUEST_ID",
      "REJECTION_REASON",
      "NEXT_STEPS"
    ]
  },
  {
    "code": "CG-REF-004",
    "title": "Refund processed",
    "owner": "REF",
    "trigger": "Provider confirms refund status is processed/success.",
    "recipient": "",
    "subject": "Refund Processed — {#REFUND_REQUEST_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nThe payment provider has confirmed processing of your refund.\nRefund Request ID: {#REFUND_REQUEST_ID#}\nOriginal transaction: {#TRANSACTION_ID#}\nRefund amount: {#AMOUNT#}\nProvider refund reference: {#REFUND_PROVIDER_REFERENCE#}\nProcessed date: {#REFUND_DATE#}\n\nPlease allow your bank/payment provider additional time to reflect the credit.\n\nRegards,\nFinance & Accounts Team",
    "attachmentRule": "Attach Refund Confirmation PDF only if generated from verified provider data.",
    "placeholders": [
      "REFUND_REQUEST_ID",
      "RECIPIENT_NAME",
      "TRANSACTION_ID",
      "AMOUNT",
      "REFUND_PROVIDER_REFERENCE",
      "REFUND_DATE"
    ]
  },
  {
    "code": "CG-REF-005",
    "title": "Refund failed/delayed",
    "owner": "REF",
    "trigger": "Provider returns failure or refund remains beyond configured SLA.",
    "recipient": "",
    "subject": "Refund Status Update — {#REFUND_REQUEST_ID#}",
    "body": "Your refund request {#REFUND_REQUEST_ID#} has an update.\nCurrent status: {#REFUND_STATUS#}\nNext action: {#NEXT_ACTION#}\nExpected update: {#EXPECTED_UPDATE#}\n\nWe will notify you when the provider confirms the final status.\n\nRegards,\nFinance & Accounts Team",
    "attachmentRule": "Do not say completed. E. Employee registration, verification, appointment and access",
    "placeholders": [
      "REFUND_REQUEST_ID",
      "REFUND_STATUS",
      "NEXT_ACTION",
      "EXPECTED_UPDATE"
    ]
  },
  {
    "code": "CG-EMP-001",
    "title": "Employee registration submitted",
    "owner": "EMP",
    "trigger": "HR saves employee registration record.",
    "recipient": "",
    "subject": "Employee Registration Received — {#EMPLOYEE_ID#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nYour employee registration has been received.\nEmployee ID: {#EMPLOYEE_ID#}\nProposed designation: {#DESIGNATION#}\nState: {#STATE#}\nDistrict: {#DISTRICT#}\nSubdivision/block: {#SUBDIVISION_BLOCK#}\nBranch: {#BRANCH_NAME#}\nDepartment: {#DEPARTMENT_NAME#}\nStatus: {#EMPLOYEE_STATUS#}\n\nYour submitted documents will be reviewed. Registration alone does not confirm appointment or system access.\n\nRegards,\nHR & Administration Team",
    "attachmentRule": "No attachment by default.",
    "placeholders": [
      "EMPLOYEE_ID",
      "EMPLOYEE_NAME",
      "DESIGNATION",
      "STATE",
      "DISTRICT",
      "SUBDIVISION_BLOCK",
      "BRANCH_NAME",
      "DEPARTMENT_NAME",
      "EMPLOYEE_STATUS"
    ]
  },
  {
    "code": "CG-EMP-002",
    "title": "Employee documents submitted/received",
    "owner": "EMP",
    "trigger": "Employee uploads or HR records receipt of documents.",
    "recipient": "",
    "subject": "Employee Documents Received — {#EMPLOYEE_ID#}",
    "body": "We have received the following documents for employee record {#EMPLOYEE_ID#}: {#DOCUMENT_LIST#}.\nStatus: Received — verification pending.\nPlease note that document receipt is not the same as document verification or appointment approval.\n\nRegards,\nHR & Administration Team",
    "attachmentRule": "No attachment; avoid echoing sensitive document numbers.",
    "placeholders": [
      "EMPLOYEE_ID",
      "DOCUMENT_LIST"
    ]
  },
  {
    "code": "CG-EMP-003",
    "title": "Employee documents verified",
    "owner": "EMP",
    "trigger": "HR verifies required documents.",
    "recipient": "",
    "subject": "Employee Documents Verified — {#EMPLOYEE_ID#}",
    "body": "The required documents for employee record {#EMPLOYEE_ID#} have been verified.\nVerification date: {#VERIFICATION_DATE#}\nNext step: {#NEXT_STEP#}\n\nAppointment and access will be confirmed separately through the authorised workflow.\n\nRegards,\nHR & Administration Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "EMPLOYEE_ID",
      "VERIFICATION_DATE",
      "NEXT_STEP"
    ]
  },
  {
    "code": "CG-EMP-004",
    "title": "Employee documents rejected / sent back",
    "owner": "EMP",
    "trigger": "HR records rejection or send-back with reason.",
    "recipient": "",
    "subject": "Action Required — Employee Documents — {#EMPLOYEE_ID#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nThe following document(s) require correction or resubmission: {#DOCUMENT_LIST#}\nDecision: {#DOCUMENT_DECISION#}\nReason: {#REASON#}\nRequired action: {#ACTION_REQUIRED#}\nSecure upload link: {#UPLOAD_LINK#}\nDue date: {#DUE_DATE#}\n\nRegards,\nHR & Administration Team",
    "attachmentRule": "No attachment. Use only HR-approved recipient-visible reasons.",
    "placeholders": [
      "EMPLOYEE_ID",
      "EMPLOYEE_NAME",
      "DOCUMENT_LIST",
      "DOCUMENT_DECISION",
      "REASON",
      "ACTION_REQUIRED",
      "UPLOAD_LINK",
      "DUE_DATE"
    ]
  },
  {
    "code": "CG-EMP-005",
    "title": "Employee approved + offer/approval/appointment documents",
    "owner": "EMP",
    "trigger": "Employment approval saved and the relevant final documents generated.",
    "recipient": "",
    "subject": "Employment Approved — Employee ID {#EMPLOYEE_ID#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nYour employment has been approved.\nEmployee ID: {#EMPLOYEE_ID#}\nDesignation: {#DESIGNATION#}\nState/district: {#STATE#} / {#DISTRICT#}\nSubdivision/block: {#SUBDIVISION_BLOCK#}\nBranch: {#BRANCH_NAME#}\nDepartment: {#DEPARTMENT_NAME#}\nReporting manager: {#REPORTING_MANAGER#}\nJoining date: {#JOINING_DATE#}\nLetter/memo number(s): {#LETTER_MEMO_NUMBERS#}\n\nPlease find the approved letters attached.\n\nRegards,\nHR & Administration Team\nCareGanga Foundation",
    "attachmentRule": "Attach only the documents actually approved and issued: Offer Letter PDF, Employment/Approval Letter PDF, Appointment Letter PDF. Joining Letter is attached only if already issued; otherwise send it at joining confirmation.",
    "placeholders": [
      "EMPLOYEE_ID",
      "EMPLOYEE_NAME",
      "DESIGNATION",
      "STATE",
      "DISTRICT",
      "SUBDIVISION_BLOCK",
      "BRANCH_NAME",
      "DEPARTMENT_NAME",
      "REPORTING_MANAGER",
      "JOINING_DATE",
      "LETTER_MEMO_NUMBERS"
    ]
  },
  {
    "code": "CG-EMP-006",
    "title": "Joining confirmed + joining letter",
    "owner": "EMP",
    "trigger": "Joining report accepted and HR records joining.",
    "recipient": "",
    "subject": "Joining Confirmed — Employee ID {#EMPLOYEE_ID#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nYour joining has been recorded.\nEmployee ID: {#EMPLOYEE_ID#}\nDesignation: {#DESIGNATION#}\nRole: {#ROLE_NAME#}\nState: {#STATE#}\nDistrict: {#DISTRICT#}\nSubdivision/block: {#SUBDIVISION_BLOCK#}\nBranch: {#BRANCH_NAME#}\nDepartment: {#DEPARTMENT_NAME#}\nDate of joining: {#JOINING_DATE#}\nReporting manager: {#REPORTING_MANAGER#}\n\nYour joining letter/confirmation is attached.\n\nRegards,\nHR & Administration Team",
    "attachmentRule": "Attach Joining Letter / Joining Confirmation PDF if issued.",
    "placeholders": [
      "EMPLOYEE_ID",
      "EMPLOYEE_NAME",
      "DESIGNATION",
      "ROLE_NAME",
      "STATE",
      "DISTRICT",
      "SUBDIVISION_BLOCK",
      "BRANCH_NAME",
      "DEPARTMENT_NAME",
      "JOINING_DATE",
      "REPORTING_MANAGER"
    ]
  },
  {
    "code": "CG-EMP-007",
    "title": "Employee login, role and access assigned",
    "owner": "EMP",
    "trigger": "Account is provisioned and authorised role/scope permissions are saved.",
    "recipient": "",
    "subject": "Employee Account Access Ready — {#EMPLOYEE_ID#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nYour CareGanga employee account has been provisioned.\nEmployee ID: {#EMPLOYEE_ID#}\nLogin email: {#LOGIN_EMAIL#}\nRole: {#ROLE_NAME#}\nAccess profile: {#ACCESS_PROFILE#}\nState: {#STATE#}\nDistrict: {#DISTRICT#}\nSubdivision/block: {#SUBDIVISION_BLOCK#}\nBranch: {#BRANCH_NAME#}\nDepartment: {#DEPARTMENT_NAME#}\nEffective date: {#EFFECTIVE_DATE#}\n\nSet your password using this secure, single-use link: {#PASSWORD_SETUP_LINK#}\nLink expiry: {#LINK_EXPIRY#}\n\nYour access is limited to the permissions approved for your role. Your password is not included in this email.\n\nRegards,\nIT & Administration Team",
    "attachmentRule": "No password attachment or plaintext password. Role/scope must be authorised and audited.",
    "placeholders": [
      "EMPLOYEE_ID",
      "EMPLOYEE_NAME",
      "LOGIN_EMAIL",
      "ROLE_NAME",
      "ACCESS_PROFILE",
      "STATE",
      "DISTRICT",
      "SUBDIVISION_BLOCK",
      "BRANCH_NAME",
      "DEPARTMENT_NAME",
      "EFFECTIVE_DATE",
      "PASSWORD_SETUP_LINK",
      "LINK_EXPIRY"
    ]
  },
  {
    "code": "CG-EMP-008",
    "title": "Employee account/role access changed",
    "owner": "EMP",
    "trigger": "Authorised role, branch, department or jurisdiction change saved.",
    "recipient": "",
    "subject": "Employee Role/Access Updated — {#EMPLOYEE_ID#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nYour approved employee role/access has been updated.\nEmployee ID: {#EMPLOYEE_ID#}\nPrevious role: {#OLD_ROLE#}\nNew role: {#NEW_ROLE#}\nState/district: {#STATE#} / {#DISTRICT#}\nSubdivision/block: {#SUBDIVISION_BLOCK#}\nBranch: {#BRANCH_NAME#}\nDepartment: {#DEPARTMENT_NAME#}\nEffective date: {#EFFECTIVE_DATE#}\n\nIf the displayed access does not match your approved assignment, contact IT Support.\n\nRegards,\nIT & Administration Team",
    "attachmentRule": "No attachment unless updated ID card/letter is issued by separate event.",
    "placeholders": [
      "EMPLOYEE_ID",
      "EMPLOYEE_NAME",
      "OLD_ROLE",
      "NEW_ROLE",
      "STATE",
      "DISTRICT",
      "SUBDIVISION_BLOCK",
      "BRANCH_NAME",
      "DEPARTMENT_NAME",
      "EFFECTIVE_DATE"
    ]
  },
  {
    "code": "CG-EMP-009",
    "title": "Employee account suspended/deactivated",
    "owner": "EMP",
    "trigger": "Authorised account status transition.",
    "recipient": "",
    "subject": "Employee Account Status Update — {#EMPLOYEE_ID#}",
    "body": "Your CareGanga account status is now {#ACCOUNT_STATUS#}, effective {#EFFECTIVE_DATE#}. If you believe this is\nincorrect, contact {#HR_SUPPORT_EMAIL#} or {#IT_SUPPORT_EMAIL#}.\n\nRegards,\nHR & IT Administration Team",
    "attachmentRule": "No attachment. Do not reveal internal security notes. F. Designation / office-bearer application and certificate",
    "placeholders": [
      "EMPLOYEE_ID",
      "ACCOUNT_STATUS",
      "EFFECTIVE_DATE",
      "HR_SUPPORT_EMAIL",
      "IT_SUPPORT_EMAIL"
    ]
  },
  {
    "code": "CG-DES-001",
    "title": "Designation application submitted",
    "owner": "DES",
    "trigger": "Office-bearer/designation application saved.",
    "recipient": "",
    "subject": "Designation Application Received — {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nWe have received your designation application.\nApplication ID: {#APPLICATION_ID#}\nRequested designation/role: {#REQUESTED_DESIGNATION#}\n\nState: {#STATE#}\nDistrict: {#DISTRICT#}\nSubdivision/block: {#SUBDIVISION_BLOCK#}\nStatus: {#APPLICATION_STATUS#}\n\nYour application is awaiting review.\n\nRegards,\nAdministration Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME",
      "REQUESTED_DESIGNATION",
      "STATE",
      "DISTRICT",
      "SUBDIVISION_BLOCK",
      "APPLICATION_STATUS"
    ]
  },
  {
    "code": "CG-DES-002",
    "title": "Designation documents verified / rejected / sent back",
    "owner": "DES",
    "trigger": "Reviewer saves document verification or correction/rejection decision.",
    "recipient": "",
    "subject": "Designation Application Update — {#APPLICATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour designation application {#APPLICATION_ID#} has been updated.\nDecision: {#DOCUMENT_DECISION#}\nStatus: {#APPLICATION_STATUS#}\nReason / action required: {#REASON_OR_ACTION#}\nPortal: {#PORTAL_LINK#}\n\nFinal designation approval will be communicated separately.\n\nRegards,\nAdministration Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "APPLICATION_ID",
      "RECIPIENT_NAME",
      "DOCUMENT_DECISION",
      "APPLICATION_STATUS",
      "REASON_OR_ACTION",
      "PORTAL_LINK"
    ]
  },
  {
    "code": "CG-DES-003",
    "title": "Designation approved + certificate",
    "owner": "DES",
    "trigger": "Authorised designation approval saved; Designation ID, certificate number and approved PDF generated.",
    "recipient": "",
    "subject": "Designation Approved — {#DESIGNATION_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour designation/office-bearer appointment has been approved.\n\nName: {#RECIPIENT_NAME#}\nDesignation/role: {#DESIGNATION#}\nDesignation ID: {#DESIGNATION_ID#}\nCertificate number: {#CERTIFICATE_NUMBER#}\nIssue date: {#ISSUE_DATE#}\nExpiry date: {#EXPIRY_DATE_OR_NA#}\nState: {#STATE#}\nDistrict: {#DISTRICT#}\nSubdivision/block: {#SUBDIVISION_BLOCK#}\nBranch/office: {#BRANCH_NAME#}\nRole/jurisdiction scope: {#ROLE_SCOPE#}\n\nPlease find your approved designation certificate attached.\n\nRegards,\n\nAdministration Team\nCareGanga Foundation",
    "attachmentRule": "Attach Designation/Authority Certificate PDF. Ensure certificate number and designation ID are unique and dates/jurisdiction match approval.",
    "placeholders": [
      "DESIGNATION_ID",
      "RECIPIENT_NAME",
      "DESIGNATION",
      "CERTIFICATE_NUMBER",
      "ISSUE_DATE",
      "EXPIRY_DATE_OR_NA",
      "STATE",
      "DISTRICT",
      "SUBDIVISION_BLOCK",
      "BRANCH_NAME",
      "ROLE_SCOPE"
    ]
  },
  {
    "code": "CG-DES-004",
    "title": "Designation certificate expiry/renewal reminder",
    "owner": "DES",
    "trigger": "Configured milestone before expiry for certificate with a renewal policy.",
    "recipient": "",
    "subject": "Designation Certificate Renewal Reminder — {#CERTIFICATE_NUMBER#}",
    "body": "Your designation certificate {#CERTIFICATE_NUMBER#} expires on {#EXPIRY_DATE#}. Please start renewal using\n{#RENEWAL_LINK#}. This reminder does not extend the certificate's validity.\n\nRegards,\nAdministration Team",
    "attachmentRule": "No attachment. Exclude certificates with expiry N/A or no renewal policy. G. Promotion, role/ID changes and reissued documents",
    "placeholders": [
      "CERTIFICATE_NUMBER",
      "EXPIRY_DATE",
      "RENEWAL_LINK"
    ]
  },
  {
    "code": "CG-PROM-001",
    "title": "Promotion approved",
    "owner": "PROM",
    "trigger": "Promotion approval saved with effective date and memo number.",
    "recipient": "",
    "subject": "Promotion Approved — {#NEW_DESIGNATION#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nCongratulations. Your promotion has been approved.\nRecord ID: {#PERSON_ID#}\nPrevious designation/role: {#OLD_DESIGNATION_ROLE#}\nNew designation/role: {#NEW_DESIGNATION_ROLE#}\nNew Role ID, if assigned: {#NEW_ROLE_ID#}\nState/district: {#STATE#} / {#DISTRICT#}\nSubdivision/block: {#SUBDIVISION_BLOCK#}\nBranch/department: {#BRANCH_NAME#} / {#DEPARTMENT_NAME#}\nEffective date: {#EFFECTIVE_DATE#}\nPromotion memo number: {#MEMO_NUMBER#}\n\nPlease find the approved promotion letter attached. System access and ID card updates are completed through their\nrespective workflows.\n\nRegards,\nHR / Administration Team",
    "attachmentRule": "Attach Promotion Letter PDF. Do not send passwords; send access-change notification separately.",
    "placeholders": [
      "NEW_DESIGNATION",
      "RECIPIENT_NAME",
      "PERSON_ID",
      "OLD_DESIGNATION_ROLE",
      "NEW_DESIGNATION_ROLE",
      "NEW_ROLE_ID",
      "STATE",
      "DISTRICT",
      "SUBDIVISION_BLOCK",
      "BRANCH_NAME",
      "DEPARTMENT_NAME",
      "EFFECTIVE_DATE",
      "MEMO_NUMBER"
    ]
  },
  {
    "code": "CG-PROM-002",
    "title": "Updated ID card/certificate/letter issued",
    "owner": "PROM",
    "trigger": "New ID card/certificate generated and approved after promotion, role change or jurisdiction change.",
    "recipient": "",
    "subject": "Updated Official Documents Issued — {#PERSON_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour updated official document(s) have been issued following the approved change.\n\nPerson/Employee/Member/Volunteer ID: {#PERSON_ID#}\nNew role/designation: {#NEW_DESIGNATION_ROLE#}\nRole/Designation ID: {#NEW_ROLE_ID#}\nCertificate number: {#CERTIFICATE_NUMBER_OR_NA#}\nIssue date: {#ISSUE_DATE#}\nExpiry date: {#EXPIRY_DATE_OR_NA#}\nEffective date: {#EFFECTIVE_DATE#}\n\nPlease find the approved updated ID card and relevant certificate/letter attached. The previous version is superseded\nwhere applicable.\n\nRegards,\n{#TEAM_NAME#}\nCareGanga Foundation",
    "attachmentRule": "Attach only the relevant approved new ID Card, certificate and/or letter. Mark old card/version superseded.",
    "placeholders": [
      "PERSON_ID",
      "RECIPIENT_NAME",
      "NEW_DESIGNATION_ROLE",
      "NEW_ROLE_ID",
      "CERTIFICATE_NUMBER_OR_NA",
      "ISSUE_DATE",
      "EXPIRY_DATE_OR_NA",
      "EFFECTIVE_DATE",
      "TEAM_NAME"
    ]
  },
  {
    "code": "CG-PROM-003",
    "title": "Renewal approved / new ID card issued",
    "owner": "PROM",
    "trigger": "Membership/volunteer/certificate renewal approved and new validity saved.",
    "recipient": "",
    "subject": "Renewal Approved — Updated Document(s) Attached",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour renewal has been approved.\nRecord ID: {#PERSON_ID#}\nRecord type: {#RECORD_TYPE#}\nNew validity/expiry date: {#NEW_EXPIRY_DATE#}\nRenewal reference: {#RENEWAL_REFERENCE#}\n\nYour updated approved ID card/certificate is attached, where applicable.\n\nRegards,\n{#TEAM_NAME#}",
    "attachmentRule": "Attach only documents regenerated after renewal. If payment applies, payment receipt is a separate confirmed event. H. Salary generation, salary slip and disbursement",
    "placeholders": [
      "RECIPIENT_NAME",
      "PERSON_ID",
      "RECORD_TYPE",
      "NEW_EXPIRY_DATE",
      "RENEWAL_REFERENCE",
      "TEAM_NAME"
    ]
  },
  {
    "code": "CG-SAL-001",
    "title": "Salary generated / payroll approved",
    "owner": "SAL",
    "trigger": "Payroll calculation completed and payroll approved; payment may not yet be disbursed.",
    "recipient": "",
    "subject": "Salary Generated — {#PAYROLL_PERIOD#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nYour salary calculation for {#PAYROLL_PERIOD#} has been generated and approved.\nEmployee ID: {#EMPLOYEE_ID#}\nPayroll period: {#PAYROLL_PERIOD#}\nNet payable amount: {#NET_AMOUNT#}\nSalary status: Generated/Approved — disbursement pending.\n\nYour confidential salary slip is attached / available through the secure employee portal.\n\nRegards,\nHR & Payroll Team",
    "attachmentRule": "Attach Salary Slip PDF or secure employee portal link. This email does not confirm bank payment.",
    "placeholders": [
      "PAYROLL_PERIOD",
      "EMPLOYEE_NAME",
      "EMPLOYEE_ID",
      "NET_AMOUNT"
    ]
  },
  {
    "code": "CG-SAL-002",
    "title": "Salary disbursed / payment confirmed",
    "owner": "SAL",
    "trigger": "Bank/payment provider confirms successful salary disbursement.",
    "recipient": "",
    "subject": "Salary Payment Confirmed — {#PAYROLL_PERIOD#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nYour salary payment for {#PAYROLL_PERIOD#} has been confirmed as processed.\nEmployee ID: {#EMPLOYEE_ID#}\nNet amount: {#NET_AMOUNT#}\nPayment date: {#PAYMENT_DATE#}\nPayment reference: {#PAYMENT_REFERENCE#}\n\nIf you have any concern, contact HR & Payroll through the official channel.\n\nRegards,\nHR & Payroll Team",
    "attachmentRule": "No attachment required; optional payment advice only if generated. Employee-only recipient.",
    "placeholders": [
      "PAYROLL_PERIOD",
      "EMPLOYEE_NAME",
      "EMPLOYEE_ID",
      "NET_AMOUNT",
      "PAYMENT_DATE",
      "PAYMENT_REFERENCE"
    ]
  },
  {
    "code": "CG-SAL-003",
    "title": "Salary delayed/failed",
    "owner": "SAL",
    "trigger": "Payroll payment fails or exceeds configured payment SLA.",
    "recipient": "",
    "subject": "Salary Payment Status Update — {#PAYROLL_PERIOD#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nThere is an update regarding your salary payment for {#PAYROLL_PERIOD#}.\nCurrent status: {#PAYMENT_STATUS#}\nNext action: {#NEXT_ACTION#}\nExpected update: {#EXPECTED_UPDATE#}\n\nWe will notify you when the payment provider confirms the final status.\n\nRegards,\nHR & Payroll Team",
    "attachmentRule": "Do not state disbursed until confirmed.",
    "placeholders": [
      "PAYROLL_PERIOD",
      "EMPLOYEE_NAME",
      "PAYMENT_STATUS",
      "NEXT_ACTION",
      "EXPECTED_UPDATE"
    ]
  },
  {
    "code": "CG-SAL-004",
    "title": "Salary slip resent through support request",
    "owner": "SAL",
    "trigger": "Employee identity verified and support request completed.",
    "recipient": "",
    "subject": "Confidential Salary Slip Resent — {#SERVICE_REQUEST_ID#}",
    "body": "Dear {#EMPLOYEE_NAME#},\n\nAs requested, your salary slip for {#PAYROLL_PERIOD#} has been resent through the approved secure channel.\nService Request ID: {#SERVICE_REQUEST_ID#}\n\nThis document is confidential. Do not forward it to unauthorised persons.\n\nRegards,\nHR & Payroll Team",
    "attachmentRule": "Attach only the employee's approved salary slip or use a secure expiring link. I. Support ticket, document resend and closure",
    "placeholders": [
      "SERVICE_REQUEST_ID",
      "EMPLOYEE_NAME",
      "PAYROLL_PERIOD"
    ]
  },
  {
    "code": "CG-SUP-001",
    "title": "Support request received",
    "owner": "SUP",
    "trigger": "Ticket created from website, email or authorised manual entry.",
    "recipient": "",
    "subject": "Support Request Received — Ticket {#TICKET_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nWe have received your support request.\nTicket ID: {#TICKET_ID#}\nRequest category: {#REQUEST_CATEGORY#}\nRequested service/document: {#REQUEST_SUMMARY#}\nCurrent status: {#TICKET_STATUS#}\nSubmitted date: {#SUBMITTED_DATE#}\n\nPlease quote this Ticket ID in all follow-up messages.\n\nRegards,\nCareGanga Support Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "TICKET_ID",
      "RECIPIENT_NAME",
      "REQUEST_CATEGORY",
      "REQUEST_SUMMARY",
      "TICKET_STATUS",
      "SUBMITTED_DATE"
    ]
  },
  {
    "code": "CG-SUP-002",
    "title": "Ticket status updated",
    "owner": "SUP",
    "trigger": "Ticket status changes to In Progress, Waiting for Information, Escalated or another configured state.",
    "recipient": "",
    "subject": "Support Ticket Update — {#TICKET_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour support ticket has been updated.\nTicket ID: {#TICKET_ID#}\nCurrent status: {#TICKET_STATUS#}\nUpdate: {#STATUS_UPDATE#}\nAction required from you: {#ACTION_REQUIRED_OR_NONE#}\nExpected next update: {#EXPECTED_UPDATE#}\n\nRegards,\nCareGanga Support Team",
    "attachmentRule": "No attachment. Send only on meaningful status transitions.",
    "placeholders": [
      "TICKET_ID",
      "RECIPIENT_NAME",
      "TICKET_STATUS",
      "STATUS_UPDATE",
      "ACTION_REQUIRED_OR_NONE",
      "EXPECTED_UPDATE"
    ]
  },
  {
    "code": "CG-SUP-003",
    "title": "Document resend completed",
    "owner": "SUP",
    "trigger": "Requester verified, file status Approved/Available, delivery attempt logged.",
    "recipient": "",
    "subject": "Requested Document Resent — Ticket {#TICKET_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour document resend request has been completed.\nTicket ID: {#TICKET_ID#}\nDocument: {#DOCUMENT_NAME#}\nRecord ID: {#RECORD_ID#}\nDelivery channel: {#DELIVERY_CHANNEL#}\nDelivery date/time: {#DELIVERY_DATETIME#}\n\nThe approved document is attached / available through the secure link provided.\n\nRegards,\n{#RESPONSIBLE_TEAM#}\nCareGanga Foundation",
    "attachmentRule": "Attach requested approved PDF or use access-controlled expiring link. Verify registered recipient first.",
    "placeholders": [
      "TICKET_ID",
      "RECIPIENT_NAME",
      "DOCUMENT_NAME",
      "RECORD_ID",
      "DELIVERY_CHANNEL",
      "DELIVERY_DATETIME",
      "RESPONSIBLE_TEAM"
    ]
  },
  {
    "code": "CG-SUP-004",
    "title": "Ticket waiting for information / cannot fulfil yet",
    "owner": "SUP",
    "trigger": "Required verification or document generation is pending.",
    "recipient": "",
    "subject": "Action Required — Support Ticket {#TICKET_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nWe cannot complete ticket {#TICKET_ID#} yet.\nCurrent status: {#TICKET_STATUS#}\nReason: {#REASON#}\nAction required: {#ACTION_REQUIRED#}\n\nWe will continue once the required step is completed.\n\nRegards,\nCareGanga Support Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "TICKET_ID",
      "RECIPIENT_NAME",
      "TICKET_STATUS",
      "REASON",
      "ACTION_REQUIRED"
    ]
  },
  {
    "code": "CG-SUP-005",
    "title": "Ticket closed",
    "owner": "SUP",
    "trigger": "Ticket closure saved with resolution summary.",
    "recipient": "",
    "subject": "Support Ticket Closed — {#TICKET_ID#}",
    "body": "Dear {#RECIPIENT_NAME#},\n\nYour support ticket has been closed.\nTicket ID: {#TICKET_ID#}\nResolution: {#RESOLUTION_SUMMARY#}\nClosed date: {#CLOSED_DATE#}\n\nIf the issue remains unresolved, contact us through the official support channel and quote this Ticket ID.\n\nRegards,\nCareGanga Support Team",
    "attachmentRule": "No attachment.",
    "placeholders": [
      "TICKET_ID",
      "RECIPIENT_NAME",
      "RESOLUTION_SUMMARY",
      "CLOSED_DATE"
    ]
  },
  {
    "code": "CG-SUP-006",
    "title": "Internal notification: new ticket / assignment",
    "owner": "SUP",
    "trigger": "Ticket created or assigned to a team.",
    "recipient": "",
    "subject": "New Support Ticket — {#TICKET_ID#}",
    "body": "INTERNAL NOTIFICATION\n\nTicket ID: {#TICKET_ID#}\nRequester record: {#REQUESTER_RECORD_ID#}\nCategory: {#REQUEST_CATEGORY#}\nAssigned team: {#ASSIGNED_TEAM#}\nPriority: {#PRIORITY#}\nSLA due: {#SLA_DUE#}\nSecure ticket link: {#ADMIN_TICKET_LINK#}\n\nReview the ticket within the configured service level. Do not forward personal documents outside approved channels.",
    "attachmentRule": "Internal only; secure admin link and role-based access.",
    "placeholders": [
      "TICKET_ID",
      "REQUESTER_RECORD_ID",
      "REQUEST_CATEGORY",
      "ASSIGNED_TEAM",
      "PRIORITY",
      "SLA_DUE",
      "ADMIN_TICKET_LINK"
    ]
  }
] as const;
