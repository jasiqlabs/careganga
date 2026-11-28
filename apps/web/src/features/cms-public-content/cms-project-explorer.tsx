"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CalendarClock,
  ChevronRight,
  FolderKanban,
  GraduationCap,
  HandHeart,
  Handshake,
  HeartPulse,
  Home,
  Layers,
  LayoutGrid,
  MapPin,
  Sprout,
  X,
} from "lucide-react";

export type ExplorerProject = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  area: string;
  launch: string | null;
  status: "ACTIVE" | "PLANNED";
  coverSrc: string | null;
};

function categoryIcon(name: string) {
  const key = name.trim().toLowerCase();
  if (key === "all projects") return LayoutGrid;
  if (key.includes("education")) return GraduationCap;
  if (key.includes("health")) return HeartPulse;
  if (key.includes("livelihood")) return Briefcase;
  if (key.includes("social")) return HandHeart;
  if (key.includes("community")) return Home;
  return FolderKanban;
}

export function CmsProjectExplorer({
  slug,
  pageTitle,
  pageIntro,
  teaserHeading,
  heroImageSrc,
  heroImageAlt,
  projects,
  initialCategory,
  joinHref,
}: {
  slug: "our-work" | "upcoming-projects";
  pageTitle: string;
  pageIntro?: string;
  teaserHeading: string;
  heroImageSrc?: string | null;
  heroImageAlt?: string;
  projects: ExplorerProject[];
  initialCategory?: string;
  joinHref?: string;
}) {
  const dynamicCategories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = ["All Projects"];
    for (const p of projects) {
      const cat = p.category.trim();
      if (cat && !seen.has(cat.toLowerCase())) {
        seen.add(cat.toLowerCase());
        list.push(cat);
      }
    }
    return list;
  }, [projects]);

  const resolveCategory = (raw?: string) => {
    if (!raw || !raw.trim()) return "All Projects";
    const norm = raw.trim().toLowerCase();
    return dynamicCategories.find((c) => c.toLowerCase() === norm) ?? "All Projects";
  };

  const [selectedCategory, setSelectedCategory] = useState<string>(() =>
    resolveCategory(initialCategory)
  );
  const [activeProject, setActiveProject] = useState<ExplorerProject | null>(null);

  useEffect(() => {
    setSelectedCategory(resolveCategory(initialCategory));
  }, [initialCategory, dynamicCategories]);

  useEffect(() => {
    if (!activeProject) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveProject(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeProject]);

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (cat === "All Projects") {
        url.searchParams.delete("category");
      } else {
        url.searchParams.set("category", cat);
      }
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

  const filtered = useMemo(() => {
    if (selectedCategory === "All Projects") return projects;
    const target = selectedCategory.toLowerCase();
    return projects.filter((p) => p.category.trim().toLowerCase() === target);
  }, [projects, selectedCategory]);

  const headingText =
    selectedCategory === "All Projects"
      ? teaserHeading || (slug === "upcoming-projects" ? "Planned Projects" : "Our Projects")
      : selectedCategory;

  return (
    <div className="cg-work-page">
      {/* 1. Compact Horizontal Hero Banner matching Reference Screenshot */}
      <section className="cg-site-content cg-work-hero" aria-label={pageTitle}>
        <div className="cg-work-hero-copy">
          <div className="cg-work-eyebrow-row">
            <span className="cg-work-eyebrow">TOGETHER FOR A BETTER TOMORROW</span>
            <span className="cg-work-eyebrow-line" aria-hidden="true" />
          </div>
          <h1>{pageTitle}</h1>
          {pageIntro && <p className="cg-work-hero-lead">{pageIntro}</p>}
          <div className="cg-work-hero-actions">
            <a href="#cg-work-explorer" className="cg-work-hero-cta">
              Explore More <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="cg-work-hero-media">
          <img
            src={heroImageSrc || "/careganga-hero-community.jpg"}
            alt={heroImageAlt || pageTitle}
            className="cg-work-hero-img"
          />
          <div className="cg-work-hero-fade" aria-hidden="true" />
          <svg
            viewBox="0 0 320 220"
            preserveAspectRatio="none"
            className="cg-work-hero-curve"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="cgHeroCurveGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#84CC16" stopOpacity="0.2" />
                <stop offset="45%" stopColor="#65A30D" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#84CC16" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <path
              d="M 0 185 Q 115 215 205 95 T 320 0"
              fill="none"
              stroke="url(#cgHeroCurveGrad)"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </section>

      {/* 2. Explorer: Sidebar + Project Cards */}
      <section id="cg-work-explorer" className="cg-site-content cg-work-layout">
        <aside className="cg-work-sidebar" aria-label="Project categories">
          <div className="cg-work-sidebar-card">
            <div className="cg-work-sidebar-header">
              <Layers size={17} aria-hidden="true" />
              <h2>Project Categories</h2>
            </div>
            <div className="cg-work-cat-list" role="tablist" aria-label="Filter projects by category">
              {dynamicCategories.map((cat) => {
                const Icon = categoryIcon(cat);
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={isSelected ? "cg-work-cat-btn is-active" : "cg-work-cat-btn"}
                    onClick={() => handleSelectCategory(cat)}
                  >
                    <Icon size={16} aria-hidden="true" className="cg-work-cat-icon" />
                    <span>{cat}</span>
                    {isSelected && <ChevronRight size={15} aria-hidden="true" className="cg-work-cat-arrow" />}
                  </button>
                );
              })}
              <Link
                href={slug === "upcoming-projects" ? "/our-work" : "/upcoming-projects"}
                className="cg-work-cat-btn cg-work-cat-link"
              >
                <CalendarClock size={16} aria-hidden="true" className="cg-work-cat-icon" />
                <span>{slug === "upcoming-projects" ? "All Approved Projects" : "Upcoming Projects"}</span>
              </Link>
            </div>
          </div>

          <div className="cg-work-mission-card">
            <div className="cg-work-mission-icon" aria-hidden="true">
              <Handshake size={22} />
            </div>
            <h3>Be a Part of Our Mission</h3>
            <p>Together we can do more for a better society.</p>
            <Link href={joinHref || "/contact"} className="cg-work-mission-btn">
              Join Us <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </aside>

        <div className="cg-work-main">
          <div className="cg-work-main-head">
            <div className="cg-work-main-title">
              <span className="cg-work-title-rule" aria-hidden="true" />
              <Sprout size={18} aria-hidden="true" className="cg-work-title-icon" />
              <h2>{headingText}</h2>
              <span className="cg-work-count-pill">
                {filtered.length} {filtered.length === 1 ? "project" : "projects"}
              </span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="cg-work-empty" role="status">
              <FolderKanban size={30} aria-hidden="true" />
              <h3>
                {selectedCategory !== "All Projects"
                  ? `No projects in "${selectedCategory}"`
                  : "No projects to display yet"}
              </h3>
              <p>
                {selectedCategory !== "All Projects"
                  ? "Select another category or reset to view all approved Foundation projects."
                  : "Published project updates will appear here once approved."}
              </p>
              {selectedCategory !== "All Projects" && (
                <button
                  type="button"
                  className="cg-work-hero-cta"
                  onClick={() => handleSelectCategory("All Projects")}
                >
                  Show All Projects
                </button>
              )}
            </div>
          ) : (
            <div className="cg-work-cards">
              {filtered.map((project) => (
                <article key={project.slug} className="cg-work-card">
                  {project.coverSrc && (
                    <div className="cg-work-card-media">
                      <img
                        src={project.coverSrc}
                        alt={project.title}
                        loading="lazy"
                        className="cg-work-card-img"
                      />
                      <span
                        className={
                          project.status === "PLANNED"
                            ? "cg-work-status is-planned"
                            : "cg-work-status is-active"
                        }
                      >
                        <span className="cg-work-status-dot" aria-hidden="true" />
                        {project.status === "PLANNED" ? "Planned" : "Active"}
                      </span>
                    </div>
                  )}
                  <div className="cg-work-card-body">
                    <div className="cg-work-card-top">
                      <span className="cg-work-cat-badge">{project.category}</span>
                      {!project.coverSrc && (
                        <span
                          className={
                            project.status === "PLANNED"
                              ? "cg-work-status is-planned is-inline"
                              : "cg-work-status is-active is-inline"
                          }
                        >
                          <span className="cg-work-status-dot" aria-hidden="true" />
                          {project.status === "PLANNED" ? "Planned" : "Active"}
                        </span>
                      )}
                    </div>
                    <h3>{project.title}</h3>
                    <p className="cg-work-card-area">{project.area}</p>
                    <p className="cg-work-card-summary">{project.summary}</p>
                    <div className="cg-work-card-footer">
                      <div className="cg-work-card-meta">
                        <span>
                          <Calendar size={14} aria-hidden="true" />
                          {project.launch ? `Planned: ${project.launch}` : "Ongoing"}
                        </span>
                        <span>
                          <MapPin size={14} aria-hidden="true" />
                          {project.area}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="cg-work-detail-btn"
                        onClick={() => setActiveProject(project)}
                      >
                        View Details <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. Accessible Project Details Modal */}
      {activeProject && (
        <div
          className="cg-site-ngo-doc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cg-work-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveProject(null);
          }}
        >
          <div className="cg-work-modal">
            <div className="cg-work-modal-header">
              <div className="cg-work-modal-badges">
                <span className="cg-work-cat-badge">{activeProject.category}</span>
                <span
                  className={
                    activeProject.status === "PLANNED"
                      ? "cg-work-status is-planned is-inline"
                      : "cg-work-status is-active is-inline"
                  }
                >
                  <span className="cg-work-status-dot" aria-hidden="true" />
                  {activeProject.status === "PLANNED" ? "Planned" : "Active"}
                </span>
              </div>
              <button
                type="button"
                className="cg-site-ngo-doc-modal-x"
                aria-label="Close project details"
                onClick={() => setActiveProject(null)}
              >
                <X size={18} />
              </button>
            </div>
            {activeProject.coverSrc && (
              <div className="cg-work-modal-img-wrap">
                <img src={activeProject.coverSrc} alt={activeProject.title} />
              </div>
            )}
            <div className="cg-work-modal-body">
              <h3 id="cg-work-modal-title">{activeProject.title}</h3>
              <div className="cg-work-card-meta" style={{ marginBottom: "0.85rem" }}>
                <span>
                  <MapPin size={14} aria-hidden="true" /> {activeProject.area}
                </span>
                <span>
                  <Calendar size={14} aria-hidden="true" />{" "}
                  {activeProject.launch ? `Planned start: ${activeProject.launch}` : "Ongoing"}
                </span>
              </div>
              <p>{activeProject.summary}</p>
            </div>
            <div className="cg-work-modal-footer">
              <Link href="/contact" className="cg-work-hero-cta">
                Support or Enquire <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <button
                type="button"
                className="cg-work-detail-btn"
                onClick={() => setActiveProject(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
