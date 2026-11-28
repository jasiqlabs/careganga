import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Handshake,
  Leaf,
  ShieldCheck,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
} from "lucide-react";
import { CmsPublicShell } from "../../features/cms-public-content/cms-public-page";
import {
  publishedCmsNavigation,
  publishedCmsPage,
} from "../../features/cms-public-content/cms-public-source";
import styles from "./collaboration.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const original = await publishedCmsPage("collaboration");
  if (original.state === "PUBLISHED" && original.page.kind === "PARTNERS") {
    return {
      title: original.page.seoTitle || original.page.title,
      description: original.page.seoDescription,
      alternates: { canonical: "/collaboration" },
      robots: { index: true, follow: true },
    };
  }
  return {
    title: "CareGanga Foundation",
    alternates: { canonical: "/collaboration" },
    robots: { index: true, follow: true },
  };
}

function splitHeroHeading(heading: string): { lead: string; accent: string } {
  const words = heading.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { lead: heading, accent: "" };
  const splitAt = Math.ceil(words.length / 2);
  return {
    lead: words.slice(0, splitAt).join(" "),
    accent: words.slice(splitAt).join(" "),
  };
}

function extractHighlightDescriptions(
  highlights: string[],
  body: string
): Array<{ title: string; description: string }> {
  if (highlights.length === 0) return [];
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return highlights.map((title) => ({ title, description: "" }));
  }

  return highlights.map((title, idx) => {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextTitles = highlights
      .slice(idx + 1)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const pattern = nextTitles
      ? new RegExp(`${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:${nextTitles})\\s*:|$)`, "i")
      : new RegExp(`${escaped}\\s*:\\s*([\\s\\S]*)$`, "i");
    const match = trimmedBody.match(pattern);
    return {
      title,
      description: match ? match[1].trim() : "",
    };
  });
}

const HIGHLIGHT_ICONS = [Sparkles, Target, TrendingUp, ShieldCheck];

export default async function Partnerships() {
  const [result, home, navigation] = await Promise.all([
    publishedCmsPage("collaboration"),
    publishedCmsPage("home"),
    publishedCmsNavigation(),
  ]);

  const siteFooter =
    home.state === "PUBLISHED"
      ? home.page.sections.find((s) => s.kind === "SITE_FOOTER")?.fields
      : null;

  const published = result.state === "PUBLISHED" && result.page.kind === "PARTNERS";
  const approved = published ? result.page.sections : [];
  const approvedAssets = published ? result.page.assets : [];

  const section = approved.find((s) => s.kind === "PARTNER_CARDS");
  const candidateCards = Array.isArray(section?.fields.cards)
    ? section.fields.cards.flatMap((raw) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
        const x = raw as Record<string, unknown>;
        if (
          typeof x.name !== "string" ||
          x.name.trim().length < 2 ||
          x.name.length > 200 ||
          typeof x.summary !== "string" ||
          x.summary.trim().length < 10 ||
          x.summary.length > 500 ||
          !Number.isSafeInteger(x.originalIndex) ||
          Number(x.originalIndex) < 0 ||
          Number(x.originalIndex) > 11
        ) {
          return [];
        }
        return [
          {
            name: x.name,
            summary: x.summary,
            originalIndex: x.originalIndex as number,
          },
        ];
      })
    : [];
  const safeCards = candidateCards.filter(
    (card) => candidateCards.filter((v) => v.originalIndex === card.originalIndex).length === 1
  );

  const logoFor = (index: number) =>
    approvedAssets.find(
      (a) =>
        a &&
        a.role === "FEATURE" &&
        a.order === index &&
        typeof a.src === "string" &&
        typeof a.altText === "string" &&
        /^\/api\/public\/content\/media\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          a.src
        )
    );

  const heroAsset = approvedAssets.find((a) => a && a.role === "HERO" && typeof a.src === "string");
  const hero = approved.find((s) => s.kind === "HERO")?.fields;
  const final = approved.find((s) => s.kind === "CTA")?.fields;

  const copy = (value: unknown, max = 700) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= max
      ? value.trim()
      : "";

  const narrative = approved
    .filter((s) => s.kind === "RICH_TEXT" && copy(s.fields.heading, 160))
    .sort((a, b) => a.order - b.order);

  const primaryNarrative = narrative[0];
  const remainingNarrative = narrative.slice(1);

  const primaryHighlights = primaryNarrative
    ? Array.isArray(primaryNarrative.fields.highlights)
      ? primaryNarrative.fields.highlights.filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0
        )
      : []
    : [];

  const floatingCards = primaryNarrative
    ? extractHighlightDescriptions(primaryHighlights, copy(primaryNarrative.fields.body, 4000))
    : [];

  const heroTitle = copy(hero?.heading, 180) || (published ? result.page.title : "");
  const { lead: heroLead, accent: heroAccent } = splitHeroHeading(heroTitle);
  const heroEyebrow = copy(hero?.eyebrow, 100);
  const heroSubtitle = copy(hero?.subtitle, 700);
  const heroIntro = copy(hero?.description, 400);
  const heroCtaPath = copy(hero?.primaryPath, 160);
  const heroCtaLabel =
    published && heroCtaPath.startsWith("/") ? copy(hero?.primaryLabel, 60) : "";

  const partnerHeading = copy(section?.fields.heading, 160);
  const partnerIntro = copy(section?.fields.intro, 1000);

  const finalTitle = copy(final?.heading, 160);
  const finalEyebrow = copy(final?.eyebrow, 80);
  const finalBody = copy(final?.body, 400);
  const finalPath = copy(final?.path, 160);
  const finalLabel = finalPath.startsWith("/") ? copy(final?.label, 80) : "";

  return (
    <CmsPublicShell navigation={navigation} siteFooter={siteFooter}>
      <div className={styles.shell}>
        {/* 1. Deep Navy Hero with Curved Bottom Wave */}
        <section className={styles.hero} aria-labelledby="corporate-heading">
          <div className={styles.heroGridBg} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              {heroEyebrow && (
                <p className={styles.eyebrow}>
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>{heroEyebrow}</span>
                </p>
              )}
              {heroTitle && (
                <h1 id="corporate-heading">
                  {heroLead}
                  {heroAccent ? (
                    <>
                      <br />
                      <span>{heroAccent}</span>
                    </>
                  ) : null}
                </h1>
              )}
              {heroSubtitle && <p className={styles.lead}>{heroSubtitle}</p>}
              {!heroSubtitle && heroIntro && <p className={styles.lead}>{heroIntro}</p>}

              <div className={styles.heroActions}>
                {heroCtaLabel && (
                  <Link className={styles.primary} href={heroCtaPath}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span>{heroCtaLabel}</span>
                  </Link>
                )}
                {partnerHeading && (
                  <a className={styles.secondary} href="#corporate-partners">
                    <span>{partnerHeading}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.heroCircleRing}>
                <div className={styles.heroCircle}>
                  {heroAsset ? (
                    <img src={heroAsset.src} alt={heroAsset.altText || heroTitle} />
                  ) : (
                    <div className={styles.heroCircleFallback} aria-hidden="true">
                      <Sprout size={54} />
                    </div>
                  )}
                </div>
                <span className={styles.heroLeafBadge} aria-hidden="true">
                  <Leaf size={18} />
                </span>
                {primaryNarrative && (
                  <div className={styles.heroFloatPill}>
                    <span className={styles.heroFloatIcon} aria-hidden="true">
                      <Handshake size={18} />
                    </span>
                    <div>
                      {copy(primaryNarrative.fields.eyebrow, 100) && (
                        <small>{copy(primaryNarrative.fields.eyebrow, 100)}</small>
                      )}
                      <strong>{copy(primaryNarrative.fields.heading, 160)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <svg
            className={styles.heroWave}
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,48 C480,0 960,0 1440,48 L1440,80 L0,80 Z" fill="#ffffff" />
          </svg>
        </section>

        {/* 2. 3 Floating Highlights Cards (from CMS RICH_TEXT) */}
        {floatingCards.length > 0 && (
          <section className={styles.floatingWrap} aria-label={copy(primaryNarrative?.fields.heading, 160)}>
            <div className={styles.floatingGrid}>
              {floatingCards.map((item, idx) => {
                const Icon = HIGHLIGHT_ICONS[idx % HIGHLIGHT_ICONS.length];
                return (
                  <article key={item.title + "-" + idx} className={styles.floatingCard}>
                    <div className={styles.floatingCardIcon} aria-hidden="true">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h2>{item.title}</h2>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Extra RICH_TEXT sections if CMS has more */}
        {remainingNarrative.map((item, i) => {
          const f = item.fields;
          const highlights = Array.isArray(f.highlights)
            ? f.highlights.filter((v): v is string => typeof v === "string").slice(0, 6)
            : [];
          return (
            <section key={item.order} className={styles.section} aria-labelledby={"partner-copy-" + i}>
              <div className={styles.sectionHeading}>
                {copy(f.eyebrow, 100) && <p className={styles.kicker}>{copy(f.eyebrow, 100)}</p>}
                <h2 id={"partner-copy-" + i}>{copy(f.heading, 160)}</h2>
                {copy(f.body, 4000) && <p>{copy(f.body, 4000)}</p>}
              </div>
              {highlights.length > 0 && (
                <div className={styles.cards}>
                  {highlights.map((v, j) => (
                    <article className={styles.card} key={j}>
                      <div className={styles.cardMark} aria-hidden="true">
                        {String(j + 1).padStart(2, "0")}
                      </div>
                      <h3>{v}</h3>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {/* 3. Our Social Partners (from CMS PARTNER_CARDS) */}
        {(partnerHeading || partnerIntro || safeCards.length > 0 || !published) && (
          <section
            id="corporate-partners"
            className={styles.partners}
            aria-labelledby="partners-heading"
          >
            <div className={styles.sectionHeading}>
              {partnerHeading && <h2 id="partners-heading">{partnerHeading}</h2>}
              {partnerIntro && <p>{partnerIntro}</p>}
            </div>

            {safeCards.length > 0 ? (
              <div className={styles.partnerCards}>
                {safeCards.map((partner, i) => {
                  const logo = logoFor(partner.originalIndex);
                  return (
                    <article key={partner.name + String(i)} className={styles.partnerCard}>
                      {logo && (
                        <img
                          className={styles.partnerLogo}
                          src={logo.src}
                          alt={logo.altText}
                          loading="lazy"
                        />
                      )}
                      <div>
                        <h3>{partner.name}</h3>
                        <p>{partner.summary}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyPartners} role="status">
                <div className={styles.emptyIcon} aria-hidden="true">
                  <Handshake size={28} />
                </div>
                <p>
                  {result.state === "UNAVAILABLE"
                    ? "Published partner information is temporarily unavailable."
                    : partnerIntro || "Approved partner listings will appear here once published."}
                </p>
              </div>
            )}
          </section>
        )}

        {/* 4. Final CTA Banner (from CMS CTA) */}
        {finalTitle && (
          <section className={styles.finalCtaWrap} aria-labelledby="collaborate-heading">
            <div className={styles.finalCta}>
              <div className={styles.finalCtaCopy}>
                {finalEyebrow && <p className={styles.kicker}>{finalEyebrow}</p>}
                <h2 id="collaborate-heading">{finalTitle}</h2>
                {finalBody && <p className={styles.finalCtaBody}>{finalBody}</p>}
              </div>
              {finalLabel && (
                <Link className={styles.finalCtaBtn} href={finalPath}>
                  <span>{finalLabel}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          </section>
        )}
      </div>
    </CmsPublicShell>
  );
}
