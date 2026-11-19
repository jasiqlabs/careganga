"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type {
  Role,
  Group,
  RoleSummary,
  RoleList,
  AuditEvent,
  FormMode,
  RoleStatus,
  RoleKind,
  Notice
} from "./roles-permissions/roles-permissions-types";
import { roleColorOptions } from "../../../../../packages/design-tokens/src/index";
import { RolesStatisticsCards } from "./roles-permissions/roles-statistics-cards";
import { RolesSearchFilterPanel } from "./roles-permissions/roles-search-filter-panel";
import { RolesListPanel } from "./roles-permissions/roles-list-panel";
import { PermissionManagerPanel } from "./roles-permissions/permission-manager-panel";
import { RoleDetailsPanel } from "./roles-permissions/role-details-panel";
import { CreateRoleDrawer } from "./roles-permissions/create-role-drawer";
import { RoleDetailsDrawer } from "./roles-permissions/role-details-drawer";
import { RetireRoleModal } from "./roles-permissions/retire-role-modal";
import { AccessHistoryView } from "./roles-permissions/access-history-view";
import {
  RolesStatisticsCardsSkeleton,
  RolesSearchFilterPanelSkeleton,
  RolesListPanelSkeleton,
  PermissionManagerPanelSkeleton,
  RoleDetailsPanelSkeleton
} from "./roles-permissions/roles-permissions-skeletons";

async function read<T>(path: string): Promise<T> {
  const response = await fetch("/api/access/" + path, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Your session expired. Sign in again."
        : response.status === 403
        ? "You don't have permission to view this information."
        : "The information is unavailable. Try refreshing."
    );
  }
  return response.json() as Promise<T>;
}

export function RolesPanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleRef, setSelectedRoleRef] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [tab, setTab] = useState<RoleStatus>("all");
  const [roleKind, setRoleKind] = useState<RoleKind>("all");
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RoleSummary | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<{ mode: FormMode; source?: Role } | null>(null);
  const [pendingRetire, setPendingRetire] = useState<Role | null>(null);
  const [details, setDetails] = useState<Role | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [copySearch, setCopySearch] = useState("");
  const [copyCandidates, setCopyCandidates] = useState<Role[]>([]);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colorKey, setColorKey] = useState("blue");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<AuditEvent[] | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);

  const searchInput = useRef<HTMLInputElement>(null);
  const requestKey = useRef("");
  const latestRead = useRef(0);
  const copyRead = useRef(0);
  const auditRead = useRef(0);
  const lastResumeCheck = useRef(0);

  const purgeProtected = useCallback((message: string) => {
    ++latestRead.current;
    ++copyRead.current;
    ++auditRead.current;
    setRoles([]);
    setGroups([]);
    setActions([]);
    setCopyCandidates([]);
    setSummary(null);
    setSelectedRoleRef(null);
    setHistory(null);
    setHistoryCursor(null);
    setEditor(null);
    setPendingRetire(null);
    setDetails(null);
    setLoading(false);
    setCopyLoading(false);
    setNotice({ kind: "error", text: message });
  }, []);

  const load = useCallback(
    async (searchText: string, skip: number, status: RoleStatus = "all", kind: RoleKind = "all") => {
      const generation = ++latestRead.current;
      setLoading(true);
      setNotice(null);
      setDetails(null);
      try {
        const params = new URLSearchParams({
          search: searchText,
          limit: "30",
          offset: String(skip),
          status,
          type: kind
        });
        const [list, catalog, effective] = await Promise.all([
          read<RoleList>("roles?" + params),
          read<{ groups: Group[] }>("capabilities"),
          read<{ actions: { key: string }[] }>("effective")
        ]);
        if (generation !== latestRead.current) return;
        setRoles(list.roles);
        setGroups(catalog.groups);
        setSelectedRoleRef((previous) =>
          list.roles.some((r) => r.roleRef === previous) ? previous : list.roles[0]?.roleRef ?? null
        );
        setActions(effective.actions.map((x) => x.key));
        setTotal(list.total);
        setSummary(list.summary);
        setOffset(skip);
      } catch (e) {
        if (generation !== latestRead.current) return;
        purgeProtected(e instanceof Error ? e.message : "Information unavailable.");
      } finally {
        if (generation === latestRead.current) setLoading(false);
      }
    },
    [purgeProtected]
  );

  useEffect(() => {
    void load("", 0);
  }, [load]);

  // Focus revalidation
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastResumeCheck.current < 1200) return;
      lastResumeCheck.current = now;
      void load(appliedSearch, offset, tab, roleKind);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load, appliedSearch, offset, tab, roleKind]);

  // Ctrl+K keyboard shortcut
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  async function findCopySources(searchText: string) {
    const identityGeneration = latestRead.current;
    const request = ++copyRead.current;
    setCopyLoading(true);
    setCopyError("");
    try {
      const params = new URLSearchParams({ search: searchText, status: "active", limit: "50", offset: "0" });
      const response = await read<RoleList>("roles?" + params.toString());
      if (identityGeneration !== latestRead.current || request !== copyRead.current) return;
      setCopyCandidates(response.roles.filter((r) => r.active && !r.protected));
    } catch (error) {
      if (identityGeneration !== latestRead.current || request !== copyRead.current) return;
      if (error instanceof Error && /session expired|permission/i.test(error.message)) {
        purgeProtected(error.message);
      } else {
        setCopyCandidates([]);
        setCopyError("Eligible roles could not be loaded. Try searching again.");
      }
    } finally {
      if (request === copyRead.current) setCopyLoading(false);
    }
  }

  function selectCopySource(roleRef: string) {
    if (!editor || saving) return;
    const source = copyCandidates.find((r) => r.roleRef === roleRef) ||
      (editor.source?.roleRef === roleRef ? editor.source : undefined);
    if (!roleRef) {
      setEditor({ mode: "create" });
      setSelected([]);
      return;
    }
    if (!source || source.protected || !source.active) return;
    setEditor({ mode: "copy", source });
    const eligible = new Set(
      groups.flatMap((g) => g.actions.filter((c) => c.assignable || c.key === "roles.manage").map((c) => c.key))
    );
    setSelected(source.actionKeys.filter((key) => eligible.has(key)));
  }

  function open(mode: FormMode, source?: Role) {
    if (!actions.includes("roles.manage")) return;
    if (source?.protected) return;
    setEditor({ mode, source });
    if (mode !== "edit") {
      setCopySearch("");
      void findCopySources("");
    }
    setName(mode === "copy" ? (source ? source.name + " copy" : "") : source?.name ?? "");
    setDescription(source?.description ?? "");
    setColorKey(source?.colorKey && roleColorOptions.some((x) => x.key === source.colorKey) ? source.colorKey : "blue");
    const allowed = new Set(
      groups.flatMap((x) => x.actions.filter((a) => a.assignable || a.key === "roles.manage").map((a) => a.key))
    );
    setSelected(source?.actionKeys.filter((k) => allowed.has(k)) ?? []);
    requestKey.current = crypto.randomUUID();
    setNotice(null);
  }

  const canManage = actions.includes("roles.manage");
  const canAudit = actions.includes("access.audit.view");
  const selectedRole = roles.find((role) => role.roleRef === selectedRoleRef) ?? null;

  async function mutate(path: string, method: "POST" | "PATCH", body: unknown) {
    let result: Response;
    try {
      result = await fetch("/api/access/" + path, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body)
      });
    } catch {
      throw new Error("UNCERTAIN");
    }
    if (!result.ok) {
      if (result.status === 503) throw new Error("UNCERTAIN");
      if (result.status === 409) {
        const data = (await result.json()) as { code?: string };
        const message: Record<string, string> = {
          DUPLICATE_ROLE: "A role with this name already exists. Choose another name.",
          STALE_ROLE: "This role changed elsewhere. Refresh before saving.",
          ROLE_RETIRED: "This role was already retired.",
          ROLE_ASSIGNED: "Reassign assigned accounts before retiring this role.",
          REPLAY_CONFLICT: "This request reference was already used. Refresh before retrying."
        };
        throw new Error(
          data.code && message[data.code]
            ? message[data.code]
            : "This role changed elsewhere. Refresh before retrying."
        );
      }
      if (result.status === 403) throw new Error("You don't have permission for this action.");
      if (result.status === 401) throw new Error("Your session expired. Sign in again.");
      throw new Error("Check your changes and try again.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    setNotice(null);
    const source = editor.source;
    const payload = {
      name: name.trim(),
      description: description.trim(),
      colorKey,
      actionKeys: selected,
      requestKey: requestKey.current,
      ...(editor.mode !== "create" && source ? { expectedRevision: source.revision } : {})
    };
    const path =
      editor.mode === "edit" && source
        ? "roles/" + source.roleRef
        : editor.mode === "copy" && source
        ? "roles/" + source.roleRef + "/copy"
        : "roles";
    const method = editor.mode === "edit" ? "PATCH" : "POST";
    try {
      await mutate(path, method, payload);
      setEditor(null);
      requestKey.current = "";
      await load(appliedSearch, offset, tab, roleKind);
      setNotice({ kind: "success", text: "Role change saved." });
    } catch (error) {
      if (error instanceof Error && /session expired|permission/i.test(error.message)) {
        purgeProtected(error.message);
      } else if (error instanceof Error && error.message === "UNCERTAIN") {
        setNotice({
          kind: "uncertain",
          text: "The result could not be confirmed. Refresh the list before submitting another change."
        });
      } else if (!(error instanceof Error && /session expired|permission/i.test(error.message))) {
        setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to save the role." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRolePermissions(role: Role, newActionKeys: string[]) {
    if (!canManage || role.protected) return;
    setSaving(true);
    setNotice(null);
    const payload = {
      name: role.name,
      description: role.description,
      colorKey: role.colorKey,
      actionKeys: newActionKeys,
      requestKey: crypto.randomUUID(),
      expectedRevision: role.revision
    };
    try {
      await mutate("roles/" + role.roleRef, "PATCH", payload);
      await load(appliedSearch, offset, tab, roleKind);
      setNotice({ kind: "success", text: `Permissions updated successfully for "${role.name}".` });
    } catch (error) {
      if (error instanceof Error && /session expired|permission/i.test(error.message)) {
        purgeProtected(error.message);
      } else if (error instanceof Error && error.message === "UNCERTAIN") {
        setNotice({
          kind: "uncertain",
          text: "The result could not be confirmed. Refresh the list before submitting another change."
        });
      } else {
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "Unable to update role permissions."
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function retire(role: Role) {
    if (!canManage || role.protected || role.assignedCount > 0 || !role.active) return;
    setSaving(true);
    setNotice(null);
    try {
      await mutate("roles/" + role.roleRef + "/retire", "POST", {
        expectedRevision: role.revision,
        requestKey: crypto.randomUUID()
      });
      await load(appliedSearch, offset, tab, roleKind);
      setPendingRetire(null);
      setNotice({ kind: "success", text: "Role retired." });
    } catch (error) {
      if (error instanceof Error && /session expired|permission/i.test(error.message)) {
        purgeProtected(error.message);
      } else {
        setNotice({
          kind: "error",
          text:
            error instanceof Error && error.message === "UNCERTAIN"
              ? "Could not confirm retirement. Refresh the list before retrying."
              : error instanceof Error
              ? error.message
              : "Role could not be retired."
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function audit() {
    const identityGeneration = latestRead.current;
    const request = ++auditRead.current;
    setHistory(null);
    setNotice(null);
    try {
      const result = await read<{ events: AuditEvent[]; nextCursor: string | null }>("audit?limit=30");
      if (identityGeneration !== latestRead.current || request !== auditRead.current) return;
      setHistory(result.events);
      setHistoryCursor(result.nextCursor);
    } catch (error) {
      if (identityGeneration !== latestRead.current || request !== auditRead.current) return;
      if (error instanceof Error && /session expired|permission/i.test(error.message)) {
        purgeProtected(error.message);
      } else {
        setNotice({ kind: "error", text: error instanceof Error ? error.message : "History unavailable." });
      }
    }
  }

  async function moreHistory() {
    if (!historyCursor) return;
    const identityGeneration = latestRead.current;
    const request = ++auditRead.current;
    try {
      const result = await read<{ events: AuditEvent[]; nextCursor: string | null }>(
        "audit?limit=30&cursor=" + encodeURIComponent(historyCursor)
      );
      if (identityGeneration !== latestRead.current || request !== auditRead.current) return;
      setHistory((old) => [...(old ?? []), ...result.events]);
      setHistoryCursor(result.nextCursor);
    } catch (error) {
      if (identityGeneration !== latestRead.current || request !== auditRead.current) return;
      if (error instanceof Error && /session expired|permission/i.test(error.message)) {
        purgeProtected(error.message);
      } else {
        setNotice({ kind: "error", text: "More security history could not be confirmed." });
      }
    }
  }

  const handleExportRoles = () => {
    if (!roles.length) return;
    const headers = ["Role Name", "Type", "Status", "Assigned Accounts", "Allowed Actions Count", "Description"];
    const rows = roles.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.protected ? "System" : "Custom"}"`,
      `"${r.active ? "Active" : "Retired"}"`,
      r.assignedCount,
      r.actionKeys.length,
      `"${(r.description || "").replace(/"/g, '""')}"`
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `careganga-roles-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="cg-rp-workspace">
      {/* Background refresh progress bar */}
      {loading && roles.length > 0 && <div className="cg-rp-refresh-bar" />}

      {/* Notice Banner */}
      {notice && (
        <div className={`cg-rp-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          <span>{notice.text}</span>
        </div>
      )}

      {/* Initial Cold Loading Skeleton */}
      {loading && roles.length === 0 ? (
        <>
          <RolesStatisticsCardsSkeleton />
          <RolesSearchFilterPanelSkeleton />
          <div className="cg-rp-three-col-layout">
            <RolesListPanelSkeleton />
            <PermissionManagerPanelSkeleton />
            <div className="cg-rp-panel-detail-wrapper">
              <RoleDetailsPanelSkeleton />
            </div>
          </div>
        </>
      ) : history !== null ? (
        /* Access History Screen View (Reference 2) */
        <AccessHistoryView
          history={history}
          historyCursor={historyCursor}
          onMoreHistory={moreHistory}
          onBackToDashboard={() => setHistory(null)}
        />
      ) : (
        /* Main Roles & Permissions Dashboard (Reference 1) */
        <>
          {/* SECTION A — ROLE STATISTICS (6 Cards) */}
          <RolesStatisticsCards summary={summary} loading={loading} />

          {/* SECTION B — SEARCH & FILTER PANEL */}
          <RolesSearchFilterPanel
            search={search}
            setSearch={setSearch}
            searchInputRef={searchInput}
            roleKind={roleKind}
            setRoleKind={(kind) => {
              setRoleKind(kind);
              void load(appliedSearch, 0, tab, kind);
            }}
            tab={tab}
            setTab={(newTab) => {
              setTab(newTab);
              void load(appliedSearch, 0, newTab, roleKind);
            }}
            loading={loading}
            canManage={canManage}
            canAudit={canAudit}
            onSearchSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(search);
              void load(search, 0, tab, roleKind);
            }}
            onClearAll={() => {
              setSearch("");
              setAppliedSearch("");
              setTab("all");
              setRoleKind("all");
              void load("", 0, "all", "all");
            }}
            onCreateRole={() => open("create")}
            onViewHistory={() => void audit()}
            onExport={handleExportRoles}
          />

          {/* SECTION C — THREE-COLUMN MAIN WORKSPACE */}
          <div className="cg-rp-three-col-layout">
            {/* C1. LEFT PANEL — ROLES LIST */}
            <RolesListPanel
              roles={roles}
              total={total}
              offset={offset}
              selectedRoleRef={selectedRoleRef}
              onSelectRole={(ref) => setSelectedRoleRef(ref)}
              onPageChange={(newOffset) => void load(appliedSearch, newOffset, tab, roleKind)}
              loading={loading}
            />

            {/* C2. CENTER PANEL — PERMISSION MANAGER */}
            <PermissionManagerPanel
              roles={roles}
              selectedRole={selectedRole}
              groups={groups}
              canManage={canManage}
              onSelectRole={(ref) => setSelectedRoleRef(ref)}
              onSaveRolePermissions={handleSaveRolePermissions}
              saving={saving}
            />

            {/* C3. RIGHT PANEL — ROLE DETAILS */}
            <div className="cg-rp-panel-detail-wrapper">
              <RoleDetailsPanel
                selectedRole={selectedRole}
                canManage={canManage}
                canAudit={canAudit}
                saving={saving}
                onViewDetails={(role) => setDetails(role)}
                onEditRole={(role) => open("edit", role)}
                onCopyRole={(role) => open("copy", role)}
                onRetireRole={(role) => setPendingRetire(role)}
                onViewActivity={() => void audit()}
              />
            </div>
          </div>
        </>
      )}

      {/* PHASE 2 — CREATE / EDIT / COPY ROLE DRAWER */}
      <AnimatePresence>
        {editor && (
          <CreateRoleDrawer
            editor={editor}
            groups={groups}
            copyCandidates={copyCandidates}
            copyLoading={copyLoading}
            copyError={copyError}
            saving={saving}
            onClose={() => setEditor(null)}
            onSave={save}
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            colorKey={colorKey}
            setColorKey={setColorKey}
            selected={selected}
            setSelected={setSelected}
            onFindCopySources={(s) => void findCopySources(s)}
            onSelectCopySource={selectCopySource}
          />
        )}
      </AnimatePresence>

      {/* Role Details Drawer */}
      <AnimatePresence>
        {details && (
          <RoleDetailsDrawer
            details={details}
            groups={groups}
            onClose={() => setDetails(null)}
          />
        )}
      </AnimatePresence>

      {/* Retire Role Confirmation Modal */}
      <AnimatePresence>
        {pendingRetire && (
          <RetireRoleModal
            role={pendingRetire}
            saving={saving}
            onCancel={() => setPendingRetire(null)}
            onConfirm={() => void retire(pendingRetire)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
