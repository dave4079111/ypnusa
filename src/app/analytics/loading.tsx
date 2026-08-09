export default function AnalyticsLoading() {
  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-10 bg-slate-50 px-6 py-16 text-slate-900">
      <header className="space-y-3">
        <div className="h-3 w-48 rounded-full bg-cyan-100" />
        <div className="h-9 w-72 rounded-full bg-slate-200" />
        <div className="h-4 w-full max-w-xl rounded-full bg-slate-200" />
      </header>
      <section className="grid gap-4 md:grid-cols-4" data-cwv-shell>
        <div className="h-32 rounded-3xl bg-white shadow-xl shadow-cyan-100/60 ring-1 ring-slate-100" />
        <div className="h-32 rounded-3xl bg-white shadow-xl shadow-cyan-100/60 ring-1 ring-slate-100" />
        <div className="h-32 rounded-3xl bg-white shadow-xl shadow-cyan-100/60 ring-1 ring-slate-100" />
        <div className="h-32 rounded-3xl bg-white shadow-xl shadow-cyan-100/60 ring-1 ring-slate-100" />
      </section>
    </div>
  );
}
