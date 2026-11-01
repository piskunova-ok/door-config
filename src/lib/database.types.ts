import type { imageManifest } from '../data/imageManifest.ts'

export type ModelRow = {
  id: string
  name: string
  tagline: string
  description: string
  features: string[]
  base_price: number
  asset_model_id: keyof typeof imageManifest
  sizes: string[]
  is_visible: boolean
  sort_order: number
}

export type FinishRow = {
  model_id: string
  code: string
  name: string
  detail: string
  tone: string
  surcharge: number
  image_path: string
  is_visible: boolean
  sort_order: number
}

export type SizeRow = { id: string; label: string; surcharge: number; sort_order: number }
export type AccessoryRow = { id: string; name: string; price: number; is_visible: boolean; sort_order: number }
export type ServiceRow = { id: 'delivery' | 'installation'; price: number }
type AdminRow = { user_id: string }
export type EstimateRow = { id: string; number: string; created_at: string; configuration: { modelId: string; finishId: string; sizeId: string; accessoryIds: string[]; delivery: boolean; installation: boolean }; snapshot: { model: string; finish: string; size: string; image: string; lines: { key: string; label: string; amount: number }[]; total: number }; total: number }
export type RequestRow = { id: string; estimate_id: string; created_at: string; customer_name: string; phone: string; email: string | null; comment: string; consent_at: string; status: 'new' | 'in_progress' | 'completed'; ip_hash: string }
type Table<Row> = { Row: Row; Insert: Row; Update: Partial<Row>; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      door_admins: Table<AdminRow>
      door_models: Table<ModelRow>
      door_finishes: Table<FinishRow>
      door_sizes: Table<SizeRow>
      door_accessories: Table<AccessoryRow>
      door_service_tariffs: Table<ServiceRow>
      door_estimates: Table<EstimateRow>
      door_requests: Table<RequestRow>
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
