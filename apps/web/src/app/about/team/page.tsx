import Link from "next/link";
import type { Metadata } from "next";
import { Filter, GraduationCap, Heart, Puzzle, RotateCcw, Search, Sprout, Users } from "lucide-react";
import { HealthcarePublicChrome } from "../../../shared/healthcare-public-chrome";
import { AboutCtaBanner } from "../../../features/cms-public-content/cms-about-page";
import {
  publishedCmsNavigation,
  publishedCmsPage,
  selectPublicIntro,
} from "../../../features/cms-public-content/cms-public-source";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Leadership Directory | CareGanga Foundation",
  robots: { index: false, follow: true },
};

type Person = { name: string; designation: string };

const badgeMeta = (label: string, idx: number) => {
  const lower = label.toLowerCase();
  if (lower.includes("people")) return { Icon: Sprout, cls: "is-green" };
  if (lower.includes("health")) return { Icon: Heart, cls: "is-blue" };
  if (lower.includes("educat")) return { Icon: GraduationCap, cls: "is-amber" };
  if (lower.includes("society") || lower.includes("better")) return { Icon: Users, cls: "is-purple" };
  const fallbacks = [
    { Icon: Sprout, cls: "is-green" },
    { Icon: Heart, cls: "is-blue" },
    { Icon: GraduationCap, cls: "is-amber" },
    { Icon: Users, cls: "is-purple" },
  ];
  return fallbacks[idx % fallbacks.length];
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; designation?: string }>;
}) {
  const params = await searchParams;
  const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 120) : "");
  const name = clean(params.name);
  const designation = clean(params.designation);
  const [aboutRes, homeRes, navigation] = await Promise.all([
    publishedCmsPage("about"),
    publishedCmsPage("home"),
    publishedCmsNavigation(),
  ]);
  const results = [aboutRes, homeRes];
  const intro = selectPublicIntro(aboutRes, "TEAM");
  const people: Person[] = [];
  for (const result of results) {
    if (result.state === "PUBLISHED") {
      for (const section of result.page.sections) {
        if (section.kind === "TEAM" && Array.isArray(section.fields.members)) {
          for (const p of section.fields.members) {
            if (
              !p ||
              p.consentConfirmed !== true ||
              typeof p.name !== "string" ||
              typeof p.designation !== "string" ||
              !p.name.trim() ||
              !p.designation.trim()
            ) {
              continue;
            }
            const person = { name: p.name.trim(), designation: p.designation.trim() };
            if (!people.some((x) => x.name === person.name && x.designation === person.designation)) {
              people.push(person);
            }
          }
        }
      }
    }
  }

  const options = [...new Set(people.map((p) => p.designation))].sort();
  const incomplete = results.some((r) => r.state === "UNAVAILABLE");
  const filtered = people.filter(
    (p) =>
      (!name || p.name.toLocaleLowerCase().includes(name.toLocaleLowerCase())) &&
      (!designation || p.designation === designation)
  );

  const aboutAssets = aboutRes.state === "PUBLISHED" ? aboutRes.page.assets ?? [] : [];
  const heroAsset =
    aboutAssets.find((a) => a.role === "HERO") || aboutAssets.find((a) => a.role === "ABOUT");
  const aboutCta =
    aboutRes.state === "PUBLISHED"
      ? aboutRes.page.sections.find((s) => s.kind === "CTA")
      : undefined;

  const heading = intro?.heading ?? "Leadership Directory";
  const highlights = intro?.highlights?.length
    ? intro.highlights
    : ["People", "Health", "Education", "Better Society"];

  return (
    <HealthcarePublicChrome>
      <main id="main-content" className="cg-about-root cg-team-page">
        {/* Hero */}
        <section className="cg-team-hero-wrap" aria-label="Leadership Directory">
          <div className="cg-team-hero-grid">
            <div className="cg-team-hero-left">
              <h1>
                Leadership <span>Directory</span>
              </h1>
              <p>{intro?.eyebrow ? `${intro.eyebrow} — ` : ""}Find your team by name and designation.</p>
              <div className="cg-team-badges">
                {highlights.map((item, idx) => {
                  const { Icon, cls } = badgeMeta(item, idx);
                  return (
                    <div key={item} className="cg-team-badge-item">
                      <span className={"cg-team-badge-circle " + cls} aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <span>{item}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {heroAsset && (
              <div className="cg-team-hero-right">
                <img src={heroAsset.src} alt={heroAsset.altText} />
                <div className="cg-team-hero-fade" aria-hidden="true" />
              </div>
            )}
          </div>
        </section>

        {/* Directory Search */}
        <section className="cg-about-section cg-team-dir-section" aria-label="Search published team profiles">
          <div className="cg-about-section-head">
            <h2>
              Team <span>Directory</span>
            </h2>
            <span className="cg-about-heading-bar" aria-hidden="true" />
            <p>Only independently published, currently consented public names and designations are displayed.</p>
          </div>

          <div className="cg-team-filter-card">
            <div className="cg-team-filter-pill">
              <Filter size={14} aria-hidden="true" /> Search Team Members
            </div>
            <form method="get" action="/about/team" className="cg-team-filter-form">
              <label className="cg-team-search-input-wrap">
                <Search size={16} aria-hidden="true" />
                <input
                  name="name"
                  maxLength={120}
                  defaultValue={name}
                  placeholder="Search by name"
                  aria-label="Search by name"
                />
              </label>
              <label className="cg-team-select-wrap">
                <span>Designation</span>
                <select name="designation" defaultValue={designation}>
                  <option value="">All Designations</option>
                  {designation && !options.includes(designation) && (
                    <option value={designation}>Requested designation (not available)</option>
                  )}
                  {options.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <div className="cg-team-filter-actions">
                <button type="submit" className="cg-team-btn-primary">
                  <Search size={15} aria-hidden="true" /> Search
                </button>
                <Link href="/about/team" className="cg-team-btn-reset">
                  <RotateCcw size={15} aria-hidden="true" /> Reset
                </Link>
              </div>
            </form>
          </div>

          {incomplete && (
            <p role="status" className="cg-team-notice">
              Some approved team information could not be verified. Only currently available approved profiles are shown.
            </p>
          )}

          {!filtered.length ? (
            <div className="cg-team-empty-box" role="status">
              <Search size={28} aria-hidden="true" />
              <strong>
                {incomplete
                  ? "No current matching profiles could be confirmed"
                  : name || designation
                  ? "No matching profiles"
                  : "No public profiles published yet"}
              </strong>
              <p>
                {incomplete
                  ? "Try again later before relying on the directory."
                  : name || designation
                  ? "Try another name or designation."
                  : "Consented team profiles will appear here once published from HR & CMS."}
              </p>
              {(name || designation) && (
                <Link href="/about/team" className="cg-team-btn-reset">
                  Clear filters
                </Link>
              )}
            </div>
          ) : (
            <div className="cg-site-team-grid">
              {filtered.map((p, i) => (
                <article key={i} className="cg-site-person">
                  <h3>{p.name}</h3>
                  <strong>{p.designation}</strong>
                </article>
              ))}
            </div>
          )}

          <p className="cg-team-approved-note">
            Only approved and published profiles are shown.
          </p>

          {/* Why We Work Together */}
          <div className="cg-team-together-card">
            <span className="cg-team-together-icon" aria-hidden="true">
              <Users size={22} />
            </span>
            <div>
              <h3>Why We Work Together</h3>
              <p>
                {intro?.body ||
                  "We believe that teamwork, trust, and transparency are the foundation of real change. Together, we create a stronger, better tomorrow."}
              </p>
            </div>
            <span className="cg-team-together-puzzle" aria-hidden="true">
              <Puzzle size={22} />
            </span>
          </div>
        </section>

        <AboutCtaBanner cta={aboutCta} navigation={navigation} />
      </main>
    </HealthcarePublicChrome>
  );
}
