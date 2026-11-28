import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsMissionVisionView } from "../../../features/cms-public-content/cms-about-page";
import { CmsPublicShell } from "../../../features/cms-public-content/cms-public-page";
import { publishedCmsNavigation, publishedCmsPage } from "../../../features/cms-public-content/cms-public-source";
import { UnavailablePage } from "../../../shared/unavailable-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const r = await publishedCmsPage("about");
  return r.state === "PUBLISHED"
    ? {
        title: "Mission & Vision | CareGanga Foundation",
        description: r.page.seoDescription,
        alternates: { canonical: "/about/mission-vision" },
        robots: { index: true, follow: true },
      }
    : { title: "Mission & Vision | CareGanga Foundation", robots: { index: false, follow: false } };
}

export default async function MissionVisionPage() {
  const [about, navigation, home] = await Promise.all([
    publishedCmsPage("about"),
    publishedCmsNavigation(),
    publishedCmsPage("home"),
  ]);
  if (about.state === "NOT_PUBLISHED") notFound();
  if (about.state !== "PUBLISHED") {
    return (
      <UnavailablePage
        title="Mission & Vision temporarily unavailable"
        description="We could not verify the currently published About Us information."
        linkHref="/"
        linkLabel="Return home"
      />
    );
  }
  const siteFooter =
    home.state === "PUBLISHED" ? home.page.sections.find((s) => s.kind === "SITE_FOOTER")?.fields : null;
  return (
    <CmsPublicShell navigation={navigation} siteFooter={siteFooter}>
      <CmsMissionVisionView page={about.page} navigation={navigation} />
    </CmsPublicShell>
  );
}
