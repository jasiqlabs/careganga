"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  FlaskConical,
  HeartPulse,
  MapPin,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { PublicCmsPage } from "./cms-public-page";
import type { PublicCmsNavigation } from "./cms-public-source";
import type { PublicLabOffersResult } from "../diagnostics/public-lab-offers";
import type { currentConsultationBenefits } from "../healthcare-assistance/public-consultation-benefits";

type ConsultationBenefitsResult = Awaited<ReturnType<typeof currentConsultationBenefits>>;

const CATEGORY_CODE_MAP: Record<string, string> = {
  "poly clinic": "POLYCLINIC",
  polyclinic: "POLYCLINIC",
  "diagnostic centre": "DIAGNOSTIC_CENTER",
  "diagnostic center": "DIAGNOSTIC_CENTER",
  "dental clinic": "DENTAL_CLINIC",
  "medical laboratories": "MEDICAL_LABORATORY",
  "medical laboratory": "MEDICAL_LABORATORY",
  "hospital & nursing home": "HOSPITAL",
  "hospital and nursing home": "HOSPITAL",
  "retail pharmacy": "PHARMACY",
  "orthopedic centre": "ORTHOPEDIC_CLINIC",
  "orthopedic center": "ORTHOPEDIC_CLINIC",
  "homoeopathy centre": "HOMEOPATHY_CLINIC",
  "homeopathy centre": "HOMEOPATHY_CLINIC",
  "ayurvedic centre": "AYURVEDIC_CLINIC",
  "ayurvedic center": "AYURVEDIC_CLINIC",
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function resolveCategoryCode(title: string): string {
  return CATEGORY_CODE_MAP[title.trim().toLowerCase()] ?? "";
}

function splitHeroHeading(heading: string): { lead: string; accent: string } {
  const words = heading.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { lead: heading, accent: "" };
  const splitAt = words.length >= 4 ? words.length - 2 : Math.ceil(words.length / 2);
  return {
    lead: words.slice(0, splitAt).join(" "),
    accent: words.slice(splitAt).join(" "),
  };
}

function formatPaise(minor: string): string {
  const num = Number(minor);
  if (!Number.isFinite(num)) return "₹0";
  return "₹" + (num / 100).toLocaleString("en-IN", { minimumFractionDigits: num % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

export function CmsHealthcareView({
  page,
  navigation,
  benefits,
  labOffers,
}: {
  page: PublicCmsPage;
  navigation?: PublicCmsNavigation | null;
  benefits?: ConsultationBenefitsResult | null;
  labOffers?: PublicLabOffersResult | null;
}) {
  const heroSection = page.sections.find((s) => s.kind === "HERO");
  const categoriesSection = page.sections.find((s) => s.kind === "HEALTHCARE_CATEGORIES");

  const hf = heroSection?.fields ?? {};
  const cf = categoriesSection?.fields ?? {};

  const eyebrow = str(hf.eyebrow) || page.title;
  const rawHeading = str(hf.heading) || page.title;
  const { lead: headingLead, accent: headingAccent } = splitHeroHeading(rawHeading);
  const heroDescription = str(hf.description) || str(hf.subtitle) || page.seoDescription;
  const primaryPath = str(hf.primaryPath) || str(cf.ctaPath) || "/contact";
  const primaryLabel = str(hf.primaryLabel) || str(cf.ctaLabel) || "Contact Us";

  const categories = useMemo(() => {
    const raw = Array.isArray(cf.categories) ? cf.categories : [];
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      .map((item, idx) => ({
        title: str(item.title),
        description: str(item.description),
        code: resolveCategoryCode(str(item.title)),
        asset: page.assets.find((a) => a.role === "FEATURE" && a.order === idx),
      }))
      .filter((c) => c.title.length > 0);
  }, [cf.categories, page.assets]);

  const selectableCategories = useMemo(
    () => categories.filter((c) => c.code.length > 0),
    [categories]
  );

  const [selectedCode, setSelectedCode] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen]);

  const selectedLabel =
    selectableCategories.find((c) => c.code === selectedCode)?.title || "All Categories";

  const sectionHeading = str(cf.heading);
  const sectionIntro = str(cf.intro);

  const isRoutePublished = (path: string) =>
    navigation?.publishedRoutes?.some((r) => r.path === path) ?? false;

  const doctorsHref = "/health-network?tab=doctors";
  const centersHref = "/health-network?tab=centers";
  const labsHref = "/health-network/lab-tests";
  const safePrimaryHref = primaryPath.startsWith("/") ? primaryPath : "/contact";

  return (
    <div className="cg-hc-root">
      {/* 1. Crimson / Burgundy Hero Banner */}
      <section className="cg-hc-hero" aria-label={page.title}>
        <div className="cg-hc-hero-glow" aria-hidden="true" />
        <div className="cg-hc-hero-inner">
          <div className="cg-hc-pill">
            <HeartPulse size={14} aria-hidden="true" />
            <span>{eyebrow}</span>
          </div>
          <h1 className="cg-hc-hero-title">
            {headingLead}
            {headingAccent ? (
              <>
                {" "}
                <span>{headingAccent}</span>
              </>
            ) : null}
          </h1>
          {heroDescription && <p className="cg-hc-hero-desc">{heroDescription}</p>}
        </div>
      </section>

      {/* 2. Warm Cream Main Body with Overlapping White Card */}
      <div className="cg-hc-body">
        <div className="cg-hc-container">
          <section className="cg-hc-feature-card" aria-label="Healthcare services discovery">
            <div className="cg-hc-card-icon" aria-hidden="true">
              <HeartPulse size={24} />
            </div>

            {sectionHeading && <h2 className="cg-hc-card-title">{sectionHeading}</h2>}
            {sectionIntro && <p className="cg-hc-card-intro">{sectionIntro}</p>}

            {/* 3 Quick-Access Pillars (matching screenshot 3-pill strip) */}
            <div className="cg-hc-quick-grid">
              <Link href={doctorsHref} className="cg-hc-quick-pill">
                <Stethoscope size={18} className="cg-hc-quick-ico" aria-hidden="true" />
                <span>Verified Doctors</span>
              </Link>
              <Link href={centersHref} className="cg-hc-quick-pill">
                <Building2 size={18} className="cg-hc-quick-ico" aria-hidden="true" />
                <span>Healthcare Centers</span>
              </Link>
              <Link href={labsHref} className="cg-hc-quick-pill">
                <FlaskConical size={18} className="cg-hc-quick-ico" aria-hidden="true" />
                <span>Lab Tests &amp; Prices</span>
              </Link>
            </div>

            {/* Search & Custom Dropdown Form */}
            <form
              className="cg-hc-search-form"
              action="/health-network"
              method="get"
              aria-label="Search verified healthcare centers"
            >
              <input type="hidden" name="tab" value="centers" />
              <input type="hidden" name="category" value={selectedCode} />

              <div className="cg-hc-field">
                <label htmlFor="cg-hc-q">Center or provider</label>
                <div className="cg-hc-input-wrap">
                  <Search size={16} className="cg-hc-input-ico" aria-hidden="true" />
                  <input
                    id="cg-hc-q"
                    type="search"
                    name="q"
                    maxLength={80}
                    placeholder="Find a verified center"
                  />
                </div>
              </div>

              <div className="cg-hc-field" ref={dropdownRef}>
                <label id="cg-hc-cat-label">Service category</label>
                <div className="cg-hc-dropdown">
                  <button
                    type="button"
                    className={`cg-hc-dropdown-trigger ${dropdownOpen ? "is-open" : ""}`}
                    aria-haspopup="listbox"
                    aria-expanded={dropdownOpen}
                    aria-labelledby="cg-hc-cat-label"
                    onClick={() => setDropdownOpen((o) => !o)}
                  >
                    <span>{selectedLabel}</span>
                    <ChevronDown
                      size={16}
                      className={`cg-hc-dropdown-chev ${dropdownOpen ? "is-rotated" : ""}`}
                      aria-hidden="true"
                    />
                  </button>

                  {dropdownOpen && (
                    <ul
                      className="cg-hc-dropdown-menu"
                      role="listbox"
                      aria-labelledby="cg-hc-cat-label"
                    >
                      <li>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedCode === ""}
                          className={`cg-hc-dropdown-option ${selectedCode === "" ? "is-selected" : ""}`}
                          onClick={() => {
                            setSelectedCode("");
                            setDropdownOpen(false);
                          }}
                        >
                          <span>All Categories</span>
                          {selectedCode === "" && <Check size={15} aria-hidden="true" />}
                        </button>
                      </li>
                      {selectableCategories.map((cat) => {
                        const active = selectedCode === cat.code;
                        return (
                          <li key={cat.code + "-" + cat.title}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={`cg-hc-dropdown-option ${active ? "is-selected" : ""}`}
                              onClick={() => {
                                setSelectedCode(cat.code);
                                setDropdownOpen(false);
                              }}
                            >
                              <span>{cat.title}</span>
                              {active && <Check size={15} aria-hidden="true" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="cg-hc-field cg-hc-field-pin">
                <label htmlFor="cg-hc-pin">PIN code (optional)</label>
                <div className="cg-hc-input-wrap">
                  <MapPin size={16} className="cg-hc-input-ico" aria-hidden="true" />
                  <input
                    id="cg-hc-pin"
                    name="pin"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[1-9][0-9]{5}"
                    placeholder="6-digit PIN"
                  />
                </div>
              </div>

              <div className="cg-hc-form-submit">
                <button type="submit" className="cg-hc-btn-crimson">
                  <Search size={16} aria-hidden="true" />
                  <span>Search Centers</span>
                </button>
              </div>
            </form>

            {/* Primary & Secondary Action Buttons */}
            <div className="cg-hc-card-actions">
              <Link
                href={isRoutePublished(safePrimaryHref) ? safePrimaryHref : "/contact"}
                className="cg-hc-btn-crimson"
              >
                <span>{primaryLabel}</span>
              </Link>
              <Link href="/" className="cg-hc-btn-outline">
                <ArrowLeft size={15} aria-hidden="true" />
                <span>Back to Home</span>
              </Link>
            </div>
          </section>

          {/* 3. CMS Healthcare Service Categories Grid */}
          {categories.length > 0 && (
            <section className="cg-hc-section" aria-label="Healthcare service categories">
              <div className="cg-hc-section-head">
                <h2>{sectionHeading || page.title}</h2>
                {sectionIntro && <p>{sectionIntro}</p>}
              </div>

              <div className="cg-hc-cat-grid">
                {categories.map((cat, idx) => (
                  <article key={cat.title + "-" + idx} className="cg-hc-cat-card">
                    <div className="cg-hc-cat-media">
                      {cat.asset ? (
                        <img src={cat.asset.src} alt={cat.asset.altText || cat.title} loading="lazy" />
                      ) : (
                        <div className="cg-hc-cat-placeholder" aria-hidden="true">
                          <HeartPulse size={32} />
                        </div>
                      )}
                    </div>
                    <div className="cg-hc-cat-body">
                      <h3>{cat.title}</h3>
                      {cat.description && <p>{cat.description}</p>}
                      <Link
                        className="cg-hc-cat-link"
                        href={
                          "/health-network?tab=centers" +
                          (cat.code ? "&category=" + encodeURIComponent(cat.code) : "")
                        }
                      >
                        <span>Find centers</span>
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* 4. Approved Consultation Benefits (from Backend API) */}
          {benefits?.state === "READY" && benefits.items.length > 0 && (
            <section
              className="cg-hc-section"
              aria-label="Currently approved consultation contribution policies"
            >
              <div className="cg-hc-section-head">
                <h2>Currently Approved Consultation Support</h2>
                <p>
                  Where applicable, the Foundation may contribute toward an eligible in-person
                  consultation based on verified patient eligibility and current policy caps.
                </p>
              </div>
              <div className="cg-hc-info-grid">
                {benefits.items.slice(0, 4).map((item, i) => (
                  <article
                    key={item.centerSlug + ":" + (item.doctorRef ?? "center") + ":" + i}
                    className="cg-hc-info-card"
                  >
                    <div className="cg-hc-info-badge">
                      <ShieldCheck size={14} aria-hidden="true" />
                      <span>Approved Policy</span>
                    </div>
                    <h3>{item.centerName}</h3>
                    {item.doctorName && <p className="cg-hc-info-sub">{item.doctorName}</p>}
                    <p className="cg-hc-info-detail">
                      {item.mode === "PERCENT" && item.percentBasisPoints !== null
                        ? `${(item.percentBasisPoints / 100).toFixed(2)}% possible Foundation contribution`
                        : `Fixed possible Foundation contribution of ${formatPaise(item.fixedSupportMinor ?? "0")}`}
                      {` · Max ${formatPaise(item.maximumSupportMinor)}`}
                      {item.feeMinor !== null ? ` · Fee ${formatPaise(item.feeMinor)}` : ""}
                    </p>
                    <Link
                      href={"/healthcare/centers/" + encodeURIComponent(item.centerSlug)}
                      className="cg-hc-cat-link"
                    >
                      <span>View center</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* 5. Currently Approved Lab Tests & Prices (from Backend API) */}
          {labOffers?.state === "READY" && labOffers.items.length > 0 && (
            <section
              className="cg-hc-section"
              aria-label="Currently approved partner laboratory tests"
            >
              <div className="cg-hc-section-head">
                <h2>Approved Partner Laboratory Tests</h2>
                <p>
                  Verified partner laboratory commercial prices. Contact the verified laboratory to
                  confirm appointments or test preparation.
                </p>
              </div>
              <div className="cg-hc-info-grid">
                {labOffers.items.slice(0, 3).map((offer) => (
                  <article key={offer.offerRef} className="cg-hc-info-card">
                    <div className="cg-hc-lab-top">
                      <span className="cg-hc-lab-price">{formatPaise(offer.patientPriceMinor)}</span>
                    </div>
                    <h3>{offer.name}</h3>
                    <p className="cg-hc-info-sub">{offer.centerName}</p>
                    <Link
                      href={"/health-network/lab-tests?center=" + encodeURIComponent(offer.centerSlug)}
                      className="cg-hc-cat-link"
                    >
                      <span>View lab test options</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
              <div className="cg-hc-section-cta">
                <Link href={labsHref} className="cg-hc-btn-outline">
                  <span>Browse all approved tests and prices</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
