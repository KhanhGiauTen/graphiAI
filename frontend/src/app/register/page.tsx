"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

import { api } from "@/lib/api"
import type { TokenResponse } from "@/types"


export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    try {
      const response = await api.post<TokenResponse>("/auth/register", {
        email,
        password,
        full_name: fullName || null,
      })
      window.localStorage.setItem("graphify_token", response.data.access_token)
      router.push("/projects")
    } catch {
      setError("Could not create account. Use a unique email and at least 8 characters.")
    }
  }

  return (
    <main className="min-h-screen bg-panel px-6 py-8 text-ink">
      <form className="mx-auto mt-16 max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={submit}>
        <h1 className="text-2xl font-semibold">Create account</h1>
        <input className="mt-6 w-full rounded-md border p-3 text-sm" onChange={(event) => setFullName(event.target.value)} placeholder="Full name" value={fullName} />
        <input className="mt-3 w-full rounded-md border p-3 text-sm" onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" value={email} />
        <input className="mt-3 w-full rounded-md border p-3 text-sm" onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} />
        <button className="mt-5 rounded-md bg-graph-blue px-4 py-2 text-sm font-semibold text-white" type="submit">Create account</button>
        <a className="ml-4 text-sm font-medium text-graph-blue" href="/login">Sign in</a>
        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      </form>
    </main>
  )
}
