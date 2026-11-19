import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Role, Group, Capability, PermissionManagerTab, MatrixActionColumn } from "./roles-permissions-types";
import {
  IconInfo,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconShield,
  IconLock,
  IconKey,
  IconSpinner,
  getGroupIcon
} from "./roles-permissions-icons";

type Props = {
  roles: Role[];
  selectedRole: Role | null;
  groups: Group[];
  canManage: boolean;
  onSelectRole: (roleRef: string) => void;
  onSaveRolePermissions: (role: Role, newActionKeys: string[]) => Promise<void>;
  saving: boolean;
};

export function PermissionManagerPanel({
  roles,
  selectedRole,
  groups,
  canManage,
  onSelectRole,
  onSaveRolePermissions,
  saving
}: Props) {
  const [activeTab, setActiveTab] = useState<PermissionManagerTab>("matrix");
  const [quickAction, setQuickAction] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [localActionKeys, setLocalActionKeys] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync local keys when selectedRole changes
  useEffect(() => {
    if (selectedRole) {
      setLocalActionKeys([...selectedRole.actionKeys]);
      setHasUnsavedChanges(false);
    }
  }, [selectedRole]);

  // Tab 2 State: selected module group
  const [selectedModuleGroup, setSelectedModuleGroup] = useState<string>("");
  useEffect(() => {
    if (groups.length && !selectedModuleGroup) {
      setSelectedModuleGroup(groups[0].group);
    }
  }, [groups, selectedModuleGroup]);

  // Tab 3 State: selected role, module, capability, action choice
  const [tab3RoleRef, setTab3RoleRef] = useState<string>("");
  const [tab3Group, setTab3Group] = useState<string>("");
  const [tab3CapabilityKey, setTab3CapabilityKey] = useState<string>("");
  const [tab3GrantChoice, setTab3GrantChoice] = useState<boolean>(true);

  useEffect(() => {
    if (selectedRole) {
      setTab3RoleRef(selectedRole.roleRef);
    }
  }, [selectedRole]);

  useEffect(() => {
    if (groups.length && !tab3Group) {
      setTab3Group(groups[0].group);
    }
  }, [groups, tab3Group]);

  const tab3GroupCapabilities = useMemo(() => {
    return groups.find((g) => g.group === tab3Group)?.actions ?? [];
  }, [groups, tab3Group]);

  useEffect(() => {
    if (tab3GroupCapabilities.length && !tab3GroupCapabilities.some((c) => c.key === tab3CapabilityKey)) {
      setTab3CapabilityKey(tab3GroupCapabilities[0].key);
    }
  }, [tab3GroupCapabilities, tab3CapabilityKey]);

  // Compute map from capability key to column
  const getActionColumn = (key: string): MatrixActionColumn => {
    const k = key.toLowerCase();
    if (k.endsWith(".view") || k.includes(".read")) return "view";
    if (k.endsWith(".create") || k.endsWith(".post") || k.endsWith(".propose") || k.includes(".draft")) return "add";
    if (k.endsWith(".manage") || k.endsWith(".edit") || k.endsWith(".status.manage") || k.includes(".reconciliation")) return "edit";
    if (k.endsWith(".delete") || k.endsWith(".retire") || k.endsWith(".revoke")) return "delete";
    if (k.endsWith(".approve") || k.endsWith(".review") || k.endsWith(".authorize") || k.endsWith(".assign")) return "approve";
    if (k.includes(".export") || k.includes(".download")) return "export";
    return "view";
  };

  const allCapabilities = useMemo(() => groups.flatMap((g) => g.actions), [groups]);
  const totalActionsCount = allCapabilities.length;
  const grantedCount = useMemo(() => {
    return localActionKeys.filter((k) => allCapabilities.some((c) => c.key === k)).length;
  }, [localActionKeys, allCapabilities]);

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const toggleAllCollapse = () => {
    const anyExpanded = groups.some((g) => !collapsedGroups[g.group]);
    const next: Record<string, boolean> = {};
    for (const g of groups) {
      next[g.group] = anyExpanded;
    }
    setCollapsedGroups(next);
  };

  const handleToggleKey = (key: string) => {
    if (!selectedRole || selectedRole.protected || !canManage) return;
    setLocalActionKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      setHasUnsavedChanges(true);
      return next;
    });
  };

  const handleQuickAction = () => {
    if (!selectedRole || selectedRole.protected || !canManage || !quickAction) return;

    if (quickAction === "grant_all") {
      const allAssignable = allCapabilities
        .filter((c) => c.assignable || c.key === "roles.manage")
        .map((c) => c.key);
      setLocalActionKeys(allAssignable);
      setHasUnsavedChanges(true);
    } else if (quickAction === "revoke_all") {
      setLocalActionKeys([]);
      setHasUnsavedChanges(true);
    } else if (quickAction === "view_only") {
      const viewKeys = allCapabilities
        .filter((c) => (c.assignable || c.key === "roles.manage") && getActionColumn(c.key) === "view")
        .map((c) => c.key);
      setLocalActionKeys(viewKeys);
      setHasUnsavedChanges(true);
    }
    setQuickAction("");
  };

  const handleApplyChanges = async () => {
    if (!selectedRole || selectedRole.protected || !canManage) return;
    await onSaveRolePermissions(selectedRole, localActionKeys);
    setHasUnsavedChanges(false);
  };

  // Tab 3 handler
  const handleTab3Apply = async () => {
    if (!selectedRole || selectedRole.protected || !canManage || !tab3CapabilityKey) return;
    const isGranted = localActionKeys.includes(tab3CapabilityKey);
    let next: string[];
    if (tab3GrantChoice && !isGranted) {
      next = [...localActionKeys, tab3CapabilityKey];
    } else if (!tab3GrantChoice && isGranted) {
      next = localActionKeys.filter((k) => k !== tab3CapabilityKey);
    } else {
      return; // Already in desired state
    }
    await onSaveRolePermissions(selectedRole, next);
  };

  const isRoleEditable = Boolean(selectedRole && !selectedRole.protected && canManage);

  return (
    <section aria-labelledby="permissions-title" className="cg-rp-panel">
      {/* Header */}
      <header className="cg-rp-panel-header">
        <div className="cg-rp-panel-title-wrap">
          <h2 id="permissions-title" className="cg-rp-panel-title">
            Permission Manager
          </h2>
          <p className="cg-rp-panel-subtitle">Manage role permissions across modules and actions</p>
        </div>
        <span className="cg-rp-badge system" style={{ fontSize: "0.775rem", padding: "0.25rem 0.65rem", flexShrink: 0 }}>
          {selectedRole?.protected ? "Protected" : `${grantedCount} allowed`}
        </span>
      </header>

      {/* Tabs */}
      <div className="cg-rp-tabs-row" role="tablist" aria-label="Permission Manager Navigation">
        {[
          { key: "matrix" as const, num: 1, label: "Permission Matrix" },
          { key: "module" as const, num: 2, label: "Module Permissions" },
          { key: "set" as const, num: 3, label: "Set Permission" }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`cg-rp-tab-btn ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="cg-rp-tab-num">{tab.num}</span>
              <span className="cg-rp-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Tab 1: Permission Matrix */}
        {activeTab === "matrix" && (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="cg-rp-tab-content"
          >
            <div className="cg-rp-info-banner">
              <IconInfo size={17} />
              <span>
                Permission Matrix lets you view and manage all module permissions for a selected role in a single grid (View, Add, Edit, Delete, Approve, Export).
              </span>
            </div>

            {/* Sub-toolbar */}
            <div className="cg-rp-matrix-toolbar">
              <div className="cg-rp-toolbar-control">
                <label htmlFor="cg-rp-matrix-select-role" className="cg-rp-toolbar-label">
                  Select Role:
                </label>
                <select
                  id="cg-rp-matrix-select-role"
                  className="cg-rp-select"
                  value={selectedRole?.roleRef ?? ""}
                  onChange={(e) => onSelectRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.roleRef} value={r.roleRef}>
                      {r.name} {r.active ? "(Active)" : "(Retired)"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cg-rp-toolbar-control">
                <label htmlFor="cg-rp-matrix-quick-action" className="cg-rp-toolbar-label">
                  Quick Action:
                </label>
                <div className="cg-rp-toolbar-action-group">
                  <select
                    id="cg-rp-matrix-quick-action"
                    className="cg-rp-select"
                    value={quickAction}
                    disabled={!isRoleEditable}
                    onChange={(e) => setQuickAction(e.target.value)}
                  >
                    <option value="">Select Action</option>
                    <option value="grant_all">Grant All Assignable</option>
                    <option value="revoke_all">Revoke All</option>
                    <option value="view_only">View Only</option>
                  </select>

                  <button
                    type="button"
                    className="cg-rp-btn cg-rp-btn-primary"
                    disabled={!isRoleEditable || (!hasUnsavedChanges && !quickAction) || saving}
                    onClick={() => {
                      if (quickAction) {
                        handleQuickAction();
                      } else {
                        void handleApplyChanges();
                      }
                    }}
                  >
                    {saving && <IconSpinner size={13} />}
                    <span>{saving ? "Applying…" : "Apply"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Subbar with Collapse All and Status indicator */}
            <div className="cg-rp-matrix-subbar">
              <button
                type="button"
                className="cg-rp-btn cg-rp-btn-ghost cg-rp-collapse-toggle-btn"
                onClick={toggleAllCollapse}
              >
                {groups.some((g) => !collapsedGroups[g.group]) ? "≈ Collapse All" : "+ Expand All"}
              </button>

              <span className="cg-rp-actions-count-indicator">
                <IconCheck size={14} />
                <span>
                  <strong>{grantedCount}</strong> of <strong>{totalActionsCount}</strong> actions granted
                </span>
              </span>
            </div>

            {/* Protected role message if applicable */}
            {selectedRole?.protected && (
              <div className="cg-rp-notice uncertain">
                <IconShield size={16} />
                <span>This is a protected Foundation system role. Its permissions are enforced by identity policy and cannot be altered here.</span>
              </div>
            )}

            {/* Matrix Table */}
            <div className="cg-rp-table-wrap">
              <table className="cg-rp-matrix-table">
                <thead>
                  <tr>
                    <th>Module / Permission</th>
                    <th>View</th>
                    <th>Add</th>
                    <th>Edit</th>
                    <th>Delete</th>
                    <th>Approve</th>
                    <th>Export</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const isCollapsed = Boolean(collapsedGroups[group.group]);
                    const grantedInGroup = group.actions.filter((a) => localActionKeys.includes(a.key)).length;
                    const totalInGroup = group.actions.length;

                    return (
                      <React.Fragment key={group.group}>
                        {/* Group Header Row */}
                        <tr
                          className="cg-rp-matrix-group-row"
                          onClick={() => toggleGroupCollapse(group.group)}
                        >
                          <td colSpan={7}>
                            <div className="cg-rp-group-title-content">
                              {isCollapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
                              {getGroupIcon(group.group, 15)}
                              <span>{group.group}</span>
                              <span className="cg-rp-group-count-badge">
                                {grantedInGroup}/{totalInGroup}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Child Rows */}
                        {!isCollapsed &&
                          group.actions.map((cap) => {
                            const actionCol = getActionColumn(cap.key);
                            const isGranted = localActionKeys.includes(cap.key);
                            const canToggleThis = isRoleEditable && (cap.assignable || cap.key === "roles.manage");

                            return (
                              <tr key={cap.key} className="cg-rp-matrix-child-row">
                                <td>
                                  <div className="cg-rp-permission-title-indented">
                                    <span>{cap.businessLabel}</span>
                                    {!cap.assignable && cap.key !== "roles.manage" && (
                                      <span title="System Managed Permission" style={{ color: "#94A3B8" }}>
                                        <IconLock size={11} />
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Action Columns: View, Add, Edit, Delete, Approve, Export */}
                                {(["view", "add", "edit", "delete", "approve", "export"] as const).map((col) => {
                                  if (actionCol === col) {
                                    return (
                                      <td key={col}>
                                        <input
                                          type="checkbox"
                                          className="cg-rp-checkbox"
                                          checked={isGranted}
                                          disabled={!canToggleThis || saving}
                                          onChange={() => handleToggleKey(cap.key)}
                                          aria-label={`${col} for ${cap.businessLabel}`}
                                        />
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={col}>
                                      <span className="cg-rp-cell-dash">—</span>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasUnsavedChanges && isRoleEditable && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="cg-rp-btn cg-rp-btn-ghost"
                  onClick={() => {
                    if (selectedRole) setLocalActionKeys([...selectedRole.actionKeys]);
                    setHasUnsavedChanges(false);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="cg-rp-btn cg-rp-btn-primary"
                  disabled={saving}
                  onClick={() => void handleApplyChanges()}
                >
                  {saving && <IconSpinner size={13} />}
                  <span>{saving ? "Saving Changes…" : "Save Permission Changes"}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab 2: Module Permissions */}
        {activeTab === "module" && (
          <motion.div
            key="module"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="cg-rp-tab-content"
          >
            <div className="cg-rp-info-banner">
              <IconInfo size={17} />
              <span>
                Focus on a single module, see its summary, and manage grouped and individual permissions with clear status indicators and toggles.
              </span>
            </div>

            {/* Module Selector & Role Context */}
            <div className="cg-rp-matrix-toolbar">
              <div className="cg-rp-toolbar-control">
                <label htmlFor="cg-rp-select-module" className="cg-rp-toolbar-label">
                  Selected Module:
                </label>
                <select
                  id="cg-rp-select-module"
                  className="cg-rp-select"
                  value={selectedModuleGroup}
                  onChange={(e) => setSelectedModuleGroup(e.target.value)}
                >
                  {groups.map((g) => (
                    <option key={g.group} value={g.group}>
                      {g.group} ({g.actions.length} actions)
                    </option>
                  ))}
                </select>
              </div>

              <div className="cg-rp-toolbar-control" style={{ justifyContent: "flex-end" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                  Role: <strong>{selectedRole?.name ?? "None"}</strong>
                </span>
              </div>
            </div>

            {/* Selected Module Summary Cards */}
            {(() => {
              const currentGroup = groups.find((g) => g.group === selectedModuleGroup);
              const groupActions = currentGroup?.actions ?? [];
              const grantedInGroup = groupActions.filter((a) => localActionKeys.includes(a.key)).length;
              const notGrantedInGroup = groupActions.length - grantedInGroup;

              return (
                <>
                  <div className="cg-rp-module-summary-cards">
                    <div className="cg-rp-module-stat-box">
                      <span className="cg-rp-module-stat-label">Module</span>
                      <span className="cg-rp-module-stat-value" style={{ fontSize: "0.875rem" }} title={selectedModuleGroup}>
                        {selectedModuleGroup || "None"}
                      </span>
                    </div>
                    <div className="cg-rp-module-stat-box">
                      <span className="cg-rp-module-stat-label">Total Actions</span>
                      <span className="cg-rp-module-stat-value">{groupActions.length}</span>
                    </div>
                    <div className="cg-rp-module-stat-box">
                      <span className="cg-rp-module-stat-label">Granted</span>
                      <span className="cg-rp-module-stat-value" style={{ color: "#059669" }}>
                        {grantedInGroup}
                      </span>
                    </div>
                    <div className="cg-rp-module-stat-box">
                      <span className="cg-rp-module-stat-label">Not Granted</span>
                      <span className="cg-rp-module-stat-value" style={{ color: "#64748B" }}>
                        {notGrantedInGroup}
                      </span>
                    </div>
                  </div>

                  {/* Module Permission List */}
                  <div className="cg-rp-module-permission-list">
                    {groupActions.map((cap) => {
                      const isGranted = localActionKeys.includes(cap.key);
                      const canToggleThis = isRoleEditable && (cap.assignable || cap.key === "roles.manage");

                      return (
                        <div key={cap.key} className="cg-rp-module-permission-card">
                          <div className="cg-rp-module-perm-details">
                            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                              <span className="cg-rp-module-perm-title">{cap.businessLabel}</span>
                              <span className={`cg-rp-badge ${isGranted ? "active" : "retired"}`}>
                                {isGranted ? "Allowed" : "Not Granted"}
                              </span>
                              {cap.sensitive && <span className="cg-rp-badge protected">Sensitive</span>}
                            </div>
                            <span className="cg-rp-module-perm-key">{cap.key}</span>
                          </div>

                          <div>
                            {canToggleThis ? (
                              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  className="cg-rp-checkbox"
                                  checked={isGranted}
                                  disabled={saving}
                                  onChange={() => handleToggleKey(cap.key)}
                                />
                                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: isGranted ? "#059669" : "#64748B" }}>
                                  {isGranted ? "Granted" : "Grant"}
                                </span>
                              </label>
                            ) : (
                              <span style={{ fontSize: "0.725rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <IconLock size={12} />
                                System Managed
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {hasUnsavedChanges && isRoleEditable && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="cg-rp-btn cg-rp-btn-primary"
                  disabled={saving}
                  onClick={() => void handleApplyChanges()}
                >
                  {saving && <IconSpinner size={13} />}
                  <span>{saving ? "Saving Changes…" : "Apply Module Permission Changes"}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab 3: Set Permission */}
        {activeTab === "set" && (
          <motion.div
            key="set"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="cg-rp-tab-content"
          >
            <div className="cg-rp-info-banner">
              <IconInfo size={17} />
              <span>
                Grant or revoke a specific permission action for a selected role and module with a clear explanation and apply instantly.
              </span>
            </div>

            <div className="cg-rp-set-perm-form-card">
              {/* Step 1: Role Context */}
              <div className="cg-rp-toolbar-control">
                <span className="cg-rp-toolbar-label" style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A" }}>
                  Target Role:
                </span>
                <select
                  className="cg-rp-select"
                  style={{ width: "auto", minWidth: "11rem" }}
                  value={selectedRole?.roleRef ?? ""}
                  onChange={(e) => onSelectRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.roleRef} value={r.roleRef}>
                      {r.name} {r.protected ? "[System]" : "[Custom]"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2 & 3: Module & Permission Selection */}
              <div className="cg-rp-tab3-grid">
                <div className="cg-rp-field-group">
                  <label className="cg-rp-field-label">Select Module Group</label>
                  <select
                    className="cg-rp-select"
                    value={tab3Group}
                    onChange={(e) => setTab3Group(e.target.value)}
                  >
                    {groups.map((g) => (
                      <option key={g.group} value={g.group}>
                        {g.group}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cg-rp-field-group">
                  <label className="cg-rp-field-label">Select Permission Action</label>
                  <select
                    className="cg-rp-select"
                    value={tab3CapabilityKey}
                    onChange={(e) => setTab3CapabilityKey(e.target.value)}
                  >
                    {tab3GroupCapabilities.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.businessLabel} ({c.key})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 4: Current Status & Info */}
              {(() => {
                const cap = allCapabilities.find((c) => c.key === tab3CapabilityKey);
                const isGranted = Boolean(selectedRole && localActionKeys.includes(tab3CapabilityKey));
                const canEdit = isRoleEditable && Boolean(cap && (cap.assignable || cap.key === "roles.manage"));

                return (
                  <div className="cg-rp-current-status-box">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0F172A" }}>
                          {cap?.businessLabel ?? tab3CapabilityKey}
                        </span>
                        <span className={`cg-rp-badge ${isGranted ? "active" : "retired"}`}>
                          {isGranted ? "Currently Granted" : "Currently Revoked / Not Granted"}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.725rem", color: "#64748B", fontFamily: "monospace" }}>
                        {tab3CapabilityKey}
                      </span>
                      {!canEdit && (
                        <span style={{ fontSize: "0.7rem", color: "#DC2626", marginTop: "0.2rem" }}>
                          {selectedRole?.protected
                            ? "This role is a protected system role and cannot be modified."
                            : "This permission is managed by system identity policy."}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8rem", fontWeight: 600, color: "#166534", cursor: canEdit ? "pointer" : "not-allowed" }}>
                        <input
                          type="radio"
                          name="tab3Choice"
                          checked={tab3GrantChoice === true}
                          disabled={!canEdit}
                          onChange={() => setTab3GrantChoice(true)}
                        />
                        <span>Grant Permission</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8rem", fontWeight: 600, color: "#991B1B", cursor: canEdit ? "pointer" : "not-allowed" }}>
                        <input
                          type="radio"
                          name="tab3Choice"
                          checked={tab3GrantChoice === false}
                          disabled={!canEdit}
                          onChange={() => setTab3GrantChoice(false)}
                        />
                        <span>Revoke Permission</span>
                      </label>
                    </div>
                  </div>
                );
              })()}

              {/* Apply Button */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="cg-rp-btn cg-rp-btn-primary"
                  disabled={!isRoleEditable || saving}
                  onClick={() => void handleTab3Apply()}
                >
                  {saving && <IconSpinner size={13} />}
                  <span>{saving ? "Applying…" : "Apply Permission Change"}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Tab Guide Banner (Reference 1) */}
      <div className="cg-rp-tab-guide-card">
        <div className="cg-rp-tab-guide-header">
          <IconInfo size={17} />
          <span>Permission Manager – Tab Guide</span>
        </div>
        <div className="cg-rp-tab-guide-grid">
          <div className="cg-rp-tab-guide-col">
            <span className="cg-rp-tab-guide-col-title">
              <span className="cg-rp-tab-num">1</span>
              <span>Permission Matrix</span>
            </span>
            <p className="cg-rp-tab-guide-col-desc">
              View and manage all module permissions for a role in a grid (View, Add, Edit, Delete, Approve, Export).
            </p>
          </div>

          <div className="cg-rp-tab-guide-col">
            <span className="cg-rp-tab-guide-col-title">
              <span className="cg-rp-tab-num">2</span>
              <span>Module Permissions</span>
            </span>
            <p className="cg-rp-tab-guide-col-desc">
              Focus on a single module, see its summary, manage grouped and individual permissions with toggles.
            </p>
          </div>

          <div className="cg-rp-tab-guide-col">
            <span className="cg-rp-tab-guide-col-title">
              <span className="cg-rp-tab-num">3</span>
              <span>Set Permission</span>
            </span>
            <p className="cg-rp-tab-guide-col-desc">
              Grant or revoke a specific permission action for a selected role and module with a clear explanation and apply instantly.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
