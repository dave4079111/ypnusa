import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { APP_SITE_URL, MARKETING_SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_SITE_URL),
  title: {
    default: "YPN USA App — Mortgage Growth Platform for Loan Officers",
    template: "%s · YPN USA App",
  },
  description:
    "YPN USA is the mortgage growth platform for loan officers: claim exclusive ZIP territories, capture borrowers with AI intake, and turn local demand into owned leads.",
  applicationName: "YPN USA App",
  authors: [{ name: "David J. Moore, MBA" }],
  creator: "YPN Inc.",
  publisher: "YPN Inc.",
  category: "Business",
  referrer: "origin-when-cross-origin",
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
    title: "YPN USA App — Mortgage Growth Platform for Loan Officers",
    description:
      "Claim exclusive ZIP territories, capture borrowers with AI intake, and build an owned mortgage lead pipeline.",
  },
  twitter: {
    card: "summary_large_image",
    title: "YPN USA App — Mortgage Growth Platform for Loan Officers",
    description:
      "Exclusive ZIP territories and AI borrower intake for mortgage loan officers.",
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
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Starter", price: "29.99", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: "99.99", priceCurrency: "USD" },
        { "@type": "Offer", name: "Elite", price: "299.99", priceCurrency: "USD" },
      ],
      description:
        "Mortgage growth platform for licensed loan officers with exclusive ZIP territories, AI borrower intake, qualification, and nurture.",
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
      className={`${geistSans.variable} h-full antialiased`}
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
