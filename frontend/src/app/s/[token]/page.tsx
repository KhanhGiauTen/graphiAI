"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Download, FileJson, GitBranch, LockKeyhole, ShieldCheck } from "lucide-react"

import { AppHeader } from "@/components/AppHeader"
import { QualityPanel } from "@/components/quality/QualityPanel"
import { api } from "@/lib/api"
import type { ProjectDetail, ProjectReport } from "@/types"

export default function SharedProjectPage() {
  const routeParams = useParams<{ token: string }>()
  const token = routeParams.token
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [selectedSchema, setSelectedSchema] = useState("")
  const [report, setReport] = useState<ProjectReport | null>(null)
  const [reportStatus, setReportStatus] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    api
      .get<ProjectDetail>(`/share/${token}`)
      .then((response) => {
        setProject(response.data)
        setSelectedSchema(response.data.selected_schema_id ?? response.data.graph_schemas[0]?.id ?? "")
      })
      .catch(() => setError("Shared project not found."))
  }, [token])

  useEffect(() => {
    if (!selectedSchema) {
      return
    }

    let cancelled = false
    setError("")
    setReport(null)
    setReportStatus("Loading read-only report")
    api
      .get<ProjectReport>(`/share/${token}/report`, { params: { schema_id: selectedSchema } })
      .then((response) => {
        if (!cancelled) {
          setReport(response.data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Shared report not found.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReportStatus("")
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, selectedSchema])

  if (error) return <main className="app-shell p-8 text-rose-700">{error}</main>
  if (!project) return <main className="app-shell p-8 text-muted">Loading shared project...</main>

  const schema = project.graph_schemas.find((item) => item.id === selectedSchema) ?? project.graph_schemas[0]

  return (
    <main className="app-shell text-ink">
      <AppHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 pb-10">
        <section className="soft-card border-t border-border-soft p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="pill border-emerald-100 bg-emerald-50 text-graph-green">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                Read-only shared report
              </span>
              <h1 className="mt-4 text-3xl font-bold md:text-4xl">{project.name ?? project.original_filename}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                Public schema preview, quality guardrails, and report download. Editing, graph building, baseline runs,
                and export creation remain locked to the project owner.
              </p>
            </div>
            {report ? (
              <span className="pill border-cyan-100 bg-cyan-50 text-graph-cyan">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {report.quality.final_score.toFixed(1)}/100 quality
              </span>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="soft-card h-fit p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-card bg-indigo-50 text-accent-indigo">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-bold">Suggested schemas</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {project.graph_schemas.map((item) => (
                <button
                  className={`rounded-card border p-4 text-left text-sm shadow-line ${
                    item.id === selectedSchema ? "border-cyan-200 bg-cyan-50" : "border-border-soft bg-white hover:border-cyan-200"
                  }`}
                  key={item.id}
                  onClick={() => setSelectedSchema(item.id)}
                  type="button"
                >
                  <span className="font-bold text-ink">{item.name}</span>
                  <span className="mt-2 block text-muted">Score: {item.quality_score.toFixed(1)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 gap-6">
            {schema ? (
              <article className="soft-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Selected schema</p>
                    <h2 className="mt-1 text-2xl font-bold">{schema.name}</h2>
                    <p className="mt-3 text-sm leading-7 text-muted">{schema.description}</p>
                  </div>
                  <span className="pill bg-surface-muted">{schema.quality_score.toFixed(1)} score</span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <SharedList
                    title="Nodes"
                    items={schema.node_types.map((node) => `${node.name} from ${node.source_column}`)}
                  />
                  <SharedList
                    title="Edges"
                    items={schema.edge_types.map((edge) => `${edge.source} ${edge.relation} ${edge.target}`)}
                  />
                </div>
              </article>
            ) : null}

            {report?.quality ? <QualityPanel report={report.quality} /> : null}
            {report ? <SharedReport report={report} /> : reportStatus ? <LoadingBlock label={reportStatus} /> : null}
          </div>
        </section>
      </div>
    </main>
  )
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <section className="soft-card p-5 text-sm font-semibold text-muted">
      {label}
    </section>
  )
}

function SharedList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="subtle-panel p-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-muted">
        {items.map((item) => (
          <li className="break-words" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SharedReport({ report }: { report: ProjectReport }) {
  return (
    <section className="soft-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Read-only report</p>
          <h2 className="mt-1 text-xl font-bold">{report.schema_name}</h2>
          <p className="mt-2 text-sm text-muted">
            {report.overview.row_count.toLocaleString()} rows, {report.overview.column_count} columns,
            quality {report.quality.final_score.toFixed(1)}/100.
          </p>
        </div>
        <button className="btn-secondary" onClick={() => downloadSharedReport(report)} type="button">
          <Download className="h-4 w-4" aria-hidden="true" />
          Download JSON
        </button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SharedReportList title="Recommendations" items={report.recommendations} />
        <SharedReportList title="Next steps" items={report.next_steps} />
        <SharedReportList title="Suggested tasks" items={report.suggested_tasks} />
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <FileJson className="h-4 w-4" aria-hidden="true" />
        JSON export is generated from the same project report API.
      </div>
    </section>
  )
}

function SharedReportList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="subtle-panel p-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
        {(items.length ? items : ["None"]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function downloadSharedReport(report: ProjectReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `graphify-shared-report-${report.project_id}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
