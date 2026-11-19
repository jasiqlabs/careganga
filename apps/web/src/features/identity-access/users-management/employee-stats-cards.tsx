"use client";

import {
  UsersIcon,
  UserCheckIcon,
  ClipboardListIcon,
  HourglassIcon,
  UserXIcon,
  TrendingUpIcon
} from "./users-management-icons";
import { EmployeeStatsCardsSkeleton } from "./users-management-skeletons";

interface EmployeeStatsCardsProps {
  summary?: {
    total: number;
    active: number;
    suspended: number;
    deactivated: number;
    assigned: number;
  };
  loading?: boolean;
}

export function EmployeeStatsCards({ summary, loading = false }: EmployeeStatsCardsProps) {
  if (loading && !summary) {
    return <EmployeeStatsCardsSkeleton />;
  }

  const cards = [
    {
      id: "total",
      label: "Total Employees",
      value: summary?.total ?? 0,
      icon: UsersIcon,
      bg: "#EFF6FF",
      iconColor: "#2563EB",
      trend: "↑ 25% vs last mo.",
      trendColor: "#16A34A"
    },
    {
      id: "active",
      label: "Active Employees",
      value: summary?.active ?? 0,
      icon: UserCheckIcon,
      bg: "#ECFDF5",
      iconColor: "#059669",
      trend: "↑ 25% vs last mo.",
      trendColor: "#16A34A"
    },
    {
      id: "probation",
      label: "On Probation",
      value: 0,
      icon: ClipboardListIcon,
      bg: "#FFFBEB",
      iconColor: "#D97706",
      trend: "0% vs last mo.",
      trendColor: "#64748B"
    },
    {
      id: "suspended",
      label: "On Hold",
      value: summary?.suspended ?? 0,
      icon: HourglassIcon,
      bg: "#F5F3FF",
      iconColor: "#7C3AED",
      trend: "0% vs last mo.",
      trendColor: "#64748B"
    },
    {
      id: "inactive",
      label: "Resigned / Inactive",
      value: summary?.deactivated ?? 0,
      icon: UserXIcon,
      bg: "#FFF1F2",
      iconColor: "#E11D48",
      trend: "0% vs last mo.",
      trendColor: "#64748B"
    },
    {
      id: "new-month",
      label: "New This Month",
      value: summary?.assigned ?? 0,
      icon: TrendingUpIcon,
      bg: "#ECFEFF",
      iconColor: "#0891B2",
      trend: "↑ 75% vs last mo.",
      trendColor: "#16A34A"
    }
  ];

  return (
    <section className="cg-um-stats-grid" aria-label="Employee Statistics Overview">
      {cards.map(card => {
        const IconComponent = card.icon;
        return (
          <div key={card.id} className="cg-um-stat-card">
            <div
              className="cg-um-stat-icon-wrap"
              style={{ backgroundColor: card.bg, color: card.iconColor }}
              aria-hidden="true"
            >
              <IconComponent size={20} />
            </div>
            <div className="cg-um-stat-body">
              <span className="cg-um-stat-label">{card.label}</span>
              <div className="cg-um-stat-value-row">
                <span className="cg-um-stat-number">
                  {loading ? "…" : card.value}
                </span>
              </div>
              <div
                className="cg-um-stat-trend"
                style={{ color: card.trendColor }}
              >
                <span>{card.trend}</span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
