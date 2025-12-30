/**
 * Receipt Chunking for Long Receipts
 *
 * Splits very long receipts (30+ items) into overlapping chunks
 * to improve extraction accuracy by reducing cognitive load per extraction.
 */

import { ReceiptItem } from '../receiptScanner/types'

export interface ChunkConfig {
  min_items_for_chunking: number  // Default: 30
  chunk_overlap_percent: number    // Default: 0.2 (20% overlap)
  chunk_count: number               // Default: 3 (top, middle, bottom)
}

export interface ImageChunk {
  id: string
  section: 'top' | 'middle' | 'bottom'
  y_start_percent: number  // 0-100
  y_end_percent: number    // 0-100
  expected_item_range: string  // e.g., "items 1-15"
}

/**
 * Decide whether to use chunking based on estimated item count
 */
export function shouldUseChunking(estimatedItemCount: number, config?: Partial<ChunkConfig>): boolean {
  const minItems = config?.min_items_for_chunking || 30
  return estimatedItemCount >= minItems
}

/**
 * Generate chunk definitions for splitting a receipt image
 */
export function generateChunks(estimatedItemCount: number, config?: Partial<ChunkConfig>): ImageChunk[] {
  const chunkCount = config?.chunk_count || 3
  const overlapPercent = config?.chunk_overlap_percent || 0.2

  if (chunkCount === 3) {
    // Three overlapping chunks with 20% overlap
    // Top: 0-60%, Middle: 40-100%, Bottom: 60-100%
    // This creates two 20% overlap regions
    return [
      {
        id: 'top',
        section: 'top',
        y_start_percent: 0,
        y_end_percent: 60,
        expected_item_range: `items 1-${Math.ceil(estimatedItemCount * 0.6)}`
      },
      {
        id: 'middle',
        section: 'middle',
        y_start_percent: 40,
        y_end_percent: 100,
        expected_item_range: `items ${Math.ceil(estimatedItemCount * 0.4)}-${estimatedItemCount}`
      },
      {
        id: 'bottom',
        section: 'bottom',
        y_start_percent: 60,
        y_end_percent: 100,
        expected_item_range: `items ${Math.ceil(estimatedItemCount * 0.6)}-${estimatedItemCount}`
      }
    ]
  }

  // Generic chunking for other chunk counts
  const chunkSize = 100 / chunkCount
  const overlap = chunkSize * overlapPercent

  return Array.from({ length: chunkCount }, (_, i) => {
    const start = Math.max(0, i * chunkSize - (i > 0 ? overlap : 0))
    const end = Math.min(100, (i + 1) * chunkSize + (i < chunkCount - 1 ? overlap : 0))

    return {
      id: `chunk_${i + 1}`,
      section: i === 0 ? 'top' : i === chunkCount - 1 ? 'bottom' : 'middle',
      y_start_percent: start,
      y_end_percent: end,
      expected_item_range: `chunk ${i + 1} of ${chunkCount}`
    }
  })
}

/**
 * Crop an image to a specific chunk region
 * This is a placeholder - actual implementation would use canvas/sharp/jimp
 */
export async function cropImageToChunk(
  imageBase64: string,
  mimeType: string,
  chunk: ImageChunk
): Promise<string> {
  // For now, return original image with metadata about chunk
  // In production, this would actually crop the image using canvas API or image library

  console.log('[receipt-chunking] Cropping image for chunk', {
    section: chunk.section,
    y_range: `${chunk.y_start_percent}%-${chunk.y_end_percent}%`
  })

  // TODO: Implement actual image cropping
  // For Phase 2 MVP, we'll just send the full image with instructions
  // to focus on specific regions
  return imageBase64
}

/**
 * Deduplicate items found in overlapping regions of chunks
 */
export function deduplicateChunkItems(chunkResults: ReceiptItem[][]): ReceiptItem[] {
  const allItems = chunkResults.flat()

  // Use source_text as primary deduplication key
  const seenSourceTexts = new Set<string>()
  const uniqueItems: ReceiptItem[] = []

  for (const item of allItems) {
    const key = item.source_text?.toLowerCase() || `${item.name}_${item.price}`

    if (!seenSourceTexts.has(key)) {
      seenSourceTexts.add(key)
      uniqueItems.push(item)
    } else {
      console.log('[receipt-chunking] Deduplicating item', {
        name: item.name,
        source_text: item.source_text,
        reason: 'Found in multiple chunks (overlap region)'
      })
    }
  }

  // Sort by line_number to restore original order
  return uniqueItems.sort((a, b) => (a.line_number || 0) - (b.line_number || 0))
}

/**
 * Merge items from multiple chunks, handling overlaps intelligently
 */
export function mergeChunkResults(
  chunkResults: Array<{ chunk: ImageChunk; items: ReceiptItem[] }>,
  estimatedTotal: number
): ReceiptItem[] {
  console.log('[receipt-chunking] Merging results from chunks', {
    chunkCount: chunkResults.length,
    itemCounts: chunkResults.map(r => r.items.length),
    estimatedTotal
  })

  // Extract all items
  const allItemArrays = chunkResults.map(r => r.items)

  // Deduplicate items in overlap regions
  const deduplicated = deduplicateChunkItems(allItemArrays)

  // Renumber sequentially
  const renumbered = deduplicated.map((item, index) => ({
    ...item,
    line_number: index + 1
  }))

  console.log('[receipt-chunking] Merge complete', {
    totalBeforeDedup: allItemArrays.flat().length,
    totalAfterDedup: renumbered.length,
    estimatedTotal,
    captureRate: ((renumbered.length / estimatedTotal) * 100).toFixed(1) + '%'
  })

  return renumbered
}

/**
 * Generate chunk-specific extraction prompt
 */
export function generateChunkPrompt(chunk: ImageChunk, basePrompt: string): string {
  const chunkContext = `
IMPORTANT - CHUNK-SPECIFIC INSTRUCTIONS:
You are viewing the ${chunk.section.toUpperCase()} SECTION of a longer receipt.
This section spans from ${chunk.y_start_percent}% to ${chunk.y_end_percent}% of the full receipt.
Expected content: ${chunk.expected_item_range}.

EXTRACTION RULES FOR THIS CHUNK:
1. Extract ONLY items that are >50% visible in this section
2. Items at the edges (cut off) should be included if majority of item is visible
3. If an item appears to be cut off at the top/bottom edge, still extract it (overlap handling will deduplicate)
4. Pay special attention to ${chunk.section === 'top' ? 'the first few items' : chunk.section === 'bottom' ? 'the last few items' : 'items in the middle section'}
5. Line numbers should be sequential within this chunk (don't try to guess position in full receipt)

${basePrompt}
`

  return chunkContext
}

/**
 * Estimate item count from receipt image using quick pre-scan
 * This is a simplified heuristic - actual implementation would use Claude
 */
export async function estimateItemCount(
  imageBase64: string,
  mimeType: string
): Promise<number> {
  // Placeholder - in production, this would call Claude with a simple counting prompt
  // For now, return a default that won't trigger chunking unless explicitly enabled

  console.log('[receipt-chunking] Estimating item count from image...')

  // TODO: Implement actual counting via Claude
  // const count = await callClaudeToCountItems(imageBase64, mimeType)

  // For now, return 0 to indicate "unknown, don't chunk"
  return 0
}
