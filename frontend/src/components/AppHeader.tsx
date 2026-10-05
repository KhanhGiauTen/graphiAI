import { DatabaseZap, FolderKanban, Settings, UploadCloud } from "lucide-react"

const navItems = [
  { href: "/upload", label: "Demo", icon: UploadCloud },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function AppHeader() {
  const publicDemo = process.env.NEXT_PUBLIC_PUBLIC_DEMO === "true"
  const items = publicDemo ? [{ href: "/demo", label: "Demo", icon: UploadCloud }, { href: "/demo#graph", label: "Graph", icon: FolderKanban }, { href: "/demo#quality", label: "Quality", icon: Settings }] : navItems
  return (
    <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5 text-ink">
      <a className="flex items-center gap-3" href="/">
        <span className="grid h-10 w-10 place-items-center rounded-card border border-cyan-100 bg-white text-graph-cyan shadow-line">
          <DatabaseZap className="h-5 w-5" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-base font-bold leading-5">Graphify AI</span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
            Tabular to graph
          </span>
        </span>
      </a>
      <nav className="flex flex-wrap items-center gap-1 rounded-card border border-border-soft bg-white/76 p-1 shadow-line">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <a className="btn-ghost px-3 py-2" href={item.href} key={item.href}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </a>
          )
        })}
      </nav>
    </header>
  )
}
