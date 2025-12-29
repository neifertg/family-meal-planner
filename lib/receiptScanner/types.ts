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
  category?: string        // Categorized by Claude: produce, dairy, meat, pantry, frozen, non_food
  is_food?: boolean        // true for food items, false for bags/gift wrap/non-grocery
  source_text?: string     // Raw text from receipt that this item came from
  line_number?: number     // Sequential line number (1, 2, 3...) in top-to-bottom order
  position_percent?: number // Vertical position as percentage (0-100) - calibrated using anchors
  is_first_item?: boolean  // Anchor: true only for the first item on receipt
  is_last_item?: boolean   // Anchor: true only for the last item on receipt
  is_anchor_mid?: boolean  // Anchor: true for 2-3 middle items used for position calibration
  bounding_box?: BoundingBox // Coordinates for highlighting on receipt image
  cropped_image?: string   // Base64 data URL of cropped receipt segment showing this item
  consolidated_count?: number // Number of duplicate items that were merged into this one
  consolidated_details?: string // Explanation of what was consolidated (e.g., "Combined 3 separate entries")
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
  quality_warnings?: string[] // Quality issues detected during extraction
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
