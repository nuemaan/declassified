import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans",
  display: "swap",
});

import { manifest } from "@/lib/data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://declassified.local";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `DECLASSIFIED — ${manifest.count} UAP files. Open the dossier.`,
  description: `An interactive 3D archive of ${manifest.count} declassified UFO files released by the Pentagon at war.gov/ufo. Find the nearest case to you.`,
  openGraph: {
    title: `DECLASSIFIED — ${manifest.count} UAP files`,
    description: `The Pentagon released ${manifest.count} declassified UFO files. We turned them into an investigation. Find the nearest case to you.`,
    type: "website",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "DECLASSIFIED — interactive UAP archive",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `DECLASSIFIED — ${manifest.count} UAP files`,
    description: `The Pentagon released ${manifest.count} declassified UFO files. We turned them into an investigation.`,
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${mono.variable} ${sans.variable}`}>
      <body className="crt vignette bg-archive-void text-archive-paper antialiased">
        {children}
      </body>
    </html>
  );
}
