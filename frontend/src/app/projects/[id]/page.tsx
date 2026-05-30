"use client"

import { useEffect, useState } from "react"

import { GraphExplorer } from "@/components/graph/GraphExplorer"
import { api, apiBaseUrl } from "@/lib/api"
import type {
  AISchemaResponse,
  BaselineRunResponse,
  ColumnSemanticAnalysis,
  ExportBundle,
  GraphPreview,
  GraphSchema,
  ProjectDetail,
  SchemaExplanationResponse,
} from "@/types"


interface ProjectPageProps {
  params: {
    id: string
  }
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [selectedSchema, setSelectedSchema] = useState<string>("")
  const [preview, setPreview] = useState<GraphPreview | null>(null)
  const [previewStatus, setPreviewStatus] = useState<string>("")
  const [exportBundle, setExportBundle] = useState<ExportBundle | null>(null)
  const [exportStatus, setExportStatus] = useState<string>("")
  const [baseline, setBaseline] = useState<BaselineRunResponse | null>(null)
  const [baselineStatus, setBaselineStatus] = useState<string>("")
  const [aiResponse, setAiResponse] = useState<AISchemaResponse | null>(null)
  const [aiStatus, setAiStatus] = useState<string>("")
  const [schemaExplanation, setSchemaExplanation] = useState<string>("")
  const [explanationStatus, setExplanationStatus] = useState<string>("")
  const [actionError, setActionError] = useState<string>("")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    api
      .get<ProjectDetail>(`/projects/${params.id}`)
      .then((response) => {
        setProject(response.data)
        setSelectedSchema(response.data.selected_schema_id ?? response.data.graph_schemas[0]?.id ?? "")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load project."))
  }, [params.id])

  async function buildPreview(schemaId: string) {
    setActionError("")
    setPreviewStatus("Building preview...")
    try {
      const response = await api.post<GraphPreview>(`/graph/build/${params.id}`, {
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
    setExportStatus("Creating ZIP...")
    try {
      const response = await api.post<ExportBundle>(`/export/${params.id}`, { schema_id: schemaId })
      setExportBundle(response.data)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed.")
    } finally {
      setExportStatus("")
    }
  }

  async function runBaseline(schemaId: string) {
    setActionError("")
    setBaselineStatus("Running baseline...")
    try {
      const response = await api.post<BaselineRunResponse>(`/experiments/baseline/${params.id}`, {
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
    setAiStatus("Analyzing with AI...")
    setSchemaExplanation("")
    try {
      const response = await api.post<AISchemaResponse>(`/ai/schema/analyze/${params.id}`)
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
    setExplanationStatus("Generating explanation...")
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
      const response = await api.post<ProjectDetail>(`/projects/${params.id}/share`)
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
    setActionError("")
  }

  if (error) {
    return <main className="p-8 text-rose-700">{error}</main>
  }

  if (!project) {
    return <main className="p-8 text-slate-600">Loading project...</main>
  }

  const schema = project.graph_schemas.find((item) => item.id === selectedSchema) ?? project.graph_schemas[0]

  return (
    <main className="min-h-screen bg-panel px-6 py-8 text-ink">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="border-b border-slate-200 pb-5">
          <a className="text-sm font-medium text-graph-blue" href="/upload">
            New upload
          </a>
          <h1 className="mt-3 text-3xl font-semibold">{project.name ?? project.original_filename}</h1>
          <p className="mt-2 text-sm text-slate-600">Status: {project.status}</p>
        </header>

        {actionError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {actionError}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <Overview project={project} />
          <SchemaList
            schemas={project.graph_schemas}
            selectedSchema={selectedSchema}
            onSelect={selectSchema}
          />
          <ExportPanel
            baselineStatus={baselineStatus}
            bundle={exportBundle}
            disabled={!schema}
            exportStatus={exportStatus}
            onExport={() => schema && exportProject(schema.id)}
            onRunBaseline={() => schema && runBaseline(schema.id)}
            projectId={params.id}
          />
        </section>

        <AiSchemaPanel
          aiResponse={aiResponse}
          aiStatus={aiStatus}
          disabled={!project.dataset_profile}
          onAnalyze={runAiSchemaAnalysis}
          semantics={aiResponse?.semantics ?? null}
        />

        {schema ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Selected schema</p>
                <h2 className="mt-1 text-xl font-semibold">{schema.name}</h2>
              </div>
              <button
                className="rounded-md bg-graph-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={Boolean(previewStatus)}
                onClick={() => buildPreview(schema.id)}
                type="button"
              >
                {previewStatus || "Build Preview"}
              </button>
              <button
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                disabled={Boolean(explanationStatus)}
                onClick={() => explainSchema(schema)}
                type="button"
              >
                {explanationStatus || "Explain Schema"}
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{schema.description}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SchemaItems title="Nodes" items={schema.node_types.map((node) => `${node.name} from ${node.source_column}`)} />
              <SchemaItems title="Edges" items={schema.edge_types.map((edge) => `${edge.source} ${edge.relation} ${edge.target}`)} />
            </div>
            {schemaExplanation ? <ExplanationBlock explanation={schemaExplanation} /> : null}
          </section>
        ) : null}

        {preview ? <GraphExplorer preview={preview} /> : null}

        {baseline ? <BaselinePanel baseline={baseline} /> : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Sharing</h2>
          <button className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={shareProject} type="button">
            Create read-only link
          </button>
          {project.share_token ? (
            <a className="ml-4 text-sm font-medium text-graph-blue" href={`/s/${project.share_token}`}>
              Open shared view
            </a>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function Overview({ project }: { project: ProjectDetail }) {
  const profile = project.dataset_profile
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Dataset Overview</h2>
      {profile ? (
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>Rows: {profile.row_count}</p>
          <p>Columns: {profile.column_count}</p>
          <p>Missing: {(profile.total_missing_rate * 100).toFixed(1)}%</p>
          <p>ID columns: {profile.id_columns.join(", ") || "None"}</p>
          <p>Labels: {profile.label_columns.join(", ") || "None"}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No profile yet.</p>
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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">AI Graph Engineer</p>
          <h2 className="mt-1 text-xl font-semibold">
            {aiResponse ? `${aiResponse.mode.replaceAll("_", " ")} schema analysis` : "Schema understanding"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Run the AI schema layer to interpret columns, replace the project schema set with ranked AI proposals,
            and unlock schema-specific explanations.
          </p>
        </div>
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={disabled || Boolean(aiStatus)}
          onClick={onAnalyze}
          type="button"
        >
          {aiStatus || "Run AI Schema"}
        </button>
      </div>

      {semantics ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-md border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700">Dataset read</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{semantics.dataset_summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {semantics.potential_tasks.map((task) => (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-graph-blue" key={task}>
                  {task}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-2">Column</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Meaning</th>
                  <th className="p-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {topSemantics.map((column) => (
                  <tr className="border-t border-slate-100" key={column.column_name}>
                    <td className="p-2 font-medium text-slate-800">{column.column_name}</td>
                    <td className="p-2 text-slate-600">{column.role}</td>
                    <td className="p-2 text-slate-600">{column.semantic_meaning}</td>
                    <td className="p-2 text-slate-600">{Math.round(column.confidence * 100)}%</td>
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
            <li className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2" key={warning}>
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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Suggested Schemas</h2>
      <div className="mt-4 space-y-3">
        {schemas.map((schema) => (
          <button
            className={`block w-full rounded-md border p-3 text-left text-sm ${
              schema.id === selectedSchema ? "border-graph-blue bg-blue-50" : "border-slate-200"
            }`}
            key={schema.id}
            onClick={() => onSelect(schema.id)}
            type="button"
          >
            <span className="font-semibold">{schema.name}</span>
            <span className="mt-1 block text-slate-600">Score: {schema.quality_score.toFixed(1)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function ExportPanel({
  baselineStatus,
  bundle,
  disabled,
  exportStatus,
  onExport,
  onRunBaseline,
  projectId,
}: {
  baselineStatus: string
  bundle: ExportBundle | null
  disabled: boolean
  exportStatus: string
  onExport: () => void
  onRunBaseline: () => void
  projectId: string
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Export</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Download schema, graph tables, NetworkX builder, PyG helper, and a starter notebook.
      </p>
      <button
        className="mt-4 rounded-md bg-graph-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={disabled || Boolean(exportStatus)}
        onClick={onExport}
        type="button"
      >
        {exportStatus || "Create ZIP"}
      </button>
      {bundle ? (
        <a
          className="mt-4 block text-sm font-medium text-graph-blue"
          href={`${apiBaseUrl}/export/${projectId}/download`}
        >
          Download ZIP
        </a>
      ) : null}
      <button
        className="mt-4 block rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        disabled={disabled || Boolean(baselineStatus)}
        onClick={onRunBaseline}
        type="button"
      >
        {baselineStatus || "Run Baseline"}
      </button>
    </section>
  )
}

function SchemaItems({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function ExplanationBlock({ explanation }: { explanation: string }) {
  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-700">Schema explanation</h3>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Experiment baseline</p>
          <h2 className="mt-1 text-xl font-semibold">{baseline.model_name}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{baseline.summary}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {baseline.mode.replaceAll("_", " ")}
        </span>
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
        <div className="rounded-md border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Target</h3>
          <dl className="mt-3 grid gap-2 text-sm text-slate-600">
            {Object.entries(baseline.target).map(([key, value]) => (
              <div className="grid grid-cols-[110px_1fr] gap-2" key={key}>
                <dt className="truncate text-slate-500">{key}</dt>
                <dd className="truncate font-medium text-slate-700">{value ?? "None"}</dd>
              </div>
            ))}
            {baseline.rule ? (
              <>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <dt className="text-slate-500">Rule</dt>
                  <dd className="font-medium text-slate-700">
                    {baseline.rule.feature} {baseline.rule.direction === "gte" ? ">=" : "<="} {baseline.rule.threshold}
                  </dd>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <dt className="text-slate-500">Train F1</dt>
                  <dd className="font-medium text-slate-700">{baseline.rule.train_f1.toFixed(3)}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </div>

        <div className="rounded-md border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Labels</h3>
          <div className="mt-3 grid gap-2">
            {Object.entries(baseline.label_distribution).map(([label, count]) => (
              <div className="flex items-center justify-between text-sm" key={label}>
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-slate-800">{count}</span>
              </div>
            ))}
            {!Object.keys(baseline.label_distribution).length ? (
              <p className="text-sm text-slate-500">No supervised labels</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Warnings</h3>
          <ul className="mt-3 grid gap-2 text-sm text-slate-600">
            {(baseline.warnings.length ? baseline.warnings : ["No baseline warnings."]).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 max-h-80 overflow-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-2">Node</th>
              <th className="p-2">Score</th>
              <th className="p-2">Predicted</th>
              <th className="p-2">Actual</th>
            </tr>
          </thead>
          <tbody>
            {baseline.top_predictions.map((prediction) => (
              <tr className="border-t border-slate-100" key={prediction.node_id}>
                <td className="p-2">{prediction.node_id}</td>
                <td className="p-2">{prediction.score.toFixed(3)}</td>
                <td className="p-2">{prediction.predicted_label ?? "N/A"}</td>
                <td className="p-2">{prediction.true_label ?? "N/A"}</td>
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
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{raw ? value : value.toFixed(3)}</p>
    </div>
  )
}
