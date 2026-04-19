import { redirect } from "next/navigation"

export default async function LegacyGraphPage(): Promise<never> {
  redirect("/graphs")
}
