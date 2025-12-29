/**
 * Receipt Scanning Analytics
 *
 * Tracks and measures receipt scanning accuracy to monitor
 * position calibration and item capture improvements.
 */

import { ReceiptItem, ExtractedReceipt } from '../receiptScanner/types'

export interface ReceiptAnalytics {
  // Metadata
  receipt_id?: string
  timestamp: string
  store_name?: string
  item_count: number

  // Position accuracy metrics
  position_metrics: {
    has_anchors: boolean
    anchor_count: number
    first_item_pos?: number
    last_item_pos?: number
    avg_spacing: number
    position_distribution: 'clustered' | 'uniform' | 'irregular'
  }

  // Capture metrics
  capture_metrics: {
    initial_extraction_count: number
    verification_found_count: number
    final_item_count: number
    capture_rate_estimate: number // 0-100
    had_gaps: boolean
    gap_count: number
    high_confidence_gaps: number
  }

  // Quality indicators
  quality_indicators: {
    has_quality_warnings: boolean
    warning_count: number
    warnings: string[]
    receipt_length_category: 'short' | 'medium' | 'long' | 'very_long'
  }

  // Performance
  performance: {
    total_tokens_used?: number
    total_cost_usd?: number
    processing_time_ms?: number
  }
}

/**
 * Analyze position distribution to detect clustering or irregular spacing
 */
function analyzePositionDistribution(items: ReceiptItem[]): 'clustered' | 'uniform' | 'irregular' {
  if (items.length < 3) return 'uniform'

  const positions = items
    .map(i => i.position_percent)
    .filter((p): p is number => p !== undefined)
    .sort((a, b) => a - b)

  if (positions.length < 3) return 'irregular'

  // Calculate spacing between consecutive items
  const spacings = []
  for (let i = 1; i < positions.length; i++) {
    spacings.push(positions[i] - positions[i - 1])
  }

  // Calculate standard deviation of spacings
  const avgSpacing = spacings.reduce((sum, s) => sum + s, 0) / spacings.length
  const variance = spacings.reduce((sum, s) => sum + Math.pow(s - avgSpacing, 2), 0) / spacings.length
  const stdDev = Math.sqrt(variance)

  // Classify based on coefficient of variation
  const coefficientOfVariation = stdDev / avgSpacing

  if (coefficientOfVariation < 0.3) return 'uniform'
  if (coefficientOfVariation > 0.8) return 'irregular'
  return 'clustered'
}

/**
 * Estimate capture rate based on gaps and verification results
 */
function estimateCaptureRate(
  initialCount: number,
  verificationFoundCount: number,
  gapCount: number,
  highConfidenceGaps: number
): number {
  const finalCount = initialCount + verificationFoundCount

  // If verification found items, we know we missed some
  if (verificationFoundCount > 0) {
    // Assume we might have missed similar number in low-confidence gaps
    const estimatedMissed = verificationFoundCount + (gapCount - highConfidenceGaps) * 0.5
    const estimatedTotal = finalCount + estimatedMissed
    return (finalCount / estimatedTotal) * 100
  }

  // If there are high-confidence gaps that weren't filled, likely missed items
  if (highConfidenceGaps > 0) {
    const estimatedTotal = finalCount + highConfidenceGaps
    return (finalCount / estimatedTotal) * 100
  }

  // No gaps and verification didn't find anything = likely complete
  return gapCount === 0 ? 100 : 98
}

/**
 * Generate analytics for a receipt extraction
 */
export function generateReceiptAnalytics(
  receipt: ExtractedReceipt,
  metadata: {
    initial_item_count: number
    verification_found_count: number
    gap_count: number
    high_confidence_gap_count: number
    tokens_used?: number
    cost_usd?: number
    processing_time_ms?: number
  }
): ReceiptAnalytics {
  const items = receipt.items || []

  // Anchor analysis
  const firstItem = items.find(i => i.is_first_item)
  const lastItem = items.find(i => i.is_last_item)
  const midAnchors = items.filter(i => i.is_anchor_mid)
  const anchorCount = (firstItem ? 1 : 0) + (lastItem ? 1 : 0) + midAnchors.length

  // Position metrics
  const positions = items
    .map(i => i.position_percent)
    .filter((p): p is number => p !== undefined)

  const avgSpacing = positions.length > 1
    ? (Math.max(...positions) - Math.min(...positions)) / (positions.length - 1)
    : 0

  // Receipt length category
  const itemCount = items.length
  const receiptCategory =
    itemCount <= 10 ? 'short' :
    itemCount <= 20 ? 'medium' :
    itemCount <= 35 ? 'long' : 'very_long'

  // Capture rate estimation
  const captureRate = estimateCaptureRate(
    metadata.initial_item_count,
    metadata.verification_found_count,
    metadata.gap_count,
    metadata.high_confidence_gap_count
  )

  return {
    timestamp: new Date().toISOString(),
    store_name: receipt.store_name,
    item_count: itemCount,

    position_metrics: {
      has_anchors: anchorCount >= 2,
      anchor_count: anchorCount,
      first_item_pos: firstItem?.position_percent,
      last_item_pos: lastItem?.position_percent,
      avg_spacing: avgSpacing,
      position_distribution: analyzePositionDistribution(items)
    },

    capture_metrics: {
      initial_extraction_count: metadata.initial_item_count,
      verification_found_count: metadata.verification_found_count,
      final_item_count: itemCount,
      capture_rate_estimate: Math.round(captureRate * 10) / 10, // Round to 1 decimal
      had_gaps: metadata.gap_count > 0,
      gap_count: metadata.gap_count,
      high_confidence_gaps: metadata.high_confidence_gap_count
    },

    quality_indicators: {
      has_quality_warnings: (receipt.quality_warnings?.length || 0) > 0,
      warning_count: receipt.quality_warnings?.length || 0,
      warnings: receipt.quality_warnings || [],
      receipt_length_category: receiptCategory
    },

    performance: {
      total_tokens_used: metadata.tokens_used,
      total_cost_usd: metadata.cost_usd,
      processing_time_ms: metadata.processing_time_ms
    }
  }
}

/**
 * Log analytics to console for debugging
 */
export function logAnalytics(analytics: ReceiptAnalytics): void {
  console.log('[receipt-analytics] Receipt Scan Complete', {
    store: analytics.store_name,
    items: analytics.item_count,
    category: analytics.quality_indicators.receipt_length_category,
    captureRate: `${analytics.capture_metrics.capture_rate_estimate}%`,
    anchors: `${analytics.position_metrics.anchor_count} (${analytics.position_metrics.has_anchors ? 'sufficient' : 'insufficient'})`,
    distribution: analytics.position_metrics.position_distribution,
    gaps: analytics.capture_metrics.had_gaps
      ? `${analytics.capture_metrics.gap_count} (${analytics.capture_metrics.high_confidence_gaps} high confidence)`
      : 'none',
    verificationRecovered: analytics.capture_metrics.verification_found_count,
    cost: analytics.performance.total_cost_usd
      ? `$${analytics.performance.total_cost_usd.toFixed(4)}`
      : 'unknown',
    warnings: analytics.quality_indicators.warning_count
  })
}

/**
 * Format analytics for display to user
 */
export function formatAnalyticsForDisplay(analytics: ReceiptAnalytics): string {
  const parts = []

  // Capture rate
  const captureRate = analytics.capture_metrics.capture_rate_estimate
  const captureEmoji = captureRate >= 98 ? '✅' : captureRate >= 95 ? '✓' : captureRate >= 90 ? '⚠️' : '❌'
  parts.push(`${captureEmoji} Estimated ${captureRate.toFixed(1)}% of items captured`)

  // Position quality
  if (analytics.position_metrics.has_anchors) {
    parts.push(`📍 ${analytics.position_metrics.anchor_count} anchor points for accurate positioning`)
  } else {
    parts.push(`⚠️ Limited positioning accuracy (only ${analytics.position_metrics.anchor_count} anchors)`)
  }

  // Verification recovered items
  if (analytics.capture_metrics.verification_found_count > 0) {
    parts.push(`🔍 Verification found ${analytics.capture_metrics.verification_found_count} additional item${analytics.capture_metrics.verification_found_count > 1 ? 's' : ''}`)
  }

  // Warnings
  if (analytics.quality_indicators.has_quality_warnings) {
    parts.push(`⚠️ ${analytics.quality_indicators.warning_count} quality warning${analytics.quality_indicators.warning_count > 1 ? 's' : ''}`)
  }

  return parts.join(' • ')
}

/**
 * Aggregate analytics across multiple receipts for reporting
 */
export interface AggregateAnalytics {
  total_receipts: number
  avg_capture_rate: number
  avg_items_per_receipt: number
  receipts_by_length: Record<string, number>
  avg_anchors: number
  total_gaps_found: number
  total_items_recovered: number
  avg_cost_per_receipt: number
  position_distribution_breakdown: Record<string, number>
}

export function aggregateAnalytics(analyticsArray: ReceiptAnalytics[]): AggregateAnalytics {
  if (analyticsArray.length === 0) {
    return {
      total_receipts: 0,
      avg_capture_rate: 0,
      avg_items_per_receipt: 0,
      receipts_by_length: {},
      avg_anchors: 0,
      total_gaps_found: 0,
      total_items_recovered: 0,
      avg_cost_per_receipt: 0,
      position_distribution_breakdown: {}
    }
  }

  const total = analyticsArray.length

  return {
    total_receipts: total,
    avg_capture_rate: analyticsArray.reduce((sum, a) => sum + a.capture_metrics.capture_rate_estimate, 0) / total,
    avg_items_per_receipt: analyticsArray.reduce((sum, a) => sum + a.item_count, 0) / total,
    receipts_by_length: analyticsArray.reduce((acc, a) => {
      const cat = a.quality_indicators.receipt_length_category
      acc[cat] = (acc[cat] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    avg_anchors: analyticsArray.reduce((sum, a) => sum + a.position_metrics.anchor_count, 0) / total,
    total_gaps_found: analyticsArray.reduce((sum, a) => sum + a.capture_metrics.gap_count, 0),
    total_items_recovered: analyticsArray.reduce((sum, a) => sum + a.capture_metrics.verification_found_count, 0),
    avg_cost_per_receipt: analyticsArray.reduce((sum, a) => sum + (a.performance.total_cost_usd || 0), 0) / total,
    position_distribution_breakdown: analyticsArray.reduce((acc, a) => {
      const dist = a.position_metrics.position_distribution
      acc[dist] = (acc[dist] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}
