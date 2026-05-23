import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "YPN · Borrower intake (embed)",
  description: "Full LoanPilot intake pipeline in an iframe-friendly surface.",
};

export default function EmbedIntakeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${outfit.className} min-h-0 bg-[#fdfcf7] text-slate-900 antialiased md:bg-transparent`}>{children}</div>
  );
}
