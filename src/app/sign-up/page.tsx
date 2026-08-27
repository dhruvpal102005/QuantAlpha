import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AuthForm } from "@/components/auth-form"

export default async function SignUpPage() {
  const session = await getSession()
  if (session?.user) redirect("/")
  return (
    <main className="min-h-screen grid place-items-center bg-background px-6 py-12">
      <AuthForm mode="sign-up" />
    </main>
  )
}
