"use client";

import type { CG01AccountView } from "@careganga/api-contracts";
import {
  XIcon,
  AlertTriangleIcon,
  Trash2Icon
} from "./users-management-icons";
import type { Notice } from "./users-management-types";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: CG01AccountView | null;
  busy: boolean;
  uncertain: boolean;
  notice: Notice | null;
  onConfirm: () => void;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  account,
  busy,
  uncertain,
  notice,
  onConfirm
}: DeleteConfirmationModalProps) {
  if (!isOpen || !account) return null;

  return (
    <div className="cg-um-modal-backdrop" role="presentation" onClick={e => {
      if (e.target === e.currentTarget && !busy) onClose();
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-delete-title"
        className="cg-um-modal cg-um-delete-modal"
      >
        {/* Modal Header */}
        <header className="cg-um-modal-header danger">
          <div className="cg-um-modal-title-row">
            <span className="cg-um-modal-icon-badge danger" aria-hidden="true">
              <AlertTriangleIcon size={18} />
            </span>
            <h2 id="um-delete-title" className="cg-um-modal-title danger">
              Delete User Account
            </h2>
          </div>
          <button
            type="button"
            className="cg-um-drawer-close-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <XIcon size={18} />
          </button>
        </header>

        {/* Modal Body */}
        <div className="cg-um-modal-body text-center">
          <div className="cg-um-delete-warning-icon-box" aria-hidden="true">
            <AlertTriangleIcon size={32} />
          </div>

          <p className="cg-um-delete-message">
            Are you sure you want to permanently delete the account for{" "}
            <strong>{account.displayName}</strong>?
          </p>
          <p className="cg-um-delete-submessage">
            {account.email || account.phone || "No contact registered"}
          </p>

          <div className="cg-um-delete-warning-banner">
            <AlertTriangleIcon size={16} className="cg-um-banner-icon" />
            <span>Warning: This action cannot be undone and will revoke all portal access rights.</span>
          </div>

          {notice && (
            <div className={`cg-um-notice-box ${notice.kind}`} role={notice.kind === "success" ? "status" : "alert"}>
              <span>{notice.text}</span>
            </div>
          )}

          {uncertain && (
            <div className="cg-um-notice-box uncertain" role="alert">
              <span>This request may have been processed. Refresh before another attempt.</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="cg-um-modal-footer">
          <button
            type="button"
            className="cg-um-btn cg-um-btn-outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cg-um-btn cg-um-btn-danger"
            disabled={busy || uncertain}
            onClick={onConfirm}
          >
            <Trash2Icon size={16} />
            <span>{busy ? "Deleting…" : "Yes, Delete"}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
