import React from "react";

export function EmployeeStatsCardsSkeleton() {
  return (
    <section aria-label="Loading staff statistics" className="cg-um-stats-grid" aria-busy="true">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div className="cg-um-stat-card" key={idx} style={{ pointerEvents: "none" }}>
          <div className="cg-um-stat-icon-wrap cg-um-skeleton" style={{ width: "2.5rem", height: "2.5rem", borderRadius: "0.5rem" }} />
          <div className="cg-um-stat-content" style={{ width: "100%", gap: "0.35rem" }}>
            <div className="cg-um-skeleton" style={{ height: "0.75rem", width: "60%" }} />
            <div className="cg-um-skeleton" style={{ height: "1.4rem", width: "45%", margin: "0.15rem 0" }} />
            <div className="cg-um-skeleton" style={{ height: "0.65rem", width: "75%" }} />
          </div>
        </div>
      ))}
    </section>
  );
}

export function EmployeeTableViewSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="cg-um-table-wrap" aria-busy="true">
      <table className="cg-um-table" aria-label="Loading staff accounts table">
        <thead>
          <tr>
            <th style={{ width: "2.5rem" }}>
              <div className="cg-um-skeleton" style={{ width: "1rem", height: "1rem", borderRadius: "0.25rem" }} />
            </th>
            <th>Employee / User</th>
            <th>Role / Designation</th>
            <th>Contact Details</th>
            <th>Account Status</th>
            <th>Registered</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, idx) => (
            <tr key={idx} className="cg-um-table-row">
              <td>
                <div className="cg-um-skeleton" style={{ width: "1rem", height: "1rem", borderRadius: "0.25rem" }} />
              </td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div className="cg-um-skeleton" style={{ width: "2.25rem", height: "2.25rem", borderRadius: "9999px", flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "10rem" }}>
                    <div className="cg-um-skeleton" style={{ height: "0.85rem", width: "80%" }} />
                    <div className="cg-um-skeleton" style={{ height: "0.7rem", width: "55%" }} />
                  </div>
                </div>
              </td>
              <td>
                <div className="cg-um-skeleton" style={{ height: "1.35rem", width: "5.5rem", borderRadius: "9999px" }} />
              </td>
              <td>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "9rem" }}>
                  <div className="cg-um-skeleton" style={{ height: "0.75rem", width: "90%" }} />
                  <div className="cg-um-skeleton" style={{ height: "0.7rem", width: "70%" }} />
                </div>
              </td>
              <td>
                <div className="cg-um-skeleton" style={{ height: "1.25rem", width: "4.5rem", borderRadius: "9999px" }} />
              </td>
              <td>
                <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "5rem" }} />
              </td>
              <td className="text-right">
                <div style={{ display: "inline-flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                  <div className="cg-um-skeleton" style={{ width: "1.85rem", height: "1.85rem", borderRadius: "0.35rem" }} />
                  <div className="cg-um-skeleton" style={{ width: "1.85rem", height: "1.85rem", borderRadius: "0.35rem" }} />
                  <div className="cg-um-skeleton" style={{ width: "1.85rem", height: "1.85rem", borderRadius: "0.35rem" }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmployeeCardViewSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="cg-um-cards-grid" aria-busy="true">
      {Array.from({ length: cards }).map((_, idx) => (
        <div key={idx} className="cg-um-user-card" style={{ pointerEvents: "none" }}>
          <div className="cg-um-card-top">
            <div className="cg-um-skeleton" style={{ width: "2.75rem", height: "2.75rem", borderRadius: "9999px", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <div className="cg-um-skeleton" style={{ height: "0.95rem", width: "70%" }} />
              <div className="cg-um-skeleton" style={{ height: "0.7rem", width: "45%" }} />
            </div>
            <div className="cg-um-skeleton" style={{ width: "4rem", height: "1.25rem", borderRadius: "9999px" }} />
          </div>

          <div style={{ margin: "0.75rem 0", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <div className="cg-um-skeleton" style={{ height: "0.75rem", width: "85%" }} />
            <div className="cg-um-skeleton" style={{ height: "0.75rem", width: "65%" }} />
          </div>

          <div className="cg-um-card-footer" style={{ borderTop: "1px solid #F1F5F9", paddingTop: "0.65rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="cg-um-skeleton" style={{ height: "1.25rem", width: "4.5rem", borderRadius: "9999px" }} />
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <div className="cg-um-skeleton" style={{ width: "1.75rem", height: "1.75rem", borderRadius: "0.35rem" }} />
              <div className="cg-um-skeleton" style={{ width: "1.75rem", height: "1.75rem", borderRadius: "0.35rem" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserDetailsDrawerSkeleton() {
  return (
    <div className="cg-um-drawer-skeleton" aria-busy="true" style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      {/* Top Fixed Header Skeleton */}
      <div className="cg-um-drawer-top-fixed">
        <header className="cg-um-profile-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div className="cg-um-skeleton" style={{ width: "1.25rem", height: "1.25rem", borderRadius: "0.25rem" }} />
            <div className="cg-um-skeleton" style={{ width: "6rem", height: "1rem" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div className="cg-um-skeleton" style={{ width: "4.5rem", height: "1.4rem", borderRadius: "9999px" }} />
            <div className="cg-um-skeleton" style={{ width: "1.85rem", height: "1.85rem", borderRadius: "0.35rem" }} />
          </div>
        </header>

        {/* Identity Banner Skeleton */}
        <section className="cg-um-profile-banner" style={{ pointerEvents: "none" }}>
          <div className="cg-um-profile-banner-left">
            <div className="cg-um-skeleton" style={{ width: "4.5rem", height: "4.5rem", borderRadius: "0.75rem", flexShrink: 0 }} />
            <div className="cg-um-profile-meta-wrap" style={{ width: "100%", maxWidth: "24rem", gap: "0.45rem" }}>
              <div className="cg-um-skeleton" style={{ height: "1.35rem", width: "55%" }} />
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <div className="cg-um-skeleton" style={{ height: "1.1rem", width: "35%", borderRadius: "9999px" }} />
                <div className="cg-um-skeleton" style={{ height: "1.1rem", width: "25%", borderRadius: "9999px" }} />
              </div>
              <div style={{ display: "flex", gap: "0.85rem" }}>
                <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "40%" }} />
                <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "45%" }} />
              </div>
            </div>
          </div>
        </section>

        {/* Tabs Strip Skeleton */}
        <nav className="cg-um-profile-tabs" style={{ pointerEvents: "none" }}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="cg-um-skeleton" style={{ height: "1.85rem", width: idx === 0 ? "5rem" : "6rem", borderRadius: "0.45rem" }} />
          ))}
        </nav>
      </div>

      {/* Tab Content Skeleton */}
      <div className="cg-um-profile-tab-content">
        {/* 4 Metric Cells Skeleton */}
        <div className="cg-um-metrics-strip" style={{ marginBottom: "1.25rem" }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="cg-um-metric-cell">
              <div className="cg-um-skeleton" style={{ width: "2.35rem", height: "2.35rem", borderRadius: "9999px", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <div className="cg-um-skeleton" style={{ height: "0.65rem", width: "50%" }} />
                <div className="cg-um-skeleton" style={{ height: "0.95rem", width: "75%" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Two Col Cards Skeleton */}
        <div className="cg-um-cards-two-col">
          <div className="cg-um-section-card" style={{ minHeight: "18rem" }}>
            <div className="cg-um-section-card-header">
              <div className="cg-um-skeleton" style={{ height: "1rem", width: "45%" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "1rem" }}>
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                  <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "30%" }} />
                  <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "50%" }} />
                </div>
              ))}
            </div>
          </div>

          <div className="cg-um-section-card" style={{ minHeight: "18rem" }}>
            <div className="cg-um-section-card-header">
              <div className="cg-um-skeleton" style={{ height: "1rem", width: "40%" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "1rem" }}>
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                  <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "35%" }} />
                  <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "45%" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
