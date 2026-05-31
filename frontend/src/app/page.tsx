import {
  ArrowRight,
  Bot,
  Braces,
  ChartNoAxesCombined,
  Download,
  FileSpreadsheet,
  Network,
  ShieldCheck,
} from "lucide-react"

import { AppHeader } from "@/components/AppHeader"

const pipeline = [
  { label: "Upload", detail: "CSV demo or custom file", icon: FileSpreadsheet },
  { label: "Profile", detail: "Types, IDs, labels, leakage clues", icon: ChartNoAxesCombined },
  { label: "Schema", detail: "Ranked node and edge proposals", icon: Bot },
  { label: "Quality", detail: "Suitability score and warnings", icon: ShieldCheck },
  { label: "Graph", detail: "Animated relationship explorer", icon: Network },
  { label: "Export", detail: "NetworkX and PyG starter files", icon: Download },
]

const stats = [
  ["3", "demo datasets"],
  ["8", "workflow checks"],
  ["100-300", "preview nodes"],
  ["JSON + ZIP", "exports"],
]

export default function Home() {
  return (
    <main className="app-shell text-ink">
      <AppHeader />
      <div className="mx-auto grid max-w-7xl gap-7 px-6 pb-10">
        <section className="grid gap-6 border-t border-border-soft pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div className="flex min-h-[430px] flex-col justify-center">
            <span className="pill w-fit border-cyan-100 bg-cyan-50 text-graph-cyan">
              Local portfolio demo ready
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-normal md:text-6xl">
              Graphify AI
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
              Upload tabular data, infer graph schemas, check quality risks, explore an animated
              graph preview, and export runnable graph-learning starter code.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a className="btn-primary" href="/upload">
                Start demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a className="btn-secondary" href="/projects">
                Open projects
              </a>
            </div>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-4">
              {stats.map(([value, label]) => (
                <div className="subtle-panel px-4 py-3" key={label}>
                  <p className="text-lg font-bold text-ink">{value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="soft-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-soft bg-surface-muted px-5 py-4">
              <div>
                <p className="text-sm font-bold text-ink">Fraud graph preview</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  User {"->"} Transaction {"->"} Merchant {"->"} Device
                </p>
              </div>
              <span className="pill border-mint/30 bg-emerald-50 text-graph-green">82/100 quality</span>
            </div>
            <div className="grid gap-4 p-5">
              <ProductGraphPreview />
              <div className="grid gap-3 sm:grid-cols-3">
                {["Leakage guard", "AI schema", "PyG export"].map((item, index) => (
                  <div className="subtle-panel p-3" key={item}>
                    <p className="text-sm font-bold text-ink">{item}</p>
                    <div className="mt-3 h-2 rounded-full bg-slate-200">
                      <div
                        className={`h-2 rounded-full ${index === 0 ? "bg-graph-rose" : index === 1 ? "bg-graph-lavender" : "bg-mint"}`}
                        style={{ width: `${76 + index * 7}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {pipeline.map((step, index) => {
            const Icon = step.icon
            return (
              <article className="soft-card p-4" key={step.label}>
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-card bg-cyan-50 text-graph-cyan">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-bold text-muted">0{index + 1}</span>
                </div>
                <h2 className="mt-4 text-base font-bold">{step.label}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{step.detail}</p>
              </article>
            )
          })}
        </section>

        <section className="soft-card grid gap-5 p-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Built for graph ML demos</p>
            <h2 className="mt-2 text-2xl font-bold">One clear path from CSV to graph code.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FeatureChip icon={<Braces className="h-4 w-4" aria-hidden="true" />} label="Schema JSON" />
            <FeatureChip icon={<Network className="h-4 w-4" aria-hidden="true" />} label="NetworkX graph" />
            <FeatureChip icon={<Bot className="h-4 w-4" aria-hidden="true" />} label="AI explanations" />
          </div>
        </section>
      </div>
    </main>
  )
}

function FeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border-soft bg-surface-muted px-4 py-3 text-sm font-bold text-ink">
      <span className="text-graph-cyan">{icon}</span>
      {label}
    </div>
  )
}

function ProductGraphPreview() {
  const nodes = [
    { x: 110, y: 110, color: "#1d7fd6", label: "User" },
    { x: 270, y: 70, color: "#8d8fe5", label: "Transaction" },
    { x: 430, y: 130, color: "#36a982", label: "Merchant" },
    { x: 260, y: 230, color: "#d95f7a", label: "Device" },
    { x: 485, y: 245, color: "#d69032", label: "IP" },
  ]
  const edges = [
    [0, 1],
    [1, 2],
    [1, 3],
    [3, 0],
    [2, 4],
  ]
  return (
    <svg className="h-72 w-full rounded-card border border-border-soft bg-white" viewBox="0 0 600 320" role="img">
      <rect width="600" height="320" fill="#f8fbff" />
      {edges.map(([source, target], index) => (
        <line
          className="graph-edge-draw"
          key={`${source}-${target}`}
          stroke="#b9ccda"
          strokeWidth="2"
          style={{ animationDelay: `${index * 90}ms` }}
          x1={nodes[source].x}
          x2={nodes[target].x}
          y1={nodes[source].y}
          y2={nodes[target].y}
        />
      ))}
      {nodes.map((node, index) => (
        <g className="graph-node-enter" key={node.label} style={{ animationDelay: `${index * 85}ms` }}>
          <circle cx={node.x} cy={node.y} fill={node.color} r="18" stroke="#fff" strokeWidth="4" />
          <text fill="#38536d" fontSize="13" fontWeight="700" textAnchor="middle" x={node.x} y={node.y + 38}>
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
