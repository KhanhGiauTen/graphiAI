"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, LogIn, ShieldAlert } from "lucide-react"

import { AppHeader } from "@/components/AppHeader"
import { api } from "@/lib/api"
import type { TokenResponse } from "@/types"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    try {
      const response = await api.post<TokenResponse>("/auth/login", { email, password })
      window.localStorage.setItem("graphify_token", response.data.access_token)
      router.push("/projects")
    } catch {
      setError("Invalid email or password.")
    }
  }

  return (
    <main className="app-shell text-ink">
      <AppHeader />
      <form className="soft-card mx-auto mt-10 max-w-md p-6" onSubmit={submit}>
        <span className="pill border-cyan-100 bg-cyan-50 text-graph-cyan">
          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
          Welcome back
        </span>
        <h1 className="mt-4 text-2xl font-bold">Sign in</h1>
        <input
          className="mt-6 w-full rounded-card border border-border-soft bg-white p-3 text-sm focus:border-cyan-200"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          type="email"
          value={email}
        />
        <input
          className="mt-3 w-full rounded-card border border-border-soft bg-white p-3 text-sm focus:border-cyan-200"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          value={password}
        />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" type="submit">
            Sign in
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <a className="btn-ghost" href="/register">Create account</a>
        </div>
        {error ? (
          <p className="mt-4 flex items-center gap-2 rounded-card border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </form>
    </main>
  )
}
