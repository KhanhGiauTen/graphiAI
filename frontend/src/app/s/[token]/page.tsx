"use client"

import { useEffect, useState } from "react"

import { api } from "@/lib/api"
import type { ProjectDetail } from "@/types"


interface SharedPageProps {
  params: {
    token: string
  }
}

export default function SharedProjectPage({ params }: SharedPageProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api
      .get<ProjectDetail>(`/share/${params.token}`)
      .then((response) => setProject(response.data))
      .catch(() => setError("Shared project not found."))
  }, [params.token])

  if (error) return <main className="p-8 text-rose-700">{error}</main>
  if (!project) return <main className="p-8 text-slate-600">Loading shared project...</main>

  return (
    <main className="min-h-screen bg-panel px-6 py-8 text-ink">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-graph-blue">Shared Graphify AI Project</p>
        <h1 className="mt-3 text-3xl font-semibold">{project.name ?? project.original_filename}</h1>
        <p className="mt-2 text-sm text-slate-600">Read-only schema preview</p>
        <div className="mt-6 grid gap-4">
          {project.graph_schemas.map((schema) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={schema.id}>
              <h2 className="text-lg font-semibold">{schema.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{schema.description}</p>
              <p className="mt-2 text-sm text-slate-600">Score: {schema.quality_score.toFixed(1)}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
