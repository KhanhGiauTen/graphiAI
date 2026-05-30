"use client"

import { useMemo, useState } from "react"

import type { GraphEdge, GraphNode, GraphPreview } from "@/types"

const VIEWBOX_WIDTH = 1040
const VIEWBOX_HEIGHT = 620
const MAX_RENDERED_EDGES = 900

const PALETTE = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#e11d48",
  "#7c3aed",
  "#0891b2",
  "#4f46e5",
  "#65a30d",
]

interface GraphExplorerProps {
  preview: GraphPreview
}

interface PositionedNode extends GraphNode {
  x: number
  y: number
  degree: number
  color: string
}

export function GraphExplorer({ preview }: GraphExplorerProps) {
  const nodeTypes = useMemo(() => sortUnique(preview.nodes.map((node) => node.type)), [preview.nodes])
  const relationTypes = useMemo(() => sortUnique(preview.edges.map((edge) => edge.relation)), [preview.edges])
  const [enabledTypes, setEnabledTypes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(nodeTypes.map((type) => [type, true])),
  )
  const [enabledRelations, setEnabledRelations] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(relationTypes.map((relation) => [relation, true])),
  )
  const [query, setQuery] = useState("")
  const [selectedNodeId, setSelectedNodeId] = useState<string>("")
  const [focusNeighbors, setFocusNeighbors] = useState(false)

  const colorByType = useMemo(
    () => Object.fromEntries(nodeTypes.map((type, index) => [type, PALETTE[index % PALETTE.length]])),
    [nodeTypes],
  )

  const graphIndex = useMemo(() => buildGraphIndex(preview.nodes, preview.edges), [preview.nodes, preview.edges])
  const selectedNeighbors = selectedNodeId ? graphIndex.neighborsByNode.get(selectedNodeId) ?? new Set<string>() : new Set<string>()

  const visibleNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return preview.nodes.filter((node) => {
      const typeEnabled = enabledTypes[node.type] ?? true
      const matchesQuery =
        !normalizedQuery ||
        node.id.toLowerCase().includes(normalizedQuery) ||
        node.label.toLowerCase().includes(normalizedQuery) ||
        node.type.toLowerCase().includes(normalizedQuery)
      const matchesFocus =
        !focusNeighbors ||
        !selectedNodeId ||
        node.id === selectedNodeId ||
        selectedNeighbors.has(node.id)
      return typeEnabled && matchesQuery && matchesFocus
    })
  }, [enabledTypes, focusNeighbors, preview.nodes, query, selectedNeighbors, selectedNodeId])

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const visibleEdges = useMemo(
    () =>
      preview.edges.filter(
        (edge) =>
          visibleNodeIds.has(edge.source) &&
          visibleNodeIds.has(edge.target) &&
          (enabledRelations[edge.relation] ?? true),
      ),
    [enabledRelations, preview.edges, visibleNodeIds],
  )

  const positionedNodes = useMemo(
    () => positionNodes(visibleNodes, graphIndex.degreeByNode, colorByType),
    [colorByType, graphIndex.degreeByNode, visibleNodes],
  )
  const positionedById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  )
  const renderedEdges = visibleEdges.slice(0, MAX_RENDERED_EDGES)
  const selectedNode = selectedNodeId ? graphIndex.nodeById.get(selectedNodeId) : undefined
  const selectedDegree = selectedNodeId ? graphIndex.degreeByNode.get(selectedNodeId) ?? 0 : 0
  const selectedNeighborList = selectedNodeId ? Array.from(selectedNeighbors).slice(0, 12) : []

  function toggleType(type: string) {
    setEnabledTypes((current) => ({ ...current, [type]: !(current[type] ?? true) }))
  }

  function toggleRelation(relation: string) {
    setEnabledRelations((current) => ({ ...current, [relation]: !(current[relation] ?? true) }))
  }

  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId)
    setFocusNeighbors(false)
  }

  function resetView() {
    setQuery("")
    setSelectedNodeId("")
    setFocusNeighbors(false)
    setEnabledTypes(Object.fromEntries(nodeTypes.map((type) => [type, true])))
    setEnabledRelations(Object.fromEntries(relationTypes.map((relation) => [relation, true])))
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Graph preview</p>
          <h2 className="mt-1 text-xl font-semibold">{preview.stats.num_nodes} nodes / {preview.stats.num_edges} edges</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-4">
            <span>Components: {preview.stats.num_connected_components}</span>
            <span>Avg degree: {preview.stats.avg_degree}</span>
            <span>Density: {preview.stats.density}</span>
            <span>Types: {preview.stats.num_node_types}</span>
          </div>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          onClick={resetView}
          type="button"
        >
          Reset
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr_280px]">
        <aside className="grid content-start gap-4">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="graph-search">
            Search
          </label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-graph-blue focus:ring-2 focus:ring-blue-100"
            id="graph-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Node id, label, type"
            type="search"
            value={query}
          />

          <FilterGroup
            colorByItem={colorByType}
            enabled={enabledTypes}
            items={nodeTypes}
            onToggle={toggleType}
            title="Node types"
          />
          <FilterGroup
            enabled={enabledRelations}
            items={relationTypes}
            onToggle={toggleRelation}
            title="Relations"
          />
        </aside>

        <div className="min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <svg
            aria-label="Interactive graph preview"
            className="block h-full min-h-[520px] w-full"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          >
            <rect fill="#f8fafc" height={VIEWBOX_HEIGHT} width={VIEWBOX_WIDTH} />
            {renderedEdges.map((edge, index) => {
              const source = positionedById.get(edge.source)
              const target = positionedById.get(edge.target)
              if (!source || !target) return null
              const selectedEdge = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
              return (
                <line
                  key={`${edge.source}-${edge.target}-${edge.relation}-${index}`}
                  stroke={selectedEdge ? "#334155" : "#cbd5e1"}
                  strokeOpacity={selectedEdge ? 0.9 : 0.45}
                  strokeWidth={selectedEdge ? 1.8 : 1}
                  x1={source.x}
                  x2={target.x}
                  y1={source.y}
                  y2={target.y}
                />
              )
            })}
            {positionedNodes.map((node) => {
              const isSelected = node.id === selectedNodeId
              const isNeighbor = selectedNeighbors.has(node.id)
              const faded = selectedNodeId && !isSelected && !isNeighbor
              const radius = Math.min(19, 7 + Math.sqrt(node.degree + 1) * 2.2)
              return (
                <g
                  className="cursor-pointer"
                  key={node.id}
                  onClick={() => selectNode(node.id)}
                  opacity={faded ? 0.25 : 1}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    fill={node.color}
                    r={radius}
                    stroke={isSelected ? "#0f172a" : "#ffffff"}
                    strokeWidth={isSelected ? 4 : 2}
                  >
                    <title>{node.id}</title>
                  </circle>
                  {(isSelected || positionedNodes.length <= 35) ? (
                    <text
                      fill="#334155"
                      fontSize="12"
                      fontWeight={isSelected ? 700 : 500}
                      textAnchor="middle"
                      x={node.x}
                      y={node.y + radius + 16}
                    >
                      {shortLabel(node.label)}
                    </text>
                  ) : null}
                </g>
              )
            })}
            {!positionedNodes.length ? (
              <text fill="#64748b" fontSize="18" textAnchor="middle" x={VIEWBOX_WIDTH / 2} y={VIEWBOX_HEIGHT / 2}>
                No nodes match the current filters
              </text>
            ) : null}
          </svg>
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-md border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Visible graph</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
              <dt>Nodes</dt>
              <dd className="text-right font-semibold text-slate-800">{visibleNodes.length}</dd>
              <dt>Edges</dt>
              <dd className="text-right font-semibold text-slate-800">{visibleEdges.length}</dd>
              <dt>Rendered</dt>
              <dd className="text-right font-semibold text-slate-800">{renderedEdges.length}</dd>
              <dt>Hidden</dt>
              <dd className="text-right font-semibold text-slate-800">{Math.max(visibleEdges.length - renderedEdges.length, 0)}</dd>
            </dl>
          </div>

          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">Selected node</p>
              <button
                className="text-sm font-semibold text-graph-blue disabled:text-slate-400"
                disabled={!selectedNode}
                onClick={() => setFocusNeighbors((current) => !current)}
                type="button"
              >
                {focusNeighbors ? "Show all" : "Focus"}
              </button>
            </div>
            {selectedNode ? (
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <p className="break-all font-semibold text-slate-800">{selectedNode.id}</p>
                <p>Type: {selectedNode.type}</p>
                <p>Degree: {selectedDegree}</p>
                <FeatureList features={selectedNode.features} />
                {selectedNeighborList.length ? (
                  <div>
                    <p className="font-semibold text-slate-700">Neighbors</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedNeighborList.map((neighborId) => (
                        <button
                          className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                          key={neighborId}
                          onClick={() => selectNode(neighborId)}
                          type="button"
                        >
                          {shortLabel(neighborId)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">None</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

function FilterGroup({
  colorByItem,
  enabled,
  items,
  onToggle,
  title,
}: {
  colorByItem?: Record<string, string>
  enabled: Record<string, boolean>
  items: string[]
  onToggle: (item: string) => void
  title: string
}) {
  return (
    <fieldset className="rounded-md border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-700">{title}</legend>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <label className="flex items-center gap-2 text-sm text-slate-700" key={item}>
            <input
              checked={enabled[item] ?? true}
              className="h-4 w-4 rounded border-slate-300 text-graph-blue focus:ring-graph-blue"
              onChange={() => onToggle(item)}
              type="checkbox"
            />
            {colorByItem ? (
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: colorByItem[item] ?? "#64748b" }}
              />
            ) : null}
            <span className="truncate">{item}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function FeatureList({ features }: { features: Record<string, unknown> }) {
  const entries = Object.entries(features).slice(0, 8)
  if (!entries.length) {
    return null
  }
  return (
    <div>
      <p className="font-semibold text-slate-700">Features</p>
      <dl className="mt-2 grid gap-1">
        {entries.map(([key, value]) => (
          <div className="grid grid-cols-[90px_1fr] gap-2" key={key}>
            <dt className="truncate text-slate-500">{key}</dt>
            <dd className="truncate text-slate-700">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function buildGraphIndex(nodes: GraphNode[], edges: GraphEdge[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const degreeByNode = new Map<string, number>()
  const neighborsByNode = new Map<string, Set<string>>()

  for (const node of nodes) {
    degreeByNode.set(node.id, 0)
    neighborsByNode.set(node.id, new Set<string>())
  }
  for (const edge of edges) {
    degreeByNode.set(edge.source, (degreeByNode.get(edge.source) ?? 0) + 1)
    degreeByNode.set(edge.target, (degreeByNode.get(edge.target) ?? 0) + 1)
    neighborsByNode.get(edge.source)?.add(edge.target)
    neighborsByNode.get(edge.target)?.add(edge.source)
  }

  return { degreeByNode, neighborsByNode, nodeById }
}

function positionNodes(
  nodes: GraphNode[],
  degreeByNode: Map<string, number>,
  colorByType: Record<string, string>,
): PositionedNode[] {
  if (!nodes.length) {
    return []
  }

  const grouped = new Map<string, GraphNode[]>()
  for (const node of nodes) {
    grouped.set(node.type, [...(grouped.get(node.type) ?? []), node])
  }

  const types = Array.from(grouped.keys()).sort()
  const centerX = VIEWBOX_WIDTH / 2
  const centerY = VIEWBOX_HEIGHT / 2
  const clusterRadiusX = Math.min(360, 160 + types.length * 35)
  const clusterRadiusY = Math.min(210, 100 + types.length * 25)

  return types.flatMap((type, typeIndex) => {
    const group = [...(grouped.get(type) ?? [])].sort(
      (left, right) => (degreeByNode.get(right.id) ?? 0) - (degreeByNode.get(left.id) ?? 0) || left.id.localeCompare(right.id),
    )
    const typeAngle = (Math.PI * 2 * typeIndex) / Math.max(types.length, 1) - Math.PI / 2
    const groupCenterX = types.length === 1 ? centerX : centerX + Math.cos(typeAngle) * clusterRadiusX
    const groupCenterY = types.length === 1 ? centerY : centerY + Math.sin(typeAngle) * clusterRadiusY
    const ringStep = group.length < 18 ? 42 : 34

    return group.map((node, index) => {
      if (index === 0) {
        return {
          ...node,
          x: groupCenterX,
          y: groupCenterY,
          degree: degreeByNode.get(node.id) ?? 0,
          color: colorByType[node.type] ?? "#64748b",
        }
      }
      const ring = Math.floor(Math.sqrt(index))
      const firstIndexInRing = ring * ring
      const itemsInRing = Math.max((ring + 1) * (ring + 1) - firstIndexInRing, 1)
      const ringIndex = index - firstIndexInRing
      const angle = (Math.PI * 2 * ringIndex) / itemsInRing + ring * 0.43
      return {
        ...node,
        x: clamp(groupCenterX + Math.cos(angle) * ring * ringStep, 26, VIEWBOX_WIDTH - 26),
        y: clamp(groupCenterY + Math.sin(angle) * ring * ringStep, 26, VIEWBOX_HEIGHT - 26),
        degree: degreeByNode.get(node.id) ?? 0,
        color: colorByType[node.type] ?? "#64748b",
      }
    })
  })
}

function sortUnique(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
}

function shortLabel(value: string) {
  return value.length > 22 ? `${value.slice(0, 19)}...` : value
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
