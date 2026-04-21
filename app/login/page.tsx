import { redirect } from "next/navigation"

import AuthForm from "@/components/auth/AuthForm"
import { getAuthUser } from "@/server/auth/session"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const user = await getAuthUser()
  if (user) {
    redirect("/graphs")
  }

  return <AuthForm />
}
