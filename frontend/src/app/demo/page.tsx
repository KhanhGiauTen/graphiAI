"use client"

import { useState } from "react"
import { ArrowUpRight, Download, Network } from "lucide-react"
import { AppHeader } from "@/components/AppHeader"
import { GraphExplorer } from "@/components/graph/GraphExplorer"
import { QualityPanel } from "@/components/quality/QualityPanel"
import snapshots from "@/data/public-demo.json"
import type { DatasetProfile, GraphPreview, GraphQualityReport, GraphSchema } from "@/types"

type Demo = { id: string; name: string; profile: DatasetProfile; variants: Array<{ schema: GraphSchema; preview: GraphPreview; quality: GraphQualityReport }> }
// The generator validates these records with the backend Pydantic contracts.
const demos = snapshots as unknown as Demo[]

export default function PublicDemoPage() {
  const [datasetId, setDatasetId] = useState(demos[0].id)
  const [schemaIndex, setSchemaIndex] = useState(0)
  const dataset = demos.find((item) => item.id === datasetId) ?? demos[0]
  const variant = dataset.variants[schemaIndex] ?? dataset.variants[0]

  const exportHref = `/api/demo-export?dataset=${encodeURIComponent(dataset.id)}&schema=${encodeURIComponent(variant.schema.id)}`

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-12 sm:px-6">
        <header className="border-b border-border-soft pb-6">
          <p className="text-xs font-bold uppercase text-graph-green">Public interactive demo</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Graphify AI</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Synthetic datasets. Real outputs from the Python profiler, rule-based schema recommender, graph builder, and quality scorer. No account, private uploads, or external AI service.</p>
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink">Dataset
              <select className="max-w-full rounded-card border border-border-soft bg-white p-3" value={datasetId} onChange={(event) => { setDatasetId(event.target.value); setSchemaIndex(0) }}>
                {demos.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink">Graph schema
              <select className="max-w-full rounded-card border border-border-soft bg-white p-3" value={schemaIndex} onChange={(event) => setSchemaIndex(Number(event.target.value))}>
                {dataset.variants.map((item, index) => <option key={item.schema.id} value={index}>{item.schema.name}</option>)}
              </select>
            </label>
            <a className="btn-secondary" href={exportHref} download><Download size={16} aria-hidden="true" /> Export JSON</a>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-4 border-b border-border-soft pb-6 md:grid-cols-4" aria-label="Dataset summary">
          {[["Source rows", dataset.profile.row_count], ["Columns", dataset.profile.column_count], ["Graph nodes", variant.preview.stats.num_nodes], ["Graph edges", variant.preview.stats.num_edges]].map(([label, value]) => <div key={label}><p className="text-xs text-muted">{label}</p><strong className="mt-1 block text-2xl text-ink">{value}</strong></div>)}
        </section>
        <section id="graph" aria-label="Graph explorer">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink"><Network size={20} aria-hidden="true" /> {variant.schema.name}</h2>
          <p className="mb-4 text-sm leading-6 text-muted">{variant.schema.description}</p>
          <GraphExplorer key={`${dataset.id}-${variant.schema.id}`} preview={variant.preview} fitToData />
        </section>
        <div id="quality"><QualityPanel report={variant.quality} /></div>
        <footer className="border-t border-border-soft pt-5 text-sm text-muted">
          <p>This hosted demo explores precomputed fixture outputs. CSV upload, fresh profiling, model integrations, authentication, and persistent projects remain in the full local application.</p>
          <a className="mt-3 inline-flex items-center gap-2 font-semibold text-graph-cyan" href="https://github.com/KhanhGiauTen/graphiAI" target="_blank" rel="noreferrer">Full application source <ArrowUpRight size={16} aria-hidden="true" /></a>
        </footer>
      </main>
    </>
  )
}
