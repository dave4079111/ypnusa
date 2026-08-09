export default function Loading() {
  return (
    <main className="min-h-screen bg-[#09081b] text-white">
      <section className="relative isolate overflow-hidden px-6 py-16">
        <div className="ypn-aurora pointer-events-none absolute inset-0 opacity-80" aria-hidden />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
          <div className="h-4 w-44 rounded-full bg-cyan-300/25" />
          <div className="max-w-3xl space-y-4">
            <div className="h-12 rounded-full bg-white/15" />
            <div className="h-12 w-5/6 rounded-full bg-white/10" />
            <div className="h-5 w-2/3 rounded-full bg-white/10" />
          </div>
          <div className="grid gap-4 md:grid-cols-3" data-cwv-shell>
            <div className="h-32 rounded-3xl border border-white/10 bg-white/[0.06]" />
            <div className="h-32 rounded-3xl border border-white/10 bg-white/[0.06]" />
            <div className="h-32 rounded-3xl border border-white/10 bg-white/[0.06]" />
          </div>
        </div>
      </section>
    </main>
  );
}
