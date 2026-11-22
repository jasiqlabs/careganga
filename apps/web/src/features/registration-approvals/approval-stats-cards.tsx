"use client";

import React from "react";
import {
  IconLayers,
  IconHourglass,
  IconRefresh,
  IconCheckCircle,
  IconXCircle
} from "./registration-approvals-icons";
import type { ApprovalStats } from "./registration-approvals-types";

interface ApprovalStatsCardsProps {
  stats: ApprovalStats;
  selectedStatusFilter: string;
  onSelectStatus: (status: string) => void;
}

export function ApprovalStatsCards({
  stats,
  selectedStatusFilter,
  onSelectStatus
}: ApprovalStatsCardsProps) {
  const cards = [
    {
      id: "TOTAL",
      label: "Total",
      count: stats.total,
      filterValue: "all",
      iconWrapClass: "blue",
      shadowClass: "shadow-blue",
      icon: <IconLayers size={22} />
    },
    {
      id: "AWAITING",
      label: "Awaiting",
      count: stats.awaitingReview,
      filterValue: "SUBMITTED",
      iconWrapClass: "amber",
      shadowClass: "shadow-amber",
      icon: <IconHourglass size={22} />
    },
    {
      id: "IN_REVIEW",
      label: "In Review",
      count: stats.inReview,
      filterValue: "IN_REVIEW",
      iconWrapClass: "blue-soft",
      shadowClass: "shadow-blue",
      icon: <IconRefresh size={22} />
    },
    {
      id: "APPROVED",
      label: "Approved",
      count: stats.approved,
      filterValue: "FINAL_APPROVED",
      iconWrapClass: "green",
      shadowClass: "shadow-green",
      icon: <IconCheckCircle size={22} />
    },
    {
      id: "REJECTED",
      label: "Rejected",
      count: stats.rejected,
      filterValue: "REJECTED",
      iconWrapClass: "red",
      shadowClass: "shadow-red",
      icon: <IconXCircle size={22} />
    }
  ];

  return (
    <section aria-label="Application Summary Statistics" className="cg-ra-stats-grid">
      {cards.map((card) => {
        const isActive =
          (card.filterValue === "all" && selectedStatusFilter === "all") ||
          (card.filterValue !== "all" && selectedStatusFilter === card.filterValue);

        return (
          <button
            type="button"
            key={card.id}
            className={`cg-ra-stat-card ${card.shadowClass} ${isActive ? "active" : ""}`}
            onClick={() => onSelectStatus(card.filterValue)}
            aria-pressed={isActive}
          >
            <div className={`cg-ra-stat-icon-wrap ${card.iconWrapClass}`}>
              {card.icon}
            </div>
            <div className="cg-ra-stat-content">
              <span className="cg-ra-stat-label">{card.label}</span>
              <strong className="cg-ra-stat-value">{card.count}</strong>
            </div>
          </button>
        );
      })}
    </section>
  );
}
