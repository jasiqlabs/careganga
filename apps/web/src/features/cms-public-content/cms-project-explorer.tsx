"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CalendarClock,
  FolderKanban,
  GraduationCap,
  HandHeart,
  Heart,
  HeartPulse,
  Home,
  Layers,
  LayoutGrid,
  MapPin,
  Search,
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
  projects,
  initialCategory,
  joinHref,
  donateHref,
  isDonatePublished,
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
  donateHref?: string;
  isDonatePublished?: boolean;
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

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set("All Projects", projects.length);
    for (const p of projects) {
      const key = p.category.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [projects]);

  const resolveCategory = (raw?: string) => {
    if (!raw || !raw.trim()) return "All Projects";
    const norm = raw.trim().toLowerCase();
    return dynamicCategories.find((c) => c.toLowerCase() === norm) ?? "All Projects";
  };

  const [selectedCategory, setSelectedCategory] = useState<string>(() =>
    resolveCategory(initialCategory)
  );
  const [searchQuery, setSearchQuery] = useState("");
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
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const catOk =
        selectedCategory === "All Projects" ||
        p.category.trim().toLowerCase() === selectedCategory.toLowerCase();
      if (!catOk) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q)
      );
    });
  }, [projects, selectedCategory, searchQuery]);

  const activeCount = useMemo(
    () => projects.filter((p) => p.status === "ACTIVE").length,
    [projects]
  );
  const plannedCount = useMemo(
    () => projects.filter((p) => p.status === "PLANNED").length,
    [projects]
  );
  const uniqueAreasCount = useMemo(
    () => new Set(projects.map((p) => p.area.trim().toLowerCase()).filter(Boolean)).size,
    [projects]
  );

  const headingWords = pageTitle.trim().split(/\s+/);
  const titleLead = headingWords.length > 1 ? headingWords.slice(0, -1).join(" ") : pageTitle;
  const titleAccent = headingWords.length > 1 ? headingWords[headingWords.length - 1] : "";

  const sectionHeading =
    selectedCategory === "All Projects"
      ? teaserHeading || (slug === "upcoming-projects" ? "Planned Projects" : "Our Projects")
      : selectedCategory;

  const supportHref = donateHref || "/contact";
  const supportLabel = isDonatePublished ? "Support" : "Enquire";

  return (
    <div className="cg-work-v2-root">
      {/* A. Deep Slate Hero Section */}
      <section className="cg-work-v2-hero" aria-label={pageTitle}>
        <div className="cg-work-v2-hero-inner">
          <span className="cg-work-v2-pill">
            <Sprout size={14} aria-hidden="true" />
            {slug === "upcoming-projects" ? "UPCOMING FIELD INITIATIVES" : "CMS GROUND INITIATIVES"}
          </span>
          <h1>
            {titleLead} {titleAccent && <span>{titleAccent}</span>}
          </h1>
          <p className="cg-work-v2-lead">
            {pageIntro ||
              "Explore approved CareGanga Foundation initiatives across education, healthcare, livelihood, and community welfare along the Ganga riverbanks."}
          </p>

          <div className="cg-work-v2-search-wrap">
            <Search size={18} aria-hidden="true" className="cg-work-v2-search-icon" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search initiatives by title, location, or category..."
              aria-label="Search projects"
            />
            {searchQuery && (
              <button
                type="button"
                className="cg-work-v2-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <svg
          className="cg-work-v2-wave"
          viewBox="0 0 1440 72"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,24 Q720,86 1440,24 L1440,72 L0,72 Z" fill="#FAF7EE" />
        </svg>
      </section>

      {/* B. Floating Dynamic Stat Cards (100% derived from CMS projects) */}
      <section className="cg-work-v2-stats-wrap" aria-label="Published project summary">
        <div className="cg-work-v2-stats-grid">
          <article className="cg-work-v2-stat-card">
            <span className="cg-work-v2-stat-icon is-green" aria-hidden="true">
              <FolderKanban size={20} />
            </span>
            <div>
              <strong>{projects.length} Approved Initiatives</strong>
              <p>
                {activeCount} Active · {plannedCount} Planned in CMS
              </p>
            </div>
          </article>
          <article className="cg-work-v2-stat-card">
            <span className="cg-work-v2-stat-icon is-teal" aria-hidden="true">
              <Layers size={20} />
            </span>
            <div>
              <strong>{Math.max(0, dynamicCategories.length - 1)} Focus Categories</strong>
              <p>Dynamically grouped from published Foundation projects</p>
            </div>
          </article>
          <article className="cg-work-v2-stat-card">
            <span className="cg-work-v2-stat-icon is-amber" aria-hidden="true">
              <MapPin size={20} />
            </span>
            <div>
              <strong>{uniqueAreasCount} Regions Covered</strong>
              <p>Verified field locations across riverbank communities</p>
            </div>
          </article>
        </div>
      </section>

      {/* C. Sticky Horizontal Category Filter Bar */}
      <section className="cg-work-v2-filter-sticky" aria-label="Filter projects by category">
        <div className="cg-work-v2-filter-inner" role="tablist">
          {dynamicCategories.map((cat) => {
            const Icon = categoryIcon(cat);
            const isSelected = selectedCategory === cat;
            const count =
              cat === "All Projects"
                ? projects.length
                : categoryCounts.get(cat.toLowerCase()) ?? 0;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={isSelected ? "cg-work-v2-cat-pill is-active" : "cg-work-v2-cat-pill"}
                onClick={() => handleSelectCategory(cat)}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{cat}</span>
                <span className="cg-work-v2-cat-count">{count}</span>
              </button>
            );
          })}
          <Link
            href={slug === "upcoming-projects" ? "/our-work" : "/upcoming-projects"}
            className="cg-work-v2-cat-pill is-cross"
          >
            <CalendarClock size={15} aria-hidden="true" />
            <span>{slug === "upcoming-projects" ? "All Approved Projects" : "Upcoming Projects"}</span>
          </Link>
        </div>
      </section>

      {/* D. Dynamic 3-Column Projects Grid */}
      <section id="cg-work-explorer" className="cg-work-v2-main">
        <div className="cg-work-v2-main-head">
          <div>
            <p className="cg-work-v2-main-eyebrow">VERIFIED PROJECTS</p>
            <h2>{sectionHeading}</h2>
          </div>
          <span className="cg-work-v2-result-pill">
            Showing {filtered.length} of {projects.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="cg-work-v2-empty" role="status">
            <FolderKanban size={32} aria-hidden="true" />
            <h3>
              {searchQuery
                ? `No projects matching "${searchQuery}"`
                : selectedCategory !== "All Projects"
                ? `No projects in "${selectedCategory}"`
                : "No projects to display yet"}
            </h3>
            <p>
              {searchQuery || selectedCategory !== "All Projects"
                ? "Try clearing your search or selecting another category."
                : "Published project updates will appear here once approved."}
            </p>
            {(searchQuery || selectedCategory !== "All Projects") && (
              <button
                type="button"
                className="cg-work-v2-btn-primary"
                onClick={() => {
                  setSearchQuery("");
                  handleSelectCategory("All Projects");
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="cg-work-v2-grid">
            {filtered.map((project) => (
              <article key={project.slug} className="cg-work-v2-card">
                <div className="cg-work-v2-card-media">
                  {project.coverSrc ? (
                    <img src={project.coverSrc} alt={project.title} loading="lazy" />
                  ) : (
                    <div className="cg-work-v2-card-placeholder" aria-hidden="true">
                      <Sprout size={34} />
                    </div>
                  )}
                  <span className="cg-work-v2-badge-cat">{project.category}</span>
                  <span
                    className={
                      project.status === "PLANNED"
                        ? "cg-work-v2-badge-status is-planned"
                        : "cg-work-v2-badge-status is-active"
                    }
                  >
                    <span className="cg-work-v2-pulse-dot" aria-hidden="true" />
                    {project.status === "PLANNED" ? "Upcoming" : "Active"}
                  </span>
                </div>

                <div className="cg-work-v2-card-body">
                  <p className="cg-work-v2-card-loc">
                    <MapPin size={14} aria-hidden="true" /> {project.area}
                  </p>
                  <h3>{project.title}</h3>
                  <p className="cg-work-v2-card-summary">{project.summary}</p>
                  <p className="cg-work-v2-card-time">
                    <Calendar size={13} aria-hidden="true" />{" "}
                    {project.launch ? `Planned start: ${project.launch}` : "Ongoing initiative"}
                  </p>

                  <div className="cg-work-v2-card-actions">
                    <button
                      type="button"
                      className="cg-work-v2-btn-outline"
                      onClick={() => setActiveProject(project)}
                    >
                      Read Story <ArrowRight size={14} aria-hidden="true" />
                    </button>
                    <Link href={supportHref} className="cg-work-v2-btn-orange">
                      <Heart size={14} aria-hidden="true" /> {supportLabel}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Bottom Mission Strip */}
        <div className="cg-work-v2-mission-strip">
          <div>
            <h3>Be a Part of Our Mission</h3>
            <p>Collaborate, volunteer, or support approved community initiatives along the Ganga.</p>
          </div>
          <Link href={joinHref || "/contact"} className="cg-work-v2-btn-primary">
            Join Us <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* E. Accessible Project Detail Modal */}
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
                <span className="cg-work-v2-badge-cat is-static">{activeProject.category}</span>
                <span
                  className={
                    activeProject.status === "PLANNED"
                      ? "cg-work-v2-badge-status is-planned is-static"
                      : "cg-work-v2-badge-status is-active is-static"
                  }
                >
                  <span className="cg-work-v2-pulse-dot" aria-hidden="true" />
                  {activeProject.status === "PLANNED" ? "Upcoming" : "Active"}
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
              <Link href={supportHref} className="cg-work-v2-btn-orange">
                <Heart size={15} aria-hidden="true" /> {isDonatePublished ? "Donate Now" : "Support or Enquire"}
              </Link>
              <button
                type="button"
                className="cg-work-v2-btn-outline"
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
