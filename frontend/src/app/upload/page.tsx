"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { api } from "@/lib/api"
import type { DemoDataset, DemoDatasetCreateResponse, UploadResponse } from "@/types"


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
    setStatus("Uploading dataset...")
    const formData = new FormData()
    formData.append("file", file)

    try {
      const upload = await api.post<UploadResponse>("/upload", formData)
      const projectId = upload.data.project_id
      setStatus("Profiling columns...")
      await api.post(`/profile/${projectId}`)
      setStatus("Generating graph schemas...")
      await api.post(`/schema/recommend/${projectId}`)
      router.push(`/projects/${projectId}`)
    } catch (err) {
      setStatus("")
      setError(err instanceof Error ? err.message : "Upload failed.")
    }
  }

  async function startDemo(dataset: DemoDataset) {
    setError("")
    setDemoStatus(`Preparing ${dataset.name}...`)
    try {
      const response = await api.post<DemoDatasetCreateResponse>(`/demo-datasets/${dataset.id}/project`)
      router.push(`/projects/${response.data.project_id}`)
    } catch (err) {
      setDemoStatus("")
      setError(err instanceof Error ? err.message : "Demo dataset failed.")
    }
  }

  return (
    <main className="min-h-screen bg-panel px-6 py-8 text-ink">
      <div className="mx-auto max-w-3xl">
        <a className="text-sm font-medium text-graph-blue" href="/">
          Back
        </a>
        <h1 className="mt-6 text-3xl font-semibold">Upload Dataset</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Upload a CSV to profile columns and create initial rule-based graph schemas. You can run AI schema
          analysis, interactive preview, export, and baseline evaluation on the project page.
        </p>

        <div className="mt-8 grid gap-5">
          {demos.length ? (
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Demo datasets</p>
                  <h2 className="mt-1 text-xl font-semibold">Start from a prepared example</h2>
                </div>
                {demoStatus ? <p className="text-sm text-slate-600">{demoStatus}</p> : null}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {demos.map((dataset) => (
                  <button
                    className="rounded-md border border-slate-200 p-4 text-left text-sm transition hover:border-graph-blue hover:bg-blue-50 disabled:opacity-50"
                    disabled={Boolean(status || demoStatus)}
                    key={dataset.id}
                    onClick={() => startDemo(dataset)}
                    type="button"
                  >
                    <span className="block font-semibold text-slate-900">{dataset.name}</span>
                    <span className="mt-2 block text-xs font-medium uppercase text-slate-500">
                      {dataset.domain}
                    </span>
                    <span className="mt-3 block leading-6 text-slate-600">{dataset.description}</span>
                    <span className="mt-3 block font-medium text-graph-blue">{dataset.suggested_task}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="dataset">
              CSV file
            </label>
            <input
              accept=".csv"
              className="mt-3 block w-full rounded-md border border-slate-300 p-3 text-sm"
              id="dataset"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <button
              className="mt-5 rounded-md bg-graph-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!file || Boolean(status || demoStatus)}
              type="submit"
            >
              Upload and Analyze
            </button>
            {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
            {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
          </form>
        </div>
      </div>
    </main>
  )
}
