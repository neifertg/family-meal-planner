/**
 * Receipt Scanner Learning System
 *
 * Improves AI accuracy over time by learning from user corrections
 * and providing vendor-specific examples to the AI model
 */

import { createClient } from '@/lib/supabase/client'

export type ReceiptItemCorrection = {
  ai_extracted_name: string
  ai_extracted_quantity: string | null
  ai_extracted_price: number
  ai_extracted_category: string | null
  corrected_name: string
  corrected_quantity: string | null
  corrected_price: number
  corrected_category: string | null
  was_corrected: boolean
  was_removed: boolean
}

export type ReceiptScanSession = {
  id?: string
  family_id: string
  store_name: string | null
  purchase_date: string
  confidence_score: number | null
  tokens_used: number | null
  cost_usd: number | null
  applied_to_budget?: boolean
}

/**
 * Get vendor-specific correction examples to improve AI prompts
 * Returns recent corrections for the same store to use as few-shot examples
 */
export async function getVendorLearningExamples(
  familyId: string,
  storeName: string | null,
  limit: number = 10
): Promise<ReceiptItemCorrection[]> {
  const supabase = createClient()

  // Build query - get corrections from the same vendor
  let query = supabase
    .from('receipt_item_corrections')
    .select(`
      ai_extracted_name,
      ai_extracted_quantity,
      ai_extracted_price,
      ai_extracted_category,
      corrected_name,
      corrected_quantity,
      corrected_price,
      corrected_category,
      was_corrected,
      was_removed,
      receipt_scans!inner(store_name, scan_date)
    `)
    .eq('family_id', familyId)
    .eq('was_corrected', true) // Only get items that were actually corrected
    .eq('was_removed', false) // Don't include deleted items
    .order('created_at', { ascending: false })
    .limit(limit)

  // Filter by vendor if provided
  if (storeName) {
    query = query.eq('receipt_scans.store_name', storeName)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching learning examples:', error)
    return []
  }

  return data || []
}

/**
 * Get general (non-vendor-specific) correction examples
 * Useful when scanning from a new vendor
 */
export async function getGeneralLearningExamples(
  familyId: string,
  limit: number = 5
): Promise<ReceiptItemCorrection[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('receipt_item_corrections')
    .select(`
      ai_extracted_name,
      ai_extracted_quantity,
      ai_extracted_price,
      ai_extracted_category,
      corrected_name,
      corrected_quantity,
      corrected_price,
      corrected_category,
      was_corrected,
      was_removed
    `)
    .eq('family_id', familyId)
    .eq('was_corrected', true)
    .eq('was_removed', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching general learning examples:', error)
    return []
  }

  return data || []
}

/**
 * Save receipt scan session and corrections for future learning
 */
export async function saveReceiptCorrections(
  session: ReceiptScanSession,
  originalItems: any[],
  correctedItems: any[]
): Promise<void> {
  const supabase = createClient()

  try {
    // 1. Save receipt scan session
    const { data: scanData, error: scanError } = await supabase
      .from('receipt_scans')
      .insert({
        family_id: session.family_id,
        store_name: session.store_name,
        purchase_date: session.purchase_date,
        confidence_score: session.confidence_score,
        tokens_used: session.tokens_used,
        cost_usd: session.cost_usd,
        applied_to_budget: session.applied_to_budget || false
      })
      .select('id')
      .single()

    if (scanError || !scanData) {
      console.error('Error saving receipt scan:', scanError)
      return
    }

    const receiptScanId = scanData.id

    // 2. Compare original vs corrected items and save corrections
    const corrections: any[] = []

    for (let i = 0; i < originalItems.length; i++) {
      const original = originalItems[i]
      const corrected = correctedItems.find((c: any) =>
        // Match by index or name similarity
        c.name === original.name ||
        correctedItems.indexOf(c) === i
      )

      const wasRemoved = !corrected
      const wasModified = corrected && (
        corrected.name !== original.name ||
        corrected.quantity !== original.quantity ||
        corrected.price !== original.price ||
        corrected.category !== original.category
      )

      corrections.push({
        receipt_scan_id: receiptScanId,
        family_id: session.family_id,
        ai_extracted_name: original.name,
        ai_extracted_quantity: original.quantity,
        ai_extracted_price: original.price,
        ai_extracted_category: original.category,
        corrected_name: corrected?.name || original.name,
        corrected_quantity: corrected?.quantity || original.quantity,
        corrected_price: corrected?.price || original.price,
        corrected_category: corrected?.category || original.category,
        was_corrected: wasModified || wasRemoved,
        was_removed: wasRemoved
      })
    }

    // Save all corrections
    if (corrections.length > 0) {
      const { error: correctionsError } = await supabase
        .from('receipt_item_corrections')
        .insert(corrections)

      if (correctionsError) {
        console.error('Error saving corrections:', correctionsError)
      }
    }
  } catch (error) {
    console.error('Error in saveReceiptCorrections:', error)
  }
}

/**
 * Format learning examples for AI prompt
 * Converts correction examples into a format suitable for few-shot learning
 */
export function formatExamplesForPrompt(examples: ReceiptItemCorrection[]): string {
  if (examples.length === 0) {
    return ''
  }

  const formatted = examples.map(ex => {
    return `AI saw: "${ex.ai_extracted_name}" → User corrected to: "${ex.corrected_name}"`
  }).join('\n')

  return `\n\nPrevious corrections from this store:\n${formatted}\n\nUse these examples to improve your extraction accuracy.`
}

/**
 * Get statistics about learning data for a family
 */
export async function getLearningStats(familyId: string) {
  const supabase = createClient()

  const [scansResult, correctionsResult, vendorsResult] = await Promise.all([
    // Total scans
    supabase
      .from('receipt_scans')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId),

    // Total corrections made
    supabase
      .from('receipt_item_corrections')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId)
      .eq('was_corrected', true),

    // Unique vendors
    supabase
      .from('receipt_scans')
      .select('store_name')
      .eq('family_id', familyId)
      .not('store_name', 'is', null)
  ])

  const uniqueVendors = new Set(
    (vendorsResult.data || []).map(v => v.store_name)
  ).size

  return {
    totalScans: scansResult.count || 0,
    totalCorrections: correctionsResult.count || 0,
    uniqueVendors
  }
}
