import type { GraphQualityReport, HealthStatus } from "@/types"

const suitabilityLabel: Record<GraphQualityReport["suitability"], string> = {
  recommended: "Recommended",
  promising_but_review: "Review",
  weak_graph_signal: "Weak signal",
  not_recommended: "Not recommended",
}

const statusClass: Record<HealthStatus, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  fail: "border-rose-200 bg-rose-50 text-rose-800",
}

interface QualityPanelProps {
  report: GraphQualityReport
}

export function QualityPanel({ report }: QualityPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Graph quality</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">{report.final_score.toFixed(1)}/100</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {suitabilityLabel[report.suitability]}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{report.explanation}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <QualityList title="Strengths" items={report.strengths} empty="No clear strengths yet." />
        <QualityList title="Warnings" items={report.warnings} empty="No warnings." />
      </div>

      <div className="mt-5 grid gap-2">
        {report.health_checks.map((check) => (
          <div className={`rounded-md border px-3 py-2 text-sm ${statusClass[check.status]}`} key={check.name}>
            {check.message}
          </div>
        ))}
      </div>
    </section>
  )
}

function QualityList({
  title,
  items,
  empty,
}: {
  title: string
  items: string[]
  empty: string
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
        {(items.length ? items : [empty]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
