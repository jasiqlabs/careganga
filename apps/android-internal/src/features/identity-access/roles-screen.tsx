import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Modal,
  Alert
} from "react-native";
import * as Crypto from "expo-crypto";
import type { CG01SessionView } from "@careganga/api-contracts";
import { identityRequest } from "./http-client";
import { AuthenticatedScreenHeader } from "../dashboard/authenticated-screen-header";
import {
  AuthenticatedBottomNavigation,
  type RolesNavTab
} from "../dashboard/authenticated-bottom-navigation";
import type { ModuleActionHandlers } from "../dashboard/dashboard-modules";
import { NavigationDrawer } from "../dashboard/navigation-drawer";
import { getAuthorizedModules } from "../dashboard/dashboard-modules";

import { ScreenOverviewDashboard } from "./roles-permissions/screen-overview-dashboard";
import { ScreenRolesList } from "./roles-permissions/screen-roles-list";
import { ScreenPermissionMatrix } from "./roles-permissions/screen-permission-matrix";
import { ScreenModulePermissions } from "./roles-permissions/screen-module-permissions";
import { ScreenSetPermission } from "./roles-permissions/screen-set-permission";
import { ScreenRoleDetails } from "./roles-permissions/screen-role-details";
import { ScreenCreateRoleWizard } from "./roles-permissions/screen-create-role-wizard";
import { ScreenAccessHistory } from "./roles-permissions/screen-access-history";

import type {
  Role,
  Group,
  RoleSummary,
  AuditEvent,
  RoleStatus,
  RoleKind,
  FormMode,
  PermissionManagerTab
} from "./roles-permissions/roles-permissions-types";

const base = "/api/access/";
const EMPTY_ACTIONS: string[] = [];

async function call(
  token: string,
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: object
): Promise<unknown> {
  let result: Response;
  try {
    result = await identityRequest(base + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    // Lost response after a mutation may conceal a successful commit.
    throw new Error(method === "GET" ? "UNAVAILABLE" : "UNKNOWN");
  }
  if (result.status === 401) throw new Error("SESSION_EXPIRED");
  if (result.status === 403) throw new Error("PERMISSION_DENIED");
  if (result.status === 409) {
    const payload: unknown = await result.json();
    const code =
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      typeof payload.code === "string"
        ? payload.code
        : "CONFLICT";
    throw new Error(
      [
        "DUPLICATE_ROLE",
        "STALE_ROLE",
        "ROLE_RETIRED",
        "ROLE_ASSIGNED",
        "REPLAY_CONFLICT"
      ].includes(code)
        ? code
        : "CONFLICT"
    );
  }
  if (!result.ok) throw new Error(result.status >= 500 ? "UNKNOWN" : "INVALID");
  try {
    return (await result.json()) as unknown;
  } catch {
    // A successful HTTP response with a truncated body is not confirmation of the write.
    throw new Error(method === "GET" ? "UNAVAILABLE" : "UNKNOWN");
  }
}

export interface RolesScreenProps {
  token: string;
  actor?: CG01SessionView | null;
  roleActions?: string[];
  handlers?: ModuleActionHandlers;
  onSignOut?: () => void;
  onExit: () => void;
  onExpired: () => void;
}

/**
 * CareGanga Foundation Internal Android — Roles & Permissions Module
 * Complete 10-screen UI redesign matching the wireframe target pixel-for-pixel:
 * 1. Overview Dashboard
 * 2. Roles List
 * 3. Permission Matrix (Mobile)
 * 4. Module Permissions (Mobile)
 * 5. Set Permission (Mobile)
 * 6. Role Details
 * 7. Create Role — Step 1 (Basic Info)
 * 8. Create Role — Step 5 (Permission Assignment)
 * 9. Create Role — Step 6 (Permission Summary)
 * 10. Access History (Mobile)
 *
 * Reusable components: AuthenticatedScreenHeader and AuthenticatedBottomNavigation
 * Full RBAC, authentication, API contracts, security checks, and data integrity strictly preserved.
 */
export function RolesScreen({
  token,
  actor,
  roleActions = [],
  handlers,
  onSignOut,
  onExit,
  onExpired
}: RolesScreenProps) {
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<RolesNavTab>("overview");
  const [permissionTab, setPermissionTab] = useState<PermissionManagerTab>("matrix");

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Data states
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [detailsRole, setDetailsRole] = useState<Role | null>(null);
  const [status, setStatus] = useState<RoleStatus>("all");
  const [roleKind, setRoleKind] = useState<RoleKind>("all");
  const [groups, setGroups] = useState<Group[]>([]);
  const [allowed, setAllowed] = useState<string[]>(roleActions);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RoleSummary | null>(null);

  // Create / Edit wizard modal state
  const [editor, setEditor] = useState<{ mode: FormMode; source?: Role } | null>(null);
  const [copyCandidates, setCopyCandidates] = useState<Role[]>([]);
  const [copySearching, setCopySearching] = useState(false);

  // Access history state
  const [history, setHistory] = useState<AuditEvent[] | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Effective permissions
  const canEdit = allowed.includes("roles.manage");
  const canAudit = allowed.includes("access.audit.view");
  const canViewRoles = allowed.includes("roles.view") || allowed.length === 0;
  const canViewNotifications = allowed.includes("communications.notifications.view");

  // Load roles & capabilities from real backend
  const load = useCallback(
    async (
      q = "",
      skip = 0,
      filter: RoleStatus = "all",
      kind: RoleKind = "all"
    ) => {
      setBusy(true);
      setError("");
      try {
        const query = new URLSearchParams({
          search: q,
          limit: "30",
          offset: String(skip),
          status: filter,
          type: kind
        });
        const [list, cap, effective] = await Promise.all([
          call(token, "roles?" + query),
          call(token, "capabilities"),
          call(token, "effective")
        ]);
        const a = list as { roles: Role[]; total: number; summary: RoleSummary };
        const c = cap as { groups: Group[] };
        const eff = effective as { actions: { key: string }[] };

        if (!Array.isArray(a.roles) || !Array.isArray(c.groups) || !Array.isArray(eff.actions)) {
          throw new Error("INVALID");
        }

        setRoles(a.roles);
        setGroups(c.groups);
        setAllowed(eff.actions.map(x => x.key));
        setOffset(skip);
        setTotal(a.total);
        setSummary(a.summary);

        // Keep selected role synced if exists
        setSelectedRole(prev =>
          a.roles.find(r => r.roleRef === prev?.roleRef) ?? a.roles[0] ?? null
        );
      } catch (e) {
        setRoles([]);
        setGroups([]);
        setAllowed([]);
        setHistory(null);
        setHistoryCursor(null);
        setSummary(null);
        setEditor(null);
        setDetailsRole(null);

        if (e instanceof Error && e.message === "SESSION_EXPIRED") {
          onExpired();
          return;
        }
        setError(
          e instanceof Error && e.message === "PERMISSION_DENIED"
            ? "You don't have access to Foundation roles."
            : "Roles cannot be verified right now."
        );
      } finally {
        setBusy(false);
      }
    },
    [token, onExpired]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Hardware Back Handler
  useEffect(() => {
    const onBackPress = () => {
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return true;
      }
      if (editor && !saving) {
        setEditor(null);
        return true;
      }
      if (detailsRole) {
        setDetailsRole(null);
        return true;
      }
      if (historyOpen) {
        setHistoryOpen(false);
        return true;
      }
      if (activeTab !== "overview") {
        setActiveTab("overview");
        return true;
      }
      onExit();
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [isDrawerOpen, editor, saving, detailsRole, historyOpen, activeTab, onExit]);

  // Search candidate roles to copy permissions from
  const findCopySources = async (query: string) => {
    setCopySearching(true);
    setError("");
    try {
      const params = new URLSearchParams({
        search: query.trim(),
        status: "active",
        limit: "30",
        offset: "0"
      });
      const result = (await call(token, "roles?" + params.toString())) as {
        roles: Role[];
      };
      if (!Array.isArray(result.roles)) throw new Error("INVALID");
      setCopyCandidates(result.roles.filter(role => role.active && !role.protected));
    } catch (e) {
      setCopyCandidates([]);
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onExpired();
        return;
      }
      if (e instanceof Error && e.message === "PERMISSION_DENIED") {
        setRoles([]);
        setGroups([]);
        setAllowed([]);
        setEditor(null);
      }
      setError("Eligible roles could not be searched. Return to roles and retry.");
    } finally {
      setCopySearching(false);
    }
  };

  // Open Create/Edit/Copy Wizard
  const openEditor = (mode: FormMode, source?: Role) => {
    if (!canEdit || source?.protected) return;
    setEditor({ mode, source });
    setError("");
    if (mode !== "edit") {
      void findCopySources("");
    }
  };

  // Submit Create/Edit/Copy Role
  const handleWizardSubmit = async (data: {
    name: string;
    description: string;
    colorKey: string;
    actionKeys: string[];
  }) => {
    if (!editor || saving || data.name.trim().length < 2) return;
    setSaving(true);
    setError("");

    const source = editor.source;
    const url =
      editor.mode === "create"
        ? "roles"
        : editor.mode === "copy" && source
        ? "roles/" + source.roleRef + "/copy"
        : "roles/" + source?.roleRef;
    const method = editor.mode === "edit" ? "PATCH" : "POST";

    try {
      await call(token, url, method, {
        name: data.name.trim(),
        description: data.description.trim(),
        colorKey: data.colorKey,
        actionKeys: data.actionKeys,
        requestKey: Crypto.randomUUID(),
        ...(editor.mode !== "create" && source
          ? { expectedRevision: source.revision }
          : {})
      });
      setEditor(null);
      await load(search, offset, status, roleKind);
      Alert.alert("Success", "Role successfully saved.");
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onExpired();
        return;
      }
      if (e instanceof Error && e.message === "PERMISSION_DENIED") {
        setRoles([]);
        setGroups([]);
        setAllowed([]);
        setHistory(null);
        setEditor(null);
      }
      const msg =
        e instanceof Error && e.message === "DUPLICATE_ROLE"
          ? "A role with this name already exists. Choose another name."
          : e instanceof Error && e.message === "REPLAY_CONFLICT"
          ? "This request reference was already used. Refresh before retrying."
          : e instanceof Error &&
            ["STALE_ROLE", "ROLE_RETIRED", "CONFLICT"].includes(e.message)
          ? "This role changed elsewhere. Refresh before saving."
          : e instanceof Error && e.message === "PERMISSION_DENIED"
          ? "You don't have permission for this change."
          : "Check the role details and try again.";
      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  // Retire Role
  const handleRetireRole = async (role: Role) => {
    if (!canEdit || role.protected || !role.active || role.assignedCount > 0 || saving)
      return;
    setSaving(true);
    setError("");

    try {
      await call(token, "roles/" + role.roleRef + "/retire", "POST", {
        expectedRevision: role.revision,
        requestKey: Crypto.randomUUID()
      });
      setDetailsRole(null);
      await load(search, offset, status, roleKind);
      Alert.alert("Success", "Role successfully retired.");
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onExpired();
        return;
      }
      const msg =
        e instanceof Error && e.message === "ROLE_ASSIGNED"
          ? "Reassign accounts using this role before retiring it."
          : "Retirement could not be confirmed. Refresh roles before trying again.";
      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  // Toggle single action on a role (Permission Matrix / Module / Set)
  const handleToggleAction = async (role: Role, actionKey: string, grant: boolean) => {
    if (!canEdit || role.protected || saving) return;

    const newKeys = grant
      ? Array.from(new Set([...role.actionKeys, actionKey]))
      : role.actionKeys.filter(k => k !== actionKey);

    // Optimistically update
    const updatedRole: Role = { ...role, actionKeys: newKeys };
    setRoles(prev => prev.map(r => (r.roleRef === role.roleRef ? updatedRole : r)));
    if (selectedRole?.roleRef === role.roleRef) {
      setSelectedRole(updatedRole);
    }

    try {
      await call(token, "roles/" + role.roleRef, "PATCH", {
        name: role.name,
        description: role.description,
        colorKey: role.colorKey,
        actionKeys: newKeys,
        requestKey: Crypto.randomUUID(),
        expectedRevision: role.revision
      });
      await load(search, offset, status, roleKind);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onExpired();
        return;
      }
      Alert.alert("Error", "Permission change could not be saved. Refreshing…");
      await load(search, offset, status, roleKind);
    }
  };

  // Quick action apply (e.g. Grant view, Grant all, Revoke all)
  const handleQuickActionApply = async (role: Role, actionType: string) => {
    if (!canEdit || role.protected || saving) return;

    let targetKeys = [...role.actionKeys];
    const allAssignable = groups
      .flatMap(g => g.actions)
      .filter(a => a.assignable || a.key === "roles.manage")
      .map(a => a.key);

    if (actionType === "grant_view") {
      const viewKeys = allAssignable.filter(
        k => k.toLowerCase().includes("view") || k.toLowerCase().includes("read")
      );
      targetKeys = Array.from(new Set([...targetKeys, ...viewKeys]));
    } else if (actionType === "grant_all") {
      targetKeys = Array.from(new Set([...targetKeys, ...allAssignable]));
    } else if (actionType === "revoke_all") {
      targetKeys = [];
    }

    try {
      await call(token, "roles/" + role.roleRef, "PATCH", {
        name: role.name,
        description: role.description,
        colorKey: role.colorKey,
        actionKeys: targetKeys,
        requestKey: Crypto.randomUUID(),
        expectedRevision: role.revision
      });
      await load(search, offset, status, roleKind);
      Alert.alert("Success", "Quick action successfully applied.");
    } catch {
      Alert.alert("Error", "Quick action could not be completed.");
    }
  };

  // Load audit history
  const loadHistory = async () => {
    setBusy(true);
    setError("");
    try {
      const result = (await call(token, "audit?limit=30")) as {
        events: AuditEvent[];
        nextCursor: string | null;
      };
      if (!Array.isArray(result.events)) throw new Error("INVALID");
      setHistory(result.events);
      setHistoryCursor(result.nextCursor);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onExpired();
        return;
      }
      setError("Security history is unavailable.");
    } finally {
      setBusy(false);
    }
  };

  const moreHistory = async () => {
    if (!historyCursor || busy) return;
    setBusy(true);
    try {
      const data = (await call(
        token,
        "audit?limit=30&cursor=" + encodeURIComponent(historyCursor)
      )) as { events: AuditEvent[]; nextCursor: string | null };
      if (!Array.isArray(data.events)) throw new Error("INVALID");
      setHistory(old => [...(old ?? []), ...data.events]);
      setHistoryCursor(data.nextCursor);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onExpired();
        return;
      }
      setError("Additional history could not be confirmed.");
    } finally {
      setBusy(false);
    }
  };

  // Open Access History tab / modal
  const handleOpenHistoryTab = () => {
    if (!canAudit) return;
    setActiveTab("history");
    if (!history) {
      void loadHistory();
    }
  };

  // Drawer handlers
  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
  };

  const handleOpenNotifications = () => {
    if (canViewNotifications && handlers?.openNotifications) {
      handlers.openNotifications();
    }
  };

  const authorizedModules = useMemo(() => {
    if (actor && handlers) {
      return getAuthorizedModules(allowed, actor, handlers);
    }
    return [];
  }, [allowed, actor, handlers]);

  return (
    <View style={styles.screenRoot}>
      {/* ------------------------------------------------------------- */}
      {/* REUSABLE TOP SCREEN HEADER (Screens 1 to 5)                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab !== "history" && (
        <AuthenticatedScreenHeader
          variant="standard"
          hasNotifications={false}
          onOpenDrawer={handleOpenDrawer}
          onOpenNotifications={canViewNotifications ? handleOpenNotifications : undefined}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* SCREEN CONTENT BY ACTIVE TAB                                   */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.mainContent}>
        {/* Screen 1: Overview Dashboard */}
        {activeTab === "overview" && (
          <ScreenOverviewDashboard
            summary={summary}
            roles={roles}
            busy={busy}
            error={error}
            canEdit={canEdit}
            canAudit={canAudit}
            onCreateRole={() => openEditor("create")}
            onOpenHistory={handleOpenHistoryTab}
            onSelectRole={role => setDetailsRole(role)}
            onViewAllRoles={() => setActiveTab("roles")}
          />
        )}

        {/* Screen 2: Roles List */}
        {activeTab === "roles" && (
          <ScreenRolesList
            roles={roles}
            total={total}
            offset={offset}
            busy={busy}
            status={status}
            roleKind={roleKind}
            search={search}
            onSearchChange={q => {
              setSearch(q);
              void load(q, 0, status, roleKind);
            }}
            onStatusChange={s => {
              setStatus(s);
              void load(search, 0, s, roleKind);
            }}
            onRoleKindChange={k => {
              setRoleKind(k);
              void load(search, 0, status, k);
            }}
            onSelectRole={role => setDetailsRole(role)}
            onPageChange={newOffset => void load(search, newOffset, status, roleKind)}
          />
        )}

        {/* Screens 3, 4, 5: Permission Manager (Matrix / Module / Set) */}
        {activeTab === "permissions" && (
          <>
            {permissionTab === "matrix" && (
              <ScreenPermissionMatrix
                roles={roles}
                selectedRole={selectedRole}
                groups={groups}
                busy={busy}
                canEdit={canEdit}
                onSelectRole={setSelectedRole}
                onSelectTab={setPermissionTab}
                onToggleAction={handleToggleAction}
                onQuickActionApply={handleQuickActionApply}
              />
            )}

            {permissionTab === "module" && (
              <ScreenModulePermissions
                roles={roles}
                selectedRole={selectedRole}
                groups={groups}
                canEdit={canEdit}
                onSelectTab={setPermissionTab}
                onToggleAction={handleToggleAction}
              />
            )}

            {permissionTab === "set" && (
              <ScreenSetPermission
                roles={roles}
                selectedRole={selectedRole}
                groups={groups}
                canEdit={canEdit}
                onSelectRole={setSelectedRole}
                onSelectTab={setPermissionTab}
                onToggleAction={handleToggleAction}
              />
            )}
          </>
        )}

        {/* Screen 10: Access History (as Tab 4) */}
        {activeTab === "history" && canAudit && (
          <ScreenAccessHistory
            history={history}
            historyCursor={historyCursor}
            busy={busy}
            error={error}
            onClose={() => setActiveTab("overview")}
            onLoadMore={() => void moreHistory()}
          />
        )}
      </View>

      {/* ------------------------------------------------------------- */}
      {/* REUSABLE BOTTOM NAVIGATION BAR (Screens 1 to 5, 10)            */}
      {/* ------------------------------------------------------------- */}
      <AuthenticatedBottomNavigation
        activeTab={activeTab}
        onSelectTab={tab => {
          setActiveTab(tab);
          if (tab === "history" && !history) {
            void loadHistory();
          }
        }}
        canViewRoles={canViewRoles}
        canAudit={canAudit}
      />

      {/* ------------------------------------------------------------- */}
      {/* SCREEN 6: ROLE DETAILS MODAL                                  */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={Boolean(detailsRole)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setDetailsRole(null)}
      >
        {detailsRole && (
          <ScreenRoleDetails
            role={detailsRole}
            canEdit={canEdit}
            canAudit={canAudit}
            onClose={() => setDetailsRole(null)}
            onViewPermissions={role => {
              setSelectedRole(role);
              setDetailsRole(null);
              setActiveTab("permissions");
              setPermissionTab("matrix");
            }}
            onEditRole={role => {
              setDetailsRole(null);
              openEditor("edit", role);
            }}
            onCopyRole={role => {
              setDetailsRole(null);
              openEditor("copy", role);
            }}
            onRetireRole={handleRetireRole}
            onViewActivity={() => {
              setDetailsRole(null);
              handleOpenHistoryTab();
            }}
          />
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* SCREENS 7, 8, 9: CREATE / EDIT / COPY ROLE WIZARD MODAL       */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={Boolean(editor)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (!saving) setEditor(null);
        }}
      >
        {editor && (
          <ScreenCreateRoleWizard
            key={`editor-${editor.mode}-${editor.source?.roleRef ?? "new"}`}
            mode={editor.mode}
            sourceRole={editor.source}
            groups={groups}
            saving={saving}
            error={error}
            initialName={
              editor.mode === "copy"
                ? `${editor.source?.name ?? ""} copy`
                : editor.source?.name ?? ""
            }
            initialDescription={editor.source?.description ?? ""}
            initialColorKey={editor.source?.colorKey ?? "blue"}
            initialSelectedActions={editor.source?.actionKeys ?? EMPTY_ACTIONS}
            copyCandidates={copyCandidates}
            copySearching={copySearching}
            onSearchCopyCandidates={findCopySources}
            onChooseCopySource={source => {
              if (source) {
                setCopyCandidates(prev =>
                  prev.some(c => c.roleRef === source.roleRef)
                    ? prev
                    : [source, ...prev]
                );
              }
            }}
            onSubmit={handleWizardSubmit}
            onCancel={() => {
              if (!saving) setEditor(null);
            }}
          />
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* SCREEN 10: STANDALONE ACCESS HISTORY MODAL (IF TRIGGERED)     */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={historyOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setHistoryOpen(false)}
      >
        <ScreenAccessHistory
          history={history}
          historyCursor={historyCursor}
          busy={busy}
          error={error}
          onClose={() => setHistoryOpen(false)}
          onLoadMore={() => void moreHistory()}
        />
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* REUSABLE NAVIGATION DRAWER (HAMBURGER MENU)                   */}
      {/* ------------------------------------------------------------- */}
      {actor && (
        <NavigationDrawer
          visible={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          displayName={actor.displayName}
          roleName={actor.roleName}
          scope={actor.scope}
          authorizedModules={authorizedModules}
          activeKey="roles"
          onOpenDashboard={() => {
            setIsDrawerOpen(false);
            if (handlers?.openDashboard) {
              handlers.openDashboard();
            } else {
              onExit();
            }
          }}
          onSignOut={() => {
            setIsDrawerOpen(false);
            if (onSignOut) onSignOut();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  mainContent: {
    flex: 1
  }
});
