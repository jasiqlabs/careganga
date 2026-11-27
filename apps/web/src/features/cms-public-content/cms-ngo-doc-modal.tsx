"use client";
import { useEffect, useState } from "react";
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  X,
  ExternalLink,
  Download,
  Lock,
} from "lucide-react";

export function CmsNgoDocModalButton({
  title,
  meta,
  src,
  verifiedBy,
  active = true,
  buttonLabel = "VIEW DOCUMENT",
  className = "cg-site-ngo-view-doc-btn",
}: {
  title: string;
  meta?: string;
  src: string;
  verifiedBy?: string;
  active?: boolean;
  buttonLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setImgFailed(false);
          setOpen(true);
        }}
      >
        {buttonLabel}
      </button>

      {open && (
        <div
          className="cg-site-ngo-doc-modal-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="cg-site-ngo-doc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ngo-doc-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cg-site-ngo-doc-modal-header">
              <div className="cg-site-ngo-doc-modal-title-wrap">
                <div className="cg-site-ngo-doc-modal-icon">
                  <FileText size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3 id="ngo-doc-modal-title">{title}</h3>
                  {meta && <p>{meta}</p>}
                </div>
              </div>
              <button
                type="button"
                className="cg-site-ngo-doc-modal-x"
                aria-label="Close document viewer"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="cg-site-ngo-doc-auth-bar">
              <div className="cg-site-ngo-doc-auth-left">
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>Official Authenticated Record</strong>
                  <span>{verifiedBy || "Verified by CareGanga Foundation Secretariat"}</span>
                </div>
              </div>
              {active && (
                <span className="cg-site-ngo-doc-auth-pill">
                  <CheckCircle2 size={13} aria-hidden="true" /> Active &amp; Valid
                </span>
              )}
            </div>

            <div className="cg-site-ngo-doc-preview-box">
              {!imgFailed ? (
                <img
                  src={src}
                  alt={title}
                  className="cg-site-ngo-doc-preview-img"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="cg-site-ngo-doc-preview-fallback">
                  <FileText size={40} aria-hidden="true" />
                  <strong>{title}</strong>
                  <p>
                    Use <strong>Open Original</strong> or <strong>Download</strong> below to view
                    the complete certified PDF document.
                  </p>
                </div>
              )}
            </div>

            <div className="cg-site-ngo-doc-modal-footer">
              <span className="cg-site-ngo-doc-readonly">
                <Lock size={13} aria-hidden="true" /> Read-only certified copy
              </span>
              <div className="cg-site-ngo-doc-footer-btns">
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cg-site-ngo-doc-btn-outline"
                >
                  <ExternalLink size={14} aria-hidden="true" /> Open Original
                </a>
                <a href={src} download className="cg-site-ngo-doc-btn-outline">
                  <Download size={14} aria-hidden="true" /> Download
                </a>
                <button
                  type="button"
                  className="cg-site-ngo-doc-btn-close"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
