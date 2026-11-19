/**
 * CareGanga Foundation — Roles & Permissions Module Types
 * Strictly preserves all existing data schemas, RBAC entities and state models.
 */

export type Role = {
  roleRef: string;
  name: string;
  description: string;
  colorKey: string | null;
  protected: boolean;
  active: boolean;
  revision: number;
  assignedCount: number;
  actionKeys: string[];
};

export type Capability = {
  key: string;
  businessLabel: string;
  group: string;
  assignable: boolean;
  sensitive: boolean;
};

export type Group = {
  group: string;
  actions: Capability[];
};

export type RoleSummary = {
  totalRoles: number;
  implementedActions: number;
  activeRoles: number;
  inactiveRoles: number;
  customRoles: number;
  systemRoles: number;
};

export type RoleList = {
  roles: Role[];
  total: number;
  offset: number;
  limit: number;
  summary: RoleSummary;
};

export type AuditEvent = {
  occurredAt: string;
  actorDisplay: string;
  actionLabel: string;
  targetDisplay: string;
  outcome: string;
};

export type FormMode = "create" | "edit" | "copy";
export type RoleStatus = "all" | "active" | "retired";
export type RoleKind = "all" | "system" | "custom";
export type Notice = { text: string; kind: "error" | "success" | "uncertain" };

export type PermissionManagerTab = "matrix" | "module" | "set";

export type MatrixActionColumn = "view" | "add" | "edit" | "delete" | "approve" | "export";
