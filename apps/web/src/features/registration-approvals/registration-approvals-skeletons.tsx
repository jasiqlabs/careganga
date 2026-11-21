import React from "react";

export function ApprovalStatsCardsSkeleton() {
  return (
    <section aria-label="Loading summary statistics" className="cg-ra-stats-grid" aria-busy="true">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div className="cg-ra-stat-card" key={idx} style={{ pointerEvents: "none" }}>
          <div className="cg-ra-stat-icon-wrap cg-ra-skeleton" />
          <div className="cg-ra-stat-content">
            <div className="cg-ra-skeleton" style={{ height: "0.7rem", width: "65%" }} />
            <div className="cg-ra-skeleton" style={{ height: "1.5rem", width: "40%", margin: "0.25rem 0" }} />
          </div>
        </div>
      ))}
    </section>
  );
}

export function ApprovalTableSkeleton() {
  return (
    <div className="cg-ra-table-wrap" aria-busy="true">
      <table className="cg-ra-table">
        <thead>
          <tr>
            <th style={{ width: "40px" }}><div className="cg-ra-skeleton" style={{ width: "16px", height: "16px", borderRadius: "4px" }} /></th>
            <th>Application ID</th>
            <th>Account</th>
            <th>Proposed Role</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Current Step</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, idx) => (
            <tr key={idx}>
              <td><div className="cg-ra-skeleton" style={{ width: "16px", height: "16px", borderRadius: "4px" }} /></td>
              <td><div className="cg-ra-skeleton" style={{ width: "110px", height: "16px", borderRadius: "4px" }} /></td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div className="cg-ra-skeleton" style={{ width: "28px", height: "28px", borderRadius: "50%" }} />
                  <div className="cg-ra-skeleton" style={{ width: "90px", height: "16px", borderRadius: "4px" }} />
                </div>
              </td>
              <td><div className="cg-ra-skeleton" style={{ width: "80px", height: "16px", borderRadius: "4px" }} /></td>
              <td><div className="cg-ra-skeleton" style={{ width: "85px", height: "22px", borderRadius: "9999px" }} /></td>
              <td><div className="cg-ra-skeleton" style={{ width: "130px", height: "15px", borderRadius: "4px" }} /></td>
              <td><div className="cg-ra-skeleton" style={{ width: "75px", height: "15px", borderRadius: "4px" }} /></td>
              <td><div className="cg-ra-skeleton" style={{ width: "60px", height: "28px", borderRadius: "6px" }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApplicationDetailSkeleton() {
  return (
    <div className="cg-ra-detail-grid" aria-busy="true">
      <div className="cg-ra-detail-card">
        <div className="cg-ra-skeleton" style={{ width: "160px", height: "20px", marginBottom: "1.25rem", borderRadius: "4px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="cg-ra-skeleton" style={{ width: "110px", height: "16px", borderRadius: "4px" }} />
              <div className="cg-ra-skeleton" style={{ width: "130px", height: "16px", borderRadius: "4px" }} />
            </div>
          ))}
        </div>
      </div>
      <div className="cg-ra-detail-card">
        <div className="cg-ra-skeleton" style={{ width: "140px", height: "20px", marginBottom: "1.25rem", borderRadius: "4px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: "0.85rem" }}>
              <div className="cg-ra-skeleton" style={{ width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div className="cg-ra-skeleton" style={{ width: "90px", height: "16px", borderRadius: "4px" }} />
                <div className="cg-ra-skeleton" style={{ width: "180px", height: "14px", borderRadius: "4px" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function VersionProcessSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} aria-busy="true">
      <div className="cg-ra-process-hero">
        <div className="cg-ra-skeleton" style={{ width: "140px", height: "18px", borderRadius: "4px" }} />
        <div className="cg-ra-skeleton" style={{ width: "320px", height: "24px", margin: "0.5rem 0", borderRadius: "4px" }} />
        <div className="cg-ra-skeleton" style={{ width: "240px", height: "15px", borderRadius: "4px" }} />
      </div>
      <div className="cg-ra-table-wrap">
        <table className="cg-ra-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Description</th>
              <th>Reviewer Route</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 2 }).map((_, idx) => (
              <tr key={idx}>
                <td><div className="cg-ra-skeleton" style={{ width: "30px", height: "16px", borderRadius: "4px" }} /></td>
                <td><div className="cg-ra-skeleton" style={{ width: "180px", height: "16px", borderRadius: "4px" }} /></td>
                <td><div className="cg-ra-skeleton" style={{ width: "200px", height: "16px", borderRadius: "4px" }} /></td>
                <td><div className="cg-ra-skeleton" style={{ width: "65px", height: "22px", borderRadius: "9999px" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
