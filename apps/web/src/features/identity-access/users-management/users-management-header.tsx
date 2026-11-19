"use client";

import { SettingsIcon } from "./users-management-icons";

export function UsersManagementHeader() {
  return (
    <div className="cg-um-page-title-row">
      <div className="cg-um-page-title-left">
        <div className="cg-um-page-title-heading">
          <h1 className="cg-um-main-heading">Users Management</h1>
          <span className="cg-um-heading-icon" title="System Settings &amp; Control">
            <SettingsIcon size={18} />
          </span>
        </div>
      </div>
    </div>
  );
}
