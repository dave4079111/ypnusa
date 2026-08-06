import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ypnus.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "YPN USA — Exclusive Mortgage Lead Territories for Loan Officers",
    template: "%s · YPN USA",
  },
  description:
    "Own your mortgage leads — without waiting on Realtors. YPN USA gives loan officers an exclusive ZIP-code territory and an always-on AI agent that captures, qualifies, and nurtures every borrower. Keep your leads and your website even if you switch brokerages. Start free.",
  keywords: [
    "mortgage leads",
    "loan officer leads",
    "exclusive mortgage leads",
    "DSCR loan leads",
    "MLO marketing",
    "mortgage lead generation",
    "AI borrower intake",
    "exclusive zip code leads",
  ],
  applicationName: "YPN USA",
  authors: [{ name: "David J. Moore, MBA" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "YPN USA",
    title: "YPN USA — Exclusive Mortgage Lead Territories for Loan Officers",
    description:
      "Exclusive ZIP-code territories and an autonomous AI agent that fills your pipeline. Own your leads and your website for life. Start free.",
  },
  twitter: {
    card: "summary_large_image",
    title: "YPN USA — Exclusive Mortgage Lead Territories",
    description:
      "Own your mortgage leads without waiting on Realtors. Exclusive ZIP territories + an always-on AI intake agent.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
