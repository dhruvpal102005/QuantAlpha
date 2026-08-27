"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn, signUp } from "@/lib/auth-client"

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isSignUp = mode === "sign-up"

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = isSignUp
        ? await signUp.email({ email, password, name })
        : await signIn.email({ email, password })
      if (result.error) {
        setError(isSignUp ? "Could not create the account. Try a different email." : "Invalid email or password.")
        return
      }
      router.push("/")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signIn.social({ provider: "google", callbackURL: "/" })
    } catch {
      setError("Google sign-in is unavailable right now.")
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-primary text-on-primary grid place-items-center font-bold">Q</div>
          <span className="font-semibold text-on-surface text-lg tracking-tight">QuantAlpha</span>
        </div>
        <h1 className="text-2xl font-bold text-on-surface text-balance">
          {isSignUp ? "Create your research account" : "Sign in to your workspace"}
        </h1>
        <p className="text-on-surface-variant mt-2 leading-relaxed">
          {isSignUp
            ? "Your signals, validations, and research runs stay private to your account."
            : "Access your private signals, validation jobs, and research history."}
        </p>
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 border border-outline rounded-lg py-2.5 font-medium text-on-surface bg-surface hover:bg-surface-container-high transition-colors disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z" />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-outline-variant" />
        <span className="text-xs text-on-surface-variant uppercase tracking-wide">or</span>
        <div className="h-px flex-1 bg-outline-variant" />
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        {isSignUp && (
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-on-surface">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="border border-outline rounded-lg px-3 py-2.5 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        )}
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-on-surface">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="border border-outline rounded-lg px-3 py-2.5 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-on-surface">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="border border-outline rounded-lg px-3 py-2.5 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-on-error-container bg-error-container rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-on-primary rounded-lg py-2.5 font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          {busy ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="text-sm text-on-surface-variant mt-6 text-center">
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="text-primary font-medium hover:underline">
          {isSignUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </div>
  )
}
