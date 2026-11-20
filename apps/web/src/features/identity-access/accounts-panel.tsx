"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { CG01AccountList, CG01AccountView } from "@careganga/api-contracts";
import type { RoleOption, Notice, PendingAction, ViewMode, Density } from "./users-management/users-management-types";
import { formatEmployeeId, formatDisplayDate, accountStatusLabel } from "./users-management/users-management-types";
import { UsersManagementHeader } from "./users-management/users-management-header";
import { AdvancedSearchPanel } from "./users-management/advanced-search-panel";
import { EmployeeStatsCards } from "./users-management/employee-stats-cards";
import { EmployeeTableView } from "./users-management/employee-table-view";
import { EmployeeCardView } from "./users-management/employee-card-view";
import { AddStaffDrawer } from "./users-management/add-staff-drawer";
import { UserDetailsDrawer } from "./users-management/user-details-drawer";
import { EditProfileDrawer } from "./users-management/edit-profile-drawer";
import { AssignRoleModal } from "./users-management/assign-role-modal";
import { DeleteConfirmationModal } from "./users-management/delete-confirmation-modal";

type Editor = "create" | "detail" | "edit" | null;

async function read<T>(path: string): Promise<T> {
  const response = await fetch("/api/access/" + path, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Session expired"
        : response.status === 403
        ? "Permission denied"
        : "Account information is temporarily unavailable"
    );
  }
  return response.json() as Promise<T>;
}

async function change(path: string, method: string, payload: object): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch("/api/access/" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error("UNKNOWN");
  }
  if (!response.ok) {
    let info: unknown = null;
    try {
      info = await response.json();
    } catch {}
    const code = info && typeof info === "object" && "code" in info ? String(info.code) : "";
    if (response.status === 409) {
      throw new Error(
        code === "STALE_ACCOUNT"
          ? "Account changed elsewhere. Refresh before saving."
          : code === "DUPLICATE_ACCOUNT_OR_ASSIGNMENT"
          ? "This account or assignment already exists."
          : "This request conflicts with the current account state."
      );
    }
    if (response.status === 401 || response.status === 403) throw new Error("Permission denied or session expired");
    if (response.status === 400) throw new Error("Check your entry or selected role.");
    throw new Error("UNKNOWN");
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error("UNKNOWN");
  }
}

export function AccountsPanel({ createOnly = false }: { createOnly?: boolean }) {
  const [list, setList] = useState<CG01AccountList | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [history, setHistory] = useState<Array<{
    eventRef: string;
    occurredAt: string;
    actionLabel: string;
    outcome: string;
    actorDisplay: string;
  }> | null>(null);

  // Filters & Pagination State
  const [filter, setFilter] = useState("all");
  const [applied, setApplied] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // View Preferences State
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [density, setDensity] = useState<Density>("comfortable");

  // Drawers and Modals State
  const [editor, setEditor] = useState<Editor>(null);
  const [activeModal, setActiveModal] = useState<"assignRole" | "deleteConfirm" | "statusConfirm" | null>(null);
  const [target, setTarget] = useState<CG01AccountView | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  // Add Staff Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [roleRef, setRoleRef] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [searchRole, setSearchRole] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "SUSPENDED" | "DEACTIVATED">("ACTIVE");

  const requestKey = useRef("");
  const generation = useRef(0);
  const createEntryOpened = useRef(false);
  const roleRead = useRef(0);
  const historyRead = useRef(0);

  const purge = useCallback((message: string) => {
    ++generation.current;
    ++roleRead.current;
    ++historyRead.current;
    setList(null);
    setRoles([]);
    setRolesLoading(false);
    setActions([]);
    setHistory(null);
    setTarget(null);
    setPending(null);
    setEditor(null);
    setActiveModal(null);
    setLoading(false);
    setNotice({ kind: "error", text: message });
  }, []);

  const load = useCallback(
    async (search: string, skip: number, status: string) => {
      const seq = ++generation.current;
      setLoading(true);
      try {
        if (createOnly) {
          const access = await read<{ actions: { key: string }[] }>("effective");
          if (seq !== generation.current) return;
          if (
            !access ||
            !Array.isArray(access.actions) ||
            !access.actions.every(x => x && typeof x.key === "string")
          ) {
            throw new Error("Invalid access response");
          }
          const keys = access.actions.map(x => x.key);
          if (!keys.includes("accounts.create") || !keys.includes("roles.assign")) {
            throw new Error("Permission denied");
          }
          setList(null);
          setActions(keys);
          return;
        }

        const params = new URLSearchParams({ search, offset: String(skip), limit: String(limit), status });
        const [listResponse, access] = await Promise.all([
          read<CG01AccountList>("accounts?" + params.toString()),
          read<{ actions: { key: string }[] }>("effective")
        ]);
        if (seq !== generation.current) return;
        if (
          !listResponse ||
          !Array.isArray(listResponse.accounts) ||
          !access ||
          !Array.isArray(access.actions)
        ) {
          throw new Error("Invalid account response");
        }
        setList(listResponse);
        setActions(access.actions.map(x => x.key));
        setApplied(search);
        setOffset(skip);
        setFilter(status);
        setTarget(old => listResponse.accounts.find(x => x.accountRef === old?.accountRef) ?? null);
      } catch (e) {
        if (seq !== generation.current) return;
        purge(e instanceof Error ? e.message : "Accounts unavailable");
      } finally {
        if (seq === generation.current) setLoading(false);
      }
    },
    [purge, createOnly, limit]
  );

  useEffect(() => {
    void load("", 0, "all");
  }, [load]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") void load(applied, offset, filter);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load, applied, offset, filter]);

  const canCreate = actions.includes("accounts.create") && actions.includes("roles.assign");
  const canAssign = actions.includes("roles.assign");
  const canStatus = actions.includes("accounts.status.manage");

  async function roleSearch(value: string) {
    const request = ++roleRead.current;
    setRolesLoading(true);
    try {
      const params = new URLSearchParams({ search: value });
      const result = await read<{ options: RoleOption[] }>("roles/options?" + params.toString());
      if (request !== roleRead.current) return;
      if (!Array.isArray(result.options)) throw new Error("Invalid role response");
      const filtered = result.options.filter(x => !x.context || x.context.toLowerCase() === "foundation");
      const unique = Array.from(new Map(filtered.map(r => [r.value, r])).values());
      setRoles(unique);
      setRoleRef(prev => (prev && unique.some(r => r.value === prev) ? prev : ""));
    } catch (e) {
      if (request !== roleRead.current) return;
      setRoles([]);
      setRoleRef("");
      if (e instanceof Error && /session expired|permission denied/i.test(e.message)) purge(e.message);
      else setNotice({ kind: "error", text: "Eligible roles are temporarily unavailable." });
    } finally {
      if (request === roleRead.current) setRolesLoading(false);
    }
  }

  function openCreate() {
    ++roleRead.current;
    ++historyRead.current;
    setEditor("create");
    setPending(null);
    setActiveModal(null);
    setHistory(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setNewPassword("");
    setRoleRef("");
    setSearchRole("");
    setNotice(null);
    requestKey.current = crypto.randomUUID();
    void roleSearch("");
  }

  useEffect(() => {
    if (createOnly && canCreate && !createEntryOpened.current) {
      createEntryOpened.current = true;
      openCreate();
    }
  }, [createOnly, canCreate]);

  function openAccount(row: CG01AccountView) {
    ++roleRead.current;
    ++historyRead.current;
    setEditor("detail");
    setTarget(row);
    setHistory(null);
    setPending(null);
    setActiveModal(null);
    setRoleRef(row.roleRef ?? "");
    setEditStatus(row.status);
    setNotice(null);
    requestKey.current = crypto.randomUUID();
    if (canAssign) void roleSearch("");
  }

  function openEdit(row: CG01AccountView) {
    if (row.roleProtected || (!canAssign && !canStatus)) return;
    ++roleRead.current;
    ++historyRead.current;
    setEditor("edit");
    setTarget(row);
    setHistory(null);
    setPending(null);
    setActiveModal(null);
    setRoleRef(row.roleRef ?? "");
    setEditStatus(row.status);
    setNotice(null);
    requestKey.current = crypto.randomUUID();
    if (canAssign) void roleSearch("");
  }

  function openAssignRoleModal(row: CG01AccountView) {
    if (row.roleProtected || !canAssign) return;
    setTarget(row);
    setRoleRef(row.roleRef ?? "");
    setActiveModal("assignRole");
    setNotice(null);
    requestKey.current = crypto.randomUUID();
    if (canAssign) void roleSearch("");
  }

  function openDeleteConfirmModal(row: CG01AccountView) {
    if (row.roleProtected || !canStatus) return;
    setTarget(row);
    setActiveModal("deleteConfirm");
    setNotice(null);
    requestKey.current = crypto.randomUUID();
  }

  async function loadAccountHistory(accountRef: string) {
    if (!actions.includes("access.audit.view")) return;
    const request = ++historyRead.current;
    try {
      const result = await read<{
        events: {
          eventRef: string;
          occurredAt: string;
          actionLabel: string;
          outcome: string;
          actorDisplay: string;
        }[];
      }>("audit?limit=30&targetRef=" + encodeURIComponent(accountRef));
      if (request !== historyRead.current) return;
      if (!Array.isArray(result.events)) throw new Error("Invalid history response");
      setHistory(result.events);
    } catch (error) {
      if (request !== historyRead.current) return;
      setHistory(null);
      if (error instanceof Error && /session expired|permission denied/i.test(error.message)) {
        purge(error.message);
      } else {
        setNotice({ kind: "error", text: "Access history could not be verified." });
      }
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || busy || uncertain || !roleRef) return;
    setBusy(true);
    setNotice(null);
    try {
      await change("accounts", "POST", {
        displayName: fullName.trim(),
        email: email.trim().toLowerCase() || undefined,
        mobile: phone.trim(),
        password: newPassword,
        roleRef,
        requestKey: requestKey.current
      });
      setEditor(null);
      setNewPassword("");
      setNotice({ kind: "success", text: "Staff account created and active." });
      requestKey.current = "";
      await load(applied, 0, filter);
    } catch (e) {
      if (e instanceof Error && e.message === "UNKNOWN") setUncertain(true);
      if (e instanceof Error && /session expired|permission denied/i.test(e.message)) purge(e.message);
      else {
        setNotice({
          kind: e instanceof Error && e.message === "UNKNOWN" ? "uncertain" : "error",
          text:
            e instanceof Error && e.message === "UNKNOWN"
              ? "Account creation is unconfirmed. Refresh before another attempt."
              : e instanceof Error
              ? e.message
              : "Staff account creation could not be confirmed."
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function executeChange(pendingAction: PendingAction, newRoleRef?: string) {
    if (busy || uncertain) return;
    setBusy(true);
    setNotice(null);
    const key = requestKey.current || crypto.randomUUID();
    requestKey.current = key;
    try {
      const path = "accounts/" + pendingAction.target.accountRef;
      if (pendingAction.kind === "assign") {
        const refToUse = newRoleRef || roleRef;
        if (!refToUse) return;
        await change(path + "/role", "PUT", {
          roleRef: refToUse,
          expectedRevision: pendingAction.target.revision,
          requestKey: key
        });
      } else if (pendingAction.kind === "revoke") {
        await change(path + "/role", "DELETE", {
          expectedRevision: pendingAction.target.revision,
          requestKey: key
        });
      } else if (pendingAction.status) {
        await change(path + "/status", "PATCH", {
          status: pendingAction.status,
          expectedRevision: pendingAction.target.revision,
          requestKey: key
        });
      }
      setPending(null);
      setEditor(null);
      setActiveModal(null);
      setNotice({ kind: "success", text: "Account change confirmed." });
      requestKey.current = "";
      await load(applied, offset, filter);
    } catch (e) {
      if (e instanceof Error && e.message === "UNKNOWN") setUncertain(true);
      if (e instanceof Error && /session expired|permission denied/i.test(e.message)) purge(e.message);
      else {
        setNotice({
          kind: e instanceof Error && e.message === "UNKNOWN" ? "uncertain" : "error",
          text:
            e instanceof Error && e.message === "UNKNOWN"
              ? "Could not confirm the result. Refresh before retrying."
              : e instanceof Error
              ? e.message
              : "Account change could not be confirmed."
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const handleStatusChangeRequest = (
    account: CG01AccountView,
    status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED"
  ) => {
    if (account.roleProtected || !canStatus) return;
    const action: PendingAction = { kind: "status", target: account, status };
    setPending(action);
    void executeChange(action);
  };

  const handleAssignRoleConfirm = () => {
    if (!target || !roleRef || !canAssign || target.roleProtected) return;
    const action: PendingAction = { kind: "assign", target };
    setPending(action);
    void executeChange(action, roleRef);
  };

  const handleDeleteConfirm = () => {
    if (!target || !canStatus || target.roleProtected) return;
    const action: PendingAction = { kind: "status", target, status: "DEACTIVATED" };
    setPending(action);
    void executeChange(action);
  };

  const handleEditProfileSave = () => {
    if (!target || target.roleProtected) return;
    if (roleRef && roleRef !== target.roleRef) {
      if (!canAssign) return;
      const action: PendingAction = { kind: "assign", target };
      setPending(action);
      void executeChange(action, roleRef);
    } else if (editStatus && editStatus !== target.status) {
      if (!canStatus) return;
      const action: PendingAction = { kind: "status", target, status: editStatus };
      setPending(action);
      void executeChange(action);
    } else {
      setEditor(null);
    }
  };

  const handleExportCSV = () => {
    if (!list || !list.accounts.length) return;
    const headers = ["Employee ID", "Full Name", "Email", "Phone", "Role", "Status", "Joining Date"];
    const rows = list.accounts.map(a => [
      formatEmployeeId(a),
      `"${a.displayName.replace(/"/g, '""')}"`,
      `"${a.email || ""}"`,
      `"${a.phone || ""}"`,
      `"${a.roleName || "Volunteer"}"`,
      accountStatusLabel(a.status),
      formatDisplayDate(a.assignedAt)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CareGanga_Staff_Accounts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="cg-um-workspace">
      {/* Page Title & Subtitle Header */}
      <UsersManagementHeader />

      {/* Notice Banner */}
      {notice && (
        <div
          role={notice.kind === "success" ? "status" : "alert"}
          className={`cg-um-notice-box ${notice.kind}`}
        >
          {notice.text}
        </div>
      )}

      {uncertain && (
        <div className="cg-um-notice-box uncertain" role="alert">
          <span>The last action status is unconfirmed. Refresh account status before trying again.</span>
          <button
            type="button"
            className="cg-um-btn cg-um-btn-outline cg-um-btn-sm"
            style={{ marginLeft: "0.75rem" }}
            onClick={() => {
              setUncertain(false);
              setPending(null);
              setEditor(null);
              setActiveModal(null);
              void load(applied, offset, filter);
            }}
          >
            Refresh Status
          </button>
        </div>
      )}

      {createOnly && (
        <div className="cg-um-notice-box success" role="status">
          <span>Create an eligible Foundation staff member without access to the private staff directory.</span>
        </div>
      )}

      {!createOnly && (
        <>
          {/* Section 1.B: Advanced Digital Search Panel */}
          <AdvancedSearchPanel
            loading={loading}
            roles={roles}
            onSearch={(kw, st) => void load(kw, 0, st)}
            onClear={() => void load("", 0, "all")}
            onExport={handleExportCSV}
            initialQuery={applied}
            initialStatus={filter}
          />

          {/* Section 1.C: Employee Statistics Cards (Row of 6) */}
          <EmployeeStatsCards
            summary={list?.summary}
            loading={loading}
          />

          {/* Section 1.D & 2: Employee List (Table View or Card View) */}
          {viewMode === "table" ? (
            <EmployeeTableView
              accounts={list?.accounts ?? []}
              total={list?.total ?? 0}
              offset={offset}
              limit={limit}
              loading={loading}
              actions={actions}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              density={density}
              onDensityChange={setDensity}
              onPageChange={newOffset => void load(applied, newOffset, filter)}
              onRefresh={() => void load(applied, offset, filter)}
              onAddStaff={openCreate}
              onViewDetails={openAccount}
              onEditAccount={openEdit}
              onAssignRole={openAssignRoleModal}
              onStatusChange={handleStatusChangeRequest}
              onDeleteAccount={openDeleteConfirmModal}
            />
          ) : (
            <EmployeeCardView
              accounts={list?.accounts ?? []}
              total={list?.total ?? 0}
              offset={offset}
              limit={limit}
              loading={loading}
              actions={actions}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              density={density}
              onDensityChange={setDensity}
              onPageChange={newOffset => void load(applied, newOffset, filter)}
              onRefresh={() => void load(applied, offset, filter)}
              onAddStaff={openCreate}
              onViewDetails={openAccount}
              onEditAccount={openEdit}
              onAssignRole={openAssignRoleModal}
              onStatusChange={handleStatusChangeRequest}
              onDeleteAccount={openDeleteConfirmModal}
            />
          )}
        </>
      )}

      {/* Section 3: Add New Staff Account Drawer */}
      <AddStaffDrawer
        isOpen={editor === "create"}
        onClose={() => setEditor(null)}
        roles={roles}
        rolesLoading={rolesLoading}
        searchRole={searchRole}
        onSearchRoleChange={setSearchRole}
        onSearchRoleSubmit={() => void roleSearch(searchRole)}
        fullName={fullName}
        onFullNameChange={setFullName}
        email={email}
        onEmailChange={setEmail}
        phone={phone}
        onPhoneChange={setPhone}
        newPassword={newPassword}
        onNewPasswordChange={setNewPassword}
        roleRef={roleRef}
        onRoleRefChange={setRoleRef}
        busy={busy}
        uncertain={uncertain}
        notice={notice}
        onSubmit={submitCreate}
      />

      {/* Section 4: User Details (Full Profile View) Drawer */}
      <UserDetailsDrawer
        isOpen={editor === "detail"}
        onClose={() => setEditor(null)}
        account={target}
        actions={actions}
        history={history}
        onLoadHistory={loadAccountHistory}
        onEditProfile={openEdit}
        onAssignRole={openAssignRoleModal}
        onStatusChange={handleStatusChangeRequest}
        onDeleteAccount={openDeleteConfirmModal}
        busy={busy}
      />

      {/* Section 6 (Prompt): Edit Account Profile Drawer */}
      <EditProfileDrawer
        isOpen={editor === "edit"}
        onClose={() => setEditor(null)}
        account={target}
        roles={roles}
        rolesLoading={rolesLoading}
        roleRef={roleRef}
        onRoleRefChange={setRoleRef}
        status={editStatus}
        onStatusChange={setEditStatus}
        busy={busy}
        uncertain={uncertain}
        notice={notice}
        onSave={handleEditProfileSave}
        canAssign={canAssign}
        canStatus={canStatus}
      />

      {/* Section 5: Assign Role Modal */}
      <AssignRoleModal
        isOpen={activeModal === "assignRole"}
        onClose={() => setActiveModal(null)}
        account={target}
        roles={roles}
        rolesLoading={rolesLoading}
        selectedRoleRef={roleRef}
        onSelectRoleRef={setRoleRef}
        busy={busy}
        uncertain={uncertain}
        notice={notice}
        onConfirm={handleAssignRoleConfirm}
      />

      {/* Section 6: Delete User Account Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={activeModal === "deleteConfirm"}
        onClose={() => setActiveModal(null)}
        account={target}
        busy={busy}
        uncertain={uncertain}
        notice={notice}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
