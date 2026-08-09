import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Arial"],
});

export const metadata: Metadata = {
  title: "YPN · Borrower intake (embed)",
  description: "Full YPN USA intake pipeline in an iframe-friendly surface.",
  robots: { index: false, follow: false },
};

export default function EmbedIntakeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${outfit.className} min-h-0 bg-[#fdfcf7] text-slate-900 antialiased md:bg-transparent`}>{children}</div>
  );
}
