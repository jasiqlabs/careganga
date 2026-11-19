import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Role } from "./roles-permissions-types";
import { IconBan, IconSpinner } from "./roles-permissions-icons";

type Props = {
  role: Role;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RetireRoleModal({ role, saving, onCancel, onConfirm }: Props) {
  const modalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, saving]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const hasAssigned = role.assignedCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="cg-rp-drawer-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
    >
      <motion.section
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="retire-role-title"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.16 }}
        style={{
          background: "#FFFFFF",
          borderRadius: "0.875rem",
          width: "min(100%, 28rem)",
          margin: "auto",
          padding: "1.25rem 1.5rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: "50%",
              background: "#FEF2F2",
              color: "#DC2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <IconBan size={20} />
          </div>
          <div>
            <h3 id="retire-role-title" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0F172A" }}>
              Retire {role.name}?
            </h3>
            <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.75rem", color: "#64748B" }}>
              Permanent availability deactivation
            </p>
          </div>
        </div>

        <div
          style={{
            fontSize: "0.8125rem",
            color: "#475569",
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem"
          }}
        >
          <p style={{ margin: 0 }}>
            The role will no longer be available for new staff assignments across the Foundation.
          </p>
          {hasAssigned ? (
            <p style={{ margin: 0, color: "#DC2626", fontWeight: 600 }}>
              This role currently has {role.assignedCount} assigned account(s). You must reassign those accounts before retiring this role.
            </p>
          ) : (
            <p style={{ margin: 0, color: "#64748B" }}>
              No staff accounts are currently assigned to this role.
            </p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button
            type="button"
            className="cg-rp-btn cg-rp-btn-ghost"
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cg-rp-btn"
            style={{ background: "#DC2626", borderColor: "#DC2626", color: "#FFFFFF" }}
            disabled={saving || hasAssigned}
            onClick={onConfirm}
          >
            {saving && <IconSpinner size={14} />}
            <span>{saving ? "Retiring…" : "Confirm Retirement"}</span>
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
