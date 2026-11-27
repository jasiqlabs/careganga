"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, Clock, Search, X, ArrowRight } from "lucide-react";
import type { CmsPublicNotice, PublicIntro } from "./cms-public-source";

const plain = (s: string) => s.toLocaleLowerCase();
const types = ["All", "General", "Announcements", "Events", "Updates", "Emergency", "Policy"];

/** Public-safe, already independently approved CG19 notice read projection.
 * No staff notices or recipient lists and no copy of CG19 mutable state.
 */
export function CmsPublicNoticeBoard({
  notices,
  available,
  intro,
}: {
  notices: CmsPublicNotice[];
  available: boolean;
  intro?: PublicIntro | null;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [priority, setPriority] = useState("ALL");
  const [activeNotice, setActiveNotice] = useState<CmsPublicNotice | null>(null);

  useEffect(() => {
    if (!activeNotice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveNotice(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeNotice]);

  const approved = available ? notices : [];
  const categories = useMemo(
    () =>
      Array.from(new Set(approved.map((n) => n.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [notices, available]
  );
  const chipCategories = types.slice(1).filter((v) => categories.includes(v));
  const other = categories.filter((v) => !types.includes(v));
  const matches = approved.filter(
    (n) =>
      (category === "All" || n.category === category) &&
      (priority === "ALL" || n.priority === priority) &&
      (!search.trim() ||
        [n.title, n.body, n.category].some((v) => plain(v).includes(plain(search.trim()))))
  );
  const reset = () => {
    setCategory("All");
    setPriority("ALL");
    setSearch("");
  };

  return (
    <section className="cg-site-content cg-site-notices" aria-labelledby="notices-title">
      <div className="cg-site-notice-hero">
        <span className="cg-site-notice-pill">
          <Bell size={13} /> {intro?.eyebrow || "CareGanga Foundation Public Bulletins"}
        </span>
        <h1 id="notices-title">{intro?.heading ?? "Notice & Announcement Board"}</h1>
        <p>
          {intro?.body ||
            "Stay updated with official announcements, upcoming CareGanga Foundation events, community drives, and policy notices."}
        </p>
      </div>

      <div className="cg-site-notice-discovery">
        <div className="cg-site-notice-search-row">
          <div className="cg-site-notice-search-wrap">
            <Search size={16} className="cg-site-notice-search-icon" aria-hidden="true" />
            <input
              type="search"
              value={search}
              maxLength={80}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notices by keyword..."
              aria-label="Search notices by keyword"
            />
          </div>
          <label className="cg-site-notice-priority-wrap">
            <span>Priority:</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="ALL">All Priorities</option>
              <option value="IMPORTANT">Important / Urgent</option>
              <option value="NORMAL">Normal</option>
            </select>
          </label>
        </div>

        <div className="cg-site-notice-chips" role="group" aria-label="Notice categories">
          <button
            type="button"
            aria-pressed={category === "All"}
            onClick={() => setCategory("All")}
          >
            All Categories
          </button>
          {[...chipCategories, ...other].map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={category === v}
              onClick={() => setCategory(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {!available ? (
        <p role="alert" className="cg-site-gallery-empty">
          Current approved notices cannot be verified. Please try again later.
        </p>
      ) : (
        <>
          <p className="cg-site-provenance" role="status" aria-live="polite">
            {matches.length} currently approved {matches.length === 1 ? "notice" : "notices"} match
          </p>
          {!matches.length ? (
            <div className="cg-site-gallery-empty">
              <h2>{approved.length ? "No matching notices" : "No notices published yet"}</h2>
              <p>
                {approved.length
                  ? "Try another category, priority or search term."
                  : "Current approved announcements will appear here."}
              </p>
              {approved.length > 0 && (
                <button type="button" className="cg-site-filter-reset" onClick={reset}>
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="cg-site-notice-list">
              {matches.map((item) => (
                <article key={item.path} className="cg-site-notice-card">
                  <div className="cg-site-notice-meta">
                    <span className="cg-site-notice-badge-priority" data-priority={item.priority}>
                      {item.priority === "IMPORTANT" ? "IMPORTANT" : "NORMAL"}
                    </span>
                    <span className="cg-site-notice-badge-cat">
                      {item.category.toUpperCase()}
                    </span>
                  </div>
                  <h2>{item.title}</h2>
                  <p className="cg-site-notice-excerpt">{item.body}</p>
                  <div className="cg-site-notice-card-footer">
                    <time dateTime={item.publishedOn}>
                      <Clock size={13} aria-hidden="true" /> {item.publishedOn}
                    </time>
                    <button
                      type="button"
                      className="cg-site-notice-link"
                      onClick={() => setActiveNotice(item)}
                    >
                      Read Details <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {activeNotice && (
        <div
          className="cg-site-notice-modal-backdrop"
          role="presentation"
          onClick={() => setActiveNotice(null)}
        >
          <div
            className="cg-site-notice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cg-site-notice-modal-top">
              <div className="cg-site-notice-meta">
                <span
                  className="cg-site-notice-badge-priority"
                  data-priority={activeNotice.priority}
                >
                  {activeNotice.priority === "IMPORTANT" ? "IMPORTANT" : "NORMAL"}
                </span>
                <span className="cg-site-notice-badge-cat">
                  {activeNotice.category.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                className="cg-site-notice-modal-x"
                aria-label="Close notice details"
                onClick={() => setActiveNotice(null)}
              >
                <X size={18} />
              </button>
            </div>
            <h2 id="notice-modal-title">{activeNotice.title}</h2>
            <p className="cg-site-notice-modal-date">
              <Clock size={13} aria-hidden="true" /> Published on {activeNotice.publishedOn}
            </p>
            <div className="cg-site-notice-modal-highlight">{activeNotice.title}</div>
            <p className="cg-site-notice-modal-body">{activeNotice.body}</p>
            <div className="cg-site-notice-modal-actions">
              <Link href={activeNotice.path} className="cg-site-notice-modal-open">
                Open Full Page <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <button
                type="button"
                className="cg-site-notice-modal-close"
                onClick={() => setActiveNotice(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
