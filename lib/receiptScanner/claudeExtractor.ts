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
- subtotal (number): Subtotal before tax
- tax (number): Tax amount
- total (number): Total amount paid
- payment_method (string): Payment method if visible (e.g., "VISA", "CASH")
- receipt_number (string): Receipt or transaction number if visible

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
9. For position_percent: Estimate where vertically on the receipt this item appears (0 = very top, 100 = very bottom)
10. For category and is_food: Use context from the store type and surrounding items to categorize accurately
11. Return ONLY valid JSON - no markdown, no explanations

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
 * Extract receipt from image using Claude Vision
 */
export async function extractReceiptFromImage(
  imageData: string,
  mimeType: string = 'image/jpeg',
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

    const confidence = calculateConfidence(receipt)
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const totalTokens = inputTokens + outputTokens

    // Estimate cost (Claude Sonnet 4 pricing: ~$3/million input tokens, ~$15/million output tokens)
    const costUsd = (inputTokens * 3 / 1_000_000) + (outputTokens * 15 / 1_000_000)

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
