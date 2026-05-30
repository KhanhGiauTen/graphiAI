"use client"

import { useEffect, useState } from "react"

import { api } from "@/lib/api"
import type { ProjectRead } from "@/types"


export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRead[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    api
      .get<ProjectRead[]>("/projects")
      .then((response) => setProjects(response.data))
      .catch(() => setError("Sign in to view saved projects."))
  }, [])

  return (
    <main className="min-h-screen bg-panel px-6 py-8 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-3xl font-semibold">Projects</h1>
            <p className="mt-2 text-sm text-slate-600">Saved datasets and graph schemas.</p>
          </div>
          <div className="flex gap-3">
            <a className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="/settings">Settings</a>
            <a className="rounded-md bg-graph-blue px-4 py-2 text-sm font-semibold text-white" href="/upload">New Project</a>
          </div>
        </div>
        {error ? <p className="mt-6 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <a className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" href={`/projects/${project.id}`} key={project.id}>
              <h2 className="text-lg font-semibold">{project.name ?? project.original_filename}</h2>
              <p className="mt-2 text-sm text-slate-600">Status: {project.status}</p>
              <p className="mt-1 text-sm text-slate-600">Visibility: {project.visibility}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
