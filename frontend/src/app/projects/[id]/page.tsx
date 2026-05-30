"use client"

import { useEffect, useState } from "react"

import { api, apiBaseUrl } from "@/lib/api"
import type { ExportBundle, GraphPreview, GraphSchema, ProjectDetail } from "@/types"


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
            bundle={exportBundle}
            disabled={!schema}
            onExport={() => schema && exportProject(schema.id)}
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

        {preview ? <PreviewPanel preview={preview} /> : null}
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
  bundle,
  disabled,
  onExport,
  projectId,
}: {
  bundle: ExportBundle | null
  disabled: boolean
  onExport: () => void
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

function PreviewPanel({ preview }: { preview: GraphPreview }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Graph Preview</h2>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
        <p>Nodes: {preview.stats.num_nodes}</p>
        <p>Edges: {preview.stats.num_edges}</p>
        <p>Components: {preview.stats.num_connected_components}</p>
        <p>Avg degree: {preview.stats.avg_degree}</p>
      </div>
      <div className="mt-5 max-h-72 overflow-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-2">Node</th>
              <th className="p-2">Type</th>
              <th className="p-2">Label</th>
            </tr>
          </thead>
          <tbody>
            {preview.nodes.slice(0, 50).map((node) => (
              <tr className="border-t border-slate-100" key={node.id}>
                <td className="p-2">{node.id}</td>
                <td className="p-2">{node.type}</td>
                <td className="p-2">{node.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
