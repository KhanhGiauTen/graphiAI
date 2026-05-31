"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

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
    setReportStatus("Loading report...")
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

  if (error) return <main className="p-8 text-rose-700">{error}</main>
  if (!project) return <main className="p-8 text-slate-600">Loading shared project...</main>

  const schema = project.graph_schemas.find((item) => item.id === selectedSchema) ?? project.graph_schemas[0]

  return (
    <main className="min-h-screen bg-panel px-6 py-8 text-ink">
      <div className="mx-auto grid max-w-6xl gap-6">
        <p className="text-sm font-semibold uppercase text-graph-blue">Shared Graphify AI Project</p>
        <h1 className="mt-3 text-3xl font-semibold">{project.name ?? project.original_filename}</h1>
        <p className="text-sm text-slate-600">Read-only schema preview and quality report.</p>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Suggested schemas</h2>
            <div className="mt-4 grid gap-3">
              {project.graph_schemas.map((item) => (
                <button
                  className={`rounded-md border p-3 text-left text-sm ${
                    item.id === selectedSchema ? "border-graph-blue bg-blue-50" : "border-slate-200"
                  }`}
                  key={item.id}
                  onClick={() => setSelectedSchema(item.id)}
                  type="button"
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="mt-1 block text-slate-600">Score: {item.quality_score.toFixed(1)}</span>
                </button>
              ))}
            </div>
          </div>

          {schema ? (
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Selected schema</p>
              <h2 className="mt-1 text-xl font-semibold">{schema.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{schema.description}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
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
        </section>

        {report?.quality ? <QualityPanel report={report.quality} /> : null}
        {report ? <SharedReport report={report} /> : reportStatus ? <LoadingBlock label={reportStatus} /> : null}
      </div>
    </main>
  )
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
      {label}
    </section>
  )
}

function SharedList({ items, title }: { items: string[]; title: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <ul className="mt-2 grid gap-1 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function SharedReport({ report }: { report: ProjectReport }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Read-only report</p>
          <h2 className="mt-1 text-xl font-semibold">{report.schema_name}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {report.overview.row_count.toLocaleString()} rows, {report.overview.column_count} columns,
            quality {report.quality.final_score.toFixed(1)}/100.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          onClick={() => downloadSharedReport(report)}
          type="button"
        >
          Download JSON
        </button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SharedReportList title="Recommendations" items={report.recommendations} />
        <SharedReportList title="Next steps" items={report.next_steps} />
        <SharedReportList title="Suggested tasks" items={report.suggested_tasks} />
      </div>
    </section>
  )
}

function SharedReportList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
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
