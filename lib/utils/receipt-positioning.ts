/**
 * Receipt Position Calibration Utilities
 *
 * Uses anchor items and line numbers to calibrate position_percent values
 * for accurate visual alignment in the receipt review UI.
 */

import { ReceiptItem } from '../receiptScanner/types'

interface Anchor {
  line_number: number
  position_percent: number
}

/**
 * Calibrate item positions using anchor items and line number interpolation
 *
 * This function takes Claude's raw position estimates and calibrates them using
 * anchor points (first, last, and middle items) combined with sequential line numbers.
 * This provides reliable positioning even when Claude's estimates are off.
 */
export function calibratePositions(items: ReceiptItem[]): ReceiptItem[] {
  if (!items || items.length === 0) return []

  // Sort by line number to ensure correct order
  const sorted = [...items].sort((a, b) =>
    (a.line_number || 0) - (b.line_number || 0)
  )

  const total = sorted.length

  // Extract anchors with Claude's position estimates
  const firstItem = sorted.find(i => i.is_first_item)
  const lastItem = sorted.find(i => i.is_last_item)
  const midItems = sorted.filter(i => i.is_anchor_mid)

  const anchors: Anchor[] = [
    firstItem,
    ...midItems,
    lastItem
  ]
    .filter((item): item is ReceiptItem =>
      item !== undefined &&
      item.line_number !== undefined &&
      item.position_percent !== undefined
    )
    .map(item => ({
      line_number: item.line_number!,
      position_percent: item.position_percent!
    }))

  // If we have fewer than 2 anchors, fall back to simple linear positioning
  if (anchors.length < 2) {
    console.warn('[receipt-positioning] Insufficient anchors, using linear fallback', {
      anchorCount: anchors.length,
      itemCount: total
    })

    return sorted.map((item, idx) => ({
      ...item,
      position_percent: total === 1 ? 50 : (idx / (total - 1)) * 100
    }))
  }

  console.log('[receipt-positioning] Calibrating positions', {
    itemCount: total,
    anchorCount: anchors.length,
    anchors: anchors.map(a => `line ${a.line_number} @ ${a.position_percent}%`)
  })

  // Interpolate positions using anchors and line numbers
  const calibrated = sorted.map(item => {
    if (!item.line_number) {
      console.warn('[receipt-positioning] Item missing line_number', { name: item.name })
      return item
    }

    const calibratedPos = interpolateBetweenAnchors(
      item.line_number,
      anchors
    )

    return {
      ...item,
      position_percent: calibratedPos
    }
  })

  return calibrated
}

/**
 * Interpolate position for a line number using surrounding anchors
 *
 * Uses linear interpolation between the nearest anchor points to calculate
 * an accurate position percentage.
 */
function interpolateBetweenAnchors(
  lineNum: number,
  anchors: Anchor[]
): number {
  // Sort anchors by line number
  const sortedAnchors = [...anchors].sort((a, b) => a.line_number - b.line_number)

  // Find the surrounding anchor points
  let lowerAnchor = sortedAnchors[0]
  let upperAnchor = sortedAnchors[sortedAnchors.length - 1]

  // Find the two anchors that bracket this line number
  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    if (sortedAnchors[i].line_number <= lineNum &&
        sortedAnchors[i + 1].line_number >= lineNum) {
      lowerAnchor = sortedAnchors[i]
      upperAnchor = sortedAnchors[i + 1]
      break
    }
  }

  // Handle edge cases
  if (lineNum < lowerAnchor.line_number) {
    // Extrapolate before first anchor
    return lowerAnchor.position_percent
  }
  if (lineNum > upperAnchor.line_number) {
    // Extrapolate after last anchor
    return upperAnchor.position_percent
  }

  // Avoid division by zero
  if (upperAnchor.line_number === lowerAnchor.line_number) {
    return lowerAnchor.position_percent
  }

  // Linear interpolation between anchors
  const lineFraction =
    (lineNum - lowerAnchor.line_number) /
    (upperAnchor.line_number - lowerAnchor.line_number)

  const interpolatedPos =
    lowerAnchor.position_percent +
    lineFraction * (upperAnchor.position_percent - lowerAnchor.position_percent)

  // Clamp to valid range
  return Math.max(0, Math.min(100, interpolatedPos))
}
