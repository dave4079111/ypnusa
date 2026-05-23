import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Borrower intake embed",
  description:
    "Iframe-friendly LoanPilot AI mortgage intake surface for qualified borrower capture, LOS sync, nurture, and booking.",
  alternates: {
    canonical: "/embed/intake",
  },
};

export default function EmbedIntakeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${outfit.className} min-h-0 bg-[#fdfcf7] text-slate-900 antialiased md:bg-transparent`}>{children}</div>
  );
}
