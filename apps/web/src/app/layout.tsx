import type { Metadata } from "next";
import "./globals.css";
import "./cg-site.css";
export const metadata: Metadata = { title:"CareGanga Foundation", description:"CareGanga Foundation operations and healthcare assistance" };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body suppressHydrationWarning>{children}</body></html>;
}
