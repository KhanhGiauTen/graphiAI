"use client"

import { useEffect, useState } from "react"

import { GraphExplorer } from "@/components/graph/GraphExplorer"
import { api, apiBaseUrl } from "@/lib/api"
import type { BaselineRunResponse, ExportBundle, GraphPreview, GraphSchema, ProjectDetail } from "@/types"


interface ProjectPageProps {
  params: {
    id: string
  }
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [selectedSchema, setSelectedSchema] = useState<string>("")
  const [preview, setPreview] = useState<GraphPreview | null>(null)
  const [exportBundle, setExportBundle] = useState<ExportBundle | null>(null)
  const [baseline, setBaseline] = useState<BaselineRunResponse | null>(null)
  const [baselineStatus, setBaselineStatus] = useState<string>("")
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
    const response = await api.post<GraphPreview>(`/graph/build/${params.id}`, {
      schema_id: schemaId,
      sample_size: 300,
    })
    setPreview(response.data)
  }

  async function exportProject(schemaId: string) {
    const response = await api.post<ExportBundle>(`/export/${params.id}`, { schema_id: schemaId })
    setExportBundle(response.data)
  }

  async function runBaseline(schemaId: string) {
    setBaselineStatus("Running baseline...")
    try {
      const response = await api.post<BaselineRunResponse>(`/experiments/baseline/${params.id}`, {
        schema_id: schemaId,
        test_size: 0.3,
      })
      setBaseline(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Baseline run failed.")
    } finally {
      setBaselineStatus("")
    }
  }

  async function shareProject() {
    const response = await api.post<ProjectDetail>(`/projects/${params.id}/share`)
    setProject(response.data)
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

        <section className="grid gap-4 lg:grid-cols-3">
          <Overview project={project} />
          <SchemaList
            schemas={project.graph_schemas}
            selectedSchema={selectedSchema}
            onSelect={setSelectedSchema}
          />
          <ExportPanel
            baselineStatus={baselineStatus}
            bundle={exportBundle}
            disabled={!schema}
            onExport={() => schema && exportProject(schema.id)}
            onRunBaseline={() => schema && runBaseline(schema.id)}
            projectId={params.id}
          />
        </section>

        {schema ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Selected schema</p>
                <h2 className="mt-1 text-xl font-semibold">{schema.name}</h2>
              </div>
              <button
                className="rounded-md bg-graph-blue px-4 py-2 text-sm font-semibold text-white"
                onClick={() => buildPreview(schema.id)}
                type="button"
              >
                Build Preview
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{schema.description}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SchemaItems title="Nodes" items={schema.node_types.map((node) => `${node.name} from ${node.source_column}`)} />
              <SchemaItems title="Edges" items={schema.edge_types.map((edge) => `${edge.source} ${edge.relation} ${edge.target}`)} />
            </div>
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
  onExport,
  onRunBaseline,
  projectId,
}: {
  baselineStatus: string
  bundle: ExportBundle | null
  disabled: boolean
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
        disabled={disabled}
        onClick={onExport}
        type="button"
      >
        Create ZIP
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
