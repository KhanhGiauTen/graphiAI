export type ColumnRole =
  | "id"
  | "categorical"
  | "numerical"
  | "timestamp"
  | "label"
  | "text"
  | "unknown"

export interface ColumnProfile {
  name: string
  dtype: string
  null_count: number
  null_rate: number
  unique_count: number
  cardinality_ratio: number
  sample_values: unknown[]
  min_val?: unknown
  max_val?: unknown
  mean_val?: number | null
  inferred_role: ColumnRole
}

export interface DatasetProfile {
  filename?: string | null
  row_count: number
  column_count: number
  total_missing_rate: number
  memory_usage_mb: number
  columns: ColumnProfile[]
  id_columns: string[]
  label_columns: string[]
  has_timestamps: boolean
}

export interface NodeType {
  name: string
  source_column: string
  feature_columns: string[]
  count_estimate?: number | null
  reasoning: string
}

export interface EdgeType {
  source: string
  target: string
  relation: string
  source_columns: string[]
  directed: boolean
  reasoning: string
}

export interface GraphSchema {
  id: string
  name: string
  description: string
  node_types: NodeType[]
  edge_types: EdgeType[]
  suggested_tasks: string[]
  quality_score: number
  warnings: string[]
}

export interface GraphStats {
  num_nodes: number
  num_edges: number
  num_node_types: number
  num_edge_types: number
  avg_degree: number
  density: number
  num_connected_components: number
  top_degree_nodes: Array<Record<string, unknown>>
}

export interface GraphNode {
  id: string
  type: string
  label: string
  features: Record<string, unknown>
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
  features: Record<string, unknown>
}

export interface GraphPreview {
  schema_id: string
  stats: GraphStats
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface ProjectRead {
  id: string
  name?: string | null
  original_filename?: string | null
  file_size_bytes?: number | null
  status: string
  selected_schema_id?: string | null
  created_at: string
  updated_at: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: Record<string, unknown> | null
}
