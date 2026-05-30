"use client"

import { FormEvent, useEffect, useState } from "react"

import { api } from "@/lib/api"
import type { ApiKeyCreateResponse, ApiKeyRead, UsageSummary } from "@/types"


export default function SettingsPage() {
  const [name, setName] = useState("Development key")
  const [apiKeys, setApiKeys] = useState<ApiKeyRead[]>([])
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [newKey, setNewKey] = useState("")
  const [error, setError] = useState("")

  async function load() {
    const [keysResponse, usageResponse] = await Promise.all([
      api.get<ApiKeyRead[]>("/api-keys"),
      api.get<UsageSummary>("/api-keys/usage"),
    ])
    setApiKeys(keysResponse.data)
    setUsage(usageResponse.data)
  }

  useEffect(() => {
    load().catch(() => setError("Sign in to manage API keys."))
  }, [])

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await api.post<ApiKeyCreateResponse>("/api-keys", { name })
    setNewKey(response.data.api_key)
    await load()
  }

  async function revokeKey(id: string) {
    await api.delete(`/api-keys/${id}`)
    await load()
  }

  return (
    <main className="min-h-screen bg-panel px-6 py-8 text-ink">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Manage API keys for the public Graphify AI API.</p>
        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Usage</h2>
          <p className="mt-3 text-sm text-slate-600">Active keys: {usage?.active_api_keys ?? 0}</p>
          <p className="mt-1 text-sm text-slate-600">Public API requests: {usage?.total_public_api_requests ?? 0}</p>
        </section>

        <form className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={createKey}>
          <h2 className="text-lg font-semibold">Create API Key</h2>
          <input className="mt-4 w-full rounded-md border p-3 text-sm" onChange={(event) => setName(event.target.value)} value={name} />
          <button className="mt-4 rounded-md bg-graph-blue px-4 py-2 text-sm font-semibold text-white" type="submit">
            Create key
          </button>
          {newKey ? (
            <p className="mt-4 break-all rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Copy now: {newKey}
            </p>
          ) : null}
        </form>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">API Keys</h2>
          <div className="mt-4 space-y-3">
            {apiKeys.map((key) => (
              <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-3" key={key.id}>
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-sm text-slate-600">Requests: {key.request_count}</p>
                </div>
                <button className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700" onClick={() => revokeKey(key.id)} type="button">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
