import GraphList from "@/components/graphs/GraphList"
import { requireAuthUser } from "@/server/auth/session"

export const dynamic = "force-dynamic"

export default async function GraphsPage() {
  await requireAuthUser()
  return <GraphList />
}
