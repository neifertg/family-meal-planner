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
  - line_number (number): Approximate line number where this item appears on the receipt
  - position_percent (number): Vertical position of this item as a percentage (0-100) from top of receipt to bottom
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
8. For line_number: Count from top of receipt, starting at 1
9. For position_percent: ABSOLUTELY CRITICAL FOR VISUAL ALIGNMENT - Measure the vertical position where the ITEM LINE BEGINS on the receipt image. Start measuring from the very FIRST LINE OF ITEMS (skip store header/logo), not from the top of the image. The first actual grocery item should be around 0-5%, items in the middle of the list around 40-60%, and the last item before the total should be around 90-95%. DO NOT include the store header, logo, or receipt footer in your measurements - only measure within the item list section. Be extremely precise - users will hover over items and see a visual indicator at this exact position.
10. For category and is_food: Use context from the store type and surrounding items to categorize accurately
11. Return ONLY valid JSON - no markdown, no explanations

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
 * Verify extraction completeness with a second pass
 */
async function verifyExtraction(
  client: Anthropic,
  imageData: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  initialExtraction: ExtractedReceipt
): Promise<{ missed_items: ReceiptItem[], total_items_visible: number, inputTokens?: number, outputTokens?: number }> {
  try {
    const itemList = initialExtraction.items?.map(i => `"${i.name}"`).join(', ') || 'none'

    const verificationPrompt = `You previously extracted ${initialExtraction.items?.length || 0} items from this receipt.

VERIFICATION TASK:
1. Count the TOTAL number of visible line items on this receipt (look carefully at every line)
2. Compare that count to the ${initialExtraction.items?.length || 0} items you extracted
3. If you missed any items, identify them with:
   - name (string): Item name
   - price (number): Item price
   - line_number (number): Which line it's on
   - source_text (string): Exact text from receipt

Items you already extracted: ${itemList}

Return ONLY valid JSON with this structure:
{
  "total_items_visible": <number of line items you can see>,
  "missed_items": [
    {
      "name": "Item Name",
      "price": 0.00,
      "line_number": 0,
      "source_text": "exact text from receipt",
      "category": "pantry",
      "is_food": true
    }
  ]
}

If you didn't miss any items, return: {"total_items_visible": ${initialExtraction.items?.length || 0}, "missed_items": []}`

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

    // PASS 2: Verification step to catch missed items
    console.log('[claudeExtractor] Starting verification pass...')
    const verification = await verifyExtraction(client, imageData, mimeType, receipt)

    // Track token usage from both passes
    let totalInputTokens = message.usage.input_tokens + (verification.inputTokens || 0)
    let totalOutputTokens = message.usage.output_tokens + (verification.outputTokens || 0)

    // Add missed items to the receipt
    if (verification.missed_items && verification.missed_items.length > 0) {
      console.log('[claudeExtractor] Found missed items:', {
        missedCount: verification.missed_items.length,
        missedItems: verification.missed_items.map(i => i.name)
      })

      // Add missed items to receipt
      const missedItemsProcessed = verification.missed_items.map(item => ({
        ...item,
        category: item.category || fallbackCategorizeItem(item.name),
        is_food: item.is_food !== undefined ? item.is_food : true,
        // Mark as recovered in verification
        source_text: item.source_text || `${item.name} (recovered in verification)`
      }))

      receipt.items = [...(receipt.items || []), ...missedItemsProcessed]

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

    const confidence = calculateConfidence(receipt)
    const totalTokens = totalInputTokens + totalOutputTokens

    // Estimate cost (Claude Sonnet 4 pricing: ~$3/million input tokens, ~$15/million output tokens)
    const costUsd = (totalInputTokens * 3 / 1_000_000) + (totalOutputTokens * 15 / 1_000_000)

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
