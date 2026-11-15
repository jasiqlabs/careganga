import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"CareGanga Foundation", description:"CareGanga Foundation operations and healthcare assistance" };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
