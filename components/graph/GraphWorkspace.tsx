"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { FormEvent, useCallback, useMemo, useState, useSyncExternalStore } from "react"

import {
  createGraphEntity,
  createRelationship,
  createRelationshipInterval,
  deleteGraphEntity,
  type GraphEntityDetail,
  fetchGraphEntityDetail,
  fetchGraphEntities,
  updateGraphEntity,
  updateRelationship
} from "@/lib/api/graphs"
import type { LayoutMode } from "@/lib/graph/layout"
import { DEFAULT_HORIZONTAL_SPACING, DEFAULT_VERTICAL_SPACING } from "@/lib/graph/layoutConfig"
import { cx } from "@/lib/ui/cx"
import type { Edge } from "@/types"
import GraphExplorer from "@/components/graph/GraphExplorer"
import TimeSlider from "@/components/graph/TimeSlider"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import FieldLabel from "@/components/ui/FieldLabel"
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
type EditAction = "edit_node" | "create_linked_node" | "link_existing_node"
type RightPanelMode = "node" | "edge" | null

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

type EntityNameRecord = GraphEntityDetail["entity_names"][number]
type EntityKind = GraphEntityDetail["entity_kind"]
type RelationshipTypePreset = {
  code: string
  display_name: string
  category: string | null
  source_roles: string[]
  target_roles: string[]
  used: boolean
}

const LEFT_PANEL_KEY = "relagraph:workspace:left-panel-expanded"
const RIGHT_PANEL_KEY = "relagraph:workspace:right-panel-expanded"
const PANEL_STORAGE_EVENT = "relagraph:panel-storage"
const TEMPORAL_SIMPLE_MODE = true
const DEFAULT_RELATIONSHIP_START = "1900-01-01T00:00:00.000Z"
const NAME_TYPE_OPTIONS = ["legal", "birth", "chosen", "nickname", "maiden", "alias", "religious"] as const
const NAME_LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Unspecified" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "he", label: "Hebrew" },
  { value: "hi", label: "Hindi" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" }
]
const SEX_AT_BIRTH_OPTIONS = ["", "female", "male", "intersex", "unknown"] as const
const GENDER_IDENTITY_OPTIONS = [
  "",
  "woman",
  "man",
  "nonbinary",
  "agender",
  "trans woman",
  "trans man",
  "questioning",
  "other",
  "prefer not to say"
] as const
const RELATIONSHIP_TYPE_PRESETS: RelationshipTypePreset[] = [
  {
    code: "parent_child",
    display_name: "Parent-Child",
    category: null,
    source_roles: ["parent", "child"],
    target_roles: ["parent", "child"],
    used: false
  },
  {
    code: "romantic",
    display_name: "Romantic",
    category: null,
    source_roles: ["spouse", "partner", "husband", "wife", "boyfriend", "girlfriend", "it's complicated"],
    target_roles: ["spouse", "partner", "husband", "wife", "boyfriend", "girlfriend", "it's complicated"],
    used: false
  },
  {
    code: "animal",
    display_name: "Animal",
    category: null,
    source_roles: ["owner", "parent", "pet", "friend", "animal"],
    target_roles: ["owner", "parent", "pet", "friend", "animal"],
    used: false
  },
  {
    code: "sibling",
    display_name: "Sibling",
    category: null,
    source_roles: ["sibling", "step-sibling", "half-sibling", "adopted sibling", "foster sibling"],
    target_roles: ["sibling", "step-sibling", "half-sibling", "adopted sibling", "foster sibling"],
    used: false
  }
]

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

type BooleanUpdater = boolean | ((previous: boolean) => boolean)

function useStoredBoolean(key: string, fallback: boolean): [boolean, (next: BooleanUpdater) => void] {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === "undefined") {
      return () => {}
    }
    const handleStoreChange = () => onStoreChange()
    window.addEventListener("storage", handleStoreChange)
    window.addEventListener(PANEL_STORAGE_EVENT, handleStoreChange)
    return () => {
      window.removeEventListener("storage", handleStoreChange)
      window.removeEventListener(PANEL_STORAGE_EVENT, handleStoreChange)
    }
  }, [])

  const value = useSyncExternalStore(
    subscribe,
    () => readBoolean(key, fallback),
    () => fallback
  )

  const setValue = useCallback(
    (next: BooleanUpdater) => {
      if (typeof window === "undefined") {
        return
      }
      const previous = readBoolean(key, fallback)
      const resolved = typeof next === "function" ? next(previous) : next
      window.localStorage.setItem(key, resolved ? "1" : "0")
      window.dispatchEvent(new Event(PANEL_STORAGE_EVENT))
    },
    [fallback, key]
  )

  return [value, setValue]
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
    <Stack
      className={cx(
        "shrink-0 rounded-lg border border-[var(--console-border)] bg-[var(--console-panel)] transition-[width] duration-150",
        expanded ? "w-[320px]" : "w-12"
      )}
    >
      <Stack className="h-full min-h-[68vh] gap-0">
        <Stack className={cx("flex-row items-center gap-0 border-b border-[var(--console-border)] p-1", expanded ? "justify-between" : "justify-center")}>
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
        </Stack>
        {expanded ? <Stack className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2">{children}</Stack> : null}
      </Stack>
    </Stack>
  )
}

export default function GraphWorkspace({ graphId, graphName, initialAsOf }: GraphWorkspaceProps) {
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [graphRefreshKey, setGraphRefreshKey] = useState(0)
  const [asOf, setAsOf] = useState(initialAsOf)
  const [graphDepth, setGraphDepth] = useState(3)
  const [viewMode, setViewMode] = useState<"graph" | "family">("family")
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("family_tree")
  const [horizontalSpacing, setHorizontalSpacing] = useState(DEFAULT_HORIZONTAL_SPACING)
  const [verticalSpacing, setVerticalSpacing] = useState(DEFAULT_VERTICAL_SPACING)
  const [showNodeLabels, setShowNodeLabels] = useState(true)
  const [showRelationshipLabels, setShowRelationshipLabels] = useState(false)
  const [shapeMode, setShapeMode] = useState<"auto" | "manual">("auto")
  const [includeInactive, setIncludeInactive] = useState(TEMPORAL_SIMPLE_MODE)
  const [leftExpanded, setLeftExpanded] = useStoredBoolean(LEFT_PANEL_KEY, true)
  const [rightExpanded, setRightExpanded] = useStoredBoolean(RIGHT_PANEL_KEY, true)
  const [isNodeDetailLoading, setIsNodeDetailLoading] = useState(false)

  const [nodeKind, setNodeKind] = useState<EntityKind>("person")
  const [entityNameText, setEntityNameText] = useState("")
  const [entityNameType, setEntityNameType] = useState<(typeof NAME_TYPE_OPTIONS)[number]>("legal")
  const [entityNameLanguage, setEntityNameLanguage] = useState("")
  const [entityNameIsPrimary, setEntityNameIsPrimary] = useState(true)
  const [entityNameStartDate, setEntityNameStartDate] = useState("")
  const [entityNameEndDate, setEntityNameEndDate] = useState("")
  const [entityNamesByType, setEntityNamesByType] = useState<EntityNameRecord[]>([])
  const [nameFormBaseline, setNameFormBaseline] = useState("")
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

  const [editAction, setEditAction] = useState<EditAction>("edit_node")
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null)
  const [familySourceNodeIds, setFamilySourceNodeIds] = useState<string[]>([])
  const [newLinkedName, setNewLinkedName] = useState("")
  const [newLinkedKind, setNewLinkedKind] = useState<"person" | "animal" | "place">("person")
  const [existingTargetId, setExistingTargetId] = useState<string | null>(null)
  const [newLinkType, setNewLinkType] = useState("")
  const [newLinkFromRole, setNewLinkFromRole] = useState("")
  const [newLinkToRole, setNewLinkToRole] = useState("")
  const [newLinkStart, setNewLinkStart] = useState("")
  const [newLinkEnd, setNewLinkEnd] = useState("")

  const queryClient = useQueryClient()

  const entitiesQuery = useQuery({
    queryKey: ["graph:entities", graphId],
    queryFn: () => fetchGraphEntities(graphId)
  })

  const entities = useMemo(() => entitiesQuery.data ?? [], [entitiesQuery.data])
  const relationshipTypes = useMemo(() => RELATIONSHIP_TYPE_PRESETS, [])
  const createLinkRelationshipTypeValue = useMemo(() => {
    if (newLinkType && relationshipTypes.some((type) => type.code === newLinkType)) {
      return newLinkType
    }
    return relationshipTypes[0]?.code ?? ""
  }, [newLinkType, relationshipTypes])
  const selectedCreateLinkRelationshipType = useMemo(
    () => relationshipTypes.find((type) => type.code === createLinkRelationshipTypeValue) ?? null,
    [relationshipTypes, createLinkRelationshipTypeValue]
  )
  const createLinkSourceRoleOptions = useMemo(
    () => selectedCreateLinkRelationshipType?.source_roles ?? [],
    [selectedCreateLinkRelationshipType]
  )
  const createLinkTargetRoleOptions = useMemo(
    () => selectedCreateLinkRelationshipType?.target_roles ?? [],
    [selectedCreateLinkRelationshipType]
  )
  const edgeRelationshipTypeValue = useMemo(() => {
    if (edgeType && relationshipTypes.some((type) => type.code === edgeType)) {
      return edgeType
    }
    return relationshipTypes[0]?.code ?? ""
  }, [edgeType, relationshipTypes])
  const selectedEdgeRelationshipType = useMemo(
    () => relationshipTypes.find((type) => type.code === edgeRelationshipTypeValue) ?? null,
    [relationshipTypes, edgeRelationshipTypeValue]
  )
  const edgeSourceRoleOptions = useMemo(
    () => selectedEdgeRelationshipType?.source_roles ?? [],
    [selectedEdgeRelationshipType]
  )
  const edgeTargetRoleOptions = useMemo(
    () => selectedEdgeRelationshipType?.target_roles ?? [],
    [selectedEdgeRelationshipType]
  )
  const createLinkSourceRoleValue = useMemo(() => {
    if (newLinkFromRole) {
      return newLinkFromRole
    }
    return createLinkSourceRoleOptions[0] ?? ""
  }, [newLinkFromRole, createLinkSourceRoleOptions])
  const createLinkTargetRoleValue = useMemo(() => {
    if (newLinkToRole) {
      return newLinkToRole
    }
    return createLinkTargetRoleOptions[0] ?? ""
  }, [newLinkToRole, createLinkTargetRoleOptions])
  const createMode: CreateMode = editAction === "link_existing_node" ? "existing_node" : "new_node"

  const centerEntityId = useMemo(() => entities[0]?.id ?? null, [entities])
  const layoutConfig = useMemo(
    () => ({
      horizontalSpacing,
      verticalSpacing
    }),
    [horizontalSpacing, verticalSpacing]
  )

  const selectedNode = useMemo(
    () => entities.find((entity) => entity.id === selectedNodeId) ?? null,
    [entities, selectedNodeId]
  )
  const isFamilyNodeSelected = selectedNodeId?.startsWith("family:") ?? false
  const familySourceEntities = useMemo(
    () => entities.filter((entity) => familySourceNodeIds.includes(entity.id)),
    [entities, familySourceNodeIds]
  )
  const selectedEdgeSourceName = useMemo(() => {
    if (!selectedEdge) {
      return ""
    }
    return entities.find((entity) => entity.id === selectedEdge.from_entity_id)?.display_name ?? "Unknown source node"
  }, [entities, selectedEdge])
  const selectedEdgeTargetName = useMemo(() => {
    if (!selectedEdge) {
      return ""
    }
    return entities.find((entity) => entity.id === selectedEdge.to_entity_id)?.display_name ?? "Unknown target node"
  }, [entities, selectedEdge])

  const sourceEntityId = useMemo(() => {
    if (isFamilyNodeSelected) {
      if (sourceNodeId && familySourceNodeIds.includes(sourceNodeId)) {
        return sourceNodeId
      }
      return familySourceNodeIds[0] ?? ""
    }
    if (selectedNodeId && entities.some((entity) => entity.id === selectedNodeId)) {
      return selectedNodeId
    }
    return centerEntityId ?? ""
  }, [centerEntityId, entities, familySourceNodeIds, isFamilyNodeSelected, selectedNodeId, sourceNodeId])

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
      if (!entityNameText.trim()) {
        throw new Error("Name required")
      }
      const profilePayload =
        nodeKind === "person"
          ? personProfile
          : nodeKind === "animal"
            ? animalProfile
            : nodeKind === "place"
              ? {
                  ...placeProfile,
                  lat: placeProfile.lat.trim() ? Number(placeProfile.lat) : null,
                  lng: placeProfile.lng.trim() ? Number(placeProfile.lng) : null
                }
              : null
      await updateGraphEntity(graphId, selectedNode.id, {
        entity_kind: nodeKind,
        entity_name: {
          name_text: entityNameText.trim(),
          name_type: entityNameType,
          language_code: entityNameLanguage.trim() || null,
          is_primary: entityNameIsPrimary,
          start_date: entityNameStartDate || null,
          end_date: entityNameEndDate || null
        },
        ...(profilePayload ? { profile: profilePayload } : {})
      })
    },
    onSuccess: () => {
      setGraphRefreshKey((previous) => previous + 1)
      queryClient.invalidateQueries({ queryKey: ["graph:entities", graphId] })
      if (selectedNodeId) {
        queryClient.invalidateQueries({ queryKey: ["graph:entity-detail", graphId, selectedNodeId] })
      }
      setNameFormBaseline(buildNameFormSignature())
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

  const deleteNodeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedNode) {
        throw new Error("No node selected")
      }
      await deleteGraphEntity(graphId, selectedNode.id)
    },
    onSuccess: () => {
      setGraphRefreshKey((previous) => previous + 1)
      queryClient.invalidateQueries({ queryKey: ["graph:entities", graphId] })
      setSelectedNodeId(null)
      setSelectedEdge(null)
      setRightPanelMode(null)
      setEditAction("edit_node")
      setFamilySourceNodeIds([])
      setSourceNodeId(null)
    }
  })

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const effectiveRelationshipType = createLinkRelationshipTypeValue.trim()
      const effectiveSourceRole = createLinkSourceRoleValue.trim()
      const effectiveTargetRole = createLinkTargetRoleValue.trim()

      if (!sourceEntityId) {
        throw new Error("Source required")
      }
      if (!effectiveRelationshipType) {
        throw new Error("Type required")
      }
      if (!effectiveSourceRole || !effectiveTargetRole) {
        throw new Error("Roles required")
      }
      const startDate = newLinkStart ? new Date(newLinkStart) : new Date(DEFAULT_RELATIONSHIP_START)
      if (Number.isNaN(startDate.getTime())) {
        throw new Error("Start invalid")
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
        relationship_type: effectiveRelationshipType,
        participants: [
          { entity_id: sourceEntityId, role: effectiveSourceRole },
          { entity_id: toEntityId, role: effectiveTargetRole }
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
      if (!isFamilyNodeSelected && sourceEntityId) {
        setSelectedNodeId(sourceEntityId)
      }
      setSelectedEdge(null)
      setEditAction(isFamilyNodeSelected ? "create_linked_node" : "edit_node")
      setNewLinkedName("")
      setNewLinkType("")
      setNewLinkFromRole("")
      setNewLinkToRole("")
      setNewLinkStart("")
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

  function onCreateLinkTypeChange(nextType: string) {
    setNewLinkType(nextType)
    const nextRelationshipType = relationshipTypes.find((type) => type.code === nextType)
    if (!nextRelationshipType) {
      return
    }
    if (nextRelationshipType.source_roles.length > 0 && !nextRelationshipType.source_roles.includes(newLinkFromRole)) {
      setNewLinkFromRole(nextRelationshipType.source_roles[0])
    }
    if (nextRelationshipType.target_roles.length > 0 && !nextRelationshipType.target_roles.includes(newLinkToRole)) {
      const preferredTargetRole =
        nextRelationshipType.target_roles.length > 1
          ? nextRelationshipType.target_roles.find((role) => role !== nextRelationshipType.source_roles[0])
          : undefined
      setNewLinkToRole(preferredTargetRole ?? nextRelationshipType.target_roles[0])
    }
  }

  function onEdgeTypeChange(nextType: string) {
    setEdgeType(nextType)
    const nextRelationshipType = relationshipTypes.find((type) => type.code === nextType)
    if (!nextRelationshipType) {
      return
    }
    if (nextRelationshipType.source_roles.length > 0 && !nextRelationshipType.source_roles.includes(edgeFromRole)) {
      setEdgeFromRole(nextRelationshipType.source_roles[0])
    }
    if (nextRelationshipType.target_roles.length > 0 && !nextRelationshipType.target_roles.includes(edgeToRole)) {
      const preferredTargetRole =
        nextRelationshipType.target_roles.length > 1
          ? nextRelationshipType.target_roles.find((role) => role !== nextRelationshipType.source_roles[0])
          : undefined
      setEdgeToRole(preferredTargetRole ?? nextRelationshipType.target_roles[0])
    }
  }

  function buildNameFormSignature() {
    return JSON.stringify({
      name_text: entityNameText,
      language_code: entityNameLanguage,
      is_primary: entityNameIsPrimary,
      start_date: entityNameStartDate,
      end_date: entityNameEndDate
    })
  }

  function resolveNameForType(
    nameType: (typeof NAME_TYPE_OPTIONS)[number],
    names: EntityNameRecord[]
  ): EntityNameRecord | undefined {
    const exact = names.find((name) => name.name_type === nameType)
    if (exact) {
      return exact
    }
    if (nameType === "legal") {
      return names.find((name) => name.name_type === "preferred")
    }
    return undefined
  }

  function applyEntityNameForType(
    nameType: (typeof NAME_TYPE_OPTIONS)[number],
    names: EntityNameRecord[],
    fallbackDisplayName: string
  ) {
    const selectedName = resolveNameForType(nameType, names)
    setEntityNameType(nameType)
    setEntityNameText(selectedName?.name_text ?? "")
    setEntityNameLanguage(selectedName?.language_code ?? "")
    setEntityNameIsPrimary(selectedName?.is_primary ?? false)
    setEntityNameStartDate(toDateInputValue(selectedName?.start_date))
    setEntityNameEndDate(toDateInputValue(selectedName?.end_date))

    // If no names exist yet, seed from current display text.
    if (names.length === 0) {
      setEntityNameText(fallbackDisplayName)
      setEntityNameIsPrimary(true)
    }

    // If the entity already has saved names, primary should mirror the selected type's saved record.
    if (names.length > 0 && !selectedName) {
      setEntityNameIsPrimary(false)
    }
  }

  function onEntityNameTypeChange(nextType: (typeof NAME_TYPE_OPTIONS)[number]) {
    if (nextType === entityNameType) {
      return
    }
    if (nameFormBaseline && buildNameFormSignature() !== nameFormBaseline) {
      const shouldDiscard = window.confirm(
        "You have unsaved name changes. Switch name type and discard unsaved changes?"
      )
      if (!shouldDiscard) {
        return
      }
    }
    applyEntityNameForType(nextType, entityNamesByType, "")
    const selectedName = resolveNameForType(nextType, entityNamesByType)
    setNameFormBaseline(
      JSON.stringify({
        name_text: selectedName?.name_text ?? "",
        language_code: selectedName?.language_code ?? "",
        is_primary: selectedName?.is_primary ?? false,
        start_date: toDateInputValue(selectedName?.start_date),
        end_date: toDateInputValue(selectedName?.end_date)
      })
    )
  }

  const showNodeActionEditor = rightPanelMode === "node" && (selectedNode !== null || isFamilyNodeSelected)
  const showNodeEditor = showNodeActionEditor && !isFamilyNodeSelected && editAction === "edit_node"
  const showEdgeEditor = rightPanelMode === "edge" && selectedEdge !== null
  const showLinkEditor = showNodeActionEditor && (isFamilyNodeSelected || editAction !== "edit_node")

  async function loadNodeDetailIntoEditor(nodeId: string) {
    setIsNodeDetailLoading(true)
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: ["graph:entity-detail", graphId, nodeId],
        queryFn: () => fetchGraphEntityDetail(graphId, nodeId)
      })
      setNodeKind(detail.entity_kind)
      const names = detail.entity_names ?? (detail.entity_name ? [detail.entity_name] : [])
      setEntityNamesByType(names)
      const preferredTypeRaw = detail.entity_name?.name_type
      const preferredType = NAME_TYPE_OPTIONS.includes(preferredTypeRaw as (typeof NAME_TYPE_OPTIONS)[number])
        ? (preferredTypeRaw as (typeof NAME_TYPE_OPTIONS)[number])
        : preferredTypeRaw === "preferred"
          ? "legal"
        : "legal"
      applyEntityNameForType(preferredType, names, detail.display_name)
      const selectedName = resolveNameForType(preferredType, names)
      setNameFormBaseline(
        JSON.stringify({
          name_text: selectedName?.name_text ?? (names.length === 0 ? detail.display_name : ""),
          language_code: selectedName?.language_code ?? "",
          is_primary: selectedName?.is_primary ?? (names.length === 0),
          start_date: toDateInputValue(selectedName?.start_date),
          end_date: toDateInputValue(selectedName?.end_date)
        })
      )

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
        {!TEMPORAL_SIMPLE_MODE ? <TimeSlider asOf={asOf} onChange={setAsOf} /> : null}

        <label className="block">
          <FieldLabel>Distance</FieldLabel>
          <Select value={String(graphDepth)} onChange={(event) => setGraphDepth(Number(event.target.value))}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </Select>
        </label>

        <label className="block">
          <FieldLabel>View mode</FieldLabel>
          <Select
            value={viewMode}
            onChange={(event) => {
              const nextViewMode = event.target.value as "graph" | "family"
              setViewMode(nextViewMode)
              setLayoutMode(nextViewMode === "family" ? "family_tree" : "graph")
              setSelectedEdge(null)
              setRightPanelMode(null)
            }}
          >
            <option value="graph">Graph view</option>
            <option value="family">Family view</option>
          </Select>
        </label>

        <Stack className="gap-2">
          <ToggleRow label="Auto shape" checked={shapeMode === "auto"} onChange={(next) => setShapeMode(next ? "auto" : "manual")} />
          <ToggleRow label="Node labels" checked={showNodeLabels} onChange={setShowNodeLabels} />
          <ToggleRow label="Edge labels" checked={showRelationshipLabels} onChange={setShowRelationshipLabels} />
          {!TEMPORAL_SIMPLE_MODE ? <ToggleRow label="Inactive" checked={includeInactive} onChange={setIncludeInactive} /> : null}
        </Stack>

        <Card className="px-3 py-2">
          <Stack className="gap-2">
            <FieldLabel compact>Layout spacing</FieldLabel>
            <label className="block">
              <FieldLabel compact>Horizontal ({horizontalSpacing})</FieldLabel>
              <Input
                type="range"
                min={80}
                max={360}
                step={10}
                value={horizontalSpacing}
                onChange={(event) => setHorizontalSpacing(Number(event.target.value))}
                className="w-full max-w-full border-0 bg-transparent px-0 py-0"
              />
            </label>
            <label className="block">
              <FieldLabel compact>Vertical ({verticalSpacing})</FieldLabel>
              <Input
                type="range"
                min={80}
                max={360}
                step={10}
                value={verticalSpacing}
                onChange={(event) => setVerticalSpacing(Number(event.target.value))}
                className="w-full max-w-full border-0 bg-transparent px-0 py-0"
              />
            </label>
          </Stack>
        </Card>

        <Card className="px-3 py-2">
          <Stack className="gap-2">
            <FieldLabel compact>Color key</FieldLabel>
            <div className="grid grid-cols-1 gap-2 text-xs text-[var(--console-text-muted)]">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--console-text)]">Node colors</span>
              <span style={{ color: "var(--graph-node-person, #2563eb)" }}>Person node</span>
              <span style={{ color: "var(--graph-node-animal, #059669)" }}>Animal node</span>
              <span style={{ color: "var(--graph-node-place, #d97706)" }}>Place node</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--console-text)]">Link colors</span>
              <span style={{ color: "#2563eb" }}>Parent-child link</span>
              <span style={{ color: "#e11d48" }}>Romantic link</span>
              <span style={{ color: "#16a34a" }}>Animal link</span>
              <span style={{ color: "#f59e0b" }}>Sibling link</span>
            </div>
          </Stack>
        </Card>
      </Stack>
    </Section>
  )

  const editPanel = (
    <Stack>
      {showNodeActionEditor ? (
        <Section className="mb-0">
          <Card className="px-3 py-2">
            <label className="block">
              <FieldLabel compact>Edit action</FieldLabel>
              <Select value={editAction} onChange={(event) => setEditAction(event.target.value as EditAction)}>
                {!isFamilyNodeSelected ? <option value="edit_node">Edit node</option> : null}
                <option value="create_linked_node">Create linked node</option>
                <option value="link_existing_node">Link existing node</option>
              </Select>
            </label>
          </Card>
        </Section>
      ) : null}

      {showNodeEditor ? (
        <Section className="mb-0">
          <FormContainer>
            <form onSubmit={onSaveNode}>
              <Stack className="gap-3">
                <label className="block">
                  <FieldLabel compact>Node type</FieldLabel>
                  <Select value={nodeKind} onChange={(event) => setNodeKind(event.target.value as EntityKind)}>
                    <option value="person">person</option>
                    <option value="animal">animal</option>
                    <option value="place">place</option>
                    <option value="family">family</option>
                  </Select>
                </label>

                <label className="block">
                  <FieldLabel compact>Name type</FieldLabel>
                  <Select
                    value={entityNameType}
                    onChange={(event) => onEntityNameTypeChange(event.target.value as (typeof NAME_TYPE_OPTIONS)[number])}
                  >
                    {NAME_TYPE_OPTIONS.map((nameType) => (
                      <option key={nameType} value={nameType}>{nameType}</option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <FieldLabel compact>Name</FieldLabel>
                  <Input value={entityNameText} onChange={(event) => setEntityNameText(event.target.value)} required />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--console-border)] bg-[var(--console-subpanel)] px-2 py-1.5">
                  <FieldLabel compact>Primary Name</FieldLabel>
                  <input
                    type="checkbox"
                    checked={entityNameIsPrimary}
                    onChange={(event) => setEntityNameIsPrimary(event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--console-input-border)] accent-[var(--console-primary)]"
                  />
                </label>
                <label className="block">
                  <FieldLabel compact>Name Language</FieldLabel>
                  <Select value={entityNameLanguage} onChange={(event) => setEntityNameLanguage(event.target.value)}>
                    {NAME_LANGUAGE_OPTIONS.map((language) => (
                      <option key={language.value || "unspecified"} value={language.value}>{language.label}</option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <FieldLabel compact>Name active from</FieldLabel>
                  <Input type="date" value={entityNameStartDate} onChange={(event) => setEntityNameStartDate(event.target.value)} />
                </label>
                <label className="block">
                  <FieldLabel compact>Name active until</FieldLabel>
                  <Input type="date" value={entityNameEndDate} onChange={(event) => setEntityNameEndDate(event.target.value)} />
                </label>

                {nodeKind === "person" ? (
                  <>
                    <label className="block">
                      <FieldLabel compact>Birth date</FieldLabel>
                      <Input type="date" value={personProfile.birth_date} onChange={(event) => setPersonProfile((value) => ({ ...value, birth_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Death date</FieldLabel>
                      <Input type="date" value={personProfile.death_date} onChange={(event) => setPersonProfile((value) => ({ ...value, death_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Sex at Birth</FieldLabel>
                      <Select value={personProfile.sex_at_birth} onChange={(event) => setPersonProfile((value) => ({ ...value, sex_at_birth: event.target.value }))}>
                        {SEX_AT_BIRTH_OPTIONS.map((value) => (
                          <option key={value || "unspecified"} value={value}>{value || "Unspecified"}</option>
                        ))}
                      </Select>
                    </label>
                    <label className="block">
                      <FieldLabel compact>Gender Identity</FieldLabel>
                      <Select value={personProfile.gender_identity} onChange={(event) => setPersonProfile((value) => ({ ...value, gender_identity: event.target.value }))}>
                        {GENDER_IDENTITY_OPTIONS.map((value) => (
                          <option key={value || "unspecified"} value={value}>{value || "Unspecified"}</option>
                        ))}
                      </Select>
                    </label>
                    <label className="block">
                      <FieldLabel compact>Profile notes</FieldLabel>
                      <Input value={personProfile.notes} onChange={(event) => setPersonProfile((value) => ({ ...value, notes: event.target.value }))} />
                    </label>
                  </>
                ) : null}

                {nodeKind === "animal" ? (
                  <>
                    <label className="block">
                      <FieldLabel compact>Species</FieldLabel>
                      <Input value={animalProfile.species} onChange={(event) => setAnimalProfile((value) => ({ ...value, species: event.target.value }))} required />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Breed</FieldLabel>
                      <Input value={animalProfile.breed} onChange={(event) => setAnimalProfile((value) => ({ ...value, breed: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Sex</FieldLabel>
                      <Input value={animalProfile.sex} onChange={(event) => setAnimalProfile((value) => ({ ...value, sex: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Reproductive status</FieldLabel>
                      <Input value={animalProfile.reproductive_status} onChange={(event) => setAnimalProfile((value) => ({ ...value, reproductive_status: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Birth date</FieldLabel>
                      <Input type="date" value={animalProfile.birth_date} onChange={(event) => setAnimalProfile((value) => ({ ...value, birth_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Death date</FieldLabel>
                      <Input type="date" value={animalProfile.death_date} onChange={(event) => setAnimalProfile((value) => ({ ...value, death_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Profile notes</FieldLabel>
                      <Input value={animalProfile.notes} onChange={(event) => setAnimalProfile((value) => ({ ...value, notes: event.target.value }))} />
                    </label>
                  </>
                ) : null}

                {nodeKind === "place" ? (
                  <>
                    <label className="block">
                      <FieldLabel compact>Place type</FieldLabel>
                      <Input value={placeProfile.place_type} onChange={(event) => setPlaceProfile((value) => ({ ...value, place_type: event.target.value }))} required />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Built date</FieldLabel>
                      <Input type="date" value={placeProfile.built_date} onChange={(event) => setPlaceProfile((value) => ({ ...value, built_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Demolished date</FieldLabel>
                      <Input type="date" value={placeProfile.demolished_date} onChange={(event) => setPlaceProfile((value) => ({ ...value, demolished_date: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Latitude</FieldLabel>
                      <Input type="number" step="any" value={placeProfile.lat} onChange={(event) => setPlaceProfile((value) => ({ ...value, lat: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Longitude</FieldLabel>
                      <Input type="number" step="any" value={placeProfile.lng} onChange={(event) => setPlaceProfile((value) => ({ ...value, lng: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Address</FieldLabel>
                      <Input value={placeProfile.address_text} onChange={(event) => setPlaceProfile((value) => ({ ...value, address_text: event.target.value }))} />
                    </label>
                    <label className="block">
                      <FieldLabel compact>Profile notes</FieldLabel>
                      <Input value={placeProfile.notes} onChange={(event) => setPlaceProfile((value) => ({ ...value, notes: event.target.value }))} />
                    </label>
                  </>
                ) : null}

                <Button type="submit" disabled={saveNodeMutation.isPending || isNodeDetailLoading}>Save node</Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={deleteNodeMutation.isPending}
                  onClick={() => {
                    const confirmed = window.confirm("Delete this node? This also deletes connected relationships.")
                    if (!confirmed) {
                      return
                    }
                    deleteNodeMutation.mutate()
                  }}
                >
                  Delete node
                </Button>
                {saveNodeMutation.error ? <Card variant="danger" className="px-3 py-2 text-xs">Save failed</Card> : null}
                {deleteNodeMutation.error ? <Card variant="danger" className="px-3 py-2 text-xs">Delete failed</Card> : null}
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
                  <FieldLabel compact>Source node</FieldLabel>
                  <Input value={selectedEdgeSourceName} readOnly />
                </label>
                <label className="block">
                  <FieldLabel compact>Target node</FieldLabel>
                  <Input value={selectedEdgeTargetName} readOnly />
                </label>
                <label className="block">
                  <FieldLabel compact>Relationship type</FieldLabel>
                  <Select value={edgeRelationshipTypeValue} onChange={(event) => onEdgeTypeChange(event.target.value)} required>
                    {relationshipTypes.map((type) => (
                      <option key={type.code} value={type.code}>{type.display_name || type.code}</option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <FieldLabel compact>Source node role</FieldLabel>
                  {edgeSourceRoleOptions.length > 0 ? (
                    <Select value={edgeFromRole} onChange={(event) => setEdgeFromRole(event.target.value)} required>
                      {edgeSourceRoleOptions.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input value={edgeFromRole} onChange={(event) => setEdgeFromRole(event.target.value)} required />
                  )}
                </label>
                <label className="block">
                  <FieldLabel compact>Target node role</FieldLabel>
                  {edgeTargetRoleOptions.length > 0 ? (
                    <Select value={edgeToRole} onChange={(event) => setEdgeToRole(event.target.value)} required>
                      {edgeTargetRoleOptions.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input value={edgeToRole} onChange={(event) => setEdgeToRole(event.target.value)} required />
                  )}
                </label>
                <label className="block">
                  <FieldLabel compact>Relationship active from</FieldLabel>
                  <Input type="datetime-local" value={edgeStart} onChange={(event) => setEdgeStart(event.target.value)} required />
                </label>
                <label className="block">
                  <FieldLabel compact>Relationship active until</FieldLabel>
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
                  <FieldLabel compact>Source node</FieldLabel>
                  {isFamilyNodeSelected ? (
                    <Select
                      value={sourceEntityId}
                      onChange={(event) => setSourceNodeId(event.target.value || null)}
                      required
                    >
                      <option value=""></option>
                      {familySourceEntities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.display_name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      value={entities.find((entity) => entity.id === sourceEntityId)?.display_name ?? sourceEntityId}
                      readOnly
                    />
                  )}
                </label>

                {createMode === "new_node" ? (
                  <>
                    <label className="block">
                      <FieldLabel compact>New node label</FieldLabel>
                      <Input value={newLinkedName} onChange={(event) => setNewLinkedName(event.target.value)} required />
                    </label>
                    <label className="block">
                      <FieldLabel compact>New node kind</FieldLabel>
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
                    <FieldLabel compact>Target node</FieldLabel>
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
                  <FieldLabel compact>Relationship type</FieldLabel>
                  <Select value={createLinkRelationshipTypeValue} onChange={(event) => onCreateLinkTypeChange(event.target.value)} required>
                    {relationshipTypes.map((type) => (
                      <option key={type.code} value={type.code}>{type.display_name || type.code}</option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <FieldLabel compact>Source node role</FieldLabel>
                  {createLinkSourceRoleOptions.length > 0 ? (
                    <Select value={createLinkSourceRoleValue} onChange={(event) => setNewLinkFromRole(event.target.value)} required>
                      {createLinkSourceRoleOptions.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input value={newLinkFromRole} onChange={(event) => setNewLinkFromRole(event.target.value)} required />
                  )}
                </label>
                <label className="block">
                  <FieldLabel compact>Target node role</FieldLabel>
                  {createLinkTargetRoleOptions.length > 0 ? (
                    <Select value={createLinkTargetRoleValue} onChange={(event) => setNewLinkToRole(event.target.value)} required>
                      {createLinkTargetRoleOptions.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input value={newLinkToRole} onChange={(event) => setNewLinkToRole(event.target.value)} required />
                  )}
                </label>
                <label className="block">
                  <FieldLabel compact>Relationship active from</FieldLabel>
                  <Input type="datetime-local" value={newLinkStart} onChange={(event) => setNewLinkStart(event.target.value)} />
                </label>
                <label className="block">
                  <FieldLabel compact>Relationship active until</FieldLabel>
                  <Input type="datetime-local" value={newLinkEnd} onChange={(event) => setNewLinkEnd(event.target.value)} />
                </label>
                <Button type="submit" disabled={createLinkMutation.isPending || !sourceEntityId}>
                  {createMode === "new_node" ? "Create linked node" : "Link existing node"}
                </Button>
                {isFamilyNodeSelected && familySourceEntities.length === 0 ? (
                  <Card variant="danger" className="px-3 py-2 text-xs">
                    This family node has no linked members available as source nodes.
                  </Card>
                ) : null}
                {createLinkMutation.error ? (
                  <Card variant="danger" className="px-3 py-2 text-xs">
                    Create link failed. Please review inputs and try again.
                  </Card>
                ) : null}
              </Stack>
            </form>
          </FormContainer>
        </Section>
      ) : (
        <Card className="px-3 py-2 text-xs text-[var(--console-text-muted)]">Select a node or edge to edit.</Card>
      )}
    </Stack>
  )

  const canvas = centerEntityId ? (
    <GraphExplorer
      graphId={graphId}
      entityId={centerEntityId}
      viewMode={viewMode}
      asOf={asOf}
      includeInactive={includeInactive}
      depth={graphDepth}
      layoutMode={shapeMode}
      layoutEngineMode={layoutMode}
      layoutConfig={layoutConfig}
      refreshKey={graphRefreshKey}
      selectedEntityId={selectedNodeId}
      showNodeLabels={showNodeLabels}
      showRelationshipLabels={showRelationshipLabels}
      onNodeSelect={({ entityId, familySourceEntityIds }) => {
        setSelectedNodeId(entityId)
        setSelectedEdge(null)
        if (entityId.startsWith("family:")) {
          setFamilySourceNodeIds(familySourceEntityIds ?? [])
          setSourceNodeId((familySourceEntityIds ?? [])[0] ?? null)
          setEditAction("create_linked_node")
          setRightPanelMode("node")
          return
        }
        setFamilySourceNodeIds([])
        setSourceNodeId(null)
        setEditAction("edit_node")
        setRightPanelMode("node")
        void loadNodeDetailIntoEditor(entityId)
      }}
      onEdgeSelect={(edge) => {
        if (viewMode === "family") {
          setSelectedEdge(null)
          setSelectedNodeId(null)
          setFamilySourceNodeIds([])
          setSourceNodeId(null)
          setRightPanelMode(null)
          return
        }
        setSelectedEdge(edge)
        setSelectedNodeId(null)
        setFamilySourceNodeIds([])
        setSourceNodeId(null)
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

      <Stack className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-3">
        <PanelShell title="Controls" side="left" expanded={leftExpanded} onToggle={() => setLeftExpanded((value) => !value)}>
          {controlsPanel}
        </PanelShell>

        <Section className="mb-0 p-2">
          {canvas}
        </Section>

        <PanelShell title="Edit" side="right" expanded={rightExpanded} onToggle={() => setRightExpanded((value) => !value)}>
          {editPanel}
        </PanelShell>
      </Stack>
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
