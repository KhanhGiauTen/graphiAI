import { AlertTriangle, CheckCircle2, CircleAlert, Lightbulb, ShieldCheck, TriangleAlert } from "lucide-react"

import type { GraphQualityReport, HealthStatus } from "@/types"

const suitabilityLabel: Record<GraphQualityReport["suitability"], string> = {
  recommended: "Recommended",
  promising_but_review: "Review",
  weak_graph_signal: "Weak signal",
  not_recommended: "Not recommended",
}

const statusClass: Record<HealthStatus, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-graph-green",
  warning: "border-amber-200 bg-amber-50 text-graph-amber",
  fail: "border-rose-200 bg-rose-50 text-graph-rose",
}

const componentLabels: Record<keyof GraphQualityReport["component_scores"], string> = {
  entity_confidence: "Entity confidence",
  relationship_confidence: "Relationship confidence",
  feature_richness: "Feature richness",
  task_suitability: "Task suitability",
  connectivity_estimate: "Connectivity",
  interpretability: "Interpretability",
}

interface QualityPanelProps {
  report: GraphQualityReport
}

export function QualityPanel({ report }: QualityPanelProps) {
  const components = Object.entries(report.component_scores) as Array<
    [keyof GraphQualityReport["component_scores"], number]
  >
  return (
    <section className="soft-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Graph quality</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <h2 className="text-4xl font-bold text-ink">{report.final_score.toFixed(1)}</h2>
            <span className="pb-1 text-sm font-semibold text-muted">/100 suitability score</span>
          </div>
        </div>
        <span className="pill border-cyan-100 bg-cyan-50 text-graph-cyan">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {suitabilityLabel[report.suitability]}
        </span>
      </div>

      <p className="mt-4 max-w-4xl text-sm leading-7 text-muted">{report.explanation}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {components.map(([key, value]) => {
          const percent = Math.round(value * 100)
          const barColor = percent >= 75 ? "bg-mint" : percent >= 55 ? "bg-graph-amber" : "bg-graph-rose"
          return (
            <div className="subtle-panel p-4" key={key}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-ink">{componentLabels[key]}</span>
                <span className="font-semibold text-muted">{percent}%</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <QualityList
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          tone="green"
          title="Strengths"
          items={report.strengths}
          empty="No clear strengths yet."
        />
        <QualityList
          icon={<CircleAlert className="h-4 w-4" aria-hidden="true" />}
          tone="amber"
          title="Warnings"
          items={report.warnings}
          empty="No warnings."
        />
        <QualityList
          icon={<TriangleAlert className="h-4 w-4" aria-hidden="true" />}
          tone="rose"
          title="Leakage"
          items={report.leakage_warnings}
          empty="No leakage signals detected."
        />
        <QualityList
          icon={<Lightbulb className="h-4 w-4" aria-hidden="true" />}
          tone="cyan"
          title="Next review"
          items={report.weaknesses}
          empty="No clear weaknesses."
        />
      </div>

      <div className="mt-5 grid gap-2">
        {report.health_checks.map((check) => (
          <div className={`flex items-start gap-2 rounded-card border px-3 py-2 text-sm font-semibold ${statusClass[check.status]}`} key={check.name}>
            <StatusIcon status={check.status} />
            <span>{check.message}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function QualityList({
  empty,
  icon,
  items,
  title,
  tone,
}: {
  empty: string
  icon: React.ReactNode
  items: string[]
  title: string
  tone: "green" | "amber" | "rose" | "cyan"
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-100 bg-emerald-50 text-graph-green"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50 text-graph-amber"
        : tone === "rose"
          ? "border-rose-100 bg-rose-50 text-graph-rose"
          : "border-cyan-100 bg-cyan-50 text-graph-cyan"
  return (
    <div className="subtle-panel p-4">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full border ${toneClass}`}>{icon}</span>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
      </div>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
        {(items.length ? items : [empty]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "pass") {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
  }
  if (status === "fail") {
    return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
  }
  return <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
}
