"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  FileSpreadsheet,
  Loader2,
  ShieldAlert,
  UploadCloud,
} from "lucide-react"

import { AppHeader } from "@/components/AppHeader"
import { api } from "@/lib/api"
import type { DemoDataset, DemoDatasetCreateResponse, UploadResponse } from "@/types"

const uploadSteps = ["Uploading", "Profiling", "Generating schemas"]

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>("")
  const [demoStatus, setDemoStatus] = useState<string>("")
  const [demos, setDemos] = useState<DemoDataset[]>([])
  const [error, setError] = useState<string>("")

  useEffect(() => {
    api
      .get<DemoDataset[]>("/demo-datasets")
      .then((response) => setDemos(response.data))
      .catch(() => setDemos([]))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError("Choose a CSV file first.")
      return
    }

    setError("")
    setStatus("Uploading")
    const formData = new FormData()
    formData.append("file", file)

    try {
      const upload = await api.post<UploadResponse>("/upload", formData)
      const projectId = upload.data.project_id
      setStatus("Profiling")
      await api.post(`/profile/${projectId}`)
      setStatus("Generating schemas")
      await api.post(`/schema/recommend/${projectId}`)
      router.push(`/projects/${projectId}`)
    } catch (err) {
      setStatus("")
      setError(err instanceof Error ? err.message : "Upload failed.")
    }
  }

  async function startDemo(dataset: DemoDataset) {
    setError("")
    setDemoStatus(`Preparing ${dataset.name}`)
    try {
      const response = await api.post<DemoDatasetCreateResponse>(`/demo-datasets/${dataset.id}/project`)
      router.push(`/projects/${response.data.project_id}?demo=1`)
    } catch (err) {
      setDemoStatus("")
      setError(err instanceof Error ? err.message : "Demo dataset failed.")
    }
  }

  const working = Boolean(status || demoStatus)

  return (
    <main className="app-shell text-ink">
      <AppHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 pb-10">
        <section className="grid gap-5 border-t border-border-soft pt-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="soft-card p-6">
            <span className="pill border-cyan-100 bg-cyan-50 text-graph-cyan">
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              Dataset intake
            </span>
            <h1 className="mt-4 text-3xl font-bold md:text-4xl">Create a graph project</h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              Start with a built-in dataset or upload a CSV. Graphify AI will profile columns, recommend
              graph schemas, and open a dashboard for quality checks, preview, baseline, and export.
            </p>
            <div className="mt-6 grid gap-3">
              {uploadSteps.map((step) => {
                const active = status === step
                const done = status && uploadSteps.indexOf(status) > uploadSteps.indexOf(step)
                return (
                  <div className="flex items-center gap-3 rounded-card border border-border-soft bg-surface-muted px-4 py-3" key={step}>
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full ${
                        active ? "bg-cyan-100 text-graph-cyan" : done ? "bg-emerald-100 text-graph-green" : "bg-white text-muted"
                      }`}
                    >
                      {active ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <span className="text-sm font-bold text-ink">{step}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-5">
            <section className="soft-card p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Demo datasets</p>
                  <h2 className="mt-1 text-2xl font-bold">Fastest path to a working graph</h2>
                </div>
                {demoStatus ? (
                  <span className="pill border-cyan-100 bg-cyan-50 text-graph-cyan">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {demoStatus}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                {demos.length ? (
                  demos.map((dataset) => (
                    <button
                      className="group min-h-56 rounded-card border border-border-soft bg-white p-4 text-left shadow-line hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-soft disabled:translate-y-0 disabled:opacity-50"
                      disabled={working}
                      key={dataset.id}
                      onClick={() => startDemo(dataset)}
                      type="button"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-card bg-cyan-50 text-graph-cyan">
                          <DatabaseZap className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="pill bg-surface-muted">{dataset.rows.toLocaleString()} rows</span>
                      </span>
                      <span className="mt-4 block text-base font-bold text-ink">{dataset.name}</span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        <span className="pill border-indigo-100 bg-indigo-50 text-accent-indigo">{dataset.domain}</span>
                        <span className="pill border-emerald-100 bg-emerald-50 text-graph-green">{dataset.suggested_task}</span>
                      </span>
                      <span className="mt-4 block text-sm leading-6 text-muted">{dataset.description}</span>
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-graph-cyan">
                        Open demo <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="col-span-full rounded-card border border-border-soft bg-surface-muted p-5 text-sm text-muted">
                    Demo catalog is not available. You can still upload a CSV below.
                  </div>
                )}
              </div>
            </section>

            <form className="soft-card p-6" onSubmit={handleSubmit}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Custom CSV</p>
                  <h2 className="mt-1 text-2xl font-bold">Upload your own table</h2>
                </div>
                {file ? <span className="pill bg-emerald-50 text-graph-green">{formatBytes(file.size)}</span> : null}
              </div>
              <label
                className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-cyan-200 bg-cyan-50/45 px-4 py-6 text-center hover:bg-cyan-50"
                htmlFor="dataset"
              >
                <FileSpreadsheet className="h-9 w-9 text-graph-cyan" aria-hidden="true" />
                <span className="mt-3 text-sm font-bold text-ink">{file ? file.name : "Choose a CSV file"}</span>
                <span className="mt-1 text-xs font-semibold text-muted">Comma-separated tables up to your local backend limit</span>
              </label>
              <input
                accept=".csv"
                className="sr-only"
                id="dataset"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <button className="btn-primary mt-5" disabled={!file || working} type="submit">
                {status ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {status}
                  </>
                ) : (
                  <>
                    Analyze CSV
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
              {error ? (
                <p className="mt-4 flex items-center gap-2 rounded-card border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  {error}
                </p>
              ) : null}
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
