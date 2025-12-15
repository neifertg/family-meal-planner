export interface ParsedInventoryItem {
  name: string
  quantity: string | null
  category: 'produce' | 'meat' | 'dairy' | 'pantry' | 'frozen' | 'other'
  expiration_date: string | null
  confidence: 'high' | 'medium' | 'low'
  original_text?: string
}

export interface AudioTranscriptionResponse {
  text: string
  duration: number
}

export interface InventoryParseResponse {
  items: ParsedInventoryItem[]
  summary: {
    total_items: number
    high_confidence: number
    needs_review: number
  }
}
