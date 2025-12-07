/**
 * Receipt Scanner Types
 *
 * Structured schema for AI to extract receipt data
 */

export type BoundingBox = {
  x: number      // X coordinate (top-left)
  y: number      // Y coordinate (top-left)
  width: number  // Width of box
  height: number // Height of box
}

export type ReceiptItem = {
  name: string
  quantity?: string        // "2 lb", "1 dozen", "3 cans"
  price: number
  unit_price?: number      // Price per unit if calculable
  category?: string        // Auto-categorized: produce, dairy, meat, etc.
  source_text?: string     // Raw text from receipt that this item came from
  line_number?: number     // Approximate line number on receipt (for visual alignment)
  bounding_box?: BoundingBox // Coordinates for highlighting on receipt image
}

export type ExtractedReceipt = {
  store_name?: string
  store_location?: string
  purchase_date: string    // ISO date string
  items: ReceiptItem[]
  subtotal?: number
  tax?: number
  total: number
  payment_method?: string
  receipt_number?: string
}

export type ReceiptExtractionResult = {
  success: boolean
  receipt?: ExtractedReceipt
  error?: string
  confidence?: number      // 0-100, how confident the LLM is
  tokens_used?: number
  cost_usd?: number
}

export type InventoryMatch = {
  receipt_item: ReceiptItem
  inventory_item_id?: string
  inventory_item_name?: string
  match_confidence: number  // 0-1
  action: 'update' | 'create' | 'skip'
}
