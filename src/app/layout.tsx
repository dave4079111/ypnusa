import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { absoluteUrl, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: "LoanPilot AI | Mortgage borrower intake that converts",
    template: `%s | ${siteName}`,
  },
  description:
    "LoanPilot AI turns mortgage traffic into qualified borrower conversations with program-fit scoring, LOS-ready CRM sync, loan officer routing, nurture automation, and booking.",
  keywords: [
    "mortgage borrower intake",
    "mortgage lead conversion",
    "LOS automation",
    "loan officer routing",
    "AI mortgage assistant",
    "borrower qualification",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "LoanPilot AI mortgage borrower intake automation",
    description:
      "Capture, qualify, sync, route, nurture, and book mortgage borrowers from one conversion-focused AI intake experience.",
    url: absoluteUrl("/"),
    siteName,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "LoanPilot AI borrower intake conversion dashboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  twitter: {
    card: "summary_large_image",
    title: "LoanPilot AI | Mortgage borrower intake that converts",
    description:
      "Program-fit scoring, LOS-ready sync, loan officer routing, nurture automation, and booking in one AI intake rail.",
    images: [
      {
        url: "/opengraph-image",
        alt: "LoanPilot AI borrower intake conversion dashboard",
      },
    ],
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
