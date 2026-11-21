"use client";

import React from "react";
import type { CG03ProcessView } from "./registration-approvals-types";
import {
  IconShield,
  IconLock,
  IconArrowRight,
  IconLayers,
  IconSliders
} from "./registration-approvals-icons";

interface VersionProcessViewProps {
  process: CG03ProcessView | null;
  loading: boolean;
  mayConfigure: boolean;
  onOpenVersionModal: () => void;
}

export function VersionProcessView({
  process,
  loading,
  mayConfigure,
  onOpenVersionModal
}: VersionProcessViewProps) {
  const currentVersion = process?.version ?? 3;

  // Build list of process versions for historical table matching wireframe
  const versionHistory = [
    {
      version: `v${currentVersion}`,
      versionBadgeClass: "badge-v-active",
      description: "Protected role-change process",
      route: process?.firstReviewer
        ? "Different Super Admin"
        : process?.finalReviewer ?? "Super Admin only",
      status: "Active"
    }
  ];

  if (currentVersion >= 2) {
    versionHistory.push({
      version: `v${currentVersion - 1}`,
      versionBadgeClass: "badge-v-archive",
      description: "Previous route revision",
      route: "Super Admin only",
      status: "Archived"
    });
  }

  if (currentVersion >= 3) {
    versionHistory.push({
      version: "v1",
      versionBadgeClass: "badge-v-archive",
      description: "Initial approval route",
      route: "Super Admin only",
      status: "Archived"
    });
  }

  return (
    <div className="cg-ra-process-section">
      {/* 1. Approval Process Card matching Wireframe Panel 9 */}
      <div className="cg-ra-approval-process-card">
        <div className="cg-ra-process-card-header">
          <div className="cg-ra-process-card-title-wrap">
            <div className="cg-ra-process-shield-icon">
              <IconShield size={22} />
            </div>
            <h3 className="cg-ra-process-card-title">Approval Process</h3>
            <span className="cg-ra-badge badge-approved">
              <span className="cg-ra-badge-dot" /> Active (v{currentVersion})
            </span>
          </div>

          {mayConfigure && (
            <button
              type="button"
              className="cg-ra-btn-configure"
              onClick={onOpenVersionModal}
            >
              <IconSliders size={16} /> Configure Process
            </button>
          )}
        </div>

        {/* Visual Workflow Representation: Step 1 -> Step 2 | Security */}
        <div className="cg-ra-workflow-strip">
          <div className="cg-ra-workflow-step-box">
            <div className="cg-ra-step-number-badge">1</div>
            <div className="cg-ra-step-info">
              <strong className="cg-ra-step-title">Initial Review</strong>
              <span className="cg-ra-step-desc">
                {process?.firstReviewer ?? "Access Manager"}
              </span>
            </div>
          </div>

          <div className="cg-ra-workflow-arrow-wrap">
            <IconArrowRight size={20} className="cg-ra-workflow-arrow" />
          </div>

          <div className="cg-ra-workflow-step-box">
            <div className="cg-ra-step-number-badge">2</div>
            <div className="cg-ra-step-info">
              <strong className="cg-ra-step-title">Final Approval</strong>
              <span className="cg-ra-step-desc">Different Super Admin</span>
            </div>
          </div>

          <div className="cg-ra-workflow-divider" />

          <div className="cg-ra-workflow-security-box">
            <div className="cg-ra-security-icon-wrap">
              <IconLock size={18} />
            </div>
            <div className="cg-ra-step-info">
              <strong className="cg-ra-step-title">Security</strong>
              <span className="cg-ra-step-desc">Current password required</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Process Versions Table Card matching Wireframe Panel 9 */}
      <div className="cg-ra-process-versions-card">
        <div className="cg-ra-versions-header">
          <IconLayers size={20} className="cg-ra-versions-icon" />
          <h4 className="cg-ra-versions-title">Process Versions</h4>
        </div>

        <div className="cg-ra-table-wrap">
          <table className="cg-ra-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Version</th>
                <th>Description</th>
                <th>Reviewer Route</th>
                <th style={{ width: "130px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {versionHistory.map((item) => (
                <tr key={item.version}>
                  <td>
                    <span className={`cg-ra-version-badge ${item.versionBadgeClass}`}>
                      {item.version}
                    </span>
                  </td>
                  <td>
                    <span className="cg-ra-version-desc">{item.description}</span>
                  </td>
                  <td>
                    <span className="cg-ra-version-route">{item.route}</span>
                  </td>
                  <td>
                    {item.status === "Active" ? (
                      <span className="cg-ra-badge badge-approved">
                        <span className="cg-ra-badge-dot" /> Active
                      </span>
                    ) : (
                      <span className="cg-ra-badge badge-archived">
                        <span className="cg-ra-badge-dot" /> Archived
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
