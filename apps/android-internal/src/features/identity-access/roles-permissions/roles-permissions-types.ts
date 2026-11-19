import type {
  CG01RoleSummary,
  CG01Capability,
  CG01AuditEvent
} from "@careganga/api-contracts";

export type Role = CG01RoleSummary;
export type Capability = CG01Capability;
export type Group = { group: string; actions: Capability[] };
export type AuditEvent = CG01AuditEvent;

export type RoleStatus = "all" | "active" | "retired";
export type RoleKind = "all" | "system" | "custom";
export type FormMode = "create" | "edit" | "copy";

export type RoleSummary = {
  totalRoles: number;
  implementedActions: number;
  activeRoles: number;
  inactiveRoles: number;
  customRoles: number;
  systemRoles: number;
};

export type PermissionManagerTab = "matrix" | "module" | "set";

export type MatrixActionColumn = "view" | "add" | "edit" | "delete" | "approve" | "export";
