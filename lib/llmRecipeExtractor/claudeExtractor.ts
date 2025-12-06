/**
 * Claude-Based Recipe Extractor
 *
 * Uses Anthropic's Claude with structured JSON output to extract recipes
 */

import Anthropic from '@anthropic-ai/sdk'
import { ExtractedRecipe, ExtractionResult, ContentSource } from './types'

const EXTRACTION_PROMPT = `You are a recipe extraction expert. Extract all recipe information from the provided content and return it as valid JSON.

Extract the following information:
- title (string, required)
- description (string)
- author (string)
- ingredients (array of objects with: item, quantity, unit, preparation, notes)
- instructions (array of objects with: step_number, instruction, time_minutes, temperature)
- prep_time_minutes (number)
- cook_time_minutes (number)
- total_time_minutes (number)
- servings (number)
- yield (string)
- cuisine (string)
- category (string)
- difficulty (string: "easy", "medium", or "hard")
- meal_type (array of strings)
- dietary_tags (array: vegetarian, vegan, gluten-free, dairy-free, etc.)
- allergens (array: nuts, dairy, eggs, soy, shellfish, etc.)
- tags (array: quick, one-pot, make-ahead, etc.)
- nutrition (object with: calories, protein_g, carbohydrates_g, fat_g, fiber_g, sugar_g, sodium_mg)
- equipment_needed (array of strings)
- tips (array of strings)
- substitutions (array of strings)
- storage_instructions (string)
- image_url (string)

IMPORTANT INSTRUCTIONS:
1. Parse ingredients carefully - extract quantity, unit, item, and preparation separately
2. Number instructions sequentially starting from 1
3. Convert all times to minutes
4. Identify all dietary restrictions and allergens
5. Normalize units (cups, tbsp, tsp, oz, lb, g, ml, etc.)
6. If ingredient groups exist (e.g., "For the sauce"), note them in the ingredient order
7. Return ONLY valid JSON - no markdown, no explanations

If a field is not found in the content, omit it from the JSON (don't use null).`

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
 * Clean HTML content to reduce token usage
 */
function cleanContent(html: string): string {
  // Remove script and style tags
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')

  // Remove common ad/navigation patterns
  cleaned = cleaned.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
  cleaned = cleaned.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
  cleaned = cleaned.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')

  // Remove HTML tags but keep content
  cleaned = cleaned.replace(/<[^>]+>/g, ' ')

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  // Limit to ~15k chars for Claude (larger context than Gemini)
  if (cleaned.length > 15000) {
    // Try to find recipe section
    const recipeIndex = cleaned.toLowerCase().indexOf('ingredient')
    if (recipeIndex > 0) {
      cleaned = cleaned.substring(Math.max(0, recipeIndex - 500), recipeIndex + 14500)
    } else {
      cleaned = cleaned.substring(0, 15000)
    }
  }

  return cleaned
}

/**
 * Extract recipe from image using Claude Vision
 */
export async function extractRecipeFromImage(
  imageData: string,
  mimeType: string = 'image/jpeg'
): Promise<ExtractionResult> {
  try {
    const client = getClaudeClient()

    // Call Claude with vision
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022', // Claude 3.5 Sonnet V2 with vision support
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
              text: `${EXTRACTION_PROMPT}\n\nExtract the recipe from this image. If the recipe is handwritten, do your best to read it accurately. Return the recipe as JSON:`
            }
          ],
        }
      ]
    })

    // Extract JSON from response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let recipe: ExtractedRecipe

    try {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/```\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch ? jsonMatch[1] : responseText
      recipe = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse Claude Vision response:', responseText)
      throw new Error('Invalid JSON response from Claude Vision')
    }

    const confidence = calculateConfidence(recipe)
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const totalTokens = inputTokens + outputTokens

    return {
      success: true,
      recipe,
      confidence,
      extraction_method: 'claude',
      tokens_used: totalTokens,
    }

  } catch (error: any) {
    console.error('Claude Vision extraction error:', error)
    return {
      success: false,
      error: error.message || 'Failed to extract recipe from image with Claude Vision',
      extraction_method: 'claude',
    }
  }
}

/**
 * Extract recipe using Claude with structured JSON output
 */
export async function extractRecipeWithClaude(
  source: ContentSource
): Promise<ExtractionResult> {
  try {
    const client = getClaudeClient()

    // Prepare content based on source type
    let contentText: string

    if (source.type === 'url') {
      // Fetch HTML
      const response = await fetch(source.content)
      const html = await response.text()
      contentText = cleanContent(html)
    } else if (source.type === 'html') {
      contentText = cleanContent(source.content)
    } else if (source.type === 'text') {
      contentText = source.content
    } else if (source.type === 'image') {
      // Extract base64 data and mime type
      const base64Match = source.content.match(/^data:([^;]+);base64,(.+)$/)
      if (!base64Match) {
        throw new Error('Invalid image data format. Expected base64 data URL.')
      }
      const [, mimeType, imageData] = base64Match
      return await extractRecipeFromImage(imageData, mimeType)
    } else {
      throw new Error(`Unsupported source type: ${source.type}`)
    }

    // Call Claude with structured output request
    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast and cost-effective
      max_tokens: 4096,
      temperature: 0.1, // Low temperature for factual extraction
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nCONTENT TO EXTRACT:\n${contentText}\n\nReturn the recipe as JSON:`
        }
      ]
    })

    // Extract JSON from response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let recipe: ExtractedRecipe

    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/```\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch ? jsonMatch[1] : responseText
      recipe = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText)
      throw new Error('Invalid JSON response from Claude')
    }

    // Add source metadata
    if (source.metadata?.source_url) {
      recipe.source_url = source.metadata.source_url
    }

    // Calculate confidence based on completeness
    const confidence = calculateConfidence(recipe)

    // Calculate token usage
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const totalTokens = inputTokens + outputTokens

    return {
      success: true,
      recipe,
      confidence,
      extraction_method: 'claude',
      tokens_used: totalTokens,
    }

  } catch (error: any) {
    console.error('Claude extraction error:', error)
    return {
      success: false,
      error: error.message || 'Failed to extract recipe with Claude',
      extraction_method: 'claude',
    }
  }
}

/**
 * Calculate confidence score based on recipe completeness
 */
function calculateConfidence(recipe: ExtractedRecipe): number {
  let score = 0
  const weights = {
    title: 20,
    ingredients: 30,
    instructions: 30,
    times: 10,
    dietary: 5,
    nutrition: 5,
  }

  if (recipe.title) score += weights.title
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    const avgIngredientCompleteness = recipe.ingredients.reduce((sum, ing) => {
      let ingScore = 0
      if (ing.item) ingScore += 0.5
      if (ing.quantity) ingScore += 0.25
      if (ing.unit) ingScore += 0.25
      return sum + ingScore
    }, 0) / recipe.ingredients.length
    score += weights.ingredients * avgIngredientCompleteness
  }
  if (recipe.instructions && recipe.instructions.length > 0) score += weights.instructions
  if (recipe.prep_time_minutes || recipe.cook_time_minutes) score += weights.times
  if (recipe.dietary_tags && recipe.dietary_tags.length > 0) score += weights.dietary
  if (recipe.nutrition) score += weights.nutrition

  return Math.round(score)
}
