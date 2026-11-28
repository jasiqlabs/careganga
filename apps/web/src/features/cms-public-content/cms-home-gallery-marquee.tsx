import Link from "next/link";
import { ArrowRight, Images } from "lucide-react";

export type HomeGalleryPhoto = {
  src: string;
  alt: string;
  title: string;
  category: string;
};

export function CmsHomeGalleryMarquee({
  eyebrow,
  heading,
  subtitle,
  photos,
}: {
  eyebrow?: string;
  heading?: string;
  subtitle?: string;
  photos: HomeGalleryPhoto[];
}) {
  if (!photos.length) return null;
  // Repeat cards cleanly so the right-to-left continuous marquee never leaves blank space
  const track = photos.length >= 4 ? [...photos, ...photos] : [...photos, ...photos, ...photos, ...photos];

  return (
    <section className="cg-home-gallery-section" aria-label="Foundation Photo Gallery">
      <div className="cg-site-content">
        <div className="cg-home-gallery-head">
          <div>
            <p className="cg-site-eyebrow">
              <Images size={14} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "0.35rem" }} />
              {eyebrow || "CAPTURED MOMENTS"}
            </p>
            <h2>{heading || "Our Media Gallery"}</h2>
            {subtitle && <p className="cg-home-gallery-sub">{subtitle}</p>}
          </div>
          <Link href="/gallery" className="cg-home-gallery-viewall">
            View All <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="cg-home-gallery-viewport">
          <div
            className="cg-home-gallery-track"
            style={{ animationDuration: `${Math.max(22, track.length * 4)}s` }}
          >
            {track.map((item, idx) => (
              <Link
                key={`${item.src}-${idx}`}
                href="/gallery"
                className="cg-home-gallery-card"
                aria-label={`View ${item.title} in Gallery`}
              >
                <div className="cg-home-gallery-img-wrap">
                  <img
                    src={item.src}
                    alt={item.alt || item.title}
                    loading="lazy"
                    className="cg-home-gallery-img"
                  />
                  {item.category && (
                    <span className="cg-home-gallery-cat">{item.category}</span>
                  )}
                </div>
                <div className="cg-home-gallery-caption">
                  <strong>{item.title}</strong>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
