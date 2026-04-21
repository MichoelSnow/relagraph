"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"

import {
  createGraphEntity,
  createRelationship,
  createRelationshipInterval,
  fetchGraphEntityDetail,
  fetchGraphEntities,
  fetchRelationshipTypes,
  updateGraphEntity,
  updateRelationship
} from "@/lib/api/graphs"
import { cx } from "@/lib/ui/cx"
import type { Edge } from "@/types"
import GraphExplorer from "@/components/graph/GraphExplorer"
import TimeSlider from "@/components/graph/TimeSlider"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import FormContainer from "@/components/ui/FormContainer"
import Input from "@/components/ui/Input"
import PageHeader from "@/components/ui/PageHeader"
import PageLayout from "@/components/ui/PageLayout"
import Section from "@/components/ui/Section"
import Select from "@/components/ui/Select"
import Stack from "@/components/ui/Stack"

type GraphWorkspaceProps = {
  graphId: string
  graphName: string
  initialAsOf: string
}

type CreateMode = "new_node" | "existing_node"
type RightPanelMode = "node" | "edge" | "link" | null

type PersonProfileInput = {
  birth_date: string
  death_date: string
  sex_at_birth: string
  gender_identity: string
  notes: string
}

type AnimalProfileInput = {
  species: string
  breed: string
  sex: string
  reproductive_status: string
  birth_date: string
  death_date: string
  notes: string
}

type PlaceProfileInput = {
  place_type: string
  built_date: string
  demolished_date: string
  lat: string
  lng: string
  address_text: string
  notes: string
}

const LEFT_PANEL_KEY = "relagraph:workspace:left-panel-expanded"
const RIGHT_PANEL_KEY = "relagraph:workspace:right-panel-expanded"

function readBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") {
    return fallback
  }

  const stored = window.localStorage.getItem(key)
  if (stored === null) {
    return fallback
  }

  return stored === "1"
}

function toLocalDatetimeInputValue(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }

  const pad = (value: number) => String(value).padStart(2, "0")
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

function toDateInputValue(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return ""
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""
}

type ToggleRowProps = {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--console-border)] bg-[var(--console-subpanel)] px-2 py-1.5">
      <span className="text-xs font-medium text-[var(--console-text-muted)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[var(--console-input-border)] accent-[var(--console-primary)]"
      />
    </label>
  )
}

type PanelShellProps = {
  title: string
  side: "left" | "right"
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function PanelShell({ title, side, expanded, onToggle, children }: PanelShellProps) {
  return (
    <aside
      className={cx(
        "rounded-lg border border-[var(--console-border)] bg-[var(--console-panel)] transition-[width] duration-150",
        expanded ? "w-[320px]" : "w-12"
      )}
    >
      <div className="flex h-full min-h-[68vh] flex-col">
        <div className={cx("flex items-center border-b border-[var(--console-border)] p-1", expanded ? "justify-between" : "justify-center")}>
          {expanded ? (
            <span className="px-2 text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">
              {title}
            </span>
          ) : null}
          <button
            type="button"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${side} panel`}
            onClick={onToggle}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--console-border)] bg-[var(--console-subpanel)] text-[var(--console-text)] hover:bg-[var(--console-panel-muted)]"
          >
            {side === "left" ? (expanded ? <ChevronLeftIcon /> : <ChevronRightIcon />) : expanded ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>
        {expanded ? <div className="flex-1 overflow-y-auto p-2">{children}</div> : null}
      </div>
    </aside>
  )
}

export default function GraphWorkspace({ graphId, graphName, initialAsOf }: GraphWorkspaceProps) {
  const [focusOverride, setFocusOverride] = useState<string | null>(null)
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [graphRefreshKey, setGraphRefreshKey] = useState(0)
  const [asOf, setAsOf] = useState(initialAsOf)
  const [showNodeLabels, setShowNodeLabels] = useState(true)
  const [showRelationshipLabels, setShowRelationshipLabels] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [leftExpanded, setLeftExpanded] = useState(() => readBoolean(LEFT_PANEL_KEY, true))
  const [rightExpanded, setRightExpanded] = useState(() => readBoolean(RIGHT_PANEL_KEY, true))
  const [isNodeDetailLoading, setIsNodeDetailLoading] = useState(false)

  const [nodeName, setNodeName] = useState("")
  const [nodeKind, setNodeKind] = useState<"person" | "animal" | "place">("person")
  const [entityNameText, setEntityNameText] = useState("")
  const [entityNameType, setEntityNameType] = useState("")
  const [entityNameLanguage, setEntityNameLanguage] = useState("")
  const [entityNameScript, setEntityNameScript] = useState("")
  const [entityNameNotes, setEntityNameNotes] = useState("")
  const [entityNameIsPrimary, setEntityNameIsPrimary] = useState(true)
  const [entityNameSortOrder, setEntityNameSortOrder] = useState("")
  const [entityNameStartDate, setEntityNameStartDate] = useState("")
  const [entityNameEndDate, setEntityNameEndDate] = useState("")
  const [personProfile, setPersonProfile] = useState<PersonProfileInput>({
    birth_date: "",
    death_date: "",
    sex_at_birth: "",
    gender_identity: "",
    notes: ""
  })
  const [animalProfile, setAnimalProfile] = useState<AnimalProfileInput>({
    species: "",
    breed: "",
    sex: "",
    reproductive_status: "",
    birth_date: "",
    death_date: "",
    notes: ""
  })
  const [placeProfile, setPlaceProfile] = useState<PlaceProfileInput>({
    place_type: "",
    built_date: "",
    demolished_date: "",
    lat: "",
    lng: "",
    address_text: "",
    notes: ""
  })

  const [edgeType, setEdgeType] = useState("")
  const [edgeFromRole, setEdgeFromRole] = useState("")
  const [edgeToRole, setEdgeToRole] = useState("")
  const [edgeStart, setEdgeStart] = useState("")
  const [edgeEnd, setEdgeEnd] = useState("")

  const [createMode, setCreateMode] = useState<CreateMode>("new_node")
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null)
  const [newLinkedName, setNewLinkedName] = useState("")
  const [newLinkedKind, setNewLinkedKind] = useState<"person" | "animal" | "place">("person")
  const [existingTargetId, setExistingTargetId] = useState<string | null>(null)
  const [newLinkType, setNewLinkType] = useState("")
  const [newLinkFromRole, setNewLinkFromRole] = useState("")
  const [newLinkToRole, setNewLinkToRole] = useState("")
  const [newLinkStart, setNewLinkStart] = useState(() => toLocalDatetimeInputValue(initialAsOf))
  const [newLinkEnd, setNewLinkEnd] = useState("")

  const queryClient = useQueryClient()

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    window.localStorage.setItem(LEFT_PANEL_KEY, leftExpanded ? "1" : "0")
  }, [leftExpanded])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    window.localStorage.setItem(RIGHT_PANEL_KEY, rightExpanded ? "1" : "0")
  }, [rightExpanded])

  const entitiesQuery = useQuery({
    queryKey: ["graph:entities", graphId],
    queryFn: () => fetchGraphEntities(graphId)
  })
  const relationshipTypesQuery = useQuery({
    queryKey: ["graph:relationship-types", graphId],
    queryFn: () => fetchRelationshipTypes(graphId)
  })

  const entities = useMemo(() => entitiesQuery.data ?? [], [entitiesQuery.data])
  const relationshipTypes = useMemo(() => relationshipTypesQuery.data ?? [], [relationshipTypesQuery.data])

  const focusEntityId = useMemo(() => {
    if (focusOverride && entities.some((entity) => entity.id === focusOverride)) {
      return focusOverride
    }
    return entities[0]?.id ?? null
  }, [entities, focusOverride])

  const selectedNode = useMemo(
    () => entities.find((entity) => entity.id === selectedNodeId) ?? null,
    [entities, selectedNodeId]
  )

  const sourceEntityId = useMemo(() => {
    if (sourceNodeId && entities.some((entity) => entity.id === sourceNodeId)) {
      return sourceNodeId
    }
    return selectedNodeId ?? focusEntityId ?? ""
  }, [entities, focusEntityId, selectedNodeId, sourceNodeId])

  const targetEntityId = useMemo(() => {
    if (existingTargetId && entities.some((entity) => entity.id === existingTargetId)) {
      return existingTargetId
    }
    return entities.find((entity) => entity.id !== sourceEntityId)?.id ?? ""
  }, [entities, existingTargetId, sourceEntityId])

  const saveNodeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedNode) {
        throw new Error("No node selected")
      }
      if (!nodeName.trim()) {
        throw new Error("Name required")
      }
      if (!entityNameText.trim()) {
        throw new Error("Entity name required")
      }
      const profilePayload =
        nodeKind === "person"
          ? personProfile
          : nodeKind === "animal"
            ? animalProfile
            : placeProfile
      await updateGraphEntity(graphId, selectedNode.id, {
        display_name: nodeName.trim(),
        entity_kind: nodeKind,
        entity_name: {
          name_text: entityNameText.trim(),
          name_type: entityNameType.trim() || "preferred",
          language_code: entityNameLanguage.trim() || null,
          script_code: entityNameScript.trim() || null,
          notes: entityNameNotes.trim() || null,
          is_primary: entityNameIsPrimary,
          sort_order: entityNameSortOrder.trim() ? Number(entityNameSortOrder) : null,
          start_date: entityNameStartDate || null,
          end_date: entityNameEndDate || null
        },
        profile: {
          ...profilePayload,
          ...(nodeKind === "place"
            ? {
                lat: placeProfile.lat.trim() ? Number(placeProfile.lat) : null,
                lng: placeProfile.lng.trim() ? Number(placeProfile.lng) : null
              }
            : {})
        }
      })
    },
    onSuccess: () => {
      setGraphRefreshKey((previous) => previous + 1)
      queryClient.invalidateQueries({ queryKey: ["graph:entities", graphId] })
      if (selectedNodeId) {
        queryClient.invalidateQueries({ queryKey: ["graph:entity-detail", graphId, selectedNodeId] })
      }
    }
  })

  const saveEdgeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEdge) {
        throw new Error("No edge selected")
      }
      if (!edgeType.trim()) {
        throw new Error("Type required")
      }
      if (!edgeFromRole.trim() || !edgeToRole.trim()) {
        throw new Error("Roles required")
      }
      if (!edgeStart) {
        throw new Error("Start required")
      }

      await updateRelationship(graphId, selectedEdge.id, {
        relationship_type: edgeType.trim(),
        participants: [
          { entity_id: selectedEdge.from_entity_id, role: edgeFromRole.trim() },
          { entity_id: selectedEdge.to_entity_id, role: edgeToRole.trim() }
        ]
      })

      await createRelationshipInterval(graphId, selectedEdge.id, {
        start: new Date(edgeStart).toISOString(),
        end: edgeEnd ? new Date(edgeEnd).toISOString() : null
      })
    },
    onSuccess: () => {
      setGraphRefreshKey((previous) => previous + 1)
    }
  })

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      if (!sourceEntityId) {
        throw new Error("Source required")
      }
      if (!newLinkType.trim()) {
        throw new Error("Type required")
      }
      if (!newLinkFromRole.trim() || !newLinkToRole.trim()) {
        throw new Error("Roles required")
      }
      const startDate = new Date(newLinkStart)
      if (Number.isNaN(startDate.getTime())) {
        throw new Error("Start required")
      }
      const endDate = newLinkEnd ? new Date(newLinkEnd) : null
      if (endDate && Number.isNaN(endDate.getTime())) {
        throw new Error("End invalid")
      }

      let toEntityId = targetEntityId
      if (createMode === "new_node") {
        if (!newLinkedName.trim()) {
          throw new Error("Name required")
        }
        const createdEntity = await createGraphEntity(graphId, {
          entity_kind: newLinkedKind,
          display_name: newLinkedName.trim()
        })
        toEntityId = createdEntity.id
      } else if (!toEntityId || toEntityId === sourceEntityId) {
        throw new Error("Target required")
      }

      const relationship = await createRelationship(graphId, {
        relationship_type: newLinkType.trim(),
        participants: [
          { entity_id: sourceEntityId, role: newLinkFromRole.trim() },
          { entity_id: toEntityId, role: newLinkToRole.trim() }
        ]
      })

      await createRelationshipInterval(graphId, relationship.id, {
        start: startDate.toISOString(),
        end: endDate ? endDate.toISOString() : null
      })
    },
    onSuccess: () => {
      setGraphRefreshKey((previous) => previous + 1)
      queryClient.invalidateQueries({ queryKey: ["graph:entities", graphId] })
      setNewLinkedName("")
      setNewLinkType("")
      setNewLinkFromRole("")
      setNewLinkToRole("")
      setNewLinkEnd("")
    }
  })

  function onSaveNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveNodeMutation.mutate()
  }

  function onSaveEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveEdgeMutation.mutate()
  }

  function onCreateLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createLinkMutation.mutate()
  }

  const showNodeEditor = rightPanelMode === "node" && selectedNode !== null
  const showEdgeEditor = rightPanelMode === "edge" && selectedEdge !== null
  const showLinkEditor = rightPanelMode === "link"

  async function loadNodeDetailIntoEditor(nodeId: string) {
    setIsNodeDetailLoading(true)
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: ["graph:entity-detail", graphId, nodeId],
        queryFn: () => fetchGraphEntityDetail(graphId, nodeId)
      })
      setNodeName(detail.display_name)
      setNodeKind(detail.entity_kind)
      setEntityNameText(detail.entity_name?.name_text ?? detail.display_name)
      setEntityNameType(detail.entity_name?.name_type ?? "preferred")
      setEntityNameLanguage(detail.entity_name?.language_code ?? "")
      setEntityNameScript(detail.entity_name?.script_code ?? "")
      setEntityNameNotes(detail.entity_name?.notes ?? "")
      setEntityNameIsPrimary(detail.entity_name?.is_primary ?? true)
      setEntityNameSortOrder(detail.entity_name?.sort_order === null || detail.entity_name?.sort_order === undefined ? "" : String(detail.entity_name.sort_order))
      setEntityNameStartDate(toDateInputValue(detail.entity_name?.start_date))
      setEntityNameEndDate(toDateInputValue(detail.entity_name?.end_date))

      if (detail.entity_kind === "person") {
        const profile = (detail.profile ?? {}) as Record<string, unknown>
        setPersonProfile({
          birth_date: toDateInputValue(profile.birth_date),
          death_date: toDateInputValue(profile.death_date),
          sex_at_birth: typeof profile.sex_at_birth === "string" ? profile.sex_at_birth : "",
          gender_identity: typeof profile.gender_identity === "string" ? profile.gender_identity : "",
          notes: typeof profile.notes === "string" ? profile.notes : ""
        })
      }

      if (detail.entity_kind === "animal") {
        const profile = (detail.profile ?? {}) as Record<string, unknown>
        setAnimalProfile({
          species: typeof profile.species === "string" ? profile.species : "",
          breed: typeof profile.breed === "string" ? profile.breed : "",
          sex: typeof profile.sex === "string" ? profile.sex : "",
          reproductive_status:
            typeof profile.reproductive_status === "string" ? profile.reproductive_status : "",
          birth_date: toDateInputValue(profile.birth_date),
          death_date: toDateInputValue(profile.death_date),
          notes: typeof profile.notes === "string" ? profile.notes : ""
        })
      }

      if (detail.entity_kind === "place") {
        const profile = (detail.profile ?? {}) as Record<string, unknown>
        setPlaceProfile({
          place_type: typeof profile.place_type === "string" ? profile.place_type : "",
          built_date: toDateInputValue(profile.built_date),
          demolished_date: toDateInputValue(profile.demolished_date),
          lat: profile.lat === null || profile.lat === undefined ? "" : String(profile.lat),
          lng: profile.lng === null || profile.lng === undefined ? "" : String(profile.lng),
          address_text: typeof profile.address_text === "string" ? profile.address_text : "",
          notes: typeof profile.notes === "string" ? profile.notes : ""
        })
      }
    } finally {
      setIsNodeDetailLoading(false)
    }
  }

  const controlsPanel = (
    <Section className="mb-0">
      <Stack className="gap-3">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Focus</span>
          <Select
            value={focusEntityId ?? ""}
            onChange={(event) => {
              const nextId = event.target.value || null
              setFocusOverride(nextId)
              setSelectedNodeId(nextId)
              setSelectedEdge(null)
              setRightPanelMode(nextId ? "node" : null)
              if (nextId) {
                void loadNodeDetailIntoEditor(nextId)
              }
            }}
            disabled={entities.length === 0}
          >
            {entities.length === 0 ? <option value="">-</option> : null}
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.display_name}
              </option>
            ))}
          </Select>
        </label>

        <TimeSlider asOf={asOf} onChange={setAsOf} />

        <Stack className="gap-2">
          <ToggleRow label="Node labels" checked={showNodeLabels} onChange={setShowNodeLabels} />
          <ToggleRow label="Edge labels" checked={showRelationshipLabels} onChange={setShowRelationshipLabels} />
          <ToggleRow label="Inactive" checked={includeInactive} onChange={setIncludeInactive} />
        </Stack>
      </Stack>
    </Section>
  )

  const editPanel = (
    <Stack>
      {showNodeEditor ? (
        <Section className="mb-0">
          <FormContainer>
            <form onSubmit={onSaveNode}>
              <Stack className="gap-3">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Display label</span>
                  <Input value={nodeName} onChange={(event) => setNodeName(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Entity kind</span>
                  <Select value={nodeKind} onChange={(event) => setNodeKind(event.target.value as "person" | "animal" | "place")}>
                    <option value="person">person</option>
                    <option value="animal">animal</option>
                    <option value="place">place</option>
                  </Select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Entity name text</span>
                  <Input value={entityNameText} onChange={(event) => setEntityNameText(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Entity name type</span>
                  <Input value={entityNameType} onChange={(event) => setEntityNameType(event.target.value)} placeholder="preferred" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Entity name language</span>
                  <Input value={entityNameLanguage} onChange={(event) => setEntityNameLanguage(event.target.value)} placeholder="en" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Entity name script</span>
                  <Input value={entityNameScript} onChange={(event) => setEntityNameScript(event.target.value)} placeholder="Latn" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Entity name notes</span>
                  <Input value={entityNameNotes} onChange={(event) => setEntityNameNotes(event.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Entity name sort order</span>
                  <Input type="number" value={entityNameSortOrder} onChange={(event) => setEntityNameSortOrder(event.target.value)} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--console-border)] bg-[var(--console-subpanel)] px-2 py-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Primary entity name</span>
                  <input
                    type="checkbox"
                    checked={entityNameIsPrimary}
                    onChange={(event) => setEntityNameIsPrimary(event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--console-input-border)] accent-[var(--console-primary)]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Name active from</span>
                  <Input type="date" value={entityNameStartDate} onChange={(event) => setEntityNameStartDate(event.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Name active until</span>
                  <Input type="date" value={entityNameEndDate} onChange={(event) => setEntityNameEndDate(event.target.value)} />
                </label>

                {nodeKind === "person" ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Birth date</span>
                      <Input type="date" value={personProfile.birth_date} onChange={(event) => setPersonProfile((value) => ({ ...value, birth_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Death date</span>
                      <Input type="date" value={personProfile.death_date} onChange={(event) => setPersonProfile((value) => ({ ...value, death_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Sex at birth</span>
                      <Input value={personProfile.sex_at_birth} onChange={(event) => setPersonProfile((value) => ({ ...value, sex_at_birth: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Gender identity</span>
                      <Input value={personProfile.gender_identity} onChange={(event) => setPersonProfile((value) => ({ ...value, gender_identity: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Profile notes</span>
                      <Input value={personProfile.notes} onChange={(event) => setPersonProfile((value) => ({ ...value, notes: event.target.value }))} />
                    </label>
                  </>
                ) : null}

                {nodeKind === "animal" ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Species</span>
                      <Input value={animalProfile.species} onChange={(event) => setAnimalProfile((value) => ({ ...value, species: event.target.value }))} required />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Breed</span>
                      <Input value={animalProfile.breed} onChange={(event) => setAnimalProfile((value) => ({ ...value, breed: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Sex</span>
                      <Input value={animalProfile.sex} onChange={(event) => setAnimalProfile((value) => ({ ...value, sex: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Reproductive status</span>
                      <Input value={animalProfile.reproductive_status} onChange={(event) => setAnimalProfile((value) => ({ ...value, reproductive_status: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Birth date</span>
                      <Input type="date" value={animalProfile.birth_date} onChange={(event) => setAnimalProfile((value) => ({ ...value, birth_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Death date</span>
                      <Input type="date" value={animalProfile.death_date} onChange={(event) => setAnimalProfile((value) => ({ ...value, death_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Profile notes</span>
                      <Input value={animalProfile.notes} onChange={(event) => setAnimalProfile((value) => ({ ...value, notes: event.target.value }))} />
                    </label>
                  </>
                ) : null}

                {nodeKind === "place" ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Place type</span>
                      <Input value={placeProfile.place_type} onChange={(event) => setPlaceProfile((value) => ({ ...value, place_type: event.target.value }))} required />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Built date</span>
                      <Input type="date" value={placeProfile.built_date} onChange={(event) => setPlaceProfile((value) => ({ ...value, built_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Demolished date</span>
                      <Input type="date" value={placeProfile.demolished_date} onChange={(event) => setPlaceProfile((value) => ({ ...value, demolished_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Latitude</span>
                      <Input type="number" step="any" value={placeProfile.lat} onChange={(event) => setPlaceProfile((value) => ({ ...value, lat: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Longitude</span>
                      <Input type="number" step="any" value={placeProfile.lng} onChange={(event) => setPlaceProfile((value) => ({ ...value, lng: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Address</span>
                      <Input value={placeProfile.address_text} onChange={(event) => setPlaceProfile((value) => ({ ...value, address_text: event.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Profile notes</span>
                      <Input value={placeProfile.notes} onChange={(event) => setPlaceProfile((value) => ({ ...value, notes: event.target.value }))} />
                    </label>
                  </>
                ) : null}

                <Button type="submit" disabled={saveNodeMutation.isPending || isNodeDetailLoading}>Save node</Button>
                {saveNodeMutation.error ? <Card variant="danger" className="px-3 py-2 text-xs">Save failed</Card> : null}
              </Stack>
            </form>
          </FormContainer>
        </Section>
      ) : null}

      {showEdgeEditor ? (
        <Section className="mb-0">
          <FormContainer>
            <form onSubmit={onSaveEdge}>
              <Stack className="gap-3">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Relationship type</span>
                  <Select value={edgeType} onChange={(event) => setEdgeType(event.target.value)} required>
                    <option value="">Select relationship type</option>
                    {relationshipTypes.map((type) => (
                      <option key={type.code} value={type.code}>{type.display_name || type.code}</option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Source node role</span>
                  <Input value={edgeFromRole} onChange={(event) => setEdgeFromRole(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Target node role</span>
                  <Input value={edgeToRole} onChange={(event) => setEdgeToRole(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Relationship active from</span>
                  <Input type="datetime-local" value={edgeStart} onChange={(event) => setEdgeStart(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Relationship active until</span>
                  <Input type="datetime-local" value={edgeEnd} onChange={(event) => setEdgeEnd(event.target.value)} />
                </label>
                <Button type="submit" disabled={saveEdgeMutation.isPending}>Save edge</Button>
                {saveEdgeMutation.error ? <Card variant="danger" className="px-3 py-2 text-xs">Save failed</Card> : null}
              </Stack>
            </form>
          </FormContainer>
        </Section>
      ) : null}

      {showLinkEditor ? (
        <Section className="mb-0">
          <FormContainer>
            <form onSubmit={onCreateLink}>
              <Stack className="gap-3">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Link action</span>
                  <Select value={createMode} onChange={(event) => setCreateMode(event.target.value as CreateMode)}>
                    <option value="new_node">Create linked node</option>
                    <option value="existing_node">Link existing node</option>
                  </Select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Source node</span>
                  <Select value={sourceEntityId} onChange={(event) => setSourceNodeId(event.target.value || null)} required>
                    <option value=""></option>
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.display_name}
                      </option>
                    ))}
                  </Select>
                </label>

                {createMode === "new_node" ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">New node label</span>
                      <Input value={newLinkedName} onChange={(event) => setNewLinkedName(event.target.value)} required />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">New node kind</span>
                      <Select
                        value={newLinkedKind}
                        onChange={(event) => setNewLinkedKind(event.target.value as "person" | "animal" | "place")}
                      >
                        <option value="person">person</option>
                        <option value="animal">animal</option>
                        <option value="place">place</option>
                      </Select>
                    </label>
                  </>
                ) : (
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Target node</span>
                    <Select value={targetEntityId} onChange={(event) => setExistingTargetId(event.target.value || null)} required>
                      <option value=""></option>
                      {entities
                        .filter((entity) => entity.id !== sourceEntityId)
                        .map((entity) => (
                          <option key={entity.id} value={entity.id}>
                            {entity.display_name}
                          </option>
                        ))}
                    </Select>
                  </label>
                )}

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Relationship type</span>
                  <Select value={newLinkType} onChange={(event) => setNewLinkType(event.target.value)} required>
                    <option value="">Select relationship type</option>
                    {relationshipTypes.map((type) => (
                      <option key={type.code} value={type.code}>{type.display_name || type.code}</option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Source node role</span>
                  <Input value={newLinkFromRole} onChange={(event) => setNewLinkFromRole(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Target node role</span>
                  <Input value={newLinkToRole} onChange={(event) => setNewLinkToRole(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Relationship active from</span>
                  <Input type="datetime-local" value={newLinkStart} onChange={(event) => setNewLinkStart(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Relationship active until</span>
                  <Input type="datetime-local" value={newLinkEnd} onChange={(event) => setNewLinkEnd(event.target.value)} />
                </label>
                <Button type="submit" disabled={createLinkMutation.isPending}>Create link</Button>
                {createLinkMutation.error ? <Card variant="danger" className="px-3 py-2 text-xs">Create failed</Card> : null}
              </Stack>
            </form>
          </FormContainer>
        </Section>
      ) : (
        <Card className="px-3 py-2 text-xs text-[var(--console-text-muted)]">Select a node or edge. Use the node + button to create a linked node.</Card>
      )}
    </Stack>
  )

  const canvas = focusEntityId ? (
    <GraphExplorer
      graphId={graphId}
      entityId={focusEntityId}
      asOf={asOf}
      includeInactive={includeInactive}
      refreshKey={graphRefreshKey}
      selectedEntityId={selectedNodeId}
      showNodeLabels={showNodeLabels}
      showRelationshipLabels={showRelationshipLabels}
      onNodeSelect={(nodeId) => {
        setSelectedNodeId(nodeId)
        setSelectedEdge(null)
        setRightPanelMode("node")
        void loadNodeDetailIntoEditor(nodeId)
      }}
      onEdgeSelect={(edge) => {
        setSelectedEdge(edge)
        setSelectedNodeId(null)
        if (edge) {
          setEdgeType(edge.relationship_type)
          setEdgeFromRole(edge.roles.from)
          setEdgeToRole(edge.roles.to)
          setEdgeStart(toLocalDatetimeInputValue(edge.start))
          setEdgeEnd(edge.end ? toLocalDatetimeInputValue(edge.end) : "")
          setRightPanelMode("edge")
        } else {
          setRightPanelMode(null)
        }
      }}
      onAddLinkedNodeFrom={(nodeId) => {
        setSourceNodeId(nodeId)
        setSelectedNodeId(nodeId)
        setSelectedEdge(null)
        setCreateMode("new_node")
        setRightPanelMode("link")
        setRightExpanded(true)
      }}
    />
  ) : (
    <div className="h-[68vh] min-h-[520px] rounded-xl border border-dashed border-[var(--console-border)] bg-[var(--console-subpanel)]" />
  )

  return (
    <PageLayout className="max-w-[1200px]">
      <PageHeader
        title={graphName}
        action={(
          <Link
            href="/graphs"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-[var(--console-border)] bg-[var(--console-panel)] px-4 py-2.5 text-sm font-medium text-[var(--console-text)] transition-colors hover:bg-[var(--console-panel-muted)]"
          >
            Back
          </Link>
        )}
      />

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
        <PanelShell title="Controls" side="left" expanded={leftExpanded} onToggle={() => setLeftExpanded((value) => !value)}>
          {controlsPanel}
        </PanelShell>

        <Section className="mb-0 p-2">
          {canvas}
        </Section>

        <PanelShell title="Edit" side="right" expanded={rightExpanded} onToggle={() => setRightExpanded((value) => !value)}>
          {editPanel}
        </PanelShell>
      </div>
    </PageLayout>
  )
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M10.5 3.5L6 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M5.5 3.5L10 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
