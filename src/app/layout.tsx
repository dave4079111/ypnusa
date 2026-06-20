import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = "https://ypnusa.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "LoanPilot AI | AI-Powered Mortgage Borrower Intake & Automation",
    template: "%s | LoanPilot AI",
  },
  description:
    "LoanPilot AI automates mortgage borrower intake for FHA, VA, DSCR, HELOC, refinance, and jumbo loans. Qualify leads instantly, sync your CRM, assign loan officers, and trigger nurture automations — all without static lead forms.",
  keywords: [
    "mortgage borrower intake automation",
    "AI mortgage lead capture",
    "LOS integration software",
    "FHA VA DSCR mortgage automation",
    "mortgage CRM automation",
    "loan officer automation",
    "mortgage intake software",
    "AI loan origination",
    "mortgage lead qualification",
    "borrower intake platform",
    "mortgage chatbot",
    "loan origination automation",
    "YPN mortgage software",
    "LoanPilot AI",
  ],
  authors: [{ name: "LoanPilot AI", url: BASE_URL }],
  creator: "LoanPilot AI",
  publisher: "YPN USA",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "LoanPilot AI",
    title: "LoanPilot AI — AI-Powered Mortgage Borrower Intake & Automation",
    description:
      "Qualify mortgage borrowers instantly. FHA, VA, DSCR, HELOC, refi & jumbo intake flows with CRM sync, LO routing, and automated nurture — no static forms.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LoanPilot AI — Mortgage Intake Automation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LoanPilot AI — AI-Powered Mortgage Borrower Intake",
    description:
      "Qualify borrowers instantly across FHA, VA, DSCR, HELOC, refi & jumbo. Sync CRM, assign loan officers, launch nurture automations automatically.",
    images: ["/og-image.png"],
    creator: "@ypnusa",
  },
  alternates: {
    canonical: BASE_URL,
  },
  category: "finance",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "YPN USA / LoanPilot AI",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/favicon.ico`,
      },
      description:
        "LoanPilot AI is an AI-powered mortgage borrower intake and automation platform supporting FHA, VA, DSCR, HELOC, refinance, and jumbo loan programs.",
      sameAs: [],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${BASE_URL}/#software`,
      name: "LoanPilot AI",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: BASE_URL,
      description:
        "AI-powered mortgage borrower intake platform with LOS-grade qualification, CRM mirroring, loan officer routing, nurture automations, and calendar booking.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "AI mortgage borrower intake",
        "FHA, VA, DSCR, HELOC, refinance, jumbo loan flows",
        "LOS composite qualification scoring",
        "CRM sync and loan officer routing",
        "Automated SMS and email nurture",
        "Calendar booking integration",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "LoanPilot AI",
      publisher: { "@id": `${BASE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: BASE_URL,
      },
    },
  ],
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
      <head>
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
