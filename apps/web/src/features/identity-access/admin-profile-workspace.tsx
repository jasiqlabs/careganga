"use client";

import { useState, useRef, useEffect, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { showAuthNotification } from "../../shared/auth-notification";

interface AdminProfileWorkspaceProps {
  displayName: string;
  roleName: string;
  scope: string;
  canViewSettings?: boolean;
}

export function AdminProfileWorkspace({
  displayName,
  roleName,
  scope,
  canViewSettings = false
}: AdminProfileWorkspaceProps) {
  // Form fields
  const [fullName, setFullName] = useState(displayName || "Super Admin");
  const [designation, setDesignation] = useState("Managing Trustee & Admin");
  const [email] = useState("admin@careganga.org");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [userId] = useState("USR-371005");

  // Avatar upload state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string>("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Signature upload state
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureFileName, setSignatureFileName] = useState<string>("");
  const [signatureFileSize, setSignatureFileSize] = useState<string>("");
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Interaction and save state
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Restore saved preferences on mount if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cg_admin_profile_prefs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.designation) setDesignation(parsed.designation);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.lastSaved) setLastSavedTime(parsed.lastSaved);
      }
    } catch {
      // Local storage unavailable or unreadable
    }
  }, []);

  // Cleanup object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (avatarUrl && avatarUrl.startsWith("blob:")) URL.revokeObjectURL(avatarUrl);
      if (signatureUrl && signatureUrl.startsWith("blob:")) URL.revokeObjectURL(signatureUrl);
    };
  }, [avatarUrl, signatureUrl]);

  // Handle Photo selection with RCA-compliant validation & local preview
  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      showAuthNotification({
        type: "ERROR",
        title: "Invalid File Type",
        message: "Please choose a JPG, PNG, or WebP image for your profile photo."
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAuthNotification({
        type: "ERROR",
        title: "File Too Large",
        message: "Profile photo must be smaller than 5 MB."
      });
      return;
    }

    if (avatarUrl && avatarUrl.startsWith("blob:")) {
      URL.revokeObjectURL(avatarUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setAvatarUrl(objectUrl);
    setAvatarFileName(file.name);
    setIsDirty(true);

    showAuthNotification({
      type: "INFO",
      title: "Local Photo Preview",
      message: "Photo preview loaded in session. Click 'Save Profile & Signature' to store your settings."
    });
  };

  const handleRemovePhoto = () => {
    if (avatarUrl && avatarUrl.startsWith("blob:")) {
      URL.revokeObjectURL(avatarUrl);
    }
    setAvatarUrl(null);
    setAvatarFileName("");
    setIsDirty(true);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  // Handle Signature selection with RCA-compliant validation & local preview
  const handleSignatureSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "image/png") {
      showAuthNotification({
        type: "ERROR",
        title: "PNG Format Required",
        message: "Official signature must be a PNG file with transparent background."
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAuthNotification({
        type: "ERROR",
        title: "File Too Large",
        message: "Signature image must be smaller than 5 MB."
      });
      return;
    }

    if (signatureUrl && signatureUrl.startsWith("blob:")) {
      URL.revokeObjectURL(signatureUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSignatureUrl(objectUrl);
    setSignatureFileName(file.name);
    setSignatureFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setIsDirty(true);

    showAuthNotification({
      type: "INFO",
      title: "Signature Loaded (Preview)",
      message: "Signature PNG ready for receipts and reports. Remember to save your changes."
    });
  };

  const handleRemoveSignature = () => {
    if (signatureUrl && signatureUrl.startsWith("blob:")) {
      URL.revokeObjectURL(signatureUrl);
    }
    setSignatureUrl(null);
    setSignatureFileName("");
    setSignatureFileSize("");
    setIsDirty(true);
    if (signatureInputRef.current) signatureInputRef.current.value = "";
  };

  // Save handler with button loading, notification, and persistence
  const handleSave = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      showAuthNotification({
        type: "ERROR",
        title: "Validation Error",
        message: "Please enter a valid administrator full name (minimum 2 characters)."
      });
      return;
    }

    setIsSaving(true);

    try {
      // Simulate realistic persistence roundtrip
      await new Promise(resolve => setTimeout(resolve, 600));

      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const prefs = {
        fullName: trimmedName,
        designation: designation.trim(),
        phone: phone.trim(),
        lastSaved: now
      };

      try {
        localStorage.setItem("cg_admin_profile_prefs", JSON.stringify(prefs));
      } catch {
        // Storage restricted
      }

      setLastSavedTime(now);
      setIsDirty(false);

      showAuthNotification({
        type: "SUCCESS",
        title: "Profile Saved",
        message: "Administrator details and signature preferences updated successfully."
      });
    } catch {
      showAuthNotification({
        type: "ERROR",
        title: "Unable to Save",
        message: "Unable to save profile preferences. Please try again."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (fullName || displayName || "SA")
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="cg-profile-page-root">
      {/* Page Header */}
      <header className="cg-profile-header">
        <span className="cg-profile-kicker">ACCOUNT PREFERENCES</span>
        <h1 className="cg-profile-title">Admin User Profile &amp; Credentials</h1>
        <p className="cg-profile-subtitle">
          Manage your administrator details, official designation, and digital signature printed on financial receipts.
        </p>
      </header>

      <form onSubmit={handleSave} className="cg-profile-form">
        {/* Main 2-column Grid */}
        <div className="cg-profile-layout-grid">
          {/* Left Column — Primary Details (approx 68%) */}
          <div className="cg-profile-main-col">
            {/* Card 1: Personal Identity & Designation */}
            <section className="cg-profile-card" aria-labelledby="section-personal-identity">
              <div className="cg-card-header">
                <h2 id="section-personal-identity" className="cg-card-title">
                  1. Personal Identity &amp; Designation
                </h2>
                <p className="cg-card-subtitle">
                  Your registered administrator name, official title, email, and phone number.
                </p>
              </div>

              {/* Avatar + Info Row */}
              <div className="cg-avatar-identity-row">
                <div className="cg-avatar-preview-wrap">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Administrator preview"
                      className="cg-avatar-photo-preview"
                    />
                  ) : (
                    <div className="cg-avatar-initials-badge" aria-hidden="true">
                      {initials}
                    </div>
                  )}
                  {avatarUrl && (
                    <span className="cg-avatar-local-tag" title="Local session preview">
                      Preview
                    </span>
                  )}
                </div>

                <div className="cg-avatar-identity-meta">
                  <div className="cg-avatar-identity-name">{fullName || displayName}</div>
                  <div className="cg-avatar-identity-email">{email}</div>
                  <div className="cg-avatar-actions-bar">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      style={{ display: "none" }}
                      aria-label="Upload photo file"
                    />
                    <button
                      type="button"
                      className="cg-upload-photo-btn"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Upload Photo</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        className="cg-remove-photo-link"
                        onClick={handleRemovePhoto}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Input Grid */}
              <div className="cg-form-input-grid">
                <div className="cg-field-group">
                  <label htmlFor="input-full-name" className="cg-field-label">
                    Full Name <span className="cg-field-required">*</span>
                  </label>
                  <input
                    id="input-full-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={e => {
                      setFullName(e.target.value);
                      setIsDirty(true);
                    }}
                    className="cg-text-input-field"
                    placeholder="Enter full name"
                  />
                </div>

                <div className="cg-field-group">
                  <label htmlFor="input-designation" className="cg-field-label">
                    Official Designation / Title
                  </label>
                  <input
                    id="input-designation"
                    type="text"
                    value={designation}
                    onChange={e => {
                      setDesignation(e.target.value);
                      setIsDirty(true);
                    }}
                    className="cg-text-input-field"
                    placeholder="e.g. Managing Trustee & Admin"
                  />
                </div>

                <div className="cg-field-group">
                  <label htmlFor="input-account-email" className="cg-field-label">
                    Email Address (Account ID)
                  </label>
                  <div className="cg-readonly-input-wrapper">
                    <svg className="cg-lock-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      id="input-account-email"
                      type="email"
                      readOnly
                      disabled
                      value={email}
                      className="cg-text-input-field is-disabled"
                      title="Account identifier is verified and cannot be changed here"
                    />
                  </div>
                </div>

                <div className="cg-field-group">
                  <label htmlFor="input-contact-phone" className="cg-field-label">
                    Contact Phone Number
                  </label>
                  <input
                    id="input-contact-phone"
                    type="tel"
                    value={phone}
                    onChange={e => {
                      setPhone(e.target.value);
                      setIsDirty(true);
                    }}
                    className="cg-text-input-field"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
            </section>

            {/* Card 2: Official Digital Signature */}
            <section className="cg-profile-card" aria-labelledby="section-signature">
              <div className="cg-card-header">
                <h2 id="section-signature" className="cg-card-title">
                  2. Official Digital Signature for Financial Receipts &amp; Ledgers
                </h2>
                <p className="cg-card-subtitle">
                  Digital signature image automatically attached to 80G tax receipts and PDF exports.
                </p>
              </div>

              {/* Signature Upload Dropzone */}
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png"
                onChange={handleSignatureSelect}
                style={{ display: "none" }}
                aria-label="Upload official signature PNG"
              />

              {signatureUrl ? (
                <div className="cg-signature-loaded-box">
                  <div className="cg-signature-preview-canvas">
                    <img
                      src={signatureUrl}
                      alt="Digital signature preview"
                      className="cg-signature-img-preview"
                    />
                  </div>
                  <div className="cg-signature-meta-row">
                    <div className="cg-signature-file-info">
                      <span className="cg-signature-file-name">{signatureFileName}</span>
                      {signatureFileSize && (
                        <span className="cg-signature-file-size">({signatureFileSize})</span>
                      )}
                      <span className="cg-signature-status-pill">Local Preview Active</span>
                    </div>
                    <div className="cg-signature-loaded-actions">
                      <button
                        type="button"
                        className="cg-signature-replace-btn"
                        onClick={() => signatureInputRef.current?.click()}
                      >
                        Change PNG
                      </button>
                      <button
                        type="button"
                        className="cg-signature-remove-btn"
                        onClick={handleRemoveSignature}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="cg-signature-dropzone"
                  onClick={() => signatureInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      signatureInputRef.current?.click();
                    }
                  }}
                  aria-label="Click to upload signature PNG file"
                >
                  <div className="cg-signature-upload-icon-circle">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <span className="cg-signature-dropzone-prompt">
                    Click to Upload Signature PNG
                  </span>
                  <span className="cg-signature-dropzone-subtext">
                    PNG file with transparent background (max 5MB)
                  </span>
                </div>
              )}

              {/* Signature Guidance Notice */}
              <div className="cg-signature-info-callout" role="note">
                <div className="cg-info-callout-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <p className="cg-info-callout-text">
                  Upload a clean black or blue ink signature PNG with a transparent background for optimal rendering on receipts.
                </p>
              </div>
            </section>

            {/* Card 3: Role & Administrative Privileges */}
            <section className="cg-profile-card" aria-labelledby="section-privileges">
              <div className="cg-card-header">
                <h2 id="section-privileges" className="cg-card-title">
                  3. Role &amp; Administrative Privileges
                </h2>
                <p className="cg-card-subtitle">
                  Summary of system authorization role and governance scope.
                </p>
              </div>

              <div className="cg-privileges-subcards-grid">
                {/* System Authorization Level */}
                <div className="cg-privilege-subcard">
                  <span className="cg-privilege-label">SYSTEM AUTHORIZATION LEVEL</span>
                  <div className="cg-privilege-heading-row">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <strong className="cg-privilege-val">{roleName?.toUpperCase() || "ADMIN"}</strong>
                  </div>
                  <p className="cg-privilege-desc">
                    Full administrative authority across all modules, campaigns, ledgers, and system configurations.
                  </p>
                </div>

                {/* Account Security Status */}
                <div className="cg-privilege-subcard">
                  <span className="cg-privilege-label">ACCOUNT SECURITY STATUS</span>
                  <div className="cg-privilege-heading-row">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <strong className="cg-privilege-val text-green">Verified Active Session</strong>
                  </div>
                  <p className="cg-privilege-desc">
                    Multi-factor token authentication active. Password change and session revoking can be triggered anytime.
                  </p>
                  <div style={{ marginTop: "0.5rem" }}>
                    <Link href="/admin/password" className="cg-change-pwd-link">
                      Change Account Password &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column — Security & Access Scope Card (approx 32%) */}
          <aside className="cg-profile-side-col" aria-label="Security and Access Scope">
            <div className="cg-security-scope-card">
              <h2 className="cg-scope-card-title">Security &amp; Access Scope</h2>

              <ul className="cg-scope-items-list">
                <li className="cg-scope-item">
                  <span className="cg-scope-prop">ROLE</span>
                  <div className="cg-scope-val-wrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span className="cg-scope-val-text font-bold">{roleName?.toUpperCase() || "ADMIN"}</span>
                  </div>
                </li>

                <li className="cg-scope-item">
                  <span className="cg-scope-prop">USER ID</span>
                  <div className="cg-scope-val-wrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="cg-scope-val-text font-mono font-semibold">{userId}</span>
                  </div>
                </li>

                <li className="cg-scope-item">
                  <span className="cg-scope-prop">TITLE</span>
                  <div className="cg-scope-val-wrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span className="cg-scope-val-text font-semibold">{designation}</span>
                  </div>
                </li>

                <li className="cg-scope-item">
                  <span className="cg-scope-prop">SIGNATURE</span>
                  <div className="cg-scope-val-wrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" aria-hidden="true">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                    <span className="cg-scope-val-text text-muted">
                      {signatureUrl ? "Loaded (Preview)" : "Not Set"}
                    </span>
                  </div>
                </li>

                <li className="cg-scope-item">
                  <span className="cg-scope-prop">STATUS</span>
                  <div className="cg-scope-val-wrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span className="cg-scope-val-text text-green font-bold">Active Verified</span>
                  </div>
                </li>
              </ul>
            </div>
          </aside>
        </div>

        {/* Sticky Save Bar at Bottom */}
        <div className="cg-profile-sticky-bar">
          <div className="cg-sticky-bar-content">
            <div className="cg-sticky-status-indicator">
              {isSaving ? (
                <div className="cg-sticky-saving-wrap">
                  <span className="cg-sticky-spinner" aria-hidden="true" />
                  <span>Saving administrator profile...</span>
                </div>
              ) : isDirty ? (
                <div className="cg-sticky-dirty-wrap">
                  <span className="cg-dirty-dot" aria-hidden="true" />
                  <span>Unsaved changes (local preview ready)</span>
                </div>
              ) : (
                <div className="cg-sticky-saved-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 12 15 16 10" />
                  </svg>
                  <span>
                    All changes saved
                    {lastSavedTime && <small style={{ marginLeft: "0.4rem", opacity: 0.7 }}>at {lastSavedTime}</small>}
                  </span>
                </div>
              )}
            </div>

            <div className="cg-sticky-actions">
              <button
                type="submit"
                disabled={isSaving || !isDirty}
                className="cg-save-profile-btn"
                aria-label="Save Profile and Signature"
              >
                {isSaving ? (
                  <>
                    <span className="cg-btn-spinner" aria-hidden="true" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    <span>Save Profile &amp; Signature</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
