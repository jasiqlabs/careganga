import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  BackHandler,
  Modal,
  ActivityIndicator
} from "react-native";
import * as Crypto from "expo-crypto";
import type { CG01AccountList, CG01AccountView, CG01SessionView } from "@careganga/api-contracts";
import { careGangaTheme } from "../../../../../packages/design-tokens/src/index";
import { identityRequest } from "./http-client";
import { AuthenticatedScreenHeader } from "../dashboard/authenticated-screen-header";
import {
  AuthenticatedBottomNavigation,
  useBottomNavPadding,
  type AuthenticatedBottomNavItem
} from "../dashboard/authenticated-bottom-navigation";
import { NavigationDrawer } from "../dashboard/navigation-drawer";
import { getAuthorizedModules, type ModuleActionHandlers } from "../dashboard/dashboard-modules";

import {
  accountStatusLabel,
  auditOutcomeLabel,
  type RoleOption,
  type UserNotice,
  type PendingUserAction,
  type UserTab
} from "./users-management/users-management-types";
import {
  IconUsers,
  IconPlus,
  IconClock,
  IconRefreshCw,
  IconChevronLeft,
  IconChevronRight,
  IconAlertTriangle
} from "./users-management/users-management-icons";
import {
  StatsCardsSkeleton,
  UserCardsSkeleton,
  UserDetailsSkeleton
} from "./users-management/users-management-skeletons";
import { UsersSummaryStats } from "./users-management/users-management-stats";
import { UsersSearchFilter } from "./users-management/users-management-search-filter";
import { UserCardItem } from "./users-management/user-card-item";
import { ScreenUserDetails } from "./users-management/screen-user-details";
import { EditProfileModal } from "./users-management/edit-profile-modal";
import { AssignRoleModal } from "./users-management/assign-role-modal";
import { DeleteConfirmationModal } from "./users-management/delete-confirmation-modal";
import { ScreenAddStaffModal } from "./users-management/screen-add-staff-modal";

export interface AccountsScreenProps {
  token: string;
  onExit: () => void;
  onExpired: () => void;
  createOnly?: boolean;
  actor?: CG01SessionView | null;
  roleActions?: string[];
  handlers?: ModuleActionHandlers;
  onSignOut?: () => void;
}

async function call(token: string, path: string, method = "GET", body?: object): Promise<unknown> {
  let response: Response;
  try {
    response = await identityRequest("/api/access/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new Error(method === "GET" ? "UNAVAILABLE" : "UNKNOWN");
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error("SESSION_EXPIRED");
    if (response.status === 403) throw new Error("PERMISSION_DENIED");
    if (response.status === 409) throw new Error("CONFLICT");
    if (response.status === 429) throw new Error("RETRY_LATER");
    throw new Error(method === "GET" ? "UNAVAILABLE" : "UNKNOWN");
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error(method === "GET" ? "UNAVAILABLE" : "UNKNOWN");
  }
}

export function AccountsScreen({
  token,
  onExit,
  onExpired,
  createOnly = false,
  actor,
  roleActions = [],
  handlers,
  onSignOut
}: AccountsScreenProps) {
  const bottomPadding = useBottomNavPadding(24);

  // App Shell Navigation
  const [activeNavTab, setActiveNavTab] = useState<UserTab>(createOnly ? "create" : "users");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Directory Data States
  const [list, setList] = useState<CG01AccountList | null>(null);
  const [actions, setActions] = useState<string[]>(roleActions);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [history, setHistory] = useState<Array<{
    eventRef: string;
    occurredAt: string;
    actionLabel: string;
    outcome: string;
    actorDisplay?: string;
  }> | null>(null);

  // Filters & Pagination State
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<UserNotice | null>(null);
  const [unknown, setUnknown] = useState(false);

  // Active Modals and Selections
  const [selectedUser, setSelectedUser] = useState<CG01AccountView | null>(null);
  const [editUser, setEditUser] = useState<CG01AccountView | null>(null);
  const [assignRoleUser, setAssignRoleUser] = useState<CG01AccountView | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<CG01AccountView | null>(null);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(createOnly);
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(null);

  // Edit / Form helper values
  const [selectedRoleRef, setSelectedRoleRef] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "SUSPENDED" | "DEACTIVATED">("ACTIVE");

  // Generations for race-condition prevention
  const listGeneration = useRef(0);
  const optionsGeneration = useRef(0);
  const historyGeneration = useRef(0);

  // Effective Permissions
  const canCreate = actions.includes("accounts.create") && actions.includes("roles.assign");
  const canAssign = actions.includes("roles.assign");
  const canStatus = actions.includes("accounts.status.manage");
  const canAudit = actions.includes("access.audit.view");
  const canViewNotifications = actions.includes("communications.notifications.view");

  const deny = useCallback(
    (kind: string) => {
      ++listGeneration.current;
      ++optionsGeneration.current;
      ++historyGeneration.current;
      setList(null);
      setActions([]);
      setRoles([]);
      setSelectedUser(null);
      setEditUser(null);
      setAssignRoleUser(null);
      setDeleteConfirmUser(null);
      setPendingAction(null);
      setBusy(false);
      setHistory(null);
      setNotice({
        kind: "error",
        text: "Your account access cannot be verified. Restricted information was cleared."
      });
      if (kind === "SESSION_EXPIRED") onExpired();
    },
    [onExpired]
  );

  // Load account directory
  const load = useCallback(
    async (q = "", skip = 0, statusFilter = "all") => {
      const generation = ++listGeneration.current;
      setLoading(true);
      setNotice(null);
      try {
        if (createOnly) {
          const access = (await call(token, "effective")) as { actions?: { key: string }[] };
          if (generation !== listGeneration.current) return false;
          if (
            !access ||
            !Array.isArray(access.actions) ||
            !access.actions.every(a => a && typeof a.key === "string")
          ) {
            throw new Error("UNAVAILABLE");
          }
          const keys = access.actions.map(a => a.key);
          if (!keys.includes("accounts.create") || !keys.includes("roles.assign")) {
            throw new Error("PERMISSION_DENIED");
          }
          setList(null);
          setActions(keys);
          return true;
        }

        const params = new URLSearchParams({ search: q, limit: "20", offset: String(skip), status: statusFilter });
        const [listData, access] = await Promise.all([
          call(token, "accounts?" + params.toString()),
          call(token, "effective")
        ]);
        if (
          !listData ||
          typeof listData !== "object" ||
          !("accounts" in listData) ||
          !Array.isArray(listData.accounts) ||
          !("summary" in listData)
        ) {
          throw new Error("UNAVAILABLE");
        }
        if (!access || typeof access !== "object" || !("actions" in access) || !Array.isArray(access.actions)) {
          throw new Error("UNAVAILABLE");
        }
        if (generation !== listGeneration.current) return false;

        const typedList = listData as CG01AccountList;
        setList(typedList);
        setActions(access.actions.map((a: { key: string }) => a.key));
        setOffset(skip);
        setFilter(statusFilter);
        setSelectedUser(prev => (prev ? typedList.accounts.find(x => x.accountRef === prev.accountRef) ?? null : null));
        return true;
      } catch (e) {
        if (generation !== listGeneration.current) return false;
        if (e instanceof Error && (e.message === "SESSION_EXPIRED" || e.message === "PERMISSION_DENIED")) {
          deny(e.message);
        } else {
          deny("UNAVAILABLE");
        }
        return false;
      } finally {
        if (generation === listGeneration.current) setLoading(false);
      }
    },
    [token, deny, createOnly]
  );

  useEffect(() => {
    void load("", 0, "all");
  }, [load]);

  // Search roles from backend
  const searchRoles = useCallback(
    async (q = "") => {
      const generation = ++optionsGeneration.current;
      setRolesLoading(true);
      try {
        const query = new URLSearchParams({ search: q });
        const result = (await call(token, "roles/options?" + query.toString())) as { options: RoleOption[] };
        if (generation !== optionsGeneration.current) return;
        if (!Array.isArray(result.options)) throw new Error("UNAVAILABLE");
        const filtered = result.options.filter(x => !x.context || x.context.toLowerCase() === "foundation");
        const unique = Array.from(new Map(filtered.map(r => [r.value, r])).values());
        setRoles(unique);
      } catch (e) {
        if (generation !== optionsGeneration.current) return;
        setRoles([]);
        if (e instanceof Error && (e.message === "SESSION_EXPIRED" || e.message === "PERMISSION_DENIED")) {
          deny(e.message);
        } else {
          setNotice({ kind: "error", text: "Eligible roles are temporarily unavailable." });
        }
      } finally {
        if (generation === optionsGeneration.current) setRolesLoading(false);
      }
    },
    [token, deny]
  );

  // Load audit history
  const loadHistory = useCallback(
    async (targetRef?: string) => {
      const generation = ++historyGeneration.current;
      try {
        const params = new URLSearchParams({ limit: "20", ...(targetRef ? { targetRef } : {}) });
        const result = (await call(token, "audit?" + params.toString())) as {
          events: Array<{ eventRef: string; occurredAt: string; actionLabel: string; outcome: string; actorDisplay?: string }>;
        };
        if (generation !== historyGeneration.current) return;
        if (!Array.isArray(result.events)) throw new Error("UNAVAILABLE");
        setHistory(result.events);
      } catch (e) {
        if (generation !== historyGeneration.current) return;
        if (e instanceof Error && (e.message === "SESSION_EXPIRED" || e.message === "PERMISSION_DENIED")) {
          deny(e.message);
        } else {
          setNotice({ kind: "error", text: "Security history could not be verified." });
        }
      }
    },
    [token, deny]
  );

  // Hardware Back Handler
  useEffect(() => {
    const onBackPress = () => {
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return true;
      }
      if (deleteConfirmUser) {
        setDeleteConfirmUser(null);
        return true;
      }
      if (assignRoleUser) {
        setAssignRoleUser(null);
        return true;
      }
      if (editUser) {
        setEditUser(null);
        return true;
      }
      if (isAddStaffOpen) {
        if (createOnly) {
          onExit();
          return true;
        }
        setIsAddStaffOpen(false);
        return true;
      }
      if (selectedUser) {
        setSelectedUser(null);
        return true;
      }
      if (activeNavTab !== "users") {
        setActiveNavTab("users");
        return true;
      }
      onExit();
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [
    isDrawerOpen,
    deleteConfirmUser,
    assignRoleUser,
    editUser,
    isAddStaffOpen,
    selectedUser,
    activeNavTab,
    createOnly,
    onExit
  ]);

  // Action: Open Edit Profile Modal
  const handleOpenEdit = (account: CG01AccountView) => {
    setEditUser(account);
    setSelectedRoleRef(account.roleRef ?? "");
    setEditStatus(account.status);
    setNotice(null);
    if (canAssign) void searchRoles("");
  };

  // Action: Open Assign Role Modal
  const handleOpenAssignRole = (account: CG01AccountView) => {
    setAssignRoleUser(account);
    setSelectedRoleRef(account.roleRef ?? "");
    setNotice(null);
    if (canAssign) void searchRoles("");
  };

  // Action: Save Profile Changes
  const handleSaveProfile = async () => {
    if (!editUser || busy || unknown) return;
    setBusy(true);
    setNotice(null);
    const requestKey = Crypto.randomUUID();
    try {
      const root = "accounts/" + editUser.accountRef;
      // 1. If role was changed
      if (canAssign && selectedRoleRef && selectedRoleRef !== editUser.roleRef) {
        await call(token, root + "/role", "PUT", {
          roleRef: selectedRoleRef,
          expectedRevision: editUser.revision,
          requestKey
        });
      }
      // 2. If status was changed
      if (canStatus && editStatus !== editUser.status) {
        await call(token, root + "/status", "PATCH", {
          status: editStatus,
          expectedRevision: editUser.revision,
          requestKey
        });
      }
      setEditUser(null);
      setNotice({ kind: "success", text: "Profile changes saved successfully." });
      await load(search, offset, filter);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "UNAVAILABLE";
      if (reason === "SESSION_EXPIRED" || reason === "PERMISSION_DENIED") deny(reason);
      else if (reason === "CONFLICT") {
        setNotice({ kind: "error", text: "The account changed elsewhere. Refresh before saving." });
      } else if (reason === "UNKNOWN") {
        setUnknown(true);
        setNotice({ kind: "uncertain", text: "The result could not be confirmed. Refresh before retrying." });
      } else {
        setNotice({ kind: "error", text: "Profile update could not be confirmed." });
      }
    } finally {
      setBusy(false);
    }
  };

  // Action: Confirm Role Assignment
  const handleConfirmRoleAssignment = async () => {
    if (!assignRoleUser || !selectedRoleRef || busy || unknown) return;
    setBusy(true);
    setNotice(null);
    const requestKey = Crypto.randomUUID();
    try {
      const root = "accounts/" + assignRoleUser.accountRef;
      await call(token, root + "/role", "PUT", {
        roleRef: selectedRoleRef,
        expectedRevision: assignRoleUser.revision,
        requestKey
      });
      setAssignRoleUser(null);
      setNotice({ kind: "success", text: "Role assigned successfully." });
      await load(search, offset, filter);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "UNAVAILABLE";
      if (reason === "SESSION_EXPIRED" || reason === "PERMISSION_DENIED") deny(reason);
      else if (reason === "CONFLICT") {
        setNotice({ kind: "error", text: "The account changed elsewhere. Refresh before saving." });
      } else {
        setNotice({ kind: "error", text: "Role assignment could not be confirmed." });
      }
    } finally {
      setBusy(false);
    }
  };

  // Action: Quick Status Change (Suspend / Reactivate)
  const handleStatusChange = async (
    account: CG01AccountView,
    newStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED"
  ) => {
    if (account.roleProtected || busy || unknown) return;
    if (newStatus === "DEACTIVATED") {
      setDeleteConfirmUser(account);
      return;
    }
    setBusy(true);
    setNotice(null);
    const requestKey = Crypto.randomUUID();
    try {
      const root = "accounts/" + account.accountRef;
      await call(token, root + "/status", "PATCH", {
        status: newStatus,
        expectedRevision: account.revision,
        requestKey
      });
      setNotice({
        kind: "success",
        text: `Account status updated to ${accountStatusLabel(newStatus)}.`
      });
      await load(search, offset, filter);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "UNAVAILABLE";
      if (reason === "SESSION_EXPIRED" || reason === "PERMISSION_DENIED") deny(reason);
      else if (reason === "CONFLICT") {
        setNotice({ kind: "error", text: "The account changed elsewhere. Refresh before saving." });
      } else {
        setNotice({ kind: "error", text: "Status change could not be confirmed." });
      }
    } finally {
      setBusy(false);
    }
  };

  // Action: Deactivate Account
  const handleConfirmDeactivation = async () => {
    if (!deleteConfirmUser || busy || unknown) return;
    setBusy(true);
    setNotice(null);
    const requestKey = Crypto.randomUUID();
    try {
      const root = "accounts/" + deleteConfirmUser.accountRef;
      await call(token, root + "/status", "PATCH", {
        status: "DEACTIVATED",
        expectedRevision: deleteConfirmUser.revision,
        requestKey
      });
      setDeleteConfirmUser(null);
      if (selectedUser?.accountRef === deleteConfirmUser.accountRef) {
        setSelectedUser(null);
      }
      setNotice({ kind: "success", text: "User account deactivated." });
      await load(search, offset, filter);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "UNAVAILABLE";
      if (reason === "SESSION_EXPIRED" || reason === "PERMISSION_DENIED") deny(reason);
      else if (reason === "CONFLICT") {
        setNotice({ kind: "error", text: "The account changed elsewhere. Refresh before saving." });
      } else {
        setNotice({ kind: "error", text: "Account deactivation could not be confirmed." });
      }
    } finally {
      setBusy(false);
    }
  };

  // Action: Add Staff Submission
  const handleAddStaffSubmit = async (data: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    roleRef: string;
  }) => {
    if (busy || unknown) return;
    setBusy(true);
    setNotice(null);
    const requestKey = Crypto.randomUUID();
    try {
      await call(token, "accounts", "POST", {
        displayName: data.fullName,
        email: data.email,
        mobile: data.phone,
        password: data.password,
        roleRef: data.roleRef,
        requestKey
      });
      setIsAddStaffOpen(false);
      setNotice({ kind: "success", text: "Staff account created and active." });
      await load(search, 0, filter);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "UNAVAILABLE";
      if (reason === "SESSION_EXPIRED" || reason === "PERMISSION_DENIED") deny(reason);
      else if (reason === "UNKNOWN") {
        setUnknown(true);
        setNotice({
          kind: "uncertain",
          text: "Account creation result is uncertain. Refresh the directory before retrying."
        });
      } else if (reason === "CONFLICT") {
        setNotice({ kind: "error", text: "This mobile or email is already registered." });
      } else {
        setNotice({ kind: "error", text: "The account could not be created." });
      }
    } finally {
      setBusy(false);
    }
  };

  // Authorized drawer modules
  const authorizedModules = useMemo(() => {
    if (actor && handlers) {
      return getAuthorizedModules(actions, actor, handlers);
    }
    return [];
  }, [actions, actor, handlers]);

  // Custom Bottom Navigation Tabs
  const bottomTabs: AuthenticatedBottomNavItem[] = useMemo(() => {
    const items: AuthenticatedBottomNavItem[] = [
      {
        id: "users",
        label: "Staff Directory",
        icon: color => <IconUsers size={21} color={color} />
      }
    ];
    if (canCreate) {
      items.push({
        id: "create",
        label: "Add Staff",
        icon: color => <IconPlus size={21} color={color} />
      });
    }
    if (canAudit) {
      items.push({
        id: "history",
        label: "Security Audit",
        icon: color => <IconClock size={21} color={color} />
      });
    }
    return items;
  }, [canCreate, canAudit]);

  // Pagination details
  const total = list?.total ?? 0;
  const accounts = list?.accounts ?? [];
  const startItem = total > 0 ? offset + 1 : 0;
  const endItem = Math.min(offset + 20, total);

  return (
    <View style={styles.rootContainer}>
      {/* Reusable Authenticated Screen Header */}
      <AuthenticatedScreenHeader
        variant="standard"
        title="Users Management"
        hasNotifications={canViewNotifications}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenNotifications={() => handlers?.openNotifications?.()}
      />

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={[styles.mainScroll, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Subtitle Row */}
        <View style={styles.pageHeaderRow}>
          <View>
            <Text accessibilityRole="header" style={styles.pageTitle}>Users Management</Text>
            <Text style={styles.pageSubtitle}>
              Foundation staff directory, assigned roles, and access controls
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh directory"
            onPress={() => void load(search, offset, filter)}
            disabled={loading || busy}
            style={styles.refreshBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconRefreshCw size={15} color="#475569" />
          </Pressable>
        </View>

        {/* Global Notice Banner */}
        {notice && (
          <View
            style={[
              styles.noticeBanner,
              notice.kind === "success"
                ? styles.noticeBannerSuccess
                : notice.kind === "uncertain"
                ? styles.noticeBannerUncertain
                : styles.noticeBannerError
            ]}
          >
            <Text
              style={[
                styles.noticeBannerText,
                notice.kind === "success"
                  ? styles.noticeBannerTextSuccess
                  : notice.kind === "uncertain"
                  ? styles.noticeBannerTextUncertain
                  : styles.noticeBannerTextError
              ]}
            >
              {notice.text}
            </Text>
          </View>
        )}

        {/* TAB 1: USERS DIRECTORY VIEW */}
        {activeNavTab === "users" && (
          <>
            {/* Summary Statistics */}
            {loading && !list ? (
              <StatsCardsSkeleton />
            ) : (
              <UsersSummaryStats summary={list?.summary} />
            )}

            {/* Search and Filters */}
            <UsersSearchFilter
              search={search}
              onSearchChange={setSearch}
              onSubmitSearch={() => void load(search, 0, filter)}
              filter={filter}
              onFilterChange={newStatus => void load(search, 0, newStatus)}
              loading={loading}
            />

            {/* Pagination / Summary Status Bar */}
            <View style={styles.listToolbar}>
              <Text style={styles.entriesInfo}>
                Showing {startItem}–{endItem} of {total} entries
              </Text>
              {canCreate && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void searchRoles("");
                    setIsAddStaffOpen(true);
                  }}
                  style={styles.addStaffHeaderBtn}
                >
                  <IconPlus size={14} color="#FFFFFF" />
                  <Text style={styles.addStaffHeaderBtnText}>Add Staff</Text>
                </Pressable>
              )}
            </View>

            {/* User Cards List */}
            {loading && !list ? (
              <UserCardsSkeleton />
            ) : accounts.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <IconUsers size={40} color="#CBD5E1" />
                <Text style={styles.emptyStateTitle}>No staff accounts found</Text>
                <Text style={styles.emptyStateDesc}>
                  No accounts matched your search keyword or selected status filter.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSearch("");
                    void load("", 0, "all");
                  }}
                  style={styles.resetFiltersBtn}
                >
                  <Text style={styles.resetFiltersText}>Reset Search &amp; Filters</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.cardsWrap}>
                {accounts.map(account => (
                  <UserCardItem
                    key={account.accountRef}
                    account={account}
                    canAssign={canAssign}
                    canStatus={canStatus}
                    onViewDetails={acc => setSelectedUser(acc)}
                    onEditAccount={handleOpenEdit}
                    onAssignRole={handleOpenAssignRole}
                    onStatusChange={handleStatusChange}
                    onDeleteAccount={acc => setDeleteConfirmUser(acc)}
                  />
                ))}
              </View>
            )}

            {/* Pagination Controls */}
            {total > 20 && (
              <View style={styles.paginationRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={offset === 0 || loading || busy}
                  onPress={() => void load(search, Math.max(0, offset - 20), filter)}
                  style={[
                    styles.pageBtn,
                    (offset === 0 || loading || busy) && styles.pageBtnDisabled
                  ]}
                >
                  <IconChevronLeft size={16} color={offset === 0 ? "#94A3B8" : "#2563EB"} />
                  <Text
                    style={[
                      styles.pageBtnText,
                      offset === 0 && styles.pageBtnTextDisabled
                    ]}
                  >
                    Previous
                  </Text>
                </Pressable>

                <Text style={styles.pageCountText}>
                  Page {Math.floor(offset / 20) + 1} of {Math.max(1, Math.ceil(total / 20))}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  disabled={offset + 20 >= total || loading || busy}
                  onPress={() => void load(search, offset + 20, filter)}
                  style={[
                    styles.pageBtn,
                    (offset + 20 >= total || loading || busy) && styles.pageBtnDisabled
                  ]}
                >
                  <Text
                    style={[
                      styles.pageBtnText,
                      offset + 20 >= total && styles.pageBtnTextDisabled
                    ]}
                  >
                    Next
                  </Text>
                  <IconChevronRight
                    size={16}
                    color={offset + 20 >= total ? "#94A3B8" : "#2563EB"}
                  />
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* TAB 2: ADD STAFF VIEW */}
        {activeNavTab === "create" && (
          <View style={styles.fullTabWrap}>
            <ScreenAddStaffModal
              isOpen
              onClose={() => {
                if (createOnly) onExit();
                else setActiveNavTab("users");
              }}
              roles={roles}
              rolesLoading={rolesLoading}
              onSearchRoles={searchRoles}
              busy={busy}
              uncertain={unknown}
              notice={notice}
              onSubmit={handleAddStaffSubmit}
            />
          </View>
        )}

        {/* TAB 3: SECURITY AUDIT VIEW */}
        {activeNavTab === "history" && canAudit && (
          <View style={styles.auditTabWrap}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Security Access History</Text>
                <Text style={styles.sectionSubtitle}>
                  Verified security actions and account modifications
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadHistory()}
                style={styles.refreshBtn}
              >
                <IconRefreshCw size={14} color="#475569" />
              </Pressable>
            </View>

            {!history ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loadingText}>Loading verified audit events…</Text>
              </View>
            ) : history.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <IconClock size={36} color="#CBD5E1" />
                <Text style={styles.emptyStateTitle}>No security events recorded</Text>
              </View>
            ) : (
              <View style={styles.historyListCard}>
                {history.map(item => (
                  <View key={item.eventRef} style={styles.historyItemRow}>
                    <View style={styles.historyMarker} />
                    <View style={styles.historyItemContent}>
                      <Text style={styles.historyActionTitle}>{item.actionLabel}</Text>
                      <View style={styles.historyMetaRow}>
                        <View
                          style={[
                            styles.outcomePill,
                            item.outcome === "Confirmed"
                              ? styles.outcomeSuccess
                              : item.outcome === "Denied"
                              ? styles.outcomeDenied
                              : styles.outcomePending
                          ]}
                        >
                          <Text
                            style={[
                              styles.outcomePillText,
                              item.outcome === "Confirmed"
                                ? styles.outcomeTextSuccess
                                : item.outcome === "Denied"
                                ? styles.outcomeTextDenied
                                : styles.outcomeTextPending
                            ]}
                          >
                            {auditOutcomeLabel(item.outcome)}
                          </Text>
                        </View>
                        {!!item.actorDisplay && (
                          <Text style={styles.historyActor}>by {item.actorDisplay}</Text>
                        )}
                        <Text style={styles.historyDate}>
                          {new Date(item.occurredAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Reusable Bottom Navigation */}
      <AuthenticatedBottomNavigation
        activeTab={activeNavTab}
        onSelectTab={tab => {
          setActiveNavTab(tab as UserTab);
          if (tab === "history" && !history) void loadHistory();
          if (tab === "create") void searchRoles("");
        }}
        customTabs={bottomTabs}
      />

      {/* Navigation Drawer */}
      <NavigationDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        displayName={actor?.displayName ?? "Foundation Admin"}
        roleName={actor?.roleName ?? "Staff"}
        scope={actor?.scope ?? "Foundation"}
        authorizedModules={authorizedModules}
        activeKey="accounts"
        onOpenDashboard={onExit}
        onSignOut={() => onSignOut?.()}
      />

      {/* User Details Full Screen Modal */}
      <Modal
        visible={Boolean(selectedUser)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedUser(null)}
      >
        {selectedUser && (
          <ScreenUserDetails
            account={selectedUser}
            actions={actions}
            history={history}
            onLoadHistory={loadHistory}
            onEditProfile={handleOpenEdit}
            onAssignRole={handleOpenAssignRole}
            onStatusChange={handleStatusChange}
            onDeleteAccount={acc => setDeleteConfirmUser(acc)}
            onClose={() => setSelectedUser(null)}
            busy={busy}
          />
        )}
      </Modal>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        account={editUser}
        roles={roles}
        rolesLoading={rolesLoading}
        roleRef={selectedRoleRef}
        onRoleRefChange={setSelectedRoleRef}
        status={editStatus}
        onStatusChange={setEditStatus}
        busy={busy}
        uncertain={unknown}
        notice={notice}
        onSave={handleSaveProfile}
      />

      {/* Assign Role Modal */}
      <AssignRoleModal
        isOpen={Boolean(assignRoleUser)}
        onClose={() => setAssignRoleUser(null)}
        account={assignRoleUser}
        roles={roles}
        rolesLoading={rolesLoading}
        selectedRoleRef={selectedRoleRef}
        onSelectRoleRef={setSelectedRoleRef}
        busy={busy}
        uncertain={unknown}
        notice={notice}
        onConfirm={handleConfirmRoleAssignment}
      />

      {/* Delete / Deactivate Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(deleteConfirmUser)}
        onClose={() => setDeleteConfirmUser(null)}
        account={deleteConfirmUser}
        busy={busy}
        uncertain={unknown}
        notice={notice}
        onConfirm={handleConfirmDeactivation}
      />

      {/* Add Staff Modal (when opened from button on list view) */}
      <ScreenAddStaffModal
        isOpen={isAddStaffOpen && !createOnly}
        onClose={() => setIsAddStaffOpen(false)}
        roles={roles}
        rolesLoading={rolesLoading}
        onSearchRoles={searchRoles}
        busy={busy}
        uncertain={unknown}
        notice={notice}
        onSubmit={handleAddStaffSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  mainScroll: {
    paddingTop: 12,
    gap: 12
  },
  pageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 4
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3
  },
  pageSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  noticeBanner: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1
  },
  noticeBannerSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0"
  },
  noticeBannerUncertain: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A"
  },
  noticeBannerError: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3"
  },
  noticeBannerText: {
    fontSize: 12.5,
    fontWeight: "600"
  },
  noticeBannerTextSuccess: {
    color: "#059669"
  },
  noticeBannerTextUncertain: {
    color: "#B45309"
  },
  noticeBannerTextError: {
    color: "#E11D48"
  },
  listToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4
  },
  entriesInfo: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  addStaffHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#2563EB"
  },
  addStaffHeaderBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  cardsWrap: {
    marginTop: 4
  },
  emptyStateContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 4
  },
  emptyStateDesc: {
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280
  },
  resetFiltersBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  resetFiltersText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  pageBtnDisabled: {
    opacity: 0.5
  },
  pageBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#2563EB"
  },
  pageBtnTextDisabled: {
    color: "#94A3B8"
  },
  pageCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  fullTabWrap: {
    flex: 1
  },
  auditTabWrap: {
    paddingHorizontal: 16,
    gap: 12
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A"
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 20
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B"
  },
  historyListCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14
  },
  historyItemRow: {
    flexDirection: "row",
    gap: 12
  },
  historyMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
    marginTop: 5
  },
  historyItemContent: {
    flex: 1,
    gap: 4
  },
  historyActionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  historyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  outcomePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  outcomeSuccess: {
    backgroundColor: "#ECFDF5"
  },
  outcomeDenied: {
    backgroundColor: "#FFF1F2"
  },
  outcomePending: {
    backgroundColor: "#FFFBEB"
  },
  outcomePillText: {
    fontSize: 10.5,
    fontWeight: "700"
  },
  outcomeTextSuccess: {
    color: "#059669"
  },
  outcomeTextDenied: {
    color: "#DC2626"
  },
  outcomeTextPending: {
    color: "#D97706"
  },
  historyActor: {
    fontSize: 11,
    color: "#64748B"
  },
  historyDate: {
    fontSize: 11,
    color: "#94A3B8"
  }
});
