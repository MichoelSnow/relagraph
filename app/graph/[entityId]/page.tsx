import GraphExplorer from "@/components/graph/GraphExplorer"

type GraphPageProps = {
  params: Promise<{ entityId: string }>
}

export default async function GraphPage({ params }: GraphPageProps) {
  const { entityId } = await params
  return <GraphExplorer entityId={entityId} initialAsOf={new Date().toISOString()} />
}
