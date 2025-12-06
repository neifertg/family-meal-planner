/**
 * Gemini-Based Recipe Extractor
 *
 * Uses Google Gemini with structured output to extract recipes from any content
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { ExtractedRecipe, ExtractionResult, ContentSource } from './types'

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Recipe title/name' },
    description: { type: 'string', description: 'Brief description of the recipe' },
    author: { type: 'string', description: 'Recipe author name' },

    ingredients: {
      type: 'array',
      description: 'List of ingredients',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Ingredient name' },
          quantity: { type: 'number', description: 'Amount of ingredient' },
          unit: { type: 'string', description: 'Unit of measurement (cups, oz, etc)' },
          preparation: { type: 'string', description: 'How to prepare (chopped, diced, etc)' },
          notes: { type: 'string', description: 'Additional notes or substitutions' }
        },
        required: ['item']
      }
    },

    instructions: {
      type: 'array',
      description: 'Step-by-step instructions',
      items: {
        type: 'object',
        properties: {
          step_number: { type: 'number', description: 'Step number in sequence' },
          instruction: { type: 'string', description: 'Instruction text' },
          time_minutes: { type: 'number', description: 'Time for this step in minutes' },
          temperature: { type: 'string', description: 'Temperature if mentioned (e.g., 350°F)' }
        },
        required: ['step_number', 'instruction']
      }
    },

    prep_time_minutes: { type: 'number', description: 'Preparation time in minutes' },
    cook_time_minutes: { type: 'number', description: 'Cooking time in minutes' },
    total_time_minutes: { type: 'number', description: 'Total time in minutes' },

    servings: { type: 'number', description: 'Number of servings' },
    yield: { type: 'string', description: 'What the recipe yields (e.g., 12 cookies)' },

    cuisine: { type: 'string', description: 'Cuisine type (Italian, Mexican, etc)' },
    category: { type: 'string', description: 'Recipe category (Dessert, Main Course, etc)' },
    difficulty: {
      type: 'string',
      enum: ['easy', 'medium', 'hard'],
      description: 'Difficulty level'
    },

    dietary_tags: {
      type: 'array',
      description: 'Dietary tags (vegetarian, vegan, gluten-free, etc)',
      items: { type: 'string' }
    },

    allergens: {
      type: 'array',
      description: 'Common allergens present (nuts, dairy, eggs, etc)',
      items: { type: 'string' }
    },

    tags: {
      type: 'array',
      description: 'Additional tags (quick, one-pot, make-ahead, etc)',
      items: { type: 'string' }
    },

    nutrition: {
      type: 'object',
      description: 'Nutritional information per serving',
      properties: {
        calories: { type: 'number' },
        protein_g: { type: 'number' },
        carbohydrates_g: { type: 'number' },
        fat_g: { type: 'number' },
        fiber_g: { type: 'number' },
        sugar_g: { type: 'number' },
        sodium_mg: { type: 'number' }
      }
    },

    equipment_needed: {
      type: 'array',
      description: 'Kitchen equipment needed',
      items: { type: 'string' }
    },

    tips: {
      type: 'array',
      description: 'Cooking tips mentioned in the recipe',
      items: { type: 'string' }
    },

    substitutions: {
      type: 'array',
      description: 'Ingredient substitutions mentioned',
      items: { type: 'string' }
    },

    storage_instructions: { type: 'string', description: 'How to store leftovers' },

    image_url: { type: 'string', description: 'Main recipe image URL' }
  },
  required: ['title', 'ingredients', 'instructions']
}

const EXTRACTION_PROMPT = `You are a recipe extraction expert. Extract all recipe information from the provided content and return it in the specified JSON format.

IMPORTANT INSTRUCTIONS:
1. Extract ingredients with quantities, units, and preparation notes
2. Break down instructions into numbered steps
3. Extract all time information (prep, cook, total) in minutes
4. Identify dietary tags (vegetarian, vegan, gluten-free, dairy-free, etc.)
5. Extract nutrition information if available
6. Identify allergens (nuts, dairy, eggs, soy, shellfish, etc.)
7. Categorize the recipe (cuisine, category, difficulty)
8. Extract any cooking tips or substitutions mentioned
9. If ingredient groups are present (e.g., "For the sauce", "For the dough"), include them
10. Normalize units to standard measurements (cups, tbsp, tsp, oz, lb, g, ml, etc.)

Return ONLY valid JSON matching the schema. If any field is not found, omit it or use null.`

/**
 * Initialize Gemini client
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set')
  }
  return new GoogleGenerativeAI(apiKey)
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

  // Limit to ~10k chars to save tokens (adjust based on needs)
  if (cleaned.length > 10000) {
    // Try to find recipe section
    const recipeIndex = cleaned.toLowerCase().indexOf('ingredient')
    if (recipeIndex > 0) {
      cleaned = cleaned.substring(Math.max(0, recipeIndex - 500), recipeIndex + 9500)
    } else {
      cleaned = cleaned.substring(0, 10000)
    }
  }

  return cleaned
}

/**
 * Extract recipe using Gemini with structured output
 */
export async function extractRecipeWithGemini(
  source: ContentSource
): Promise<ExtractionResult> {
  try {
    const genAI = getGeminiClient()

    // Use Gemini 1.5 Flash for cost-effectiveness, or Pro for complex recipes
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1,  // Low temperature for factual extraction
        topK: 1,
        topP: 1,
      },
    })

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
      // For images, we'd use Gemini Vision - simplified for now
      throw new Error('Image extraction requires Gemini Vision - coming soon')
    } else {
      throw new Error(`Unsupported source type: ${source.type}`)
    }

    // Call Gemini with the extraction prompt
    const prompt = `${EXTRACTION_PROMPT}\n\nCONTENT TO EXTRACT:\n${contentText}\n\nReturn the recipe as JSON following the schema.`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // Parse JSON response
    let recipe: ExtractedRecipe

    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch ? jsonMatch[1] : text
      recipe = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text)
      throw new Error('Invalid JSON response from Gemini')
    }

    // Add source metadata
    if (source.metadata?.source_url) {
      recipe.source_url = source.metadata.source_url
    }

    // Calculate confidence based on completeness
    const confidence = calculateConfidence(recipe)

    return {
      success: true,
      recipe,
      confidence,
      extraction_method: 'gemini',
      tokens_used: result.response.usageMetadata?.totalTokenCount,
    }

  } catch (error: any) {
    console.error('Gemini extraction error:', error)
    return {
      success: false,
      error: error.message || 'Failed to extract recipe with Gemini',
      extraction_method: 'gemini',
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
