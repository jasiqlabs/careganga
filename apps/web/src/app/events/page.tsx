import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, ArrowRight } from "lucide-react";
import { HealthcarePublicChrome } from "../../shared/healthcare-public-chrome";
import { publishedCmsArticles } from "../../features/cms-public-content/cms-public-source";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Foundation Events | CareGanga",
  robots: { index: false, follow: true },
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const raw = (await searchParams).cursor;
  const cursor = typeof raw === "string" && /^[a-z0-9][a-z0-9-]{0,69}$/.test(raw) ? raw : "";
  const feed = await publishedCmsArticles("", cursor, true);

  return (
    <HealthcarePublicChrome>
      <main id="main-content" className="cg-site-content cg-site-notices">
        <div className="cg-site-notice-hero">
          <span className="cg-site-notice-pill">
            <Calendar size={13} /> CareGanga Foundation Public Events
          </span>
          <h1>Foundation Events</h1>
          <p>
            Explore current independently approved Foundation events, medical camps, and community
            drives. Open an event for its current schedule and details.
          </p>
        </div>

        {!feed.available ? (
          <p role="alert" className="cg-site-gallery-empty">
            Current event information cannot be verified. Please try again.
          </p>
        ) : feed.posts.length === 0 ? (
          <div className="cg-site-empty" role="status">
            <strong>{cursor ? "No more approved events" : "No events published yet"}</strong>
            <p>Current independently approved events will appear here.</p>
          </div>
        ) : (
          <div className="cg-site-notice-list">
            {feed.posts.map((event) => (
              <article key={event.slug} className="cg-site-notice-card">
                <div className="cg-site-notice-meta">
                  <span className="cg-site-notice-badge-priority">APPROVED EVENT</span>
                  <span className="cg-site-notice-badge-cat">{event.category.toUpperCase()}</span>
                </div>
                <h2>{event.title}</h2>
                <p className="cg-site-notice-excerpt">{event.excerpt}</p>
                <div className="cg-site-notice-card-footer">
                  <time dateTime={event.asOfDate}>
                    <Calendar size={13} aria-hidden="true" /> As of {event.asOfDate}
                  </time>
                  <Link href={event.path} className="cg-site-notice-link">
                    View event details <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {feed.available && feed.nextCursor && (
          <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <Link href={"/events?cursor=" + encodeURIComponent(feed.nextCursor)}>Next page</Link>
          </p>
        )}
        {cursor && (
          <p style={{ marginTop: "0.75rem", textAlign: "center" }}>
            <Link href="/events">Return to first page</Link>
          </p>
        )}
      </main>
    </HealthcarePublicChrome>
  );
}
