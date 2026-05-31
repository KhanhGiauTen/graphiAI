"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
  Gauge,
  GitBranch,
  Loader2,
  Network,
  Play,
  RefreshCw,
  Share2,
  Sparkles,
  TableProperties,
  Zap,
} from "lucide-react"

import { AppHeader } from "@/components/AppHeader"
import { GraphExplorer } from "@/components/graph/GraphExplorer"
import { QualityPanel } from "@/components/quality/QualityPanel"
import { api, apiBaseUrl } from "@/lib/api"
import type {
  AISchemaResponse,
  BaselineRunResponse,
  ColumnSemanticAnalysis,
  ExportBundle,
  GraphPreview,
  GraphQualityReport,
  GraphSchema,
  ProjectDetail,
  ProjectReport,
  SchemaExplanationResponse,
} from "@/types"

export default function ProjectPage() {
  const routeParams = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const demoRan = useRef(false)
  const projectId = routeParams.id
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [selectedSchema, setSelectedSchema] = useState<string>("")
  const [preview, setPreview] = useState<GraphPreview | null>(null)
  const [previewStatus, setPreviewStatus] = useState<string>("")
  const [exportBundle, setExportBundle] = useState<ExportBundle | null>(null)
  const [exportStatus, setExportStatus] = useState<string>("")
  const [baseline, setBaseline] = useState<BaselineRunResponse | null>(null)
  const [baselineStatus, setBaselineStatus] = useState<string>("")
  const [qualityReport, setQualityReport] = useState<GraphQualityReport | null>(null)
  const [projectReport, setProjectReport] = useState<ProjectReport | null>(null)
  const [reportStatus, setReportStatus] = useState<string>("")
  const [aiResponse, setAiResponse] = useState<AISchemaResponse | null>(null)
  const [aiStatus, setAiStatus] = useState<string>("")
  const [schemaExplanation, setSchemaExplanation] = useState<string>("")
  const [explanationStatus, setExplanationStatus] = useState<string>("")
  const [actionError, setActionError] = useState<string>("")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    api
      .get<ProjectDetail>(`/projects/${projectId}`)
      .then((response) => {
        setProject(response.data)
        setSelectedSchema(response.data.selected_schema_id ?? response.data.graph_schemas[0]?.id ?? "")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load project."))
  }, [projectId])

  useEffect(() => {
    if (searchParams.get("demo") !== "1" || demoRan.current || !project?.dataset_profile || !selectedSchema) {
      return
    }
    demoRan.current = true
    void runDemoSequence()
  }, [project, searchParams, selectedSchema])

  useEffect(() => {
    const focus = searchParams.get("focus")
    if (!focus) {
      return
    }
    const targetId =
      focus === "ai" ? "ai-schema-panel" : focus === "graph" ? "graph-explorer" : focus === "baseline" ? "baseline-results" : ""
    if (!targetId) {
      return
    }
    const ready = (focus === "ai" && aiResponse) || (focus === "graph" && preview) || (focus === "baseline" && baseline)
    if (ready) {
      window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ block: "start" }), 250)
    }
  }, [aiResponse, baseline, preview, searchParams])

  useEffect(() => {
    const currentSchema = project?.graph_schemas.find((item) => item.id === selectedSchema) ?? project?.graph_schemas[0]
    if (!project?.dataset_profile || !currentSchema) {
      setQualityReport(null)
      setProjectReport(null)
      return
    }

    let cancelled = false
    setReportStatus("Assessing schema quality")
    api
      .get<ProjectReport>(`/projects/${projectId}/report`, { params: { schema_id: currentSchema.id } })
      .then((response) => {
        if (cancelled) {
          return
        }
        setProjectReport(response.data)
        setQualityReport(response.data.quality)
      })
      .catch((err) => {
        if (!cancelled) {
          setActionError(err instanceof Error ? err.message : "Project report failed.")
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
  }, [project?.dataset_profile, project?.graph_schemas, projectId, selectedSchema])

  async function buildPreview(schemaId: string) {
    setActionError("")
    setPreviewStatus("Building animated graph")
    try {
      const response = await api.post<GraphPreview>(`/graph/build/${projectId}`, {
        schema_id: schemaId,
        sample_size: 300,
      })
      setPreview(response.data)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Graph preview failed.")
    } finally {
      setPreviewStatus("")
    }
  }

  async function exportProject(schemaId: string) {
    setActionError("")
    setExportStatus("Creating export")
    try {
      const response = await api.post<ExportBundle>(`/export/${projectId}`, { schema_id: schemaId })
      setExportBundle(response.data)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed.")
    } finally {
      setExportStatus("")
    }
  }

  async function runBaseline(schemaId: string) {
    setActionError("")
    setBaselineStatus("Running baseline")
    try {
      const response = await api.post<BaselineRunResponse>(`/experiments/baseline/${projectId}`, {
        schema_id: schemaId,
        test_size: 0.3,
      })
      setBaseline(response.data)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Baseline run failed.")
    } finally {
      setBaselineStatus("")
    }
  }

  async function runAiSchemaAnalysis() {
    setActionError("")
    setAiStatus("Analyzing schema")
    setSchemaExplanation("")
    try {
      const response = await api.post<AISchemaResponse>(`/ai/schema/analyze/${projectId}`)
      setAiResponse(response.data)
      const nextSchemaId = response.data.schemas[0]?.id ?? ""
      setProject((current) =>
        current
          ? {
              ...current,
              graph_schemas: response.data.schemas,
              selected_schema_id: nextSchemaId,
              status: response.data.mode === "llm" ? "ai_schema_recommended" : "ai_schema_heuristic",
            }
          : current,
      )
      setSelectedSchema(nextSchemaId)
      setPreview(null)
      setBaseline(null)
      setExportBundle(null)
      setQualityReport(null)
      setProjectReport(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "AI schema analysis failed.")
    } finally {
      setAiStatus("")
    }
  }

  async function explainSchema(graphSchema: GraphSchema) {
    if (!project?.dataset_profile) {
      setActionError("Project must be profiled before schema explanation.")
      return
    }
    setActionError("")
    setExplanationStatus("Generating explanation")
    try {
      const response = await api.post<SchemaExplanationResponse>("/ai/schema/explain", {
        profile: project.dataset_profile,
        schema: graphSchema,
        semantics: aiResponse?.semantics ?? null,
      })
      setSchemaExplanation(response.data.explanation)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Schema explanation failed.")
    } finally {
      setExplanationStatus("")
    }
  }

  async function shareProject() {
    setActionError("")
    try {
      const response = await api.post<ProjectDetail>(`/projects/${projectId}/share`)
      setProject(response.data)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Share link creation failed.")
    }
  }

  function selectSchema(schemaId: string) {
    setSelectedSchema(schemaId)
    setPreview(null)
    setBaseline(null)
    setSchemaExplanation("")
    setExportBundle(null)
    setQualityReport(null)
    setProjectReport(null)
    setActionError("")
  }

  async function runDemoSequence() {
    setActionError("")
    setAiStatus("Preparing demo")
    try {
      const ai = await api.post<AISchemaResponse>(`/ai/schema/analyze/${projectId}`)
      const graphSchema = ai.data.schemas[0]
      if (!graphSchema || !project?.dataset_profile) {
        throw new Error("Demo project does not have a schema-ready profile.")
      }

      setAiResponse(ai.data)
      setProject((current) =>
        current
          ? {
              ...current,
              graph_schemas: ai.data.schemas,
              selected_schema_id: graphSchema.id,
              status: ai.data.mode === "llm" ? "ai_schema_recommended" : "ai_schema_heuristic",
            }
          : current,
      )
      setSelectedSchema(graphSchema.id)

      const explanation = await api.post<SchemaExplanationResponse>("/ai/schema/explain", {
        profile: project.dataset_profile,
        schema: graphSchema,
        semantics: ai.data.semantics,
      })
      setSchemaExplanation(explanation.data.explanation)

      const graph = await api.post<GraphPreview>(`/graph/build/${projectId}`, {
        schema_id: graphSchema.id,
        sample_size: 300,
      })
      setPreview(graph.data)

      const experiment = await api.post<BaselineRunResponse>(`/experiments/baseline/${projectId}`, {
        schema_id: graphSchema.id,
        test_size: 0.3,
      })
      setBaseline(experiment.data)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Demo sequence failed.")
    } finally {
      setAiStatus("")
    }
  }

  if (error) {
    return <main className="app-shell p-8 text-rose-700">{error}</main>
  }

  if (!project) {
    return (
      <main className="app-shell p-8 text-muted">
        <div className="mx-auto max-w-3xl">
          <LoadingBlock label="Loading project dashboard" />
        </div>
      </main>
    )
  }

  const schema = project.graph_schemas.find((item) => item.id === selectedSchema) ?? project.graph_schemas[0]
  const captureMode = searchParams.get("capture")
  const progressSteps = [
    { label: "Uploaded", done: Boolean(project.original_filename) },
    { label: "Profiled", done: Boolean(project.dataset_profile) },
    { label: "Schemas", done: project.graph_schemas.length > 0 },
    { label: "Quality", done: Boolean(qualityReport), active: Boolean(reportStatus) },
    { label: "AI Schema", done: Boolean(aiResponse) || project.status.startsWith("ai_schema"), active: Boolean(aiStatus) },
    { label: "Graph", done: Boolean(preview), active: Boolean(previewStatus) },
    { label: "Baseline", done: Boolean(baseline), active: Boolean(baselineStatus) },
    { label: "Export", done: Boolean(exportBundle), active: Boolean(exportStatus) },
  ]

  if (captureMode === "ai") {
    return (
      <main className="app-shell px-6 py-8 text-ink">
        <div className="mx-auto grid max-w-7xl gap-6">
          {aiResponse ? (
            <AiSchemaPanel
              aiResponse={aiResponse}
              aiStatus={aiStatus}
              disabled={!project.dataset_profile}
              onAnalyze={runAiSchemaAnalysis}
              semantics={aiResponse.semantics}
            />
          ) : (
            <LoadingBlock label="Preparing AI schema demo" />
          )}
        </div>
      </main>
    )
  }

  if (captureMode === "graph") {
    return (
      <main className="app-shell px-6 py-8 text-ink">
        <div className="mx-auto grid max-w-7xl gap-6">
          {preview ? <GraphExplorer preview={preview} /> : <LoadingBlock label="Preparing graph explorer demo" />}
        </div>
      </main>
    )
  }

  if (captureMode === "quality") {
    return (
      <main className="app-shell px-6 py-8 text-ink">
        <div className="mx-auto grid max-w-7xl gap-6">
          {qualityReport ? <QualityPanel report={qualityReport} /> : <LoadingBlock label="Preparing quality report demo" />}
          {projectReport ? (
            <ProjectReportPanel onDownload={() => downloadProjectReport(projectReport)} report={projectReport} />
          ) : null}
        </div>
      </main>
    )
  }

  if (captureMode === "baseline") {
    return (
      <main className="app-shell px-6 py-8 text-ink">
        <div className="mx-auto grid max-w-7xl gap-6">
          {baseline ? <BaselinePanel baseline={baseline} /> : <LoadingBlock label="Preparing baseline demo" />}
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell text-ink">
      <AppHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 pb-10">
        <ProjectHero project={project} qualityReport={qualityReport} />

        {actionError ? (
          <div className="flex items-center gap-2 rounded-card border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-line">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {actionError}
          </div>
        ) : null}

        <ProjectProgress steps={progressSteps} />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-6">
            <WorkflowActions
              aiStatus={aiStatus}
              baseline={baseline}
              baselineStatus={baselineStatus}
              disabled={!schema}
              exportBundle={exportBundle}
              exportStatus={exportStatus}
              explanationStatus={explanationStatus}
              onAi={runAiSchemaAnalysis}
              onBuildGraph={() => schema && buildPreview(schema.id)}
              onExplain={() => schema && explainSchema(schema)}
              onExport={() => schema && exportProject(schema.id)}
              onRunBaseline={() => schema && runBaseline(schema.id)}
              onShare={shareProject}
              preview={preview}
              previewStatus={previewStatus}
              project={project}
              projectId={projectId}
            />

            {schema ? (
              <SelectedSchemaPanel
                explanation={schemaExplanation}
                explanationStatus={explanationStatus}
                onBuildPreview={() => buildPreview(schema.id)}
                onExplain={() => explainSchema(schema)}
                previewStatus={previewStatus}
                schema={schema}
              />
            ) : null}

            {qualityReport ? <QualityPanel report={qualityReport} /> : reportStatus ? <LoadingBlock label={reportStatus} /> : null}

            {projectReport ? (
              <ProjectReportPanel onDownload={() => downloadProjectReport(projectReport)} report={projectReport} />
            ) : null}

            <AiSchemaPanel
              aiResponse={aiResponse}
              aiStatus={aiStatus}
              disabled={!project.dataset_profile}
              onAnalyze={runAiSchemaAnalysis}
              semantics={aiResponse?.semantics ?? null}
            />

            {preview ? <GraphExplorer preview={preview} /> : null}

            {baseline ? <BaselinePanel baseline={baseline} /> : null}
          </div>

          <aside className="grid h-fit gap-5 xl:sticky xl:top-6">
            <Overview project={project} />
            <SchemaList schemas={project.graph_schemas} selectedSchema={selectedSchema} onSelect={selectSchema} />
            <SharePanel onShare={shareProject} project={project} />
          </aside>
        </section>
      </div>
    </main>
  )
}

function ProjectHero({
  project,
  qualityReport,
}: {
  project: ProjectDetail
  qualityReport: GraphQualityReport | null
}) {
  return (
    <section className="grid gap-5 border-t border-border-soft pt-8 lg:grid-cols-[1fr_360px] lg:items-stretch">
      <div className="soft-card p-6">
        <a className="btn-ghost -ml-2 mb-4 w-fit" href="/upload">
          <UploadBackIcon />
          New upload
        </a>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="pill border-cyan-100 bg-cyan-50 text-graph-cyan">Project dashboard</span>
            <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">{project.name ?? project.original_filename}</h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              Profile schema candidates, build the animated preview, inspect quality guardrails, run a quick baseline,
              and create a reusable export bundle.
            </p>
          </div>
          <StatusBadge status={project.status} />
        </div>
      </div>

      <div className="soft-card grid content-between gap-4 p-5">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Selected quality</p>
          <p className="mt-2 text-4xl font-bold text-ink">{qualityReport ? qualityReport.final_score.toFixed(1) : "--"}</p>
          <p className="mt-1 text-sm font-semibold text-muted">out of 100 graph suitability points</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniMetric label="Schemas" value={project.graph_schemas.length.toString()} />
          <MiniMetric label="Visibility" value={project.visibility} />
        </div>
      </div>
    </section>
  )
}

function UploadBackIcon() {
  return <TableProperties className="h-4 w-4" aria-hidden="true" />
}

function StatusBadge({ status }: { status: string }) {
  return <span className="pill bg-surface-muted capitalize">{status.replaceAll("_", " ")}</span>
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <section className="soft-card p-5">
      <div className="flex items-center gap-3 text-sm font-semibold text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-graph-cyan" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-4 grid gap-3">
        <div className="skeleton h-4 w-2/3 rounded-full" />
        <div className="skeleton h-4 w-1/2 rounded-full" />
      </div>
    </section>
  )
}

function downloadProjectReport(report: ProjectReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `graphify-report-${report.project_id}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function ProjectProgress({
  steps,
}: {
  steps: Array<{
    label: string
    done: boolean
    active?: boolean
  }>
}) {
  return (
    <section className="soft-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Project progress</p>
          <h2 className="mt-1 text-xl font-bold">Demo workflow</h2>
        </div>
        <p className="pill">{steps.filter((step) => step.done).length}/{steps.length} complete</p>
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {steps.map((step, index) => {
          const stateClass = step.done
            ? "border-emerald-200 bg-emerald-50 text-graph-green"
            : step.active
              ? "border-cyan-200 bg-cyan-50 text-graph-cyan"
              : "border-border-soft bg-surface-muted text-muted"
          return (
            <li className={`min-h-20 rounded-card border p-3 ${stateClass}`} key={step.label}>
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold shadow-line">
                  {step.done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span className="text-sm font-bold">{step.label}</span>
              </div>
              <p className="mt-2 text-xs font-semibold">{step.done ? "Done" : step.active ? "Running" : "Pending"}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function WorkflowActions({
  aiStatus,
  baseline,
  baselineStatus,
  disabled,
  exportBundle,
  exportStatus,
  explanationStatus,
  onAi,
  onBuildGraph,
  onExplain,
  onExport,
  onRunBaseline,
  onShare,
  preview,
  previewStatus,
  project,
  projectId,
}: {
  aiStatus: string
  baseline: BaselineRunResponse | null
  baselineStatus: string
  disabled: boolean
  exportBundle: ExportBundle | null
  exportStatus: string
  explanationStatus: string
  onAi: () => void
  onBuildGraph: () => void
  onExplain: () => void
  onExport: () => void
  onRunBaseline: () => void
  onShare: () => void
  preview: GraphPreview | null
  previewStatus: string
  project: ProjectDetail
  projectId: string
}) {
  return (
    <section className="soft-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Workflow actions</p>
          <h2 className="mt-1 text-xl font-bold">Run the local graph pipeline</h2>
        </div>
        <span className="pill bg-surface-muted">Selected schema required</span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ActionButton icon={<Sparkles className="h-4 w-4" />} label="Run AI Schema" loading={aiStatus} onClick={onAi} />
        <ActionButton icon={<Bot className="h-4 w-4" />} label="Explain Schema" loading={explanationStatus} onClick={onExplain} disabled={disabled} />
        <ActionButton icon={<Network className="h-4 w-4" />} label="Build Animated Graph" loading={previewStatus} onClick={onBuildGraph} disabled={disabled} done={Boolean(preview)} />
        <ActionButton icon={<Play className="h-4 w-4" />} label="Run Baseline" loading={baselineStatus} onClick={onRunBaseline} disabled={disabled} done={Boolean(baseline)} />
        <ActionButton icon={<Download className="h-4 w-4" />} label="Create Export" loading={exportStatus} onClick={onExport} disabled={disabled} done={Boolean(exportBundle)} />
        <ActionButton icon={<Share2 className="h-4 w-4" />} label="Share" onClick={onShare} done={Boolean(project.share_token)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {exportBundle ? (
          <a className="btn-secondary" href={`${apiBaseUrl}/export/${projectId}/download`}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download ZIP
          </a>
        ) : null}
        {project.share_token ? (
          <a className="btn-secondary" href={`/s/${project.share_token}`}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open shared report
          </a>
        ) : null}
      </div>
    </section>
  )
}

function ActionButton({
  disabled,
  done,
  icon,
  label,
  loading,
  onClick,
}: {
  disabled?: boolean
  done?: boolean
  icon: React.ReactNode
  label: string
  loading?: string
  onClick: () => void
}) {
  return (
    <button className="btn-secondary justify-between" disabled={disabled || Boolean(loading)} onClick={onClick} type="button">
      <span className="flex items-center gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
        {loading || label}
      </span>
      {done ? <CheckCircle2 className="h-4 w-4 text-graph-green" aria-hidden="true" /> : null}
    </button>
  )
}

function SelectedSchemaPanel({
  explanation,
  explanationStatus,
  onBuildPreview,
  onExplain,
  previewStatus,
  schema,
}: {
  explanation: string
  explanationStatus: string
  onBuildPreview: () => void
  onExplain: () => void
  previewStatus: string
  schema: GraphSchema
}) {
  return (
    <section className="soft-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Selected schema</p>
          <h2 className="mt-1 text-2xl font-bold">{schema.name}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{schema.description}</p>
        </div>
        <ScorePill score={schema.quality_score} />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <SchemaItems title="Nodes" items={schema.node_types.map((node) => `${node.name} from ${node.source_column}`)} />
        <SchemaItems title="Edges" items={schema.edge_types.map((edge) => `${edge.source} ${edge.relation} ${edge.target}`)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="btn-primary" disabled={Boolean(previewStatus)} onClick={onBuildPreview} type="button">
          {previewStatus ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Network className="h-4 w-4" aria-hidden="true" />}
          {previewStatus || "Build Preview"}
        </button>
        <button className="btn-secondary" disabled={Boolean(explanationStatus)} onClick={onExplain} type="button">
          {explanationStatus ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
          {explanationStatus || "Explain Schema"}
        </button>
      </div>
      {explanation ? <ExplanationBlock explanation={explanation} /> : null}
    </section>
  )
}

function ProjectReportPanel({ onDownload, report }: { onDownload: () => void; report: ProjectReport }) {
  return (
    <section className="soft-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Schema report</p>
          <h2 className="mt-1 text-xl font-bold">{report.schema_name}</h2>
          <p className="mt-2 text-sm text-muted">
            Generated {new Date(report.generated_at).toLocaleString()} for {report.filename ?? "dataset"}.
          </p>
        </div>
        <button className="btn-secondary" onClick={onDownload} type="button">
          <FileJson className="h-4 w-4" aria-hidden="true" />
          Download JSON
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <ReportMetric label="Rows" value={report.overview.row_count.toLocaleString()} />
        <ReportMetric label="Columns" value={report.overview.column_count.toLocaleString()} />
        <ReportMetric label="Missing" value={`${(report.overview.missing_rate * 100).toFixed(1)}%`} />
        <ReportMetric label="Quality" value={`${report.quality.final_score.toFixed(1)}/100`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ReportList title="Recommendations" items={report.recommendations} />
        <ReportList title="Next steps" items={report.next_steps} />
        <ReportList title="Suggested tasks" items={report.suggested_tasks} />
      </div>
    </section>
  )
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="subtle-panel p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
    </div>
  )
}

function ReportList({ items, title }: { items: string[]; title: string }) {
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

function Overview({ project }: { project: ProjectDetail }) {
  const profile = project.dataset_profile
  return (
    <section className="soft-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-card bg-cyan-50 text-graph-cyan">
          <TableProperties className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold">Dataset overview</h2>
      </div>
      {profile ? (
        <div className="mt-4 grid gap-3">
          <MiniMetric label="Rows" value={profile.row_count.toLocaleString()} />
          <MiniMetric label="Columns" value={profile.column_count.toLocaleString()} />
          <MiniMetric label="Missing" value={`${(profile.total_missing_rate * 100).toFixed(1)}%`} />
          <div className="subtle-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">ID columns</p>
            <p className="mt-2 break-words text-sm font-semibold text-ink">{profile.id_columns.join(", ") || "None"}</p>
          </div>
          <div className="subtle-panel p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Labels</p>
            <p className="mt-2 break-words text-sm font-semibold text-ink">{profile.label_columns.join(", ") || "None"}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No profile yet.</p>
      )}
    </section>
  )
}

function AiSchemaPanel({
  aiResponse,
  aiStatus,
  disabled,
  onAnalyze,
  semantics,
}: {
  aiResponse: AISchemaResponse | null
  aiStatus: string
  disabled: boolean
  onAnalyze: () => void
  semantics: ColumnSemanticAnalysis | null
}) {
  const topSemantics = semantics?.columns.slice(0, 8) ?? []
  return (
    <section className="soft-card p-5" id="ai-schema-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">AI Graph Engineer</p>
          <h2 className="mt-1 text-xl font-bold">
            {aiResponse ? `${aiResponse.mode.replaceAll("_", " ")} schema analysis` : "Schema understanding"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
            Interpret columns, rank graph schemas, and generate explanations. The app falls back to deterministic
            heuristics when hosted LLM mode is not configured.
          </p>
        </div>
        <button className="btn-primary" disabled={disabled || Boolean(aiStatus)} onClick={onAnalyze} type="button">
          {aiStatus ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {aiStatus || "Run AI Schema"}
        </button>
      </div>

      {semantics ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.25fr]">
          <div className="subtle-panel p-4">
            <h3 className="text-sm font-bold text-ink">Dataset read</h3>
            <p className="mt-2 text-sm leading-7 text-muted">{semantics.dataset_summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {semantics.potential_tasks.map((task) => (
                <span className="pill border-indigo-100 bg-indigo-50 text-accent-indigo" key={task}>
                  {task}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-card border border-border-soft bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-muted">
                <tr>
                  <th className="p-3">Column</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Meaning</th>
                  <th className="p-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {topSemantics.map((column) => (
                  <tr className="border-t border-border-soft" key={column.column_name}>
                    <td className="p-3 font-bold text-ink">{column.column_name}</td>
                    <td className="p-3 text-muted">{column.role}</td>
                    <td className="p-3 text-muted">{column.semantic_meaning}</td>
                    <td className="p-3 font-semibold text-graph-cyan">{Math.round(column.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {aiResponse?.warnings.length ? (
        <ul className="mt-4 grid gap-2 text-sm text-amber-800">
          {aiResponse.warnings.map((warning) => (
            <li className="rounded-card border border-amber-200 bg-amber-50 px-3 py-2" key={warning}>
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function SchemaList({
  schemas,
  selectedSchema,
  onSelect,
}: {
  schemas: GraphSchema[]
  selectedSchema: string
  onSelect: (schemaId: string) => void
}) {
  return (
    <section className="soft-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-card bg-indigo-50 text-accent-indigo">
          <GitBranch className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold">Suggested schemas</h2>
      </div>
      <div className="mt-4 grid gap-3">
        {schemas.map((schema) => (
          <button
            className={`block w-full rounded-card border p-4 text-left text-sm shadow-line ${
              schema.id === selectedSchema ? "border-cyan-200 bg-cyan-50/70" : "border-border-soft bg-white hover:border-cyan-200"
            }`}
            key={schema.id}
            onClick={() => onSelect(schema.id)}
            type="button"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="font-bold text-ink">{schema.name}</span>
              <ScorePill score={schema.quality_score} small />
            </span>
            <span className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-muted">
              <span>{schema.node_types.length} nodes</span>
              <span>{schema.edge_types.length} edges</span>
              <span>{schema.warnings.length} warnings</span>
            </span>
            <span className="mt-3 flex flex-wrap gap-2">
              {schema.suggested_tasks.slice(0, 2).map((task) => (
                <span className="pill bg-surface-muted" key={task}>
                  {task}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function SharePanel({ onShare, project }: { onShare: () => void; project: ProjectDetail }) {
  return (
    <section className="soft-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-card bg-emerald-50 text-graph-green">
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold">Share</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">Create a read-only report link for schema and quality review.</p>
      <button className="btn-secondary mt-4 w-full" onClick={onShare} type="button">
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {project.share_token ? "Refresh link" : "Create link"}
      </button>
      {project.share_token ? (
        <a className="btn-primary mt-3 w-full" href={`/s/${project.share_token}`}>
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open shared view
        </a>
      ) : null}
    </section>
  )
}

function SchemaItems({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="subtle-panel p-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-muted">
        {items.map((item) => (
          <li className="break-words" key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function ExplanationBlock({ explanation }: { explanation: string }) {
  return (
    <div className="mt-5 subtle-panel p-4">
      <h3 className="text-sm font-bold text-ink">Schema explanation</h3>
      <div className="mt-3 grid gap-2 text-sm leading-7 text-muted">
        {explanation
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => (
            <p key={line}>{line.replace(/^#+\s*/, "")}</p>
          ))}
      </div>
    </div>
  )
}

function BaselinePanel({ baseline }: { baseline: BaselineRunResponse }) {
  const metrics = baseline.metrics
  return (
    <section className="soft-card p-5" id="baseline-results">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Experiment baseline</p>
          <h2 className="mt-1 text-xl font-bold">{baseline.model_name}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{baseline.summary}</p>
        </div>
        <span className="pill bg-surface-muted">{baseline.mode.replaceAll("_", " ")}</span>
      </div>

      {metrics ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          <Metric label="F1" value={metrics.f1} />
          <Metric label="Accuracy" value={metrics.accuracy} />
          <Metric label="Precision" value={metrics.precision} />
          <Metric label="Recall" value={metrics.recall} />
          <Metric label="Support" value={metrics.support} raw />
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="subtle-panel p-4">
          <h3 className="text-sm font-bold text-ink">Target</h3>
          <dl className="mt-3 grid gap-2 text-sm text-muted">
            {Object.entries(baseline.target).map(([key, value]) => (
              <div className="grid grid-cols-[110px_1fr] gap-2" key={key}>
                <dt className="truncate">{key}</dt>
                <dd className="truncate font-bold text-ink">{value ?? "None"}</dd>
              </div>
            ))}
            {baseline.rule ? (
              <>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <dt>Rule</dt>
                  <dd className="font-bold text-ink">
                    {baseline.rule.feature} {baseline.rule.direction === "gte" ? ">=" : "<="} {baseline.rule.threshold}
                  </dd>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <dt>Train F1</dt>
                  <dd className="font-bold text-ink">{baseline.rule.train_f1.toFixed(3)}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </div>

        <div className="subtle-panel p-4">
          <h3 className="text-sm font-bold text-ink">Labels</h3>
          <div className="mt-3 grid gap-2">
            {Object.entries(baseline.label_distribution).map(([label, count]) => (
              <div className="flex items-center justify-between text-sm" key={label}>
                <span className="text-muted">{label}</span>
                <span className="font-bold text-ink">{count}</span>
              </div>
            ))}
            {!Object.keys(baseline.label_distribution).length ? <p className="text-sm text-muted">No supervised labels</p> : null}
          </div>
        </div>

        <div className="subtle-panel p-4">
          <h3 className="text-sm font-bold text-ink">Warnings</h3>
          <ul className="mt-3 grid gap-2 text-sm text-muted">
            {(baseline.warnings.length ? baseline.warnings : ["No baseline warnings."]).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 max-h-80 overflow-auto rounded-card border border-border-soft bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-muted">
            <tr>
              <th className="p-3">Node</th>
              <th className="p-3">Score</th>
              <th className="p-3">Predicted</th>
              <th className="p-3">Actual</th>
            </tr>
          </thead>
          <tbody>
            {baseline.top_predictions.map((prediction) => (
              <tr className="border-t border-border-soft" key={prediction.node_id}>
                <td className="p-3">{prediction.node_id}</td>
                <td className="p-3">{prediction.score.toFixed(3)}</td>
                <td className="p-3">{prediction.predicted_label ?? "N/A"}</td>
                <td className="p-3">{prediction.true_label ?? "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric({ label, raw, value }: { label: string; raw?: boolean; value: number }) {
  return (
    <div className="subtle-panel p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{raw ? value : value.toFixed(3)}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="subtle-panel p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 truncate text-sm font-bold text-ink">{value}</p>
    </div>
  )
}

function ScorePill({ score, small }: { score: number; small?: boolean }) {
  const color = score >= 75 ? "border-emerald-100 bg-emerald-50 text-graph-green" : score >= 55 ? "border-amber-100 bg-amber-50 text-graph-amber" : "border-rose-100 bg-rose-50 text-graph-rose"
  return <span className={`pill ${color} ${small ? "px-2 py-0.5 text-[11px]" : ""}`}>{score.toFixed(1)}</span>
}
