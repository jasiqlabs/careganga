"use client";

import React from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight
} from "./registration-approvals-icons";

interface ApprovalPaginationProps {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function ApprovalPagination({
  currentPage,
  pageSize,
  totalRecords,
  onPageChange,
  onPageSizeChange
}: ApprovalPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const fromRecord = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toRecord = Math.min(totalRecords, currentPage * pageSize);

  // Generate compact page range
  const pageNumbers: number[] = [];
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = startPage + maxButtons - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="cg-ra-pagination-bar">
      {/* Left: Showing range */}
      <div className="cg-ra-pagination-info">
        Showing <strong>{fromRecord}</strong> – <strong>{toRecord}</strong> of{" "}
        <strong>{totalRecords}</strong>
      </div>

      {/* Center: Page Controls */}
      <div className="cg-ra-pagination-controls">
        <button
          type="button"
          className="cg-ra-page-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          title="First page"
        >
          <IconChevronsLeft size={16} />
        </button>

        <button
          type="button"
          className="cg-ra-page-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          title="Previous page"
        >
          <IconChevronLeft size={16} />
        </button>

        {/* Mobile-only compact page indicator */}
        <span className="cg-ra-pagination-mobile-indicator">
          Page {currentPage} of {totalPages}
        </span>

        {/* Desktop-only full numbered buttons */}
        <div className="cg-ra-page-numbers-group">
          {startPage > 1 && (
            <>
              <button
                type="button"
                className={`cg-ra-page-btn ${currentPage === 1 ? "active" : ""}`}
                onClick={() => onPageChange(1)}
              >
                1
              </button>
              {startPage > 2 && <span className="cg-ra-page-ellipsis">…</span>}
            </>
          )}

          {pageNumbers.map((page) => (
            <button
              type="button"
              key={page}
              className={`cg-ra-page-btn ${currentPage === page ? "active" : ""}`}
              onClick={() => onPageChange(page)}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="cg-ra-page-ellipsis">…</span>}
              <button
                type="button"
                className={`cg-ra-page-btn ${currentPage === totalPages ? "active" : ""}`}
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="cg-ra-page-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          title="Next page"
        >
          <IconChevronRight size={16} />
        </button>

        <button
          type="button"
          className="cg-ra-page-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          title="Last page"
        >
          <IconChevronsRight size={16} />
        </button>
      </div>

      {/* Right: Page Size Selector */}
      <div className="cg-ra-pagination-size-wrap">
        <label htmlFor="cg-ra-page-size" className="sr-only">Items per page</label>
        <select
          id="cg-ra-page-size"
          className="cg-ra-page-size-select"
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
        >
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </div>
    </div>
  );
}
