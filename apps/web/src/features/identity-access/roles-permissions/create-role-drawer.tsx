import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FormMode, Group, Role } from "./roles-permissions-types";
import { roleColorOptions, roleColor } from "../../../../../../packages/design-tokens/src/index";
import {
  IconPlusCircle,
  IconX,
  IconSearch,
  IconBuilding,
  IconCheck,
  IconShield,
  IconChevronDown,
  IconChevronRight,
  IconLock,
  IconInfo,
  IconSpinner,
  getGroupIcon
} from "./roles-permissions-icons";

type Props = {
  editor: { mode: FormMode; source?: Role };
  groups: Group[];
  copyCandidates: Role[];
  copyLoading: boolean;
  copyError: string;
  saving: boolean;
  onClose: () => void;
  onSave: (e: FormEvent<HTMLFormElement>) => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  colorKey: string;
  setColorKey: (v: string) => void;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  onFindCopySources: (text: string) => void;
  onSelectCopySource: (roleRef: string) => void;
};

export function CreateRoleDrawer({
  editor,
  groups,
  copyCandidates,
  copyLoading,
  copyError,
  saving,
  onClose,
  onSave,
  name,
  setName,
  description,
  setDescription,
  colorKey,
  setColorKey,
  selected,
  setSelected,
  onFindCopySources,
  onSelectCopySource
}: Props) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const [copySearchText, setCopySearchText] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Stable refs for callbacks inside event handlers
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const savingRef = useRef(saving);
  savingRef.current = saving;

  // Run initial focus ONLY ONCE on mount — NEVER re-run on typing or state updates!
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Focus first input only on initial drawer open
    const firstInput = dialog.querySelector<HTMLElement>("input:not([disabled])");
    firstInput?.focus();
  }, []);

  // Keyboard trap (Escape and Tab) — stable listener that never re-attaches on keystrokes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!savingRef.current) {
          e.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getClientRects().length > 0);

      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Prevent background body scrolling while drawer is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const allCapabilities = useMemo(() => groups.flatMap((g) => g.actions), [groups]);
  const assignableCapabilities = useMemo(
    () => allCapabilities.filter((c) => c.assignable || c.key === "roles.manage"),
    [allCapabilities]
  );

  const getActionColumn = (key: string): "view" | "add" | "edit" | "delete" | "approve" => {
    const k = key.toLowerCase();
    if (k.endsWith(".view") || k.includes(".read")) return "view";
    if (k.endsWith(".create") || k.endsWith(".post") || k.endsWith(".propose") || k.includes(".draft")) return "add";
    if (k.endsWith(".manage") || k.endsWith(".edit") || k.endsWith(".status.manage") || k.includes(".reconciliation")) return "edit";
    if (k.endsWith(".delete") || k.endsWith(".retire") || k.endsWith(".revoke")) return "delete";
    if (k.endsWith(".approve") || k.endsWith(".review") || k.endsWith(".authorize") || k.endsWith(".assign")) return "approve";
    return "view";
  };

  const isAllSelected = assignableCapabilities.length > 0 && assignableCapabilities.every((c) => selected.includes(c.key));

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allAssignableKeys = assignableCapabilities.map((c) => c.key);
      setSelected(allAssignableKeys);
    } else {
      setSelected([]);
    }
  };

  const toggleCategory = (groupName: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const toggleAllAccordions = () => {
    const anyOpen = groups.some((g) => !collapsedCategories[g.group]);
    const next: Record<string, boolean> = {};
    for (const g of groups) {
      next[g.group] = anyOpen;
    }
    setCollapsedCategories(next);
  };

  // Copied permissions are 100% editable — user can toggle any individual capability
  const handleToggleCapability = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const initials = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return "AR";
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }, [name]);

  const selectedCount = selected.filter((k) => assignableCapabilities.some((c) => c.key === k)).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="cg-rp-drawer-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <motion.section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-drawer-title"
        className="cg-rp-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
      >
        {/* Fixed Header */}
        <header className="cg-rp-drawer-header">
          <div className="cg-rp-drawer-header-left">
            <div className="cg-rp-drawer-icon-wrap" aria-hidden="true">
              <IconPlusCircle size={20} />
            </div>
            <div className="cg-rp-drawer-title-wrap">
              <h2 id="role-drawer-title">
                {editor.mode === "create" ? "Create Role" : editor.mode === "edit" ? "Edit Role" : "Copy Role"}
              </h2>
              <p>Define a new role, set its scope and assign permissions.</p>
            </div>
          </div>

          <button
            type="button"
            className="cg-rp-drawer-close-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Close drawer"
          >
            <IconX size={16} />
          </button>
        </header>

        {/* Form Container with Independent Scrollable Body and Fixed Footer */}
        <form className="cg-rp-drawer-form" onSubmit={onSave}>
          <div className="cg-rp-drawer-body">
            {/* Copied Role Active Banner */}
            {editor.mode === "copy" && editor.source && (
              <div className="cg-rp-notice success" style={{ marginBottom: "0.25rem" }}>
                <IconInfo size={16} />
                <span>
                  Permissions copied from <strong>{editor.source.name}</strong>. You can freely adjust, deselect, or add permissions below.
                </span>
              </div>
            )}

            {/* Step 1: Basic Information */}
            <div className="cg-rp-drawer-step">
              <div className="cg-rp-step-header">
                <span className="cg-rp-step-num">1</span>
                <span>Basic Information</span>
              </div>

              <div className="cg-rp-field-group">
                <label htmlFor="cg-rp-role-name-input" className="cg-rp-field-label">
                  Role Name <span style={{ color: "#DC2626" }}>*</span>
                  <span className="cg-rp-char-counter">{name.length} / 80</span>
                </label>
                <input
                  id="cg-rp-role-name-input"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  className="cg-rp-input"
                  placeholder="e.g., Audit Manager"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="cg-rp-field-group">
                <label htmlFor="cg-rp-role-desc-input" className="cg-rp-field-label">
                  Description
                  <span className="cg-rp-char-counter">{description.length} / 350</span>
                </label>
                <textarea
                  id="cg-rp-role-desc-input"
                  className="cg-rp-input"
                  style={{ height: "4rem", padding: "0.5rem 0.65rem", resize: "vertical" }}
                  placeholder="Enter role description (optional)"
                  maxLength={350}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Step 2: Copy Permissions (When creating or copying a role) */}
            {editor.mode !== "edit" && (
              <div className="cg-rp-drawer-step">
                <div className="cg-rp-step-header">
                  <span className="cg-rp-step-num">2</span>
                  <span>Copy Permissions</span>
                </div>

                <div className="cg-rp-field-group">
                  <label className="cg-rp-field-label">Copy Permissions From</label>
                  <select
                    className="cg-rp-select"
                    value={editor.mode === "copy" ? editor.source?.roleRef ?? "" : ""}
                    disabled={saving || copyLoading}
                    onChange={(e) => onSelectCopySource(e.target.value)}
                  >
                    <option value="">Start with no permissions</option>
                    {[
                      ...copyCandidates,
                      ...(editor.source && !copyCandidates.some((x) => x.roleRef === editor.source?.roleRef)
                        ? [editor.source]
                        : [])
                    ]
                      .filter((r) => r.active && !r.protected)
                      .map((r) => (
                        <option key={r.roleRef} value={r.roleRef}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="cg-rp-field-group">
                  <label className="cg-rp-field-label">Find a Role to Copy</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div className="cg-rp-input-wrapper" style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="cg-rp-input with-icon-left"
                        placeholder="Role name..."
                        value={copySearchText}
                        maxLength={80}
                        onChange={(e) => setCopySearchText(e.target.value)}
                        disabled={saving || copyLoading}
                      />
                      <IconSearch className="left" size={14} />
                    </div>
                    <button
                      type="button"
                      className="cg-rp-btn"
                      style={{ height: "2.1rem" }}
                      disabled={copyLoading || saving}
                      onClick={() => onFindCopySources(copySearchText)}
                    >
                      {copyLoading && <IconSpinner size={13} />}
                      <span>{copyLoading ? "Finding…" : "Find Role"}</span>
                    </button>
                  </div>
                  {copyError && <p className="cg-rp-notice error">{copyError}</p>}
                </div>
              </div>
            )}

            {/* Step 3: Scope */}
            <div className="cg-rp-drawer-step">
              <div className="cg-rp-step-header">
                <span className="cg-rp-step-num">3</span>
                <span>Scope</span>
              </div>

              <div className="cg-rp-field-group">
                <label className="cg-rp-field-label">
                  Applies To <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <div className="cg-rp-scope-display">
                  <IconBuilding size={15} />
                  <span>Entire foundation</span>
                </div>
              </div>
            </div>

            {/* Step 4: Role Appearance */}
            <div className="cg-rp-drawer-step">
              <div className="cg-rp-step-header">
                <span className="cg-rp-step-num">4</span>
                <span>Role Appearance</span>
              </div>

              <div className="cg-rp-field-group">
                <label className="cg-rp-field-label">
                  Color <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <div className="cg-rp-color-swatches-row">
                  <div className="cg-rp-color-options" role="radiogroup" aria-label="Role color choices">
                    {roleColorOptions.map((opt) => {
                      const isSelected = colorKey === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`cg-rp-color-circle-btn ${isSelected ? "is-selected" : ""}`}
                          style={{ backgroundColor: opt.hex }}
                          onClick={() => setColorKey(opt.key)}
                          disabled={saving}
                          title={opt.name}
                        >
                          {isSelected && <IconCheck size={13} />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Preview Pill */}
                  <div className="cg-rp-color-preview-pill">
                    <span
                      className="cg-rp-color-preview-dot"
                      style={{ backgroundColor: roleColor(colorKey) }}
                    >
                      {initials}
                    </span>
                    <span>Preview: {name.trim() || "Audit Role"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5: Permission Assignment */}
            <div className="cg-rp-drawer-step">
              <div className="cg-rp-step-header" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                  <span className="cg-rp-step-num">5</span>
                  <span>Permission Assignment</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", fontSize: "0.75rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      cursor: "pointer",
                      fontWeight: 600,
                      color: "#334155"
                    }}
                  >
                    <input
                      type="checkbox"
                      className="cg-rp-checkbox"
                      checked={isAllSelected}
                      disabled={saving}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    />
                    <span>Select All</span>
                  </label>

                  <button
                    type="button"
                    className="cg-rp-btn cg-rp-btn-ghost"
                    style={{ height: "1.7rem", padding: "0 0.4rem", fontSize: "0.725rem" }}
                    onClick={toggleAllAccordions}
                  >
                    {groups.some((g) => !collapsedCategories[g.group]) ? "Collapse All" : "Expand All"}
                  </button>
                </div>
              </div>

              {/* Accordion Permission Groups */}
              <div className="cg-rp-perm-groups-wrap">
                {groups
                  .filter((group) => group.actions.some((cap) => cap.assignable || cap.key === "roles.manage"))
                  .map((group) => {
                    const isCollapsed = Boolean(collapsedCategories[group.group]);
                    const assignableInGroup = group.actions.filter(
                      (cap) => cap.assignable || cap.key === "roles.manage"
                    );
                    const selectedInGroup = assignableInGroup.filter((cap) => selected.includes(cap.key)).length;

                    return (
                      <div key={group.group} className="cg-rp-perm-accordion">
                        <button
                          type="button"
                          className="cg-rp-perm-accordion-header"
                          onClick={() => toggleCategory(group.group)}
                        >
                          <div className="cg-rp-accordion-left">
                            {isCollapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
                            {getGroupIcon(group.group, 15)}
                            <span>{group.group}</span>
                            <span
                              className={`cg-rp-perm-selected-pill ${selectedInGroup === 0 ? "none" : ""}`}
                            >
                              ({selectedInGroup}/{assignableInGroup.length} selected)
                            </span>
                          </div>

                          <div className="cg-rp-accordion-right">
                            <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                              {isCollapsed ? "Show" : "Hide"}
                            </span>
                          </div>
                        </button>

                        {!isCollapsed && (
                          <div className="cg-rp-perm-accordion-body">
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                              <thead>
                                <tr style={{ color: "#64748B", borderBottom: "1px solid #F1F5F9", textAlign: "left" }}>
                                  <th style={{ padding: "0.35rem 0.45rem", fontWeight: 600 }}>Permission</th>
                                  <th style={{ padding: "0.35rem 0.45rem", fontWeight: 600, textAlign: "center" }}>View</th>
                                  <th style={{ padding: "0.35rem 0.45rem", fontWeight: 600, textAlign: "center" }}>Add</th>
                                  <th style={{ padding: "0.35rem 0.45rem", fontWeight: 600, textAlign: "center" }}>Edit</th>
                                  <th style={{ padding: "0.35rem 0.45rem", fontWeight: 600, textAlign: "center" }}>Delete</th>
                                  <th style={{ padding: "0.35rem 0.45rem", fontWeight: 600, textAlign: "center" }}>Approve</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.actions.map((cap) => {
                                  const actionCol = getActionColumn(cap.key);
                                  const isChecked = selected.includes(cap.key);
                                  const canSelect = cap.assignable || cap.key === "roles.manage";

                                  return (
                                    <tr key={cap.key} style={{ borderBottom: "1px solid #F8FAFC" }}>
                                      <td style={{ padding: "0.4rem 0.45rem", color: "#1E293B" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                          <span>{cap.businessLabel}</span>
                                          {!canSelect && (
                                            <span title="Administrator-only permission" style={{ color: "#94A3B8" }}>
                                              <IconLock size={11} />
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      {(["view", "add", "edit", "delete", "approve"] as const).map((col) => {
                                        if (actionCol === col) {
                                          return (
                                            <td key={col} style={{ textAlign: "center", padding: "0.4rem 0.45rem" }}>
                                              <input
                                                type="checkbox"
                                                className="cg-rp-checkbox"
                                                checked={isChecked}
                                                disabled={!canSelect || saving}
                                                onChange={() => handleToggleCapability(cap.key)}
                                                aria-label={`${cap.businessLabel} - ${col}`}
                                              />
                                            </td>
                                          );
                                        }
                                        return (
                                          <td key={col} style={{ textAlign: "center", color: "#CBD5E1" }}>
                                            —
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Step 6: Permission Summary */}
            <div className="cg-rp-drawer-step">
              <div className="cg-rp-step-header">
                <span className="cg-rp-step-num">6</span>
                <span>Permission Summary</span>
              </div>

              <div className="cg-rp-perm-summary-row">
                <div className="cg-rp-summary-box-green">
                  <IconCheck size={18} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#166534" }}>
                      {selectedCount} permissions selected
                    </span>
                    <span style={{ fontSize: "0.6875rem", color: "#15803D" }}>
                      Across all modules and actions
                    </span>
                  </div>
                </div>

                <div className="cg-rp-summary-box-blue">
                  <IconShield size={18} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.725rem", fontWeight: 700, color: "#1E40AF" }}>
                      Administrator-only permissions are managed by the system.
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "#3B82F6" }}>
                      These permissions cannot be manually assigned or modified.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Sticky Drawer Footer — ALWAYS VISIBLE at the bottom */}
          <footer className="cg-rp-drawer-footer">
            <button
              type="button"
              className="cg-rp-btn cg-rp-btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cg-rp-btn cg-rp-btn-primary"
              disabled={saving || !name.trim()}
            >
              {saving && <IconSpinner size={14} />}
              <span>{saving ? "Saving…" : "Save Role"}</span>
            </button>
          </footer>
        </form>
      </motion.section>
    </motion.div>
  );
}
