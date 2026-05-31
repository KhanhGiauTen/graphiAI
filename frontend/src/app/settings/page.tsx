"use client"

import { FormEvent, useEffect, useState } from "react"
import { KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react"

import { AppHeader } from "@/components/AppHeader"
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
    <main className="app-shell text-ink">
      <AppHeader />
      <div className="mx-auto grid max-w-5xl gap-6 px-6 pb-10">
        <section className="soft-card border-t border-border-soft p-6">
          <span className="pill border-indigo-100 bg-indigo-50 text-accent-indigo">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            API access
          </span>
          <h1 className="mt-4 text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-sm leading-7 text-muted">Manage API keys for the public Graphify AI API.</p>
          {error ? (
            <p className="mt-4 flex items-center gap-2 rounded-card border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              {error}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="soft-card p-5">
            <p className="text-sm font-semibold text-muted">Active keys</p>
            <p className="mt-2 text-3xl font-bold text-ink">{usage?.active_api_keys ?? 0}</p>
          </div>
          <div className="soft-card p-5">
            <p className="text-sm font-semibold text-muted">Public API requests</p>
            <p className="mt-2 text-3xl font-bold text-ink">{usage?.total_public_api_requests ?? 0}</p>
          </div>
        </section>

        <form className="soft-card p-5" onSubmit={createKey}>
          <h2 className="text-lg font-bold">Create API Key</h2>
          <input
            className="mt-4 w-full rounded-card border border-border-soft bg-white p-3 text-sm focus:border-cyan-200"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <button className="btn-primary mt-4" type="submit">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create key
          </button>
          {newKey ? (
            <p className="mt-4 break-all rounded-card border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Copy now: {newKey}
            </p>
          ) : null}
        </form>

        <section className="soft-card p-5">
          <h2 className="text-lg font-bold">API Keys</h2>
          <div className="mt-4 grid gap-3">
            {apiKeys.map((key) => (
              <div className="flex items-center justify-between gap-4 rounded-card border border-border-soft bg-white p-3 shadow-line" key={key.id}>
                <div>
                  <p className="font-bold">{key.name}</p>
                  <p className="text-sm text-muted">Requests: {key.request_count}</p>
                </div>
                <button className="btn-secondary text-rose-700" onClick={() => revokeKey(key.id)} type="button">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Revoke
                </button>
              </div>
            ))}
            {!apiKeys.length ? <p className="text-sm text-muted">No keys yet.</p> : null}
          </div>
        </section>
      </div>
    </main>
  )
}
