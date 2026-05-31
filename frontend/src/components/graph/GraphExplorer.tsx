"use client"

import { useMemo, useState } from "react"
import { Focus, Gauge, MousePointer2, RefreshCw, Route, Search, SlidersHorizontal, Sparkles } from "lucide-react"

import type { GraphEdge, GraphNode, GraphPreview } from "@/types"

const VIEWBOX_WIDTH = 1040
const VIEWBOX_HEIGHT = 620
const MAX_RENDERED_EDGES = 900

const PALETTE = [
  "#1d7fd6",
  "#36a982",
  "#d69032",
  "#d95f7a",
  "#8d8fe5",
  "#1aa6b8",
  "#6d8ee8",
  "#58c7a4",
]

type DensityMode = "compact" | "spacious"
type NodeSizeMode = "degree" | "uniform"
type EdgeVisibilityMode = "all" | "neighborhood"

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
  const [hoveredNodeId, setHoveredNodeId] = useState<string>("")
  const [animatedLayout, setAnimatedLayout] = useState(true)
  const [focusNeighbors, setFocusNeighbors] = useState(true)
  const [densityMode, setDensityMode] = useState<DensityMode>("spacious")
  const [nodeSizeMode, setNodeSizeMode] = useState<NodeSizeMode>("degree")
  const [edgeVisibility, setEdgeVisibility] = useState<EdgeVisibilityMode>("all")

  const colorByType = useMemo(
    () => Object.fromEntries(nodeTypes.map((type, index) => [type, PALETTE[index % PALETTE.length]])),
    [nodeTypes],
  )

  const graphIndex = useMemo(() => buildGraphIndex(preview.nodes, preview.edges), [preview.nodes, preview.edges])
  const selectedNeighbors = selectedNodeId ? graphIndex.neighborsByNode.get(selectedNodeId) ?? new Set<string>() : new Set<string>()
  const normalizedQuery = query.trim().toLowerCase()
  const queryMatches = useMemo(() => {
    if (!normalizedQuery) {
      return new Set<string>()
    }
    return new Set(
      preview.nodes
        .filter(
          (node) =>
            node.id.toLowerCase().includes(normalizedQuery) ||
            node.label.toLowerCase().includes(normalizedQuery) ||
            node.type.toLowerCase().includes(normalizedQuery),
        )
        .map((node) => node.id),
    )
  }, [normalizedQuery, preview.nodes])

  const visibleNodes = useMemo(() => {
    return preview.nodes.filter((node) => {
      const typeEnabled = enabledTypes[node.type] ?? true
      const matchesQuery = !normalizedQuery || queryMatches.has(node.id)
      return typeEnabled && matchesQuery
    })
  }, [enabledTypes, normalizedQuery, preview.nodes, queryMatches])

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const visibleEdges = useMemo(
    () =>
      preview.edges.filter((edge) => {
        const baseVisible =
          visibleNodeIds.has(edge.source) &&
          visibleNodeIds.has(edge.target) &&
          (enabledRelations[edge.relation] ?? true)
        if (!baseVisible) {
          return false
        }
        if (edgeVisibility === "neighborhood" && selectedNodeId) {
          return edge.source === selectedNodeId || edge.target === selectedNodeId
        }
        return true
      }),
    [edgeVisibility, enabledRelations, preview.edges, selectedNodeId, visibleNodeIds],
  )

  const positionedNodes = useMemo(
    () => positionNodes(visibleNodes, graphIndex.degreeByNode, colorByType, densityMode),
    [colorByType, densityMode, graphIndex.degreeByNode, visibleNodes],
  )
  const positionedById = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes])
  const renderedEdges = visibleEdges.slice(0, MAX_RENDERED_EDGES)
  const selectedNode = selectedNodeId ? graphIndex.nodeById.get(selectedNodeId) : undefined
  const hoveredNode = hoveredNodeId ? positionedById.get(hoveredNodeId) : undefined
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
  }

  function resetView() {
    setQuery("")
    setSelectedNodeId("")
    setHoveredNodeId("")
    setFocusNeighbors(true)
    setAnimatedLayout(true)
    setDensityMode("spacious")
    setNodeSizeMode("degree")
    setEdgeVisibility("all")
    setEnabledTypes(Object.fromEntries(nodeTypes.map((type) => [type, true])))
    setEnabledRelations(Object.fromEntries(relationTypes.map((relation) => [relation, true])))
  }

  return (
    <section className="soft-card p-5" id="graph-explorer">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-graph-cyan">Animated graph preview</p>
          <h2 className="mt-1 text-2xl font-bold">
            {preview.stats.num_nodes} nodes / {preview.stats.num_edges} edges
          </h2>
          <div className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-4">
            <span>Components: {preview.stats.num_connected_components}</span>
            <span>Avg degree: {preview.stats.avg_degree}</span>
            <span>Density: {preview.stats.density}</span>
            <span>Types: {preview.stats.num_node_types}</span>
          </div>
        </div>
        <button className="btn-secondary" onClick={resetView} type="button">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reset
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="grid content-start gap-4">
          <label className="block text-sm font-bold text-ink" htmlFor="graph-search">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" aria-hidden="true" />
            <input
              className="w-full rounded-card border border-border-soft bg-white px-9 py-2 text-sm focus:border-cyan-200"
              id="graph-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Node id, label, type"
              type="search"
              value={query}
            />
          </div>

          <ControlPanel
            animatedLayout={animatedLayout}
            densityMode={densityMode}
            edgeVisibility={edgeVisibility}
            focusNeighbors={focusNeighbors}
            nodeSizeMode={nodeSizeMode}
            onAnimatedLayout={setAnimatedLayout}
            onDensityMode={setDensityMode}
            onEdgeVisibility={setEdgeVisibility}
            onFocusNeighbors={setFocusNeighbors}
            onNodeSizeMode={setNodeSizeMode}
          />

          <FilterGroup
            colorByItem={colorByType}
            enabled={enabledTypes}
            items={nodeTypes}
            onToggle={toggleType}
            title="Node types"
          />
          <FilterGroup enabled={enabledRelations} items={relationTypes} onToggle={toggleRelation} title="Relations" />
        </aside>

        <div className="min-h-[560px] overflow-hidden rounded-card border border-border-soft bg-white shadow-line">
          <svg
            aria-label="Interactive graph preview"
            className="block h-full min-h-[560px] w-full"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          >
            <rect fill="#f8fbff" height={VIEWBOX_HEIGHT} width={VIEWBOX_WIDTH} />
            <g>
              {renderedEdges.map((edge, index) => {
                const source = positionedById.get(edge.source)
                const target = positionedById.get(edge.target)
                if (!source || !target) return null
                const selectedEdge = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
                const dimmed =
                  focusNeighbors &&
                  selectedNodeId &&
                  edge.source !== selectedNodeId &&
                  edge.target !== selectedNodeId
                return (
                  <line
                    className={animatedLayout ? "graph-edge-draw" : undefined}
                    key={`${edge.source}-${edge.target}-${edge.relation}-${index}`}
                    stroke={selectedEdge ? "#38536d" : "#b8cddd"}
                    strokeLinecap="round"
                    strokeOpacity={dimmed ? 0.14 : selectedEdge ? 0.9 : 0.46}
                    strokeWidth={selectedEdge ? 2.15 : 1.2}
                    style={{ animationDelay: animatedLayout ? `${Math.min(index * 8, 520)}ms` : undefined }}
                    x1={source.x}
                    x2={target.x}
                    y1={source.y}
                    y2={target.y}
                  />
                )
              })}
            </g>
            <g>
              {positionedNodes.map((node, index) => {
                const isSelected = node.id === selectedNodeId
                const isNeighbor = selectedNeighbors.has(node.id)
                const isHovered = node.id === hoveredNodeId
                const isQueryMatch = queryMatches.has(node.id)
                const faded = focusNeighbors && selectedNodeId && !isSelected && !isNeighbor
                const radius = nodeSizeMode === "uniform" ? 10.5 : Math.min(21, 7 + Math.sqrt(node.degree + 1) * 2.3)
                return (
                  <g
                    className={`${animatedLayout ? "graph-node-enter" : ""} graph-node-hover cursor-pointer`}
                    key={node.id}
                    onClick={() => selectNode(node.id)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId("")}
                    opacity={faded ? 0.24 : 1}
                    style={{ animationDelay: animatedLayout ? `${Math.min(index * 16, 780)}ms` : undefined }}
                  >
                    {isSelected ? (
                      <circle
                        className="pulse-ring"
                        cx={node.x}
                        cy={node.y}
                        fill="none"
                        r={radius + 5}
                        stroke={node.color}
                        strokeWidth="3"
                      />
                    ) : null}
                    {isQueryMatch ? (
                      <circle cx={node.x} cy={node.y} fill="none" r={radius + 7} stroke="#d69032" strokeWidth="3" />
                    ) : null}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      fill={node.color}
                      r={isHovered ? radius + 2.5 : radius}
                      stroke={isSelected ? "#142033" : isNeighbor ? "#ffffff" : "#ffffff"}
                      strokeWidth={isSelected ? 4 : isNeighbor ? 3 : 2}
                    />
                    {(isSelected || isHovered || positionedNodes.length <= 35) ? (
                      <text
                        fill="#38536d"
                        fontSize="12"
                        fontWeight={isSelected ? 800 : 650}
                        textAnchor="middle"
                        x={node.x}
                        y={node.y + radius + 17}
                      >
                        {shortLabel(node.label)}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </g>
            {hoveredNode ? <NodeTooltip node={hoveredNode} /> : null}
            {!positionedNodes.length ? (
              <text fill="#637083" fontSize="18" fontWeight="700" textAnchor="middle" x={VIEWBOX_WIDTH / 2} y={VIEWBOX_HEIGHT / 2}>
                No nodes match the current filters
              </text>
            ) : null}
          </svg>
        </div>

        <aside className="grid content-start gap-4">
          <div className="subtle-panel p-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-graph-cyan" aria-hidden="true" />
              <p className="text-sm font-bold text-ink">Visible graph</p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted">
              <dt>Nodes</dt>
              <dd className="text-right font-bold text-ink">{visibleNodes.length}</dd>
              <dt>Edges</dt>
              <dd className="text-right font-bold text-ink">{visibleEdges.length}</dd>
              <dt>Rendered</dt>
              <dd className="text-right font-bold text-ink">{renderedEdges.length}</dd>
              <dt>Hidden</dt>
              <dd className="text-right font-bold text-ink">{Math.max(visibleEdges.length - renderedEdges.length, 0)}</dd>
            </dl>
            {visibleEdges.length > renderedEdges.length ? (
              <p className="mt-3 rounded-card border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Showing a sampled/rendered edge set for responsive interaction.
              </p>
            ) : null}
          </div>

          <div className="subtle-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MousePointer2 className="h-4 w-4 text-accent-indigo" aria-hidden="true" />
                <p className="text-sm font-bold text-ink">Selected node</p>
              </div>
              <button
                className="text-sm font-bold text-graph-cyan disabled:text-muted"
                disabled={!selectedNode}
                onClick={() => setFocusNeighbors((current) => !current)}
                type="button"
              >
                {focusNeighbors ? "Unfocus" : "Focus"}
              </button>
            </div>
            {selectedNode ? (
              <div className="mt-3 space-y-3 text-sm text-muted">
                <p className="break-all font-bold text-ink">{selectedNode.id}</p>
                <p>Type: {selectedNode.type}</p>
                <p>Degree: {selectedDegree}</p>
                <FeatureList features={selectedNode.features} />
                {selectedNeighborList.length ? (
                  <div>
                    <p className="font-bold text-ink">Neighbors</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedNeighborList.map((neighborId) => (
                        <button
                          className="rounded-full border border-border-soft bg-white px-2 py-1 text-xs font-semibold text-muted hover:border-cyan-200 hover:text-graph-cyan"
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
              <p className="mt-3 text-sm text-muted">Select or hover a node to inspect its neighborhood.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

function ControlPanel({
  animatedLayout,
  densityMode,
  edgeVisibility,
  focusNeighbors,
  nodeSizeMode,
  onAnimatedLayout,
  onDensityMode,
  onEdgeVisibility,
  onFocusNeighbors,
  onNodeSizeMode,
}: {
  animatedLayout: boolean
  densityMode: DensityMode
  edgeVisibility: EdgeVisibilityMode
  focusNeighbors: boolean
  nodeSizeMode: NodeSizeMode
  onAnimatedLayout: (value: boolean) => void
  onDensityMode: (value: DensityMode) => void
  onEdgeVisibility: (value: EdgeVisibilityMode) => void
  onFocusNeighbors: (value: boolean) => void
  onNodeSizeMode: (value: NodeSizeMode) => void
}) {
  return (
    <div className="subtle-panel p-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-graph-cyan" aria-hidden="true" />
        <p className="text-sm font-bold text-ink">Controls</p>
      </div>
      <div className="mt-3 grid gap-3">
        <ToggleControl icon={<Sparkles className="h-4 w-4" />} label="Animated layout" checked={animatedLayout} onChange={onAnimatedLayout} />
        <ToggleControl icon={<Focus className="h-4 w-4" />} label="Focus neighbors" checked={focusNeighbors} onChange={onFocusNeighbors} />
        <SegmentedControl<DensityMode>
          label="Density"
          options={[
            ["compact", "Compact"],
            ["spacious", "Spacious"],
          ]}
          value={densityMode}
          onChange={onDensityMode}
        />
        <SegmentedControl<NodeSizeMode>
          label="Node size"
          options={[
            ["degree", "Degree"],
            ["uniform", "Uniform"],
          ]}
          value={nodeSizeMode}
          onChange={onNodeSizeMode}
        />
        <SegmentedControl<EdgeVisibilityMode>
          label="Edges"
          options={[
            ["all", "All"],
            ["neighborhood", "Selected"],
          ]}
          value={edgeVisibility}
          onChange={onEdgeVisibility}
        />
      </div>
    </div>
  )
}

function ToggleControl({
  checked,
  icon,
  label,
  onChange,
}: {
  checked: boolean
  icon: React.ReactNode
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm font-semibold text-muted">
      <span className="flex items-center gap-2">
        <span className="text-graph-cyan">{icon}</span>
        {label}
      </span>
      <input
        checked={checked}
        className="h-4 w-4 rounded border-border-soft text-graph-cyan focus:ring-graph-cyan"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  )
}

function SegmentedControl<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: T) => void
  options: Array<[T, string]>
  value: T
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-card border border-border-soft bg-white p-1">
        {options.map(([option, optionLabel]) => (
          <button
            className={`rounded-md px-2 py-1.5 text-xs font-bold ${
              value === option ? "bg-cyan-50 text-graph-cyan shadow-line" : "text-muted hover:bg-surface-muted"
            }`}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
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
    <fieldset className="subtle-panel p-4">
      <legend className="px-1 text-sm font-bold text-ink">{title}</legend>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <label className="flex items-center gap-2 text-sm font-semibold text-muted" key={item}>
            <input
              checked={enabled[item] ?? true}
              className="h-4 w-4 rounded border-border-soft text-graph-cyan focus:ring-graph-cyan"
              onChange={() => onToggle(item)}
              type="checkbox"
            />
            {colorByItem ? (
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorByItem[item] ?? "#637083" }} />
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
      <p className="font-bold text-ink">Features</p>
      <dl className="mt-2 grid gap-1">
        {entries.map(([key, value]) => (
          <div className="grid grid-cols-[90px_1fr] gap-2" key={key}>
            <dt className="truncate text-muted">{key}</dt>
            <dd className="truncate text-ink">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function NodeTooltip({ node }: { node: PositionedNode }) {
  const width = 230
  const height = 72
  const x = clamp(node.x + 18, 10, VIEWBOX_WIDTH - width - 10)
  const y = clamp(node.y - height - 18, 10, VIEWBOX_HEIGHT - height - 10)
  return (
    <g pointerEvents="none">
      <rect fill="#142033" height={height} rx="8" width={width} x={x} y={y} opacity="0.94" />
      <text fill="#e8f2f8" fontSize="12" fontWeight="800" x={x + 14} y={y + 23}>
        {shortLabel(node.label)}
      </text>
      <text fill="#b8cddd" fontSize="11" fontWeight="650" x={x + 14} y={y + 43}>
        {node.type} / degree {node.degree}
      </text>
      <text fill="#9dc4dd" fontSize="10" x={x + 14} y={y + 60}>
        Click to pin neighborhood
      </text>
    </g>
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
  densityMode: DensityMode,
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
  const clusterRadiusX = Math.min(370, 155 + types.length * 38)
  const clusterRadiusY = Math.min(220, 105 + types.length * 24)
  const densityMultiplier = densityMode === "compact" ? 0.72 : 1

  return types.flatMap((type, typeIndex) => {
    const group = [...(grouped.get(type) ?? [])].sort(
      (left, right) => (degreeByNode.get(right.id) ?? 0) - (degreeByNode.get(left.id) ?? 0) || left.id.localeCompare(right.id),
    )
    const typeAngle = (Math.PI * 2 * typeIndex) / Math.max(types.length, 1) - Math.PI / 2
    const groupCenterX = types.length === 1 ? centerX : centerX + Math.cos(typeAngle) * clusterRadiusX
    const groupCenterY = types.length === 1 ? centerY : centerY + Math.sin(typeAngle) * clusterRadiusY
    const ringStep = (group.length < 18 ? 42 : 34) * densityMultiplier

    return group.map((node, index) => {
      if (index === 0) {
        return {
          ...node,
          x: groupCenterX,
          y: groupCenterY,
          degree: degreeByNode.get(node.id) ?? 0,
          color: colorByType[node.type] ?? "#637083",
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
        color: colorByType[node.type] ?? "#637083",
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
