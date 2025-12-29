/**
 * Receipt Gap Detection Utilities
 *
 * Detects missing line items by analyzing gaps in line_number sequence
 * and provides confidence scoring to filter out intentional gaps.
 */

import { ReceiptItem } from '../receiptScanner/types'

export interface Gap {
  missing_line: number
  before_item: string
  after_item: string
  before_price: number
  after_price: number
  position_hint: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Find gaps in line number sequence with confidence scoring
 *
 * Analyzes the sequence of line numbers to detect missing items.
 * Uses heuristics (price differences) to assess whether a gap is
 * likely a missing item (high confidence) or an intentional section
 * break (low confidence).
 */
export function findLineNumberGaps(items: ReceiptItem[]): Gap[] {
  if (!items || items.length < 2) return []

  // Sort by line number
  const sorted = [...items].sort((a, b) =>
    (a.line_number || 0) - (b.line_number || 0)
  )

  const gaps: Gap[] = []

  for (let i = 1; i < sorted.length; i++) {
    const prevItem = sorted[i - 1]
    const currItem = sorted[i]

    if (!prevItem.line_number || !currItem.line_number) continue

    const expected = prevItem.line_number + 1
    const actual = currItem.line_number

    // Check if there's a gap in the sequence
    if (actual > expected) {
      // Calculate price difference as a heuristic for confidence
      const priceDiff = Math.abs(currItem.price - prevItem.price)

      // Heuristic scoring:
      // - Large price jumps (>$5) might indicate section breaks or special items
      // - Medium jumps ($2-$5) could go either way
      // - Small jumps (<$2) are likely genuine missing items
      const confidence: 'high' | 'medium' | 'low' =
        priceDiff > 5.0 ? 'low' :
        priceDiff > 2.0 ? 'medium' : 'high'

      const prevPos = prevItem.position_percent?.toFixed(0) || '?'
      const currPos = currItem.position_percent?.toFixed(0) || '?'

      gaps.push({
        missing_line: expected,
        before_item: prevItem.name,
        after_item: currItem.name,
        before_price: prevItem.price,
        after_price: currItem.price,
        position_hint: `between ${prevPos}% and ${currPos}%`,
        confidence
      })
    }
  }

  console.log('[gap-detection] Found gaps', {
    totalGaps: gaps.length,
    highConfidence: gaps.filter(g => g.confidence === 'high').length,
    mediumConfidence: gaps.filter(g => g.confidence === 'medium').length,
    lowConfidence: gaps.filter(g => g.confidence === 'low').length
  })

  return gaps
}

/**
 * Format gap information for verification prompt
 *
 * Creates human-readable descriptions of gaps organized by confidence level
 */
export function formatGapsForPrompt(gaps: Gap[]): string {
  if (gaps.length === 0) {
    return 'No gaps detected in line number sequence. Please verify that all visible items were extracted.'
  }

  const highPriorityGaps = gaps.filter(g => g.confidence === 'high')
  const mediumPriorityGaps = gaps.filter(g => g.confidence === 'medium')
  const lowPriorityGaps = gaps.filter(g => g.confidence === 'low')

  let formatted = ''

  if (highPriorityGaps.length > 0) {
    formatted += '\n🔴 HIGH PRIORITY GAPS (likely missing items):\n'
    formatted += highPriorityGaps.map(gap =>
      `   Missing line ${gap.missing_line}\n` +
      `   Before: "${gap.before_item}" ($${gap.before_price.toFixed(2)})\n` +
      `   After: "${gap.after_item}" ($${gap.after_price.toFixed(2)})\n` +
      `   Look at ${gap.position_hint} of receipt\n`
    ).join('\n')
  }

  if (mediumPriorityGaps.length > 0) {
    formatted += '\n🟡 MEDIUM PRIORITY GAPS (check carefully):\n'
    formatted += mediumPriorityGaps.map(gap =>
      `   Possible missing line ${gap.missing_line}\n` +
      `   Before: "${gap.before_item}" ($${gap.before_price.toFixed(2)})\n` +
      `   After: "${gap.after_item}" ($${gap.after_price.toFixed(2)})\n` +
      `   Position: ${gap.position_hint}\n`
    ).join('\n')
  }

  if (lowPriorityGaps.length > 0) {
    formatted += '\n⚪ LOW PRIORITY GAPS (may be intentional section breaks):\n'
    formatted += lowPriorityGaps.map(gap =>
      `   Line ${gap.missing_line} between "${gap.before_item}" and "${gap.after_item}"\n`
    ).join('\n')
  }

  return formatted
}

/**
 * Insert found items into the correct position in the items array
 *
 * When verification finds missing items, this function inserts them
 * at the correct line_number position and renumbers subsequent items
 */
export function insertMissedItems(
  originalItems: ReceiptItem[],
  missedItems: ReceiptItem[]
): ReceiptItem[] {
  if (!missedItems || missedItems.length === 0) return originalItems

  // Combine all items
  const allItems = [...originalItems, ...missedItems]

  // Sort by line number
  const sorted = allItems.sort((a, b) =>
    (a.line_number || 0) - (b.line_number || 0)
  )

  // Renumber sequentially to fix any gaps
  return sorted.map((item, index) => ({
    ...item,
    line_number: index + 1
  }))
}
