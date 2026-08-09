"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { MortgageIntakeChat as MortgageIntakeChatComponent } from "@/components/loanpilot-floating-assistant";

type MortgageIntakeChatProps = ComponentProps<typeof MortgageIntakeChatComponent>;

function IntakeLoadingFallback() {
  return (
    <div
      aria-label="Loading borrower intake assistant"
      className="min-h-[34rem] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-cyan-100/60"
      role="status"
    >
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div className="h-3 w-28 rounded-full bg-cyan-100" />
        <div className="mt-3 h-5 w-44 rounded-full bg-slate-200" />
      </div>
      <div className="space-y-4 p-5">
        <div className="h-16 rounded-3xl bg-slate-100" />
        <div className="ml-auto h-12 w-3/4 rounded-3xl bg-cyan-100" />
        <div className="h-24 rounded-3xl bg-slate-100" />
      </div>
    </div>
  );
}

const LazyMortgageIntakeChat = dynamic<MortgageIntakeChatProps>(
  () =>
    import("@/components/loanpilot-floating-assistant").then(
      (mod) => mod.MortgageIntakeChat,
    ),
  {
    ssr: false,
    loading: IntakeLoadingFallback,
  },
);

export function MortgageIntakeChat(props: MortgageIntakeChatProps) {
  return <LazyMortgageIntakeChat {...props} />;
}
