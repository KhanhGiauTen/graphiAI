"use client"

import { useEffect, useState } from "react"
import { FolderKanban, Plus, Settings, ShieldAlert } from "lucide-react"

import { AppHeader } from "@/components/AppHeader"
import { api } from "@/lib/api"
import type { ProjectRead } from "@/types"

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRead[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    api
      .get<ProjectRead[]>("/projects")
      .then((response) => setProjects(response.data))
      .catch(() => setError("Sign in to view saved projects. Demo projects can still be created from Upload."))
  }, [])

  return (
    <main className="app-shell text-ink">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-6 pb-10">
        <section className="soft-card border-t border-border-soft p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="pill border-indigo-100 bg-indigo-50 text-accent-indigo">
                <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
                Saved work
              </span>
              <h1 className="mt-4 text-3xl font-bold">Projects</h1>
              <p className="mt-2 text-sm leading-7 text-muted">Saved datasets, schema reports, and graph exports.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="btn-secondary" href="/settings">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </a>
              <a className="btn-primary" href="/upload">
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Project
              </a>
            </div>
          </div>
        </section>

        {error ? (
          <p className="mt-6 flex items-center gap-2 rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <a className="soft-card p-5 hover:-translate-y-0.5 hover:shadow-lift" href={`/projects/${project.id}`} key={project.id}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold">{project.name ?? project.original_filename}</h2>
                <span className="pill bg-surface-muted capitalize">{project.visibility}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-muted">Status: {project.status.replaceAll("_", " ")}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Updated {new Date(project.updated_at).toLocaleString()}
              </p>
            </a>
          ))}
          {!projects.length && !error ? (
            <div className="soft-card col-span-full p-8 text-center">
              <FolderKanban className="mx-auto h-10 w-10 text-graph-cyan" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-bold">No projects yet</h2>
              <p className="mt-2 text-sm text-muted">Create a demo graph project from the upload screen.</p>
              <a className="btn-primary mt-5" href="/upload">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Start demo
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
