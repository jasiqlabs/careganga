import type { Metadata } from "next";
import "./globals.css";
import "./cg-site.css";
import { PublicAppClientWrapper } from "./public-app-client-wrapper";

export const metadata: Metadata = {
  title: "CareGanga Foundation",
  description: "CareGanga Foundation operations and healthcare assistance"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Merriweather:ital,wght@0,400;0,700;0,900;1,400&family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <PublicAppClientWrapper>
          {children}
        </PublicAppClientWrapper>
      </body>
    </html>
  );
}
