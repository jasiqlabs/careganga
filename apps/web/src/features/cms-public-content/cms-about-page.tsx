import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Droplets,
  Eye,
  Globe,
  GraduationCap,
  Heart,
  HeartPulse,
  Leaf,
  ShieldCheck,
  Sprout,
  Target,
  Users,
} from "lucide-react";
import type { PublicCmsPage, PublicCmsSection } from "./cms-public-page";
import type { PublicCmsNavigation } from "./cms-public-source";
import { effectiveCmsCtaRoute } from "./cms-cta-route";

type Asset = PublicCmsPage["assets"][number];
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) =>
  Array.isArray(v) ? (v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) as string[]) : [];

function findSection(sections: PublicCmsSection[], matcher: RegExp) {
  return sections.find(
    (s) =>
      s.kind === "RICH_TEXT" &&
      !s.fields.placement &&
      (matcher.test(text(s.fields.eyebrow)) || matcher.test(text(s.fields.heading)))
  );
}

function splitAccentHeading(heading: string) {
  const idx = heading.lastIndexOf(" ");
  if (idx <= 0) return { lead: heading, accent: "" };
  return { lead: heading.slice(0, idx), accent: heading.slice(idx + 1) };
}

function parseValues(body: string, highlights: string[]) {
  const source = highlights.length > 0 ? highlights : body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return source
    .map((line) => {
      const sep = line.indexOf(":");
      if (sep > 0) {
        return { title: line.slice(0, sep).trim(), desc: line.slice(sep + 1).trim() };
      }
      return { title: line, desc: "" };
    })
    .filter((x) => x.title);
}

function parseFocusAreas(body: string, highlights: string[]) {
  if (highlights.length > 0) return highlights;
  return body
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

const focusIcon = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes("educat")) return { Icon: GraduationCap, cls: "is-green" };
  if (lower.includes("water") || lower.includes("sanit")) return { Icon: Droplets, cls: "is-blue" };
  if (lower.includes("environ") || lower.includes("green")) return { Icon: Leaf, cls: "is-mint" };
  if (lower.includes("health") || lower.includes("medic")) return { Icon: HeartPulse, cls: "is-rose" };
  return { Icon: Users, cls: "is-purple" };
};

const valueIcon = (title: string, idx: number) => {
  const lower = title.toLowerCase();
  if (lower.includes("compassion")) return { Icon: Heart, cls: "is-green" };
  if (lower.includes("sustain")) return { Icon: Leaf, cls: "is-mint" };
  if (lower.includes("integrit")) return { Icon: ShieldCheck, cls: "is-blue" };
  if (lower.includes("account")) return { Icon: Award, cls: "is-amber" };
  if (lower.includes("inclus")) return { Icon: Globe, cls: "is-purple" };
  const fallbacks = [
    { Icon: Heart, cls: "is-green" },
    { Icon: Leaf, cls: "is-mint" },
    { Icon: ShieldCheck, cls: "is-blue" },
    { Icon: Award, cls: "is-amber" },
    { Icon: Globe, cls: "is-purple" },
  ];
  return fallbacks[idx % fallbacks.length];
};

export function AboutCtaBanner({
  cta,
  navigation,
}: {
  cta?: PublicCmsSection;
  navigation?: PublicCmsNavigation | null;
}) {
  if (!cta) return null;
  const routes = navigation?.publishedRoutes ?? [];
  const isPublished = (p: string) => routes.some((r) => r.path === p);
  const canDonate = isPublished("/donate");
  const canVolunteer = navigation?.volunteerJoin?.visible === true && navigation.volunteerJoin.path === "/volunteer";
  const canMember = navigation?.memberJoin?.visible === true && navigation.memberJoin.path === "/membership";
  const primaryHref = effectiveCmsCtaRoute(cta.fields.path, navigation);
  const primaryLabel = text(cta.fields.label);

  return (
    <section className="cg-about-cta-wrap" aria-label={text(cta.fields.heading) || "Get involved"}>
      <div className="cg-about-cta-banner">
        <div className="cg-about-cta-copy">
          <span className="cg-about-cta-sprout" aria-hidden="true">
            <Sprout size={26} />
          </span>
          <div>
            <h2>{text(cta.fields.heading) || "Be a Part of the Change"}</h2>
            {text(cta.fields.body) && <p>{text(cta.fields.body)}</p>}
          </div>
        </div>
        <div className="cg-about-cta-actions">
          {canDonate && (
            <Link href="/donate" className="cg-about-cta-btn is-green">
              <Heart size={15} aria-hidden="true" /> Donate Now
            </Link>
          )}
          {canVolunteer && (
            <Link href="/volunteer" className="cg-about-cta-btn is-blue">
              <Users size={15} aria-hidden="true" /> Become Volunteer
            </Link>
          )}
          {canMember && (
            <Link href="/membership" className="cg-about-cta-btn is-white">
              <Award size={15} aria-hidden="true" /> Join Membership
            </Link>
          )}
          {primaryHref && primaryLabel && (
            <Link href={primaryHref} className="cg-about-cta-btn is-green">
              {primaryLabel} <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function MissionVisionCards({
  mission,
  vision,
}: {
  mission?: PublicCmsSection;
  vision?: PublicCmsSection;
}) {
  if (!mission && !vision) return null;
  return (
    <div id="mission-vision" className="cg-about-mv-grid">
      {mission && (
        <article className="cg-about-mv-card is-mission">
          <div className="cg-about-mv-icon-ring is-green" aria-hidden="true">
            <Target size={24} />
          </div>
          <h3>
            {text(mission.fields.heading).includes(" ") ? (
              <>
                {splitAccentHeading(text(mission.fields.heading)).lead}{" "}
                <span>{splitAccentHeading(text(mission.fields.heading)).accent}</span>
              </>
            ) : (
              text(mission.fields.heading) || "Our Mission"
            )}
          </h3>
          <span className="cg-about-mv-bar is-green" aria-hidden="true" />
          <p>{text(mission.fields.body)}</p>
          <span className="cg-about-mv-badge is-green" aria-hidden="true">
            <Leaf size={14} />
          </span>
        </article>
      )}
      {vision && (
        <article className="cg-about-mv-card is-vision">
          <div className="cg-about-mv-icon-ring is-blue" aria-hidden="true">
            <Eye size={24} />
          </div>
          <h3>
            {text(vision.fields.heading).includes(" ") ? (
              <>
                {splitAccentHeading(text(vision.fields.heading)).lead}{" "}
                <span>{splitAccentHeading(text(vision.fields.heading)).accent}</span>
              </>
            ) : (
              text(vision.fields.heading) || "Our Vision"
            )}
          </h3>
          <span className="cg-about-mv-bar is-blue" aria-hidden="true" />
          <p>{text(vision.fields.body)}</p>
          <span className="cg-about-mv-badge is-blue" aria-hidden="true">
            <Users size={14} />
          </span>
        </article>
      )}
    </div>
  );
}

export function CmsAboutView({
  page,
  navigation,
}: {
  page: PublicCmsPage;
  navigation?: PublicCmsNavigation | null;
}) {
  const sections = [...page.sections].sort((a, b) => a.order - b.order);
  const assets = page.assets ?? [];
  const hero = sections.find((s) => s.kind === "HERO" && s.fields.visible !== false);
  const heroAsset = hero ? assets.find((a) => a.role === "HERO" && a.order === hero.order) : undefined;
  const primaryRich = sections.find((s) => s.kind === "RICH_TEXT" && !s.fields.placement);
  const primaryAsset = primaryRich
    ? assets.find((a) => a.role === "ABOUT" && a.order === primaryRich.order)
    : undefined;

  const missionSec = findSection(sections, /^our mission$/i);
  const visionSec = findSection(sections, /^our vision$/i);
  const focusSec = findSection(sections, /^our focus areas$/i);
  const valuesSec = findSection(sections, /^our values$/i);
  const founderSec = findSection(sections, /founder|ceo/i);
  const cta = sections.find((s) => s.kind === "CTA");
  const teamSec = sections.find((s) => s.kind === "TEAM");

  const handled = new Set<PublicCmsSection>(
    [hero, primaryRich, missionSec, visionSec, focusSec, valuesSec, founderSec, cta, teamSec].filter(
      Boolean
    ) as PublicCmsSection[]
  );
  const extraSections = sections.filter(
    (s) => !handled.has(s) && s.kind !== "SITE_FOOTER" && !(s.kind === "RICH_TEXT" && s.fields.placement)
  );

  const heroHeading = text(hero?.fields.heading) || page.title;
  const { lead: heroLead, accent: heroAccent } = splitAccentHeading(heroHeading);
  const heroSubtitle = text(hero?.fields.subtitle) || text(hero?.fields.description) || page.seoDescription;

  const impactPublished = navigation?.publishedRoutes?.some((r) => r.path === "/our-impact");
  const quickCards = [
    { title: "Our Story", sub: "From a vision to real impact", href: "#who-we-are", Icon: Sprout, cls: "is-green" },
    {
      title: "Our Mission",
      sub: "Service to humanity",
      href: missionSec ? "#mission-vision" : "/about/mission-vision",
      Icon: Heart,
      cls: "is-amber",
    },
    {
      title: "Our Impact",
      sub: "Lives touched, communities strengthened",
      href: impactPublished ? "/our-impact" : "#focus-areas",
      Icon: BookOpen,
      cls: "is-blue",
    },
    { title: "Our Team", sub: "Together we make it happen", href: "/about/team", Icon: Users, cls: "is-purple" },
  ];

  const focusItems = focusSec
    ? parseFocusAreas(text(focusSec.fields.body), list(focusSec.fields.highlights))
    : [];
  const valueItems = valuesSec
    ? parseValues(text(valuesSec.fields.body), list(valuesSec.fields.highlights))
    : [];

  const teamMembers = Array.isArray(teamSec?.fields.members)
    ? teamSec.fields.members.filter(
        (m): m is Record<string, unknown> =>
          !!m &&
          typeof m === "object" &&
          !Array.isArray(m) &&
          (m as Record<string, unknown>).consentConfirmed === true &&
          !!text((m as Record<string, unknown>).name) &&
          !!text((m as Record<string, unknown>).designation)
      )
    : [];

  return (
    <div className="cg-about-root">
      {/* Hero Section */}
      <section className="cg-about-hero" aria-label="About CareGanga Foundation">
        <div className="cg-about-hero-bg-grid">
          <div className="cg-about-hero-left">
            <p className="cg-about-eyebrow">
              <span aria-hidden="true">—</span> {text(hero?.fields.eyebrow) || "ABOUT US"}{" "}
              <span aria-hidden="true">—</span>
            </p>
            <h1>
              {heroLead}{" "}
              {heroAccent && (
                <span className="cg-about-hero-script">
                  {heroAccent}
                  <Leaf size={20} className="cg-about-hero-leaf" aria-hidden="true" />
                </span>
              )}
            </h1>
            {heroSubtitle && <p className="cg-about-hero-desc">{heroSubtitle}</p>}

            <div className="cg-about-quick-grid">
              {quickCards.map((card) => (
                <Link key={card.title} href={card.href} className="cg-about-quick-card">
                  <span className={"cg-about-quick-icon " + card.cls} aria-hidden="true">
                    <card.Icon size={18} />
                  </span>
                  <strong>{card.title}</strong>
                  <span>{card.sub}</span>
                </Link>
              ))}
            </div>
          </div>

          {heroAsset && (
            <div className="cg-about-hero-right">
              <img src={heroAsset.src} alt={heroAsset.altText} className="cg-about-hero-img" />
              <div className="cg-about-hero-fade" aria-hidden="true" />
              <span className="cg-about-hero-motto" aria-hidden="true">
                Better People,
                <br />A Brighter Future
              </span>
            </div>
          )}
        </div>
        <svg
          className="cg-about-hero-wave"
          viewBox="0 0 1440 72"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,36 C360,72 720,8 1080,44 C1260,60 1380,42 1440,28 L1440,72 L0,72 Z"
            fill="#15803D"
          />
          <path
            d="M0,54 C420,24 840,68 1440,38 L1440,72 L0,72 Z"
            fill="#FFFFFF"
          />
        </svg>
      </section>

      {/* Who We Are */}
      {primaryRich && (
        <section id="who-we-are" className="cg-about-section cg-about-who">
          <div className="cg-about-section-head">
            <span className="cg-about-heart-pill" aria-hidden="true">
              <Heart size={18} />
            </span>
            <h2>{text(primaryRich.fields.heading) || "Who We Are"}</h2>
            <span className="cg-about-heading-bar" aria-hidden="true" />
            {text(primaryRich.fields.body) && <p>{text(primaryRich.fields.body)}</p>}
          </div>

          <MissionVisionCards mission={missionSec} vision={visionSec} />

          {primaryAsset && !missionSec && !visionSec && (
            <div className="cg-about-split-media">
              <img src={primaryAsset.src} alt={primaryAsset.altText} loading="lazy" />
            </div>
          )}
        </section>
      )}

      {/* Focus Areas */}
      {focusSec && focusItems.length > 0 && (
        <section id="focus-areas" className="cg-about-section cg-about-focus">
          <div className="cg-about-section-head">
            <h2>{text(focusSec.fields.heading) || "Our Focus Areas"}</h2>
            <span className="cg-about-heading-bar" aria-hidden="true" />
          </div>
          <div className="cg-about-focus-grid">
            {focusItems.map((item) => {
              const { Icon, cls } = focusIcon(item);
              return (
                <article key={item} className="cg-about-focus-card">
                  <span className={"cg-about-focus-icon " + cls} aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <h3>{item}</h3>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Our Values */}
      {valuesSec && valueItems.length > 0 && (
        <section id="our-values" className="cg-about-section cg-about-values-wrap">
          <div className="cg-about-values-card">
            <h2>{text(valuesSec.fields.heading) || "Our Values"}</h2>
            <div className="cg-about-values-grid">
              {valueItems.map((val, idx) => {
                const { Icon, cls } = valueIcon(val.title, idx);
                return (
                  <div key={val.title} className="cg-about-value-item">
                    <span className={"cg-about-value-icon " + cls} aria-hidden="true">
                      <Icon size={17} />
                    </span>
                    <div>
                      <h3>{val.title}</h3>
                      {val.desc && <p>{val.desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Founder & CEO's Message */}
      {founderSec && (
        <section id="founder-message" className="cg-about-section cg-about-founder-wrap">
          <div className="cg-about-founder-card">
            {primaryAsset && (
              <div className="cg-about-founder-photo">
                <img src={primaryAsset.src} alt={primaryAsset.altText} loading="lazy" />
              </div>
            )}
            <div className="cg-about-founder-copy">
              <p className="cg-site-eyebrow">{text(founderSec.fields.eyebrow) || "FOUNDER & CEO'S MESSAGE"}</p>
              <h2>{text(founderSec.fields.heading) || "Founder & CEO's Message"}</h2>
              <p>{text(founderSec.fields.body)}</p>
              {list(founderSec.fields.highlights).length > 0 && (
                <div className="cg-about-founder-meta">
                  {list(founderSec.fields.highlights).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              )}
              <Link href="/about/founder-message" className="cg-about-founder-link">
                Read full message <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Consented Team if published in CMS */}
      {teamSec && teamMembers.length > 0 && (
        <section className="cg-about-section">
          <div className="cg-about-section-head">
            <h2>{text(teamSec.fields.heading) || "Our Team"}</h2>
            <span className="cg-about-heading-bar" aria-hidden="true" />
          </div>
          <div className="cg-site-team-grid">
            {teamMembers.map((m, i) => (
              <article key={i} className="cg-site-person">
                <h3>{text(m.name)}</h3>
                <strong>{text(m.designation)}</strong>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Any extra non-placement CMS sections */}
      {extraSections.map((sec, idx) =>
        sec.kind === "RICH_TEXT" ? (
          <section key={idx} className="cg-about-section cg-about-extra">
            <div className="cg-about-section-head">
              {text(sec.fields.eyebrow) && <p className="cg-site-eyebrow">{text(sec.fields.eyebrow)}</p>}
              <h2>{text(sec.fields.heading)}</h2>
              <span className="cg-about-heading-bar" aria-hidden="true" />
              {text(sec.fields.body) && <p>{text(sec.fields.body)}</p>}
            </div>
          </section>
        ) : null
      )}

      {/* Bottom CTA */}
      <AboutCtaBanner cta={cta} navigation={navigation} />
    </div>
  );
}

export function CmsMissionVisionView({
  page,
  navigation,
}: {
  page: PublicCmsPage;
  navigation?: PublicCmsNavigation | null;
}) {
  const sections = [...page.sections].sort((a, b) => a.order - b.order);
  const assets = page.assets ?? [];
  const bannerAsset =
    assets.find((a) => a.role === "ABOUT") || assets.find((a) => a.role === "HERO");
  const missionSec = findSection(sections, /^our mission$/i);
  const visionSec = findSection(sections, /^our vision$/i);
  const cta = sections.find((s) => s.kind === "CTA");
  const subtitle =
    list(missionSec?.fields.highlights)[0] ||
    "Guiding our actions today for a better tomorrow.";

  return (
    <div className="cg-about-root">
      <section className="cg-mv-hero">
        <div className="cg-mv-hero-grid">
          <div className="cg-mv-hero-copy">
            <nav className="cg-mv-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">›</span>
              <Link href="/about">About Us</Link>
              <span aria-hidden="true">›</span>
              <span aria-current="page">Mission &amp; Vision</span>
            </nav>
            <h1>
              Mission &amp; <span>Vision</span>
            </h1>
            <span className="cg-mv-hero-bar" aria-hidden="true" />
            <p>{subtitle}</p>
          </div>
          {bannerAsset && (
            <div className="cg-mv-hero-media">
              <img src={bannerAsset.src} alt={bannerAsset.altText} />
            </div>
          )}
        </div>
      </section>

      <section className="cg-about-section">
        <MissionVisionCards mission={missionSec} vision={visionSec} />
      </section>

      <AboutCtaBanner cta={cta} navigation={navigation} />
    </div>
  );
}

export function CmsFounderMessageView({
  page,
  navigation,
}: {
  page: PublicCmsPage;
  navigation?: PublicCmsNavigation | null;
}) {
  const sections = [...page.sections].sort((a, b) => a.order - b.order);
  const assets = page.assets ?? [];
  const bannerAsset =
    assets.find((a) => a.role === "ABOUT") || assets.find((a) => a.role === "HERO");
  const founderSec =
    findSection(sections, /founder|ceo/i) ||
    sections.find((s) => s.kind === "RICH_TEXT" && !s.fields.placement);
  const cta = sections.find((s) => s.kind === "CTA");

  return (
    <div className="cg-about-root">
      <section className="cg-mv-hero">
        <div className="cg-mv-hero-grid">
          <div className="cg-mv-hero-copy">
            <nav className="cg-mv-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">›</span>
              <Link href="/about">About Us</Link>
              <span aria-hidden="true">›</span>
              <span aria-current="page">Founder &amp; CEO&apos;s Message</span>
            </nav>
            <h1>
              {text(founderSec?.fields.heading) || "Founder & CEO's Message"}
            </h1>
            <span className="cg-mv-hero-bar" aria-hidden="true" />
            <p>{page.seoDescription}</p>
          </div>
          {bannerAsset && (
            <div className="cg-mv-hero-media">
              <img src={bannerAsset.src} alt={bannerAsset.altText} />
            </div>
          )}
        </div>
      </section>

      {founderSec && (
        <section className="cg-about-section">
          <article className="cg-founder-detail-card">
            <p className="cg-site-eyebrow">
              {text(founderSec.fields.eyebrow) || "FOUNDER & CEO'S MESSAGE"}
            </p>
            <h2>{text(founderSec.fields.heading) || "Founder & CEO's Message"}</h2>
            <p className="cg-founder-detail-body">{text(founderSec.fields.body)}</p>
            {list(founderSec.fields.highlights).length > 0 && (
              <div className="cg-about-founder-meta">
                {list(founderSec.fields.highlights).map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            )}
          </article>
        </section>
      )}

      <AboutCtaBanner cta={cta} navigation={navigation} />
    </div>
  );
}
