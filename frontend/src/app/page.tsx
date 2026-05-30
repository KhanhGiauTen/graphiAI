const phases = [
  {
    title: "Phase 0",
    label: "Lean scaffold",
    detail: "FastAPI, Next.js, SQLite metadata, local uploads, and shared contracts.",
  },
  {
    title: "Phase 1",
    label: "MVP core",
    detail: "CSV upload, profiling, rule schema recommendation, graph preview, export.",
  },
  {
    title: "Phase 2",
    label: "Quality guardrails",
    detail: "Graph suitability score, leakage warnings, imbalance checks, and schema risks.",
  },
  {
    title: "Phase 3",
    label: "AI schema",
    detail: "LLM column semantics, ranked schema proposals, explanations, and fallbacks.",
  },
]

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-graph-blue">
            Graphify AI
          </p>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
                Tabular data to explainable graph structure.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                Upload event-style CSV data, infer graph schemas, inspect quality warnings,
                preview relationships, and export graph-learning starter code.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Current milestone</p>
              <p className="mt-2 text-xl font-semibold">Phase 1 workflow</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload a CSV, profile columns, generate graph schemas, preview a sample,
                and export NetworkX-ready files.
              </p>
              <a
                className="mt-4 inline-flex rounded-md bg-graph-blue px-4 py-2 text-sm font-semibold text-white"
                href="/upload"
              >
                Upload CSV
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {phases.map((phase) => (
            <article
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              key={phase.title}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{phase.title}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {phase.label}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{phase.detail}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
