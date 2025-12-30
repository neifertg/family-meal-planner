/**
 * Claude Vision Receipt Scanner
 *
 * Uses Anthropic's Claude with vision to extract receipt data
 */

import Anthropic from '@anthropic-ai/sdk'
import { ExtractedReceipt, ReceiptExtractionResult, ReceiptItem } from './types'

const EXTRACTION_PROMPT = `You are a receipt extraction expert. Extract all information from this grocery receipt image and return it as valid JSON.

Extract the following information:
- store_name (string): Name of the store
- store_location (string): Store address or location if visible
- purchase_date (string): Date of purchase in YYYY-MM-DD format
- items (array of objects): Each item with:
  - name (string): Item name/description (cleaned up and normalized)
  - quantity (string): Quantity purchased (e.g., "2 lb", "1 dozen", "3 cans")
  - price (number): Item price in dollars
  - unit_price (number): Price per unit if calculable
  - category (string): REQUIRED - One of: "produce", "dairy", "meat", "pantry", "frozen", or "non_food"
  - is_food (boolean): REQUIRED - true if this is a food/grocery item, false for non-food items (bags, gift wrap, household items, etc.)
  - source_text (string): EXACT text from the receipt for this item (including any codes/abbreviations)
  - line_number (number): REQUIRED - Sequential number starting at 1 for the FIRST item, incrementing by 1 for each subsequent item in top-to-bottom order
  - position_percent (number): Your best estimate of vertical position (0-100%) where this item appears on the receipt
  - is_first_item (boolean): Set to true ONLY for the very first item on the receipt (for position calibration)
  - is_last_item (boolean): Set to true ONLY for the very last item on the receipt (for position calibration)
  - is_anchor_mid (boolean): Set to true for 2-3 items in the middle sections (around 33%, 66% positions) - choose items that are clearly visible and distinctive
  - consolidated_count (number): If this item was created by merging duplicates, how many separate entries were combined (e.g., 2 or 3)
  - consolidated_details (string): If consolidated, brief explanation (e.g., "Combined 2 separate banana purchases" or "Merged 3 chicken breast entries")
- subtotal (number): Subtotal before tax
- tax (number): Tax amount
- total (number): Total amount paid
- payment_method (string): Payment method if visible (e.g., "VISA", "CASH")
- receipt_number (string): Receipt or transaction number if visible
- quality_warnings (array of strings): Any quality issues detected (e.g., "Image appears upside down", "Blurry section in middle", "Missing total")

CATEGORY GUIDELINES:
- "produce": Fresh fruits, vegetables (apples, lettuce, tomatoes, carrots, etc.)
- "dairy": Milk, cheese, yogurt, butter, cream, eggs
- "meat": All meats, poultry, seafood (chicken, beef, pork, fish, steak, salami, hotdogs, bacon, etc.)
- "pantry": Shelf-stable items (flour, rice, pasta, bread, canned goods, spices, sauces, etc.)
- "frozen": Frozen foods, ice cream
- "non_food": Bags, gift wrap, household items, cleaning supplies, paper products, etc.

IMPORTANT INSTRUCTIONS:
1. Parse each line item carefully - extract item name, quantity, and price
2. Convert all prices to numbers (remove $ signs)
3. Identify quantities from item descriptions (e.g., "2 LB CHICKEN" → quantity: "2 lb")
4. Group items logically - don't split single items across multiple entries
5. INCLUDE non-food items (bags, gift wrap, etc.) but mark them with is_food: false and category: "non_food"
6. Handle multi-line item descriptions correctly
7. For source_text: Include the EXACT text as it appears on the receipt (e.g., "CHK BRE 2LB" not "Chicken Breast")
8. For line_number: CRITICAL - Must be perfectly sequential starting at 1, incrementing by 1 with NO GAPS or SKIPS. This is the primary positioning mechanism.
9. For anchor items (is_first_item, is_last_item, is_anchor_mid): Mark the first and last items, plus 2-3 distinctive middle items for position calibration. Middle anchors should be clearly visible and spread across the receipt (around 33%, 66% positions).
10. For position_percent: Estimate the vertical position (0-100%) where each item appears. First item around 0-5%, middle around 40-60%, last around 90-95%. This will be calibrated using your anchor items and line numbers.
11. For category and is_food: Use context from the store type and surrounding items to categorize accurately
12. Return ONLY valid JSON - no markdown, no explanations

SMART QUANTITY EXTRACTION:
- Detect bulk purchases: "2 @ $3.99" means 2 items at $3.99 EACH (quantity: "2", price: 7.98, unit_price: 3.99)
- Handle weight-based pricing: "2.34 lb @ $5.99/lb = $14.02" → quantity: "2.34 lb", unit_price: 5.99, price: 14.02
- Normalize units consistently: "oz" or "ounces" → use "oz"; "lb" or "pounds" → use "lb"; "ea" or "each" → use "ea"
- Calculate unit_price when possible from total price and quantity

ITEM NAME NORMALIZATION:
- Convert ALL-CAPS to Proper Case: "ORGANIC WHOLE MILK" → "Organic Whole Milk"
- Remove receipt codes/SKUs from names: "ORG MLK 12345" → "Organic Milk"
- Standardize produce names using PLU codes if visible:
  * 4011 → "Yellow Banana"
  * 4030 → "Kiwi"
  * 4225 → "Red Grapefruit"
  * 4046 → "Avocado (Hass)"
  * 4065 → "Green Grapes"
  * Common patterns: "BANAN 4011" → "Yellow Banana"
- Clean up abbreviations: "CHK BRE" → "Chicken Breast", "ORG" → "Organic", "GRN" → "Green"

DUPLICATE CONSOLIDATION:
- If the SAME item appears multiple times on the receipt, consolidate into ONE entry
- Combine quantities: If "Chicken Breast" appears twice (2 lb and 1.5 lb), create one entry with quantity "3.5 lb"
- Sum prices: Add all prices for duplicate items
- Keep the most complete name if descriptions vary slightly
- IMPORTANT: When consolidating duplicates, include consolidated_count and consolidated_details fields
- Examples:
  * "BANANAS 2 lb @ $0.59/lb = $1.18" and "BANANAS 1.5 lb @ $0.59/lb = $0.89" → Single entry: name: "Yellow Banana", quantity: "3.5 lb", price: 2.07, unit_price: 0.59, consolidated_count: 2, consolidated_details: "Combined 2 separate banana purchases"
  * "ORGANIC MILK $4.99" and "ORGANIC MILK $4.99" → Single entry: name: "Organic Milk", quantity: "2", price: 9.98, unit_price: 4.99, consolidated_count: 2, consolidated_details: "Merged 2 identical milk purchases"

RECEIPT QUALITY ASSESSMENT:
- Check image orientation: If text appears upside down or sideways, add to quality_warnings: "Image appears upside down" or "Image appears rotated 90 degrees"
- Detect blur/illegibility: If portions are blurry or unreadable, add: "Blurry section detected near [top/middle/bottom]"
- Missing critical info: If store name, date, or total is not visible, add: "Missing store name" or "Missing purchase date" or "Missing total amount"
- Torn/damaged: If receipt appears torn or damaged, add: "Receipt appears damaged or torn"
- Include quality_warnings array even if empty ([]) to indicate assessment was performed

If a field is not found in the receipt, omit it from the JSON (don't use null).`

/**
 * Initialize Claude client
 */
function getClaudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set')
  }
  return new Anthropic({ apiKey })
}

/**
 * Fallback categorization for items where Claude didn't provide a category
 * This should rarely be needed since Claude now handles categorization in the prompt
 */
function fallbackCategorizeItem(itemName: string): string {
  const lower = itemName.toLowerCase()

  if (/(apple|banana|orange|lettuce|tomato|carrot|onion|garlic|pepper|fruit|vegetable|spinach|kale|broccoli|cauliflower|potato|celery|cucumber|zucchini|mushroom)/i.test(lower)) {
    return 'produce'
  }
  if (/(milk|cheese|yogurt|butter|cream|dairy|egg)/i.test(lower)) {
    return 'dairy'
  }
  if (/(chicken|beef|pork|fish|salmon|meat|turkey|lamb|shrimp|bacon|sausage|steak|salami|hotdog|hot dog|ham|ribs|ground beef|ground turkey|ground pork|brisket|roast|chuck|sirloin|tenderloin|filet|ribeye|t-bone|drumstick|thigh|breast|wing|crab|lobster|tuna|cod|tilapia|mahi|halibut|swordfish|trout|catfish|pepperoni|chorizo|bratwurst|kielbasa|bologna|pastrami|corned beef|prosciutto|deli meat|lunch meat)/i.test(lower)) {
    return 'meat'
  }
  if (/(frozen|ice cream)/i.test(lower)) {
    return 'frozen'
  }

  // Default to 'pantry' for uncategorized items (matches database constraint)
  return 'pantry'
}

/**
 * Format learning examples for the prompt
 */
function formatLearningExamples(examples: any[]): string {
  if (examples.length === 0) {
    return ''
  }

  const formatted = examples
    .slice(0, 10) // Limit to 10 examples to keep prompt concise
    .map(ex => `  - AI extracted: "${ex.ai_extracted_name}" → User corrected to: "${ex.corrected_name}"`)
    .join('\n')

  return `\n\nPREVIOUS CORRECTIONS (learn from these):\n${formatted}\n\nUse these examples to improve extraction accuracy for similar items.`
}

/**
 * Verify extraction completeness with a second pass using gap analysis
 */
async function verifyExtraction(
  client: Anthropic,
  imageData: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  initialExtraction: ExtractedReceipt,
  gapAnalysis: string
): Promise<{ missed_items: ReceiptItem[], total_items_visible: number, inputTokens?: number, outputTokens?: number }> {
  try {
    const itemCount = initialExtraction.items?.length || 0
    const itemList = initialExtraction.items?.map(i => `"${i.name}"`).join(', ') || 'none'

    const verificationPrompt = `You previously extracted ${itemCount} items from this receipt.

Items you already extracted: ${itemList}

GAP ANALYSIS - Potential Missing Items:
${gapAnalysis}

VERIFICATION TASK:
For each HIGH and MEDIUM priority gap listed above:
1. Look at the specified position on the receipt image
2. Determine if there is actually a line item there that was missed
3. If YES, extract it with full details (name, price, line_number, source_text, category, is_food)
4. If NO (gap is intentional/section break), mark as not found

Also do a final count: How many total line items are visible on this receipt?

Return ONLY valid JSON with this structure:
{
  "total_items_visible": <total count of all line items you can see>,
  "missed_items": [
    {
      "name": "Item Name",
      "price": 0.00,
      "line_number": <the missing line number from gap analysis>,
      "source_text": "exact text from receipt",
      "category": "pantry",
      "is_food": true,
      "quantity": "1"
    }
  ]
}

If no items were actually missed, return: {"total_items_visible": ${itemCount}, "missed_items": []}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageData,
              },
            },
            {
              type: 'text',
              text: verificationPrompt
            }
          ],
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                     responseText.match(/```\s*([\s\S]*?)\s*```/)
    const jsonText = jsonMatch ? jsonMatch[1] : responseText
    const verification = JSON.parse(jsonText)

    console.log('[claudeExtractor] Verification complete', {
      totalVisible: verification.total_items_visible,
      missedCount: verification.missed_items?.length || 0,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens
    })

    return {
      ...verification,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens
    }
  } catch (error: any) {
    console.error('[claudeExtractor] Verification failed:', error)
    // If verification fails, return empty result (don't block the main flow)
    return {
      missed_items: [],
      total_items_visible: initialExtraction.items?.length || 0,
      inputTokens: 0,
      outputTokens: 0
    }
  }
}

/**
 * Extract receipt from image using Claude Vision with two-pass verification
 */
export async function extractReceiptFromImage(
  imageData: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg',
  learningExamples: any[] = []
): Promise<ReceiptExtractionResult> {
  try {
    console.log('[claudeExtractor] Starting extraction', {
      mimeType,
      imageDataLength: imageData.length,
      learningExamplesCount: learningExamples.length,
      timestamp: new Date().toISOString()
    })

    const client = getClaudeClient()

    // Build prompt with learning examples if available
    const learningContext = formatLearningExamples(learningExamples)
    const fullPrompt = `${EXTRACTION_PROMPT}${learningContext}\n\nExtract the receipt data from this image. Return the data as JSON:`

    console.log('[claudeExtractor] Calling Claude API...', {
      model: 'claude-sonnet-4-20250514',
      hasLearningContext: learningContext.length > 0
    })

    // Call Claude with vision
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514', // Claude Sonnet 4 with vision support
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: fullPrompt
            }
          ],
        }
      ]
    })

    console.log('[claudeExtractor] Claude API response received', {
      stopReason: message.stop_reason,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens
    })

    // Extract JSON from response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let receipt: ExtractedReceipt

    console.log('[claudeExtractor] Parsing response', {
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 200)
    })

    try {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/```\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch ? jsonMatch[1] : responseText
      receipt = JSON.parse(jsonText)

      console.log('[claudeExtractor] JSON parsed successfully', {
        storeName: receipt.store_name,
        itemCount: receipt.items?.length,
        hasTotal: !!receipt.total
      })
    } catch (parseError: any) {
      console.error('[claudeExtractor] JSON parse error:', {
        error: parseError,
        message: parseError.message,
        responseText: responseText.substring(0, 500)
      })
      throw new Error('Invalid JSON response from Claude Vision')
    }

    // Apply fallback categorization only for items without a category
    // Claude should handle categorization in the prompt, but this is a safety net
    if (receipt.items) {
      receipt.items = receipt.items.map(item => ({
        ...item,
        category: item.category || fallbackCategorizeItem(item.name),
        is_food: item.is_food !== undefined ? item.is_food : true // Default to true if not specified
      }))
    }

    // Import gap detection utilities
    const { findLineNumberGaps, formatGapsForPrompt, insertMissedItems } = await import('@/lib/utils/gap-detection')

    // Analyze gaps in line number sequence
    const gaps = findLineNumberGaps(receipt.items || [])
    const gapAnalysis = formatGapsForPrompt(gaps)

    // PASS 2: Verification step to catch missed items using gap analysis
    console.log('[claudeExtractor] Starting verification pass with gap analysis...')
    const verification = await verifyExtraction(client, imageData, mimeType, receipt, gapAnalysis)

    // Track token usage from both passes
    let totalInputTokens = message.usage.input_tokens + (verification.inputTokens || 0)
    let totalOutputTokens = message.usage.output_tokens + (verification.outputTokens || 0)

    // Add missed items to the receipt and renumber
    if (verification.missed_items && verification.missed_items.length > 0) {
      console.log('[claudeExtractor] Found missed items:', {
        missedCount: verification.missed_items.length,
        missedItems: verification.missed_items.map(i => i.name)
      })

      // Process missed items
      const missedItemsProcessed = verification.missed_items.map(item => ({
        ...item,
        category: item.category || fallbackCategorizeItem(item.name),
        is_food: item.is_food !== undefined ? item.is_food : true,
        source_text: item.source_text || `${item.name} (recovered in verification)`
      }))

      // Insert missed items at correct positions and renumber
      receipt.items = insertMissedItems(receipt.items || [], missedItemsProcessed)

      // Add quality warning about missed items
      if (!receipt.quality_warnings) {
        receipt.quality_warnings = []
      }
      receipt.quality_warnings.push(
        `Verification found ${verification.missed_items.length} additional item${verification.missed_items.length > 1 ? 's' : ''} that were initially missed`
      )
    } else {
      console.log('[claudeExtractor] Verification confirmed all items captured')
    }

    // Import position calibration utility
    const { calibratePositions } = await import('@/lib/utils/receipt-positioning')

    // FINAL STEP: Calibrate all positions using anchors
    console.log('[claudeExtractor] Calibrating positions using anchor items...')
    receipt.items = calibratePositions(receipt.items || [])

    const confidence = calculateConfidence(receipt)
    const totalTokens = totalInputTokens + totalOutputTokens

    // Estimate cost (Claude Sonnet 4 pricing: ~$3/million input tokens, ~$15/million output tokens)
    const costUsd = (totalInputTokens * 3 / 1_000_000) + (totalOutputTokens * 15 / 1_000_000)

    // Generate and log analytics
    const { generateReceiptAnalytics, logAnalytics } = await import('@/lib/utils/receipt-analytics')
    const analytics = generateReceiptAnalytics(receipt, {
      initial_item_count: (receipt.items?.length || 0) - (verification.missed_items?.length || 0),
      verification_found_count: verification.missed_items?.length || 0,
      gap_count: gaps.length,
      high_confidence_gap_count: gaps.filter(g => g.confidence === 'high').length,
      tokens_used: totalTokens,
      cost_usd: costUsd
    })
    logAnalytics(analytics)

    console.log('[claudeExtractor] Extraction complete', {
      finalItemCount: receipt.items?.length,
      missedItemsRecovered: verification.missed_items?.length || 0,
      totalTokens,
      costUsd: costUsd.toFixed(4)
    })

    return {
      success: true,
      receipt,
      confidence,
      tokens_used: totalTokens,
      cost_usd: costUsd
    }

  } catch (error: any) {
    console.error('[claudeExtractor] Exception caught:', {
      error,
      message: error.message,
      stack: error.stack,
      status: error.status,
      type: error.type,
      name: error.name
    })

    // Provide more specific error messages
    let errorMessage = 'Failed to extract receipt from image'

    if (error.status === 401 || error.status === 403) {
      errorMessage = 'Authentication error with Claude API. Please check API key configuration.'
      console.error('[claudeExtractor] Authentication error - check ANTHROPIC_API_KEY')
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again in a moment.'
      console.error('[claudeExtractor] Rate limit exceeded')
    } else if (error.status === 400) {
      errorMessage = 'Invalid image format. Claude Vision could not process this image.'
      console.error('[claudeExtractor] Invalid image format', { error: error.error })
    } else if (error.message) {
      errorMessage = `Claude Vision error: ${error.message}`
      console.error('[claudeExtractor] Claude error:', { message: error.message, type: error.type })
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Calculate confidence score based on receipt completeness
 */
function calculateConfidence(receipt: ExtractedReceipt): number {
  let score = 0
  const weights = {
    store: 10,
    date: 20,
    items: 40,
    total: 20,
    details: 10
  }

  if (receipt.store_name) score += weights.store
  if (receipt.purchase_date) score += weights.date
  if (receipt.items && receipt.items.length > 0) {
    const avgItemCompleteness = receipt.items.reduce((sum, item) => {
      let itemScore = 0
      if (item.name) itemScore += 0.4
      if (item.price) itemScore += 0.4
      if (item.quantity) itemScore += 0.2
      return sum + itemScore
    }, 0) / receipt.items.length
    score += weights.items * avgItemCompleteness
  }
  if (receipt.total) score += weights.total
  if (receipt.subtotal || receipt.tax) score += weights.details

  return Math.round(score)
}

/**
 * Extract a single chunk of a long receipt
 */
async function extractChunk(
  client: Anthropic,
  imageData: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  chunk: { id: string; section: 'top' | 'middle' | 'bottom'; y_start_percent: number; y_end_percent: number; expected_item_range: string },
  learningExamples: any[]
): Promise<{ chunk: any; items: ReceiptItem[]; inputTokens: number; outputTokens: number }> {
  const learningContext = formatLearningExamples(learningExamples)
  const { generateChunkPrompt } = await import('@/lib/utils/receipt-chunking')
  const chunkPrompt = generateChunkPrompt(chunk, EXTRACTION_PROMPT)
  const fullPrompt = `${chunkPrompt}${learningContext}\n\nExtract items from this receipt chunk. Return as JSON:`

  console.log(`[claudeExtractor] Extracting chunk: ${chunk.id} (${chunk.y_start_percent}% - ${chunk.y_end_percent}%)`)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: imageData,
            },
          },
          {
            type: 'text',
            text: fullPrompt
          }
        ],
      }
    ]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                   responseText.match(/```\s*([\s\S]*?)\s*```/)
  const jsonText = jsonMatch ? jsonMatch[1] : responseText
  const chunkReceipt = JSON.parse(jsonText)

  console.log(`[claudeExtractor] Chunk ${chunk.id} extracted`, {
    itemCount: chunkReceipt.items?.length || 0,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens
  })

  // Apply fallback categorization
  const items = (chunkReceipt.items || []).map((item: ReceiptItem) => ({
    ...item,
    category: item.category || fallbackCategorizeItem(item.name),
    is_food: item.is_food !== undefined ? item.is_food : true
  }))

  return {
    chunk,
    items,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens
  }
}

/**
 * Extract receipt from image using chunking for long receipts (30+ items)
 */
export async function extractReceiptWithChunking(
  imageData: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg',
  learningExamples: any[] = [],
  estimatedItemCount: number
): Promise<ReceiptExtractionResult> {
  try {
    console.log('[claudeExtractor] Starting CHUNKING extraction', {
      mimeType,
      estimatedItemCount,
      timestamp: new Date().toISOString()
    })

    const client = getClaudeClient()
    const { generateChunks, mergeChunkResults } = await import('@/lib/utils/receipt-chunking')

    // Generate chunk definitions
    const chunks = generateChunks(estimatedItemCount)
    console.log('[claudeExtractor] Generated chunks', {
      chunkCount: chunks.length,
      chunks: chunks.map(c => `${c.id} (${c.y_start_percent}%-${c.y_end_percent}%)`)
    })

    // Extract all chunks in parallel
    const chunkPromises = chunks.map(chunk =>
      extractChunk(client, imageData, mimeType, chunk, learningExamples)
    )

    const chunkResults = await Promise.all(chunkPromises)

    // Calculate total tokens from all chunks
    let totalInputTokens = chunkResults.reduce((sum, r) => sum + r.inputTokens, 0)
    let totalOutputTokens = chunkResults.reduce((sum, r) => sum + r.outputTokens, 0)

    console.log('[claudeExtractor] All chunks extracted', {
      totalItems: chunkResults.reduce((sum, r) => sum + r.items.length, 0),
      totalInputTokens,
      totalOutputTokens
    })

    // Merge and deduplicate chunk results
    const mergedItems = mergeChunkResults(chunkResults, estimatedItemCount)

    console.log('[claudeExtractor] Chunks merged', {
      finalItemCount: mergedItems.length,
      deduplicatedCount: chunkResults.reduce((sum, r) => sum + r.items.length, 0) - mergedItems.length
    })

    // Build a complete receipt from merged items
    const receipt: ExtractedReceipt = {
      purchase_date: '',
      total: 0,
      items: mergedItems,
      quality_warnings: [`Chunking used: receipt split into ${chunks.length} sections for better accuracy`]
    }

    // Now run gap detection and verification on the merged result
    const { findLineNumberGaps, formatGapsForPrompt, insertMissedItems } = await import('@/lib/utils/gap-detection')
    const gaps = findLineNumberGaps(receipt.items || [])
    const gapAnalysis = formatGapsForPrompt(gaps)

    console.log('[claudeExtractor] Starting verification pass after chunking...')
    const verification = await verifyExtraction(client, imageData, mimeType, receipt, gapAnalysis)

    totalInputTokens += verification.inputTokens || 0
    totalOutputTokens += verification.outputTokens || 0

    // Add missed items if any
    if (verification.missed_items && verification.missed_items.length > 0) {
      console.log('[claudeExtractor] Found missed items in verification', {
        missedCount: verification.missed_items.length
      })

      const missedItemsProcessed = verification.missed_items.map(item => ({
        ...item,
        category: item.category || fallbackCategorizeItem(item.name),
        is_food: item.is_food !== undefined ? item.is_food : true,
        source_text: item.source_text || `${item.name} (recovered in verification)`
      }))

      receipt.items = insertMissedItems(receipt.items || [], missedItemsProcessed)

      if (!receipt.quality_warnings) receipt.quality_warnings = []
      receipt.quality_warnings.push(
        `Verification found ${verification.missed_items.length} additional item${verification.missed_items.length > 1 ? 's' : ''}`
      )
    }

    // Calibrate positions
    const { calibratePositions } = await import('@/lib/utils/receipt-positioning')
    console.log('[claudeExtractor] Calibrating positions...')
    receipt.items = calibratePositions(receipt.items || [])

    const confidence = calculateConfidence(receipt)
    const totalTokens = totalInputTokens + totalOutputTokens
    const costUsd = (totalInputTokens * 3 / 1_000_000) + (totalOutputTokens * 15 / 1_000_000)

    // Generate analytics
    const { generateReceiptAnalytics, logAnalytics } = await import('@/lib/utils/receipt-analytics')
    const analytics = generateReceiptAnalytics(receipt, {
      initial_item_count: mergedItems.length,
      verification_found_count: verification.missed_items?.length || 0,
      gap_count: gaps.length,
      high_confidence_gap_count: gaps.filter(g => g.confidence === 'high').length,
      tokens_used: totalTokens,
      cost_usd: costUsd
    })
    logAnalytics(analytics)

    console.log('[claudeExtractor] Chunking extraction complete', {
      finalItemCount: receipt.items?.length,
      totalTokens,
      costUsd: costUsd.toFixed(4)
    })

    return {
      success: true,
      receipt,
      confidence,
      tokens_used: totalTokens,
      cost_usd: costUsd
    }

  } catch (error: any) {
    console.error('[claudeExtractor] Chunking extraction failed:', error)
    return {
      success: false,
      error: `Chunking extraction failed: ${error.message}`
    }
  }
}

/**
 * Extract receipt from image using OCR preprocessing for pixel-perfect positioning
 */
export async function extractReceiptWithOCR(
  imageData: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg',
  learningExamples: any[] = []
): Promise<ReceiptExtractionResult> {
  try {
    console.log('[claudeExtractor] Starting OCR-enhanced extraction', {
      mimeType,
      timestamp: new Date().toISOString()
    })

    const client = getClaudeClient()
    const { performOCR, formatOCRForPrompt, matchItemsToOCR, calculatePositionFromOCR } = await import('@/lib/utils/receipt-ocr')

    // Step 1: Perform OCR
    console.log('[claudeExtractor] Running OCR preprocessing...')
    const ocrResult = await performOCR(imageData, mimeType)

    if (!ocrResult) {
      console.log('[claudeExtractor] OCR failed, falling back to standard extraction')
      return await extractReceiptFromImage(imageData, mimeType, learningExamples)
    }

    console.log('[claudeExtractor] OCR complete', {
      lineCount: ocrResult.lines.length,
      avgConfidence: ocrResult.total_confidence.toFixed(1),
      processingTime: ocrResult.processing_time_ms
    })

    // Step 2: Build OCR-enhanced prompt
    const ocrContext = formatOCRForPrompt(ocrResult)
    const learningContext = formatLearningExamples(learningExamples)
    const fullPrompt = `${EXTRACTION_PROMPT}${ocrContext}${learningContext}\n\nExtract the receipt data. Return as JSON:`

    console.log('[claudeExtractor] Calling Claude with OCR context...')

    // Step 3: Extract with OCR-enhanced prompt
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: fullPrompt
            }
          ],
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                     responseText.match(/```\s*([\s\S]*?)\s*```/)
    const jsonText = jsonMatch ? jsonMatch[1] : responseText
    let receipt = JSON.parse(jsonText)

    console.log('[claudeExtractor] OCR extraction complete', {
      itemCount: receipt.items?.length,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens
    })

    // Apply fallback categorization
    if (receipt.items) {
      receipt.items = receipt.items.map((item: ReceiptItem) => ({
        ...item,
        category: item.category || fallbackCategorizeItem(item.name),
        is_food: item.is_food !== undefined ? item.is_food : true
      }))
    }

    // Step 4: Match items to OCR lines for pixel-perfect positioning
    console.log('[claudeExtractor] Matching items to OCR lines...')
    receipt.items = receipt.items.map((item: ReceiptItem) => {
      const ocrLineId = matchItemsToOCR(item.source_text || item.name, ocrResult)
      if (ocrLineId !== null) {
        const ocrPosition = calculatePositionFromOCR(ocrLineId, ocrResult)
        return {
          ...item,
          position_percent: ocrPosition,
          ocr_line_id: ocrLineId,
          ocr_confidence: ocrResult.lines.find(l => l.id === ocrLineId)?.avg_confidence
        }
      }
      return item
    })

    let totalInputTokens = message.usage.input_tokens
    let totalOutputTokens = message.usage.output_tokens

    // Run gap detection and verification
    const { findLineNumberGaps, formatGapsForPrompt, insertMissedItems } = await import('@/lib/utils/gap-detection')
    const gaps = findLineNumberGaps(receipt.items || [])
    const gapAnalysis = formatGapsForPrompt(gaps)

    console.log('[claudeExtractor] Starting verification pass...')
    const verification = await verifyExtraction(client, imageData, mimeType, receipt, gapAnalysis)

    totalInputTokens += verification.inputTokens || 0
    totalOutputTokens += verification.outputTokens || 0

    // Add missed items
    if (verification.missed_items && verification.missed_items.length > 0) {
      const missedItemsProcessed = verification.missed_items.map(item => ({
        ...item,
        category: item.category || fallbackCategorizeItem(item.name),
        is_food: item.is_food !== undefined ? item.is_food : true,
        source_text: item.source_text || `${item.name} (recovered in verification)`
      }))

      receipt.items = insertMissedItems(receipt.items || [], missedItemsProcessed)

      if (!receipt.quality_warnings) receipt.quality_warnings = []
      receipt.quality_warnings.push(
        `Verification found ${verification.missed_items.length} additional item${verification.missed_items.length > 1 ? 's' : ''}`
      )
    }

    // Calibrate positions (though OCR already provides accurate positions)
    const { calibratePositions } = await import('@/lib/utils/receipt-positioning')
    receipt.items = calibratePositions(receipt.items || [])

    const confidence = calculateConfidence(receipt)
    const totalTokens = totalInputTokens + totalOutputTokens
    const costUsd = (totalInputTokens * 3 / 1_000_000) + (totalOutputTokens * 15 / 1_000_000)

    // Generate analytics
    const { generateReceiptAnalytics, logAnalytics } = await import('@/lib/utils/receipt-analytics')
    const analytics = generateReceiptAnalytics(receipt, {
      initial_item_count: (receipt.items?.length || 0) - (verification.missed_items?.length || 0),
      verification_found_count: verification.missed_items?.length || 0,
      gap_count: gaps.length,
      high_confidence_gap_count: gaps.filter(g => g.confidence === 'high').length,
      tokens_used: totalTokens,
      cost_usd: costUsd
    })
    logAnalytics(analytics)

    console.log('[claudeExtractor] OCR extraction complete', {
      finalItemCount: receipt.items?.length,
      ocrMatchedItems: receipt.items.filter((i: ReceiptItem) => (i as any).ocr_line_id !== undefined).length,
      totalTokens,
      costUsd: costUsd.toFixed(4)
    })

    return {
      success: true,
      receipt,
      confidence,
      tokens_used: totalTokens,
      cost_usd: costUsd
    }

  } catch (error: any) {
    console.error('[claudeExtractor] OCR extraction failed:', error)
    // Fallback to standard extraction
    console.log('[claudeExtractor] Falling back to standard extraction...')
    return await extractReceiptFromImage(imageData, mimeType, learningExamples)
  }
}
