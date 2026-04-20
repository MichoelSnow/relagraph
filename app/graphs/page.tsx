import GraphList from "@/components/graphs/GraphList"
import { requireAuthUser } from "@/server/auth/session"

export default async function GraphsPage() {
  await requireAuthUser()
  return <GraphList />
}
