import { headers } from "next/headers"
import { auth } from "@/lib/auth"

/** Returns the authenticated session or null. Never trusts client input. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/** Returns the authenticated user id or throws. Use in server-only paths. */
export async function requireUserId() {
  const session = await getSession()
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}
