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

export const metadata: Metadata = {
  metadataBase: new URL("https://declassified.local"),
  title: "DECLASSIFIED — UAP Archive",
  description:
    "An interactive visualization of 162 declassified UFO/UAP files. Open the dossier. Decide for yourself.",
  openGraph: {
    title: "DECLASSIFIED — UAP Archive",
    description:
      "Explore 162 declassified UFO/UAP files on an interactive 3D globe.",
    type: "website",
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
