"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

import { api } from "@/lib/api"
import type { UploadResponse } from "@/types"


export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")

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

  return (
    <main className="min-h-screen bg-panel px-6 py-8 text-ink">
      <div className="mx-auto max-w-3xl">
        <a className="text-sm font-medium text-graph-blue" href="/">
          Back
        </a>
        <h1 className="mt-6 text-3xl font-semibold">Upload Dataset</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Phase 1 supports CSV files. The backend will profile columns and create rule-based graph schemas.
        </p>

        <form className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
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
            disabled={!file || Boolean(status)}
            type="submit"
          >
            Upload and Analyze
          </button>
          {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
          {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
        </form>
      </div>
    </main>
  )
}
