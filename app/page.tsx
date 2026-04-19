import { redirect } from "next/navigation"

import { getAuthUser } from "@/server/auth/session"

export default async function HomePage() {
  const user = await getAuthUser()
  redirect(user ? "/graphs" : "/login")
}
