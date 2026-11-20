import React from "react";
import type { RoleSummary } from "./roles-permissions-types";
import {
  IconUsers,
  IconKey,
  IconUserCheck,
  IconUserX,
  IconLayers,
  IconShield
} from "./roles-permissions-icons";

type Props = {
  summary: RoleSummary | null;
  loading: boolean;
};

export function RolesStatisticsCards({ summary }: Props) {
  const cards = [
    {
      title: "Total Roles",
      value: summary?.totalRoles ?? "—",
      desc: "Across the organisation",
      icon: <IconUsers size={20} />,
      colorClass: "blue"
    },
    {
      title: "Current Permission Actions",
      value: summary?.implementedActions ?? "—",
      desc: "Assignable permission actions",
      icon: <IconKey size={20} />,
      colorClass: "emerald"
    },
    {
      title: "Active Roles",
      value: summary?.activeRoles ?? "—",
      desc: "Currently active",
      icon: <IconUserCheck size={20} />,
      colorClass: "green"
    },
    {
      title: "Inactive Roles",
      value: summary?.inactiveRoles ?? "—",
      desc: "Currently disabled",
      icon: <IconUserX size={20} />,
      colorClass: "red"
    },
    {
      title: "Custom Roles",
      value: summary?.customRoles ?? "—",
      desc: "Created by your team",
      icon: <IconLayers size={20} />,
      colorClass: "pink"
    },
    {
      title: "System Roles",
      value: summary?.systemRoles ?? "—",
      desc: "Built-in roles",
      icon: <IconShield size={20} />,
      colorClass: "violet"
    }
  ];

  return (
    <section aria-label="Foundation role statistics" className="cg-rp-stats-grid">
      {cards.map((card) => (
        <div className="cg-rp-stat-card" key={card.title}>
          <div className={`cg-rp-stat-icon-wrap ${card.colorClass}`} aria-hidden="true">
            {card.icon}
          </div>
          <div className="cg-rp-stat-content">
            <span className="cg-rp-stat-title">{card.title}</span>
            <span className="cg-rp-stat-value">{card.value}</span>
            <span className="cg-rp-stat-desc">{card.desc}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
