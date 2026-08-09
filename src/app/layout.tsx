import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_SITE_URL, MARKETING_SITE_URL } from "@/lib/site";
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
  metadataBase: new URL(APP_SITE_URL),
  title: {
    default: "YPN USA App — Exclusive ZIP Territories & AI Borrower Intake",
    template: "%s · YPN USA App",
  },
  description:
    "Claim exclusive mortgage ZIP territories, run AI borrower intake, and keep every lead you capture. Product app for YPN USA loan officers — Free, Starter $29.99, Pro $99.99, Elite $299.99.",
  keywords: [
    "mortgage leads",
    "exclusive zip territory",
    "loan officer leads",
    "AI borrower intake",
    "MLO marketing",
    "YPN USA",
  ],
  applicationName: "YPN USA App",
  authors: [{ name: "David J. Moore, MBA" }],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: APP_SITE_URL,
    siteName: "YPN USA App",
    title: "YPN USA App — Exclusive ZIP Territories & AI Intake",
    description:
      "Own your ZIP codes. Capture, qualify, and nurture borrowers with an always-on AI agent. Start free.",
  },
  twitter: {
    card: "summary_large_image",
    title: "YPN USA App — Exclusive Mortgage Lead Territories",
    description:
      "Exclusive ZIP territories + AI borrower intake for licensed loan officers. Start free.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${MARKETING_SITE_URL}/#organization`,
      name: "YPN USA",
      legalName: "YPN Inc.",
      url: MARKETING_SITE_URL,
      email: "support@ypnus.com",
      telephone: "+15592056940",
      sameAs: [
        APP_SITE_URL,
        "https://www.linkedin.com/in/davidjmooreypn",
        "https://www.facebook.com/YPN.Incorporated/",
      ],
    },
    {
      "@type": "WebApplication",
      "@id": `${APP_SITE_URL}/#app`,
      name: "YPN USA App",
      url: APP_SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      isPartOf: { "@id": `${MARKETING_SITE_URL}/#organization` },
      relatedLink: MARKETING_SITE_URL,
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Starter", price: "29.99", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: "99.99", priceCurrency: "USD" },
        { "@type": "Offer", name: "Elite", price: "299.99", priceCurrency: "USD" },
      ],
      description:
        "Exclusive ZIP territory product for licensed mortgage loan officers with AI borrower intake, qualification, and nurture.",
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
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
