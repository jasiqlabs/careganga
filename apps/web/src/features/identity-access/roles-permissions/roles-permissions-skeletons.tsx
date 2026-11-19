import React from "react";

export function RolesStatisticsCardsSkeleton() {
  return (
    <section aria-label="Loading statistics" className="cg-rp-stats-grid" aria-busy="true">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div className="cg-rp-stat-card" key={idx} style={{ pointerEvents: "none" }}>
          <div className="cg-rp-stat-icon-wrap cg-rp-skeleton" style={{ width: "2.1rem", height: "2.1rem" }} />
          <div className="cg-rp-stat-content" style={{ width: "100%", gap: "0.35rem" }}>
            <div className="cg-rp-skeleton" style={{ height: "0.7rem", width: "65%" }} />
            <div className="cg-rp-skeleton" style={{ height: "1.25rem", width: "40%", margin: "0.15rem 0" }} />
            <div className="cg-rp-skeleton" style={{ height: "0.6rem", width: "80%" }} />
          </div>
        </div>
      ))}
    </section>
  );
}

export function RolesSearchFilterPanelSkeleton() {
  return (
    <section aria-label="Loading search filters" className="cg-rp-filter-card" aria-busy="true">
      <div className="cg-rp-filter-title-row">
        <div className="cg-rp-skeleton" style={{ width: "1.1rem", height: "1.1rem" }} />
        <div className="cg-rp-skeleton" style={{ width: "7rem", height: "0.9rem" }} />
      </div>

      <div className="cg-rp-filter-grid">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div className="cg-rp-field-group" key={idx}>
            <div className="cg-rp-skeleton" style={{ width: "5rem", height: "0.75rem", marginBottom: "0.35rem" }} />
            <div className="cg-rp-skeleton" style={{ width: "100%", height: "2.1rem", borderRadius: "0.375rem" }} />
          </div>
        ))}
      </div>

      <div className="cg-rp-filter-actions-row">
        <div className="cg-rp-filter-actions-left" style={{ gap: "0.5rem" }}>
          <div className="cg-rp-skeleton" style={{ width: "5.5rem", height: "2rem" }} />
          <div className="cg-rp-skeleton" style={{ width: "5rem", height: "2rem" }} />
          <div className="cg-rp-skeleton" style={{ width: "10rem", height: "2rem" }} />
        </div>
        <div className="cg-rp-filter-actions-right" style={{ gap: "0.5rem" }}>
          <div className="cg-rp-skeleton" style={{ width: "6.5rem", height: "2.1rem" }} />
          <div className="cg-rp-skeleton" style={{ width: "6.5rem", height: "2.1rem" }} />
          <div className="cg-rp-skeleton" style={{ width: "5rem", height: "2.1rem" }} />
          <div className="cg-rp-skeleton" style={{ width: "4.5rem", height: "2.1rem" }} />
        </div>
      </div>
    </section>
  );
}

export function RolesListPanelSkeleton() {
  return (
    <section aria-label="Loading roles" className="cg-rp-panel" aria-busy="true">
      <header className="cg-rp-panel-header">
        <div className="cg-rp-skeleton" style={{ width: "6rem", height: "1rem" }} />
        <div className="cg-rp-skeleton" style={{ width: "7rem", height: "0.75rem" }} />
      </header>

      <div className="cg-rp-roles-list" style={{ padding: "0.45rem" }}>
        {Array.from({ length: 7 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.55rem 0.65rem",
              borderRadius: "0.5rem",
              borderBottom: "1px solid #F8FAFC"
            }}
          >
            <div className="cg-rp-skeleton" style={{ width: "2rem", height: "2rem", borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <div className="cg-rp-skeleton" style={{ width: "60%", height: "0.85rem" }} />
              <div className="cg-rp-skeleton" style={{ width: "40%", height: "0.65rem" }} />
            </div>
            <div className="cg-rp-skeleton" style={{ width: "3.5rem", height: "1.2rem", borderRadius: "9999px" }} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function PermissionManagerPanelSkeleton() {
  return (
    <section aria-label="Loading permission manager" className="cg-rp-panel" aria-busy="true">
      <header className="cg-rp-panel-header">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <div className="cg-rp-skeleton" style={{ width: "9rem", height: "1.05rem" }} />
          <div className="cg-rp-skeleton" style={{ width: "14rem", height: "0.75rem" }} />
        </div>
        <div className="cg-rp-skeleton" style={{ width: "4.5rem", height: "1.5rem", borderRadius: "9999px" }} />
      </header>

      <div className="cg-rp-tabs-row" style={{ gap: "0.75rem" }}>
        <div className="cg-rp-skeleton" style={{ width: "8.5rem", height: "1.8rem", margin: "0.4rem 0" }} />
        <div className="cg-rp-skeleton" style={{ width: "8.5rem", height: "1.8rem", margin: "0.4rem 0" }} />
        <div className="cg-rp-skeleton" style={{ width: "7.5rem", height: "1.8rem", margin: "0.4rem 0" }} />
      </div>

      <div className="cg-rp-tab-content">
        <div className="cg-rp-skeleton" style={{ height: "3.2rem", width: "100%", borderRadius: "0.5rem" }} />
        <div className="cg-rp-skeleton" style={{ height: "3.6rem", width: "100%", borderRadius: "0.5rem" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0.25rem 0" }}>
          <div className="cg-rp-skeleton" style={{ width: "6rem", height: "1.8rem" }} />
          <div className="cg-rp-skeleton" style={{ width: "8rem", height: "1rem" }} />
        </div>

        <div className="cg-rp-skeleton" style={{ height: "16rem", width: "100%", borderRadius: "0.5rem" }} />
      </div>
    </section>
  );
}

export function RoleDetailsPanelSkeleton() {
  return (
    <section aria-label="Loading role details" className="cg-rp-panel" aria-busy="true">
      <header className="cg-rp-panel-header">
        <div className="cg-rp-skeleton" style={{ width: "6rem", height: "1rem" }} />
      </header>

      <div className="cg-rp-role-details-content">
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", paddingBottom: "0.65rem", borderBottom: "1px solid #E2E8F0" }}>
          <div className="cg-rp-skeleton" style={{ width: "2.75rem", height: "2.75rem", borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <div className="cg-rp-skeleton" style={{ width: "70%", height: "1rem" }} />
            <div className="cg-rp-skeleton" style={{ width: "40%", height: "0.75rem" }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
              <div className="cg-rp-skeleton" style={{ width: "5rem", height: "0.8rem" }} />
              <div className="cg-rp-skeleton" style={{ width: "3.5rem", height: "0.8rem" }} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.5rem" }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="cg-rp-skeleton" style={{ width: "100%", height: "2.1rem", borderRadius: "0.45rem" }} />
          ))}
        </div>
      </div>
    </section>
  );
}
