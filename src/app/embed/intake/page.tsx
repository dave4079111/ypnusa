import { YpnEmbedIntake } from "@/components/loanpilot-floating-assistant";

export default function EmbedIntakePage() {
  return (
    <main
      aria-label="YPN borrower intake embed"
      className="flex min-h-[720px] justify-center overflow-x-hidden bg-[#f6fbff] px-2 py-3 md:min-h-[min(100dvh,900px)] md:items-start md:px-4 md:py-6"
    >
      <YpnEmbedIntake />
    </main>
  );
}
