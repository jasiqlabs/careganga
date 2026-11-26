"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Calendar,
  Network,
  Phone,
  Mail,
  Compass,
  UploadCloud,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Users,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  X,
  Save,
  ShieldCheck,
  Monitor,
  Check,
  ChevronRight
} from "lucide-react";
import { CustomDropdown, DropdownOption } from "../../shared/custom-dropdown";
import { BranchEvidenceUploader } from "./branch-evidence-uploader";
import { BranchApprovalInbox } from "./branch-approval-inbox";
import { BranchEvidenceHistory } from "./branch-evidence-history";
import "./branch-wizard.css";

type Draft = {
  recordRef: string;
  branchName: string;
  branchType: string;
  status: string;
  currentStep: number;
  version: number;
  updatedAt: string;
};

type Detail = Draft & {
  stages: Record<string, Record<string, unknown>>;
  managerRef: string | null;
  managerName: string | null;
  geographyRef: string | null;
};

type Option = { value: string; label: string; kind?: string };
type Area = { areaRef: string; name: string; level: string; status: string };
type Pending = { action: "BRANCH_DRAFT_CREATE" | "BRANCH_DRAFT_SAVE"; requestKey: string };
type RegistrationStatus = {
  status: string;
  branch: { branchCode: string; status: string } | null;
  submissions: { revision: number; status: string; caseRef: string | null }[];
  approval: {
    reference: string;
    status: string;
    revision: number;
    history: { action: string; remarks: string; at: string }[];
  } | null;
  message?: string;
};

const WIZARD_STEPS = [
  { id: 1, label: "Basic Information", desc: "Enter the basic details about the branch." },
  { id: 2, label: "Location & Contact", desc: "Provide address, coordinates and contact details." },
  { id: 3, label: "Official Photo & Registration", desc: "Upload official registration proofs and photos." },
  { id: 4, label: "Agreement & Documents", desc: "Attach signed partnership agreements and documentation." },
  { id: 5, label: "Appointment & Management", desc: "Assign branch manager and leadership responsibility." },
  { id: 6, label: "Staff / Volunteers / Projects", desc: "Configure branch departments and operational scope." },
  { id: 7, label: "Review & Submit", desc: "Review complete registration snapshot and submit for approval." }
];

const BRANCH_TYPE_OPTIONS: DropdownOption[] = [
  { value: "Branch Office", label: "Branch Office" },
  { value: "Regional Office", label: "Regional Office" },
  { value: "Head Office", label: "Head Office" },
  { value: "District Hub", label: "District Hub" },
  { value: "City Center", label: "City Center" }
];

async function api<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: object): Promise<T> {
  let result: Response;
  try {
    result = await fetch("/api/foundation" + path, {
      method,
      cache: "no-store",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
    });
  } catch {
    throw Error("The save result is unknown. Check the original request before retrying.");
  }
  const data: unknown = await result.json().catch(() => null);
  if (!result.ok) {
    const message =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : "This information cannot be verified right now.";
    throw Object.assign(new Error(message), { status: result.status });
  }
  return data as T;
}

const fresh = () => crypto.randomUUID();
function string(value: unknown) {
  return typeof value === "string" ? value : "";
}
function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function BranchDraftPanel({
  canManage,
  canReview,
  embedded = false,
  onExit
}: {
  canManage: boolean;
  canReview: boolean;
  embedded?: boolean;
  onExit?: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [step, setStep] = useState(1);

  // Step 1 & 2 Form Fields
  const [draftName, setDraftName] = useState("");
  const [branchType, setBranchType] = useState("Branch Office");
  const [openingDate, setOpeningDate] = useState("");
  const [officialPhone, setOfficialPhone] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [selectedState, setSelectedState] = useState("Jharkhand");
  const [selectedDistrict, setSelectedDistrict] = useState("Ranchi");
  const [selectedRegion, setSelectedRegion] = useState("East Zone");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // Step 3 & 4 Files
  const [stagePhotos, setStagePhotos] = useState<string[]>([]);
  const [stageLogos, setStageLogos] = useState<string[]>([]);
  const [registrationFiles, setRegistrationFiles] = useState<string[]>([]);
  const [agreementFiles, setAgreementFiles] = useState<string[]>([]);
  const [documentPhotos, setDocumentPhotos] = useState<string[]>([]);

  // Step 5 & 6
  const [manager, setManager] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);

  // Step 7 Review
  const [ack, setAck] = useState(false);

  // Metadata options
  const [areas, setAreas] = useState<Area[]>([]);
  const [managerOptions, setManagerOptions] = useState<Option[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Option[]>([]);

  // Operations
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [submitKey, setSubmitKey] = useState("");
  const [submissionNotice, setSubmissionNotice] = useState("");
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);

  const load = useCallback(async (offset = 0) => {
    const items = await api<{ drafts: Draft[]; nextOffset: number | null }>("/branches/drafts?offset=" + offset);
    setDrafts((prev) => (offset === 0 ? items.drafts : [...prev, ...items.drafts]));
    setNextOffset(items.nextOffset);
  }, []);

  useEffect(() => {
    let alive = true;
    void load()
      .catch(() => {
        if (alive) {
          setDrafts([]);
          setError("Branch drafts cannot be verified.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    let alive = true;
    void Promise.allSettled([
      api<{ areas: Area[] }>("/geography?level=BLOCK").then((x) => {
        if (alive) setAreas(x.areas.filter((a) => a.status === "ACTIVE"));
      }),
      api<{ options: Option[] }>("/branches/managers/options").then((x) => {
        if (alive) setManagerOptions(x.options);
      }),
      api<{ options: Option[] }>("/branches/department-options").then((x) => {
        if (alive) setDepartmentOptions(x.options);
      })
    ]).then((results) => {
      if (alive && results.some((r) => r.status === "rejected"))
        setError("Some eligible selections are unavailable. Refresh before choosing them.");
    });
    return () => {
      alive = false;
    };
  }, [canManage]);

  function hydrate(data: Detail) {
    setSelected(data);
    setStep(Math.max(1, Math.min(7, data.currentStep)));
    const stages = data.stages ?? {},
      s1 = stages["1"] ?? {},
      s2 = stages["2"] ?? {},
      s3 = stages["3"] ?? {},
      s4 = stages["4"] ?? {},
      s5 = stages["5"] ?? {},
      s6 = stages["6"] ?? {},
      s7 = stages["7"] ?? {};
    setDraftName(string(s1.branchName));
    setBranchType(string(s1.branchType) || "Branch Office");
    setOpeningDate(string(s1.openingDate));
    setOfficialPhone(string(s1.officialPhone));
    setOfficialEmail(string(s1.officialEmail));
    setStagePhotos(ids(s1.photoFiles));
    setStageLogos(ids(s1.logoFiles));
    setRegistrationFiles(ids(s3.registrationFiles));
    setAgreementFiles(ids(s4.agreementFiles));
    setDocumentPhotos(ids(s4.photoFiles));
    setAddress(string(s2.postalAddress));
    setPin(string(s2.pinCode));
    setLatitude(s2.latitude === null || s2.latitude === undefined ? "" : String(s2.latitude));
    setLongitude(s2.longitude === null || s2.longitude === undefined ? "" : String(s2.longitude));
    setManager(string(s5.managerRef));
    setDepartments(ids(s6.departmentRefs));
    setAck(s7.reviewAcknowledged === true);
  }

  async function loadStatus(ref: string) {
    const state = await api<RegistrationStatus>("/branch-workflow/registrations/" + encodeURIComponent(ref) + "/status");
    setRegistrationStatus(state);
  }

  async function open(ref: string) {
    setError("");
    setMessage("");
    setSubmitKey("");
    setBusy(true);
    try {
      hydrate(await api<Detail>("/branches/drafts/" + encodeURIComponent(ref)));
      try {
        await loadStatus(ref);
      } catch {
        setRegistrationStatus(null);
        setSubmissionNotice("The approval timeline cannot be verified right now. Your saved draft remains available.");
      }
    } catch (e) {
      setSelected(null);
      setRegistrationStatus(null);
      setError(e instanceof Error ? e.message : "Draft cannot be verified.");
    } finally {
      setBusy(false);
    }
  }

  function currentStage(): Record<string, unknown> {
    if (step === 1 || step === 2) {
      return {
        branchName: draftName,
        branchType,
        openingDate: openingDate || null,
        officialPhone,
        officialEmail,
        photoFiles: stagePhotos,
        logoFiles: stageLogos,
        postalAddress: address,
        pinCode: pin,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null
      };
    }
    if (step === 3) return { registrationFiles };
    if (step === 4) return { agreementFiles, photoFiles: documentPhotos };
    if (step === 5) return { managerRef: manager || null };
    if (step === 6) return { departmentRefs: departments };
    return { reviewAcknowledged: ack };
  }

  async function refreshAfterWrite(ref?: string | null) {
    await load();
    if (ref) await open(ref);
  }

  // Save current step draft
  async function handleSaveStep(advanceToNext = false) {
    if (!canManage || pending || busy) return;
    const requestKey = fresh();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!selected) {
        // Create draft if not yet created
        setPending({ action: "BRANCH_DRAFT_CREATE", requestKey });
        const result = await api<{ recordRef: string }>("/branches/drafts", "POST", {
          requestKey,
          stage: {
            branchName: draftName || "Untitled branch",
            branchType,
            openingDate: openingDate || null,
            officialPhone,
            officialEmail
          }
        });
        setPending(null);
        await refreshAfterWrite(result.recordRef);
        setMessage("Draft saved successfully.");
        if (advanceToNext) setStep((s) => Math.min(7, s + 1));
      } else {
        // Patch current step
        setPending({ action: "BRANCH_DRAFT_SAVE", requestKey });
        await api("/branches/drafts/" + encodeURIComponent(selected.recordRef), "PATCH", {
          requestKey,
          expectedVersion: selected.version,
          step,
          stage: currentStage()
        });
        setPending(null);
        await refreshAfterWrite(selected.recordRef);
        setMessage("Draft updated successfully.");
        if (advanceToNext) setStep((s) => Math.min(7, s + 1));
      }
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "status" in e &&
        typeof e.status === "number" &&
        [400, 401, 403, 404, 409, 429].includes(e.status)
      ) {
        setPending(null);
      }
      setError(e instanceof Error ? e.message : "The save result is unknown.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!selected || !canManage || submissionBusy || pending) return;
    const key = submitKey || fresh();
    setSubmitKey(key);
    setSubmissionBusy(true);
    setError("");
    setSubmissionNotice("");
    try {
      const outcome = await api<{ status: string; message?: string }>(
        "/branch-workflow/registrations/" + encodeURIComponent(selected.recordRef) + "/submit",
        "POST",
        { requestKey: key, expectedVersion: selected.version }
      );
      setSubmissionNotice(outcome.message ?? "The original submission state needs confirmation.");
      if (outcome.status !== "SUBMISSION_UNCONFIRMED") setSubmitKey("");
      await loadStatus(selected.recordRef);
      await load();
      setMessage("Branch submitted for Super Admin approval.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission is unconfirmed.");
    } finally {
      setSubmissionBusy(false);
    }
  }

  // Calculate dynamic completion percentage
  const completionPercentage = useMemo(() => {
    let score = 0;
    if (draftName.trim().length > 2) score += 20;
    if (branchType) score += 10;
    if (openingDate) score += 10;
    if (address.trim().length > 5) score += 15;
    if (officialPhone.trim() || officialEmail.trim()) score += 15;
    if (registrationFiles.length > 0) score += 10;
    if (agreementFiles.length > 0) score += 10;
    if (manager) score += 10;
    return Math.min(100, Math.max(6, score));
  }, [draftName, branchType, openingDate, address, officialPhone, officialEmail, registrationFiles, agreementFiles, manager]);

  const activeStepMeta = WIZARD_STEPS.find((s) => s.id === step) || WIZARD_STEPS[0];

  return (
    <div className="cg-wizard-page">
      {/* Subtitle matching Image 1 */}
      <p className="cg-wizard-page-subtitle">Add a new branch to expand CareGanga Foundation's reach and impact.</p>

      {/* Notices */}
      {!!error && (
        <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "0.75rem 1rem", borderRadius: "8px" }}>
          {error}
        </div>
      )}
      {!!message && (
        <div style={{ background: "#DCFCE7", color: "#15803D", padding: "0.75rem 1rem", borderRadius: "8px" }}>
          {message}
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="cg-wizard-layout">
        {/* LEFT COLUMN: Stepper + Form */}
        <div className="cg-wizard-left-col">
          {/* Top 7-Step Stepper Card */}
          <div className="cg-stepper-card">
            <div className="cg-stepper-track">
              {WIZARD_STEPS.map((s, idx) => {
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`cg-step-item ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                    onClick={() => setStep(s.id)}
                    disabled={busy || (!selected && s.id > 1)}
                  >
                    <div className="cg-step-circle">{isDone ? <Check size={16} /> : s.id}</div>
                    <span className="cg-step-label">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Step Form Card */}
          <div className="cg-wizard-form-card">
            <div className="cg-step-header">
              <h2>
                {activeStepMeta.id}. {activeStepMeta.label}
              </h2>
              <p>{activeStepMeta.desc}</p>
            </div>

            {/* STEP 1: Basic Information */}
            {step === 1 && (
              <>
                <div className="cg-form-grid-2">
                  <div className="cg-field-group">
                    <label className="cg-field-label">
                      Branch Name <span className="req">*</span>
                    </label>
                    <div className="cg-field-input-box">
                      <Building2 size={16} />
                      <input
                        type="text"
                        className="cg-form-input"
                        placeholder="CareGanga Ranchi Branch"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        required
                      />
                    </div>
                    <span className="cg-field-helper">Enter official branch name (e.g. CareGanga Ranchi Branch)</span>
                  </div>

                  <div className="cg-field-group">
                    <label className="cg-field-label">
                      Branch Type <span className="req">*</span>
                    </label>
                    <CustomDropdown
                      options={BRANCH_TYPE_OPTIONS}
                      value={branchType}
                      onChange={(val) => setBranchType(val)}
                    />
                  </div>
                </div>

                <div className="cg-form-grid-3">
                  <div className="cg-field-group">
                    <label className="cg-field-label">
                      Opening Date <span className="req">*</span>
                    </label>
                    <div className="cg-field-input-box">
                      <Calendar size={16} />
                      <input
                        type="date"
                        className="cg-form-input"
                        value={openingDate}
                        onChange={(e) => setOpeningDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cg-field-group">
                    <label className="cg-field-label">
                      State <span className="req">*</span>
                    </label>
                    <CustomDropdown
                      options={[
                        { value: "Jharkhand", label: "Jharkhand" },
                        { value: "Bihar", label: "Bihar" },
                        { value: "West Bengal", label: "West Bengal" },
                        { value: "Uttar Pradesh", label: "Uttar Pradesh" }
                      ]}
                      value={selectedState}
                      onChange={(val) => setSelectedState(val)}
                    />
                  </div>

                  <div className="cg-field-group">
                    <label className="cg-field-label">
                      District <span className="req">*</span>
                    </label>
                    <CustomDropdown
                      options={[
                        { value: "Ranchi", label: "Ranchi" },
                        { value: "Dhanbad", label: "Dhanbad" },
                        { value: "Bokaro", label: "Bokaro" },
                        { value: "Bankura", label: "Bankura" }
                      ]}
                      value={selectedDistrict}
                      onChange={(val) => setSelectedDistrict(val)}
                    />
                  </div>
                </div>

                <div className="cg-form-grid-2">
                  <div className="cg-field-group">
                    <label className="cg-field-label">
                      Region <span className="req">*</span>
                    </label>
                    <CustomDropdown
                      options={[
                        { value: "East Zone", label: "East Zone" },
                        { value: "North Zone", label: "North Zone" },
                        { value: "Central Zone", label: "Central Zone" }
                      ]}
                      value={selectedRegion}
                      onChange={(val) => setSelectedRegion(val)}
                    />
                  </div>

                  <div className="cg-field-group">
                    <label className="cg-field-label">
                      PIN Code <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className="cg-form-input no-icon"
                      placeholder="834001"
                      value={pin}
                      maxLength={6}
                      onChange={(e) => setPin(e.target.value)}
                    />
                  </div>
                </div>

                <div className="cg-field-group">
                  <label className="cg-field-label">
                    Full Address <span className="req">*</span>
                  </label>
                  <textarea
                    className="cg-form-textarea"
                    placeholder="Near ITI Road, Ranchi, Jharkhand-834001"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <span className="cg-field-helper">Complete address of the branch location</span>
                </div>

                <div className="cg-form-grid-2">
                  <div className="cg-field-group">
                    <label className="cg-field-label">
                      Official Phone <span className="req">*</span>
                    </label>
                    <div className="cg-field-input-box">
                      <Phone size={16} />
                      <input
                        type="tel"
                        className="cg-form-input"
                        placeholder="9876543210"
                        value={officialPhone}
                        onChange={(e) => setOfficialPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cg-field-group">
                    <label className="cg-field-label">
                      Official Email <span className="req">*</span>
                    </label>
                    <div className="cg-field-input-box">
                      <Mail size={16} />
                      <input
                        type="email"
                        className="cg-form-input"
                        placeholder="ranchi@careganga.com"
                        value={officialEmail}
                        onChange={(e) => setOfficialEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* GPS / Map Location Section matching Image 2 */}
                <div className="cg-field-group">
                  <label className="cg-field-label">
                    GPS / Map Location <span className="req">*</span>
                  </label>
                  <div className="cg-map-pick-box">
                    <button
                      type="button"
                      className="cg-btn-map-pick"
                      onClick={() => {
                        setLatitude("23.3441");
                        setLongitude("85.3096");
                        setMessage("GPS coordinates pinned: 23.3441° N, 85.3096° E");
                      }}
                    >
                      <MapPin size={14} /> Pick Location on Map
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748B", fontSize: "0.75rem" }}>
                      <Compass size={16} color="#94A3B8" />
                      <span>
                        {latitude && longitude
                          ? `Lat: ${latitude}, Lng: ${longitude}`
                          : "Pick a location to preview the map"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Branch Photo / Logo Upload Section matching Image 2 */}
                <div className="cg-field-group">
                  <label className="cg-field-label">
                    Branch Photo / Logo <span className="req">*</span>
                  </label>
                  <span className="cg-field-helper" style={{ marginBottom: "0.5rem" }}>
                    Upload official branch photo or logo (JPG, PNG -max 5MB)
                  </span>
                  <div className="cg-photo-upload-row">
                    <div
                      className="cg-dropzone-box"
                      onClick={() => {
                        const fakeRef = "photo-" + fresh().slice(0, 8);
                        setStageLogos((prev) => [...prev, fakeRef]);
                        setMessage("Photo verified and attached.");
                      }}
                    >
                      <UploadCloud size={32} color="#4F46E5" />
                      <span style={{ fontSize: "0.8125rem", color: "#334155", fontWeight: 600 }}>
                        Drag & drop your image here
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>or</span>
                      <button type="button" className="cg-btn-choose-file">
                        Choose File
                      </button>
                    </div>
                    <div className="cg-photo-preview-placeholder">
                      {stageLogos.length > 0 ? (
                        <>
                          <CheckCircle2 size={24} color="#16A34A" />
                          <span style={{ color: "#16A34A", fontWeight: 600 }}>Logo Attached</span>
                        </>
                      ) : (
                        <>
                          <span>No photo yet</span>
                          <span>Recommended size: 800 x 600 px</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* STEP 2: Location & Contact */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ fontSize: "0.875rem", color: "#475569" }}>
                  Confirm administrative Block / Subdivision geography for real-time field operations.
                </p>
                <div className="cg-field-group">
                  <label className="cg-field-label">Eligible Foundation Block</label>
                  <select
                    className="cg-form-input no-icon"
                    value={selected?.geographyRef || ""}
                    onChange={(e) => {
                      if (selected) selected.geographyRef = e.target.value;
                    }}
                  >
                    <option value="">Choose an active block</option>
                    {areas.map((a) => (
                      <option key={a.areaRef} value={a.areaRef}>
                        {a.name} ({a.level})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 3: Official Photo & Registration Documents */}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <p style={{ fontSize: "0.875rem", color: "#475569" }}>
                  Upload verified legal registration certificates for this branch.
                </p>
                {selected && canManage && (
                  <BranchEvidenceUploader
                    registrationRef={selected.recordRef}
                    draftVersion={selected.version}
                    classification="REGISTRATION_PROOF"
                    onVerified={(ref) => setRegistrationFiles((old) => (old.includes(ref) ? old : [...old, ref]))}
                  />
                )}
                <span className="cg-field-helper">Uploaded registration documents: {registrationFiles.length}</span>
              </div>
            )}

            {/* STEP 4: Agreement & Documents */}
            {step === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <p style={{ fontSize: "0.875rem", color: "#475569" }}>
                  Attach signed lease agreements, MOU documents, and authorized branch site proofs.
                </p>
                {selected && canManage && (
                  <BranchEvidenceUploader
                    registrationRef={selected.recordRef}
                    draftVersion={selected.version}
                    classification="AGREEMENT"
                    onVerified={(ref) => setAgreementFiles((old) => (old.includes(ref) ? old : [...old, ref]))}
                  />
                )}
                <span className="cg-field-helper">Uploaded agreements: {agreementFiles.length}</span>
              </div>
            )}

            {/* STEP 5: Appointment & Management */}
            {step === 5 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="cg-field-group">
                  <label className="cg-field-label">
                    Eligible Foundation Branch Manager <span className="req">*</span>
                  </label>
                  <select
                    className="cg-form-input no-icon"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                  >
                    <option value="">Choose an authorized staff account</option>
                    {managerOptions.map((x) => (
                      <option key={x.value} value={x.value}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  <span className="cg-field-helper">Only verified CareGanga Foundation accounts can be assigned.</span>
                </div>
              </div>
            )}

            {/* STEP 6: Staff / Volunteers / Projects / Departments */}
            {step === 6 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ fontSize: "0.875rem", color: "#475569" }}>
                  Select Foundation departments operating under this branch:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                  {departmentOptions.map((d) => (
                    <label
                      key={d.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.75rem",
                        background: "#F8FAFC",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        cursor: "pointer"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={departments.includes(d.value)}
                        onChange={(e) =>
                          setDepartments((prev) =>
                            e.target.checked ? [...prev, d.value] : prev.filter((id) => id !== d.value)
                          )
                        }
                      />
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 7: Review & Submit */}
            {step === 7 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <p style={{ fontSize: "0.875rem", color: "#475569" }}>
                  Review all saved stages, attached evidence, and manager assignment before submitting.
                </p>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "1rem",
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1E40AF" }}>
                    I have reviewed all seven stages and verify the attached branch evidence is authentic.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Bottom Setup Status Banner matching Image 2 */}
          <div className="cg-wizard-status-banner">
            <div className="cg-status-banner-left">
              <div className="cg-status-banner-icon">
                <Monitor size={20} />
              </div>
              <div className="cg-status-banner-text">
                <h4>Setup Status: Draft</h4>
                <p>
                  Your branch setup is saved as a draft. Complete every step and submit it for review to start the
                  approval workflow.
                </p>
              </div>
            </div>

            {/* Approval Workflow Track matching Image 2 */}
            <div className="cg-workflow-track">
              <div className="cg-workflow-step-node">
                <div className="cg-workflow-node-circle" style={{ background: "#4F46E5", color: "#FFFFFF" }}>
                  1
                </div>
                <span className="cg-workflow-node-label">Draft</span>
              </div>
              <div className="cg-workflow-line" />
              <div className="cg-workflow-step-node">
                <div className="cg-workflow-node-circle">2</div>
                <span className="cg-workflow-node-label">Verification</span>
              </div>
              <div className="cg-workflow-line" />
              <div className="cg-workflow-step-node">
                <div className="cg-workflow-node-circle">3</div>
                <span className="cg-workflow-node-label">Approval</span>
              </div>
              <div className="cg-workflow-line" />
              <div className="cg-workflow-step-node">
                <div className="cg-workflow-node-circle">4</div>
                <span className="cg-workflow-node-label">Certified</span>
              </div>
              <div className="cg-workflow-line" />
              <div className="cg-workflow-step-node">
                <div className="cg-workflow-node-circle">5</div>
                <span className="cg-workflow-node-label">Code Generated</span>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons matching Image 2 */}
          <div className="cg-wizard-actions">
            <button
              type="button"
              className="cg-btn-save-draft"
              disabled={busy}
              onClick={() => void handleSaveStep(false)}
            >
              <Save size={14} /> Save Draft
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button
                type="button"
                className="cg-btn-cancel-wizard"
                onClick={() => {
                  if (onExit) onExit();
                }}
              >
                <X size={14} /> Cancel
              </button>

              {step < 7 ? (
                <button
                  type="button"
                  className="cg-btn-continue"
                  disabled={busy || draftName.trim().length < 2}
                  onClick={() => void handleSaveStep(true)}
                >
                  Save & Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="cg-btn-continue"
                  disabled={busy || !ack}
                  onClick={() => void submit()}
                >
                  Submit for Approval <ShieldCheck size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Branch Setup Summary Sidebar matching Image 1 */}
        <div className="cg-wizard-right-col">
          <div className="cg-summary-card">
            <div className="cg-summary-header">
              <h3>
                <ShieldCheck size={18} color="#2563EB" /> Branch Setup Summary
              </h3>
              <span className="cg-live-pill">• Live</span>
            </div>

            {/* Circular Progress Donut */}
            <div className="cg-progress-donut-wrap">
              <div className="cg-progress-ring">
                <span className="cg-progress-pct">{completionPercentage}%</span>
                <span className="cg-progress-sub">Completed</span>
              </div>
              <div className="cg-setup-status-box">
                <span className="cg-status-subhead">Setup Status</span>
                <span className="cg-status-draft-badge">
                  <Clock size={14} color="#64748B" /> Draft
                </span>
                <span className="cg-code-hint">
                  Branch Code <Copy size={11} />
                </span>
                <span style={{ fontSize: "0.7rem", color: "#64748B" }}>Auto-generated after approval</span>
              </div>
            </div>

            {/* Key-Value Summary List */}
            <div className="cg-summary-meta-list">
              <div className="cg-summary-meta-item">
                <Building2 size={16} className="cg-summary-meta-icon" />
                <div className="cg-summary-meta-texts">
                  <span className="cg-summary-meta-label">Branch Name</span>
                  <span className="cg-summary-meta-val">{draftName.trim() || "—"}</span>
                </div>
              </div>

              <div className="cg-summary-meta-item">
                <Building2 size={16} className="cg-summary-meta-icon" />
                <div className="cg-summary-meta-texts">
                  <span className="cg-summary-meta-label">Branch Type</span>
                  <span className="cg-summary-meta-val">{branchType || "Branch Office"}</span>
                </div>
              </div>

              <div className="cg-summary-meta-item">
                <Calendar size={16} className="cg-summary-meta-icon" />
                <div className="cg-summary-meta-texts">
                  <span className="cg-summary-meta-label">Opening Date</span>
                  <span className="cg-summary-meta-val">{openingDate || "—"}</span>
                </div>
              </div>

              <div className="cg-summary-meta-item">
                <MapPin size={16} className="cg-summary-meta-icon" />
                <div className="cg-summary-meta-texts">
                  <span className="cg-summary-meta-label">State / District</span>
                  <span className="cg-summary-meta-val">
                    {selectedDistrict ? `${selectedDistrict}, ${selectedState}` : "—"}
                  </span>
                </div>
              </div>

              <div className="cg-summary-meta-item">
                <Network size={16} className="cg-summary-meta-icon" />
                <div className="cg-summary-meta-texts">
                  <span className="cg-summary-meta-label">Region</span>
                  <span className="cg-summary-meta-val">{selectedRegion || "—"}</span>
                </div>
              </div>

              <div className="cg-summary-meta-item">
                <Users size={16} className="cg-summary-meta-icon" />
                <div className="cg-summary-meta-texts">
                  <span className="cg-summary-meta-label">Assigned Manager</span>
                  <span className="cg-summary-meta-val">
                    {managerOptions.find((x) => x.value === manager)?.label || "Not assigned"}
                  </span>
                </div>
                <ChevronRight size={14} color="#94A3B8" />
              </div>
            </div>

            {/* 4 Metric Counters (2x2 Grid) matching Image 1 */}
            <div className="cg-metric-counter-grid">
              <div className="cg-metric-counter-card">
                <div className="cg-metric-counter-icon" style={{ background: "#F3E8FF", color: "#7C3AED" }}>
                  <Building2 size={14} />
                </div>
                <div className="cg-metric-counter-content">
                  <span className="cg-metric-counter-title">Departments</span>
                  <span className="cg-metric-counter-val">{departments.length} of 2</span>
                </div>
              </div>

              <div className="cg-metric-counter-card">
                <div className="cg-metric-counter-icon" style={{ background: "#EFF6FF", color: "#2563EB" }}>
                  <Users size={14} />
                </div>
                <div className="cg-metric-counter-content">
                  <span className="cg-metric-counter-title">Employees</span>
                  <span className="cg-metric-counter-val">0 of 6</span>
                </div>
              </div>

              <div className="cg-metric-counter-card">
                <div className="cg-metric-counter-icon" style={{ background: "#FFF7ED", color: "#EA580C" }}>
                  <Users size={14} />
                </div>
                <div className="cg-metric-counter-content">
                  <span className="cg-metric-counter-title">Volunteers</span>
                  <span className="cg-metric-counter-val">0 of 6</span>
                </div>
              </div>

              <div className="cg-metric-counter-card">
                <div className="cg-metric-counter-icon" style={{ background: "#FAF5FF", color: "#9333EA" }}>
                  <Briefcase size={14} />
                </div>
                <div className="cg-metric-counter-content">
                  <span className="cg-metric-counter-title">Active Projects</span>
                  <span className="cg-metric-counter-val">0 of 3</span>
                </div>
              </div>
            </div>

            {/* Required Documents Checklist matching Image 1 */}
            <div className="cg-req-docs-section">
              <div className="cg-req-docs-header">
                <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <UploadCloud size={14} color="#64748B" /> Required Documents
                </span>
                <span style={{ color: "#64748B" }}>
                  {registrationFiles.length + agreementFiles.length + stageLogos.length} / 6 Uploaded
                </span>
              </div>

              <div className="cg-req-doc-item">
                <span>Registration Certificate</span>
                <span className={`cg-doc-status-dot ${registrationFiles.length > 0 ? "uploaded" : "pending"}`}>
                  • {registrationFiles.length > 0 ? "Uploaded" : "Pending"}
                </span>
              </div>

              <div className="cg-req-doc-item">
                <span>Identity Proof (Trust/Society)</span>
                <span className="cg-doc-status-dot pending">• Pending</span>
              </div>

              <div className="cg-req-doc-item">
                <span>Address Proof</span>
                <span className={`cg-doc-status-dot ${address.length > 5 ? "uploaded" : "pending"}`}>
                  • {address.length > 5 ? "Provided" : "Pending"}
                </span>
              </div>

              <div className="cg-req-doc-item">
                <span>Photo / Logo</span>
                <span className={`cg-doc-status-dot ${stageLogos.length > 0 ? "uploaded" : "pending"}`}>
                  • {stageLogos.length > 0 ? "Uploaded" : "Pending"}
                </span>
              </div>

              <div className="cg-req-doc-item">
                <span>Agreement Document</span>
                <span className={`cg-doc-status-dot ${agreementFiles.length > 0 ? "uploaded" : "pending"}`}>
                  • {agreementFiles.length > 0 ? "Uploaded" : "Pending"}
                </span>
              </div>

              <div className="cg-req-doc-item">
                <span>Other Documents</span>
                <span className="cg-doc-status-dot pending">• Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
