/**
 * Schema.org JSON-LD Recipe Parser
 *
 * This is the PRIMARY scraping method as 80%+ of recipe sites use schema.org markup.
 * Handles Recipe schema from https://schema.org/Recipe
 */

import { ScrapedRecipe } from './types'

/**
 * Extract schema.org JSON-LD data from HTML
 */
export function extractSchemaOrg(html: string): any[] {
  const scriptMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  const schemas: any[] = []

  for (const match of scriptMatches) {
    try {
      const jsonContent = match[1].trim()
      const data = JSON.parse(jsonContent)

      // Handle both single objects and arrays
      if (Array.isArray(data)) {
        schemas.push(...data)
      } else if (data['@graph']) {
        // Some sites use @graph to include multiple schema objects
        schemas.push(...data['@graph'])
      } else {
        schemas.push(data)
      }
    } catch (e) {
      // Invalid JSON, skip this script tag
      continue
    }
  }

  return schemas
}

/**
 * Find Recipe schema from extracted schema.org data
 */
export function findRecipeSchema(schemas: any[]): any | null {
  for (const schema of schemas) {
    const type = schema['@type']

    // Handle single type or array of types
    const types = Array.isArray(type) ? type : [type]

    if (types.includes('Recipe')) {
      return schema
    }
  }

  return null
}

/**
 * Parse ISO 8601 duration to minutes
 * Examples: "PT30M" = 30 minutes, "PT1H30M" = 90 minutes, "P1DT2H30M" = 1590 minutes
 */
export function parseDuration(duration?: string): number | undefined {
  if (!duration) return undefined

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return undefined

  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')

  return hours * 60 + minutes
}

/**
 * Normalize ingredient strings from schema.org data
 */
function normalizeIngredients(ingredients: any): string[] {
  if (!ingredients) return []

  const ingredientArray = Array.isArray(ingredients) ? ingredients : [ingredients]

  return ingredientArray.map(ing => {
    if (typeof ing === 'string') {
      return ing.trim()
    } else if (ing['@type'] === 'HowToSection' && ing.itemListElement) {
      // Handle grouped ingredients
      return normalizeIngredients(ing.itemListElement)
    } else if (typeof ing === 'object' && ing.text) {
      return ing.text.trim()
    } else {
      return String(ing).trim()
    }
  }).flat().filter(Boolean)
}

/**
 * Normalize instruction steps from schema.org data
 */
function normalizeInstructions(instructions: any): string[] {
  if (!instructions) return []

  const instructionArray = Array.isArray(instructions) ? instructions : [instructions]

  return instructionArray.map(inst => {
    if (typeof inst === 'string') {
      return inst.trim()
    } else if (inst['@type'] === 'HowToSection' && inst.itemListElement) {
      // Handle grouped instructions (e.g., "For the dough:", "For the sauce:")
      const sectionName = inst.name ? `${inst.name}:\n` : ''
      const steps = normalizeInstructions(inst.itemListElement)
      return sectionName + steps.join('\n')
    } else if (inst['@type'] === 'HowToStep' && inst.text) {
      return inst.text.trim()
    } else if (typeof inst === 'object' && inst.text) {
      return inst.text.trim()
    } else {
      return String(inst).trim()
    }
  }).flat().filter(Boolean)
}

/**
 * Extract image URL from schema.org image field
 */
function extractImageUrl(image: any): string | undefined {
  if (!image) return undefined

  if (typeof image === 'string') {
    return image
  } else if (Array.isArray(image) && image.length > 0) {
    return extractImageUrl(image[0])
  } else if (typeof image === 'object' && image.url) {
    return image.url
  }

  return undefined
}

/**
 * Extract servings from yield field
 */
function extractServings(recipeYield: any): number | undefined {
  if (!recipeYield) return undefined

  const yieldValue = Array.isArray(recipeYield) ? recipeYield[0] : recipeYield

  if (typeof yieldValue === 'number') {
    return yieldValue
  }

  if (typeof yieldValue === 'string') {
    // Try to extract number from strings like "8 servings", "Makes 12", "4-6 servings"
    const match = yieldValue.match(/(\d+)/)
    return match ? parseInt(match[1]) : undefined
  }

  return undefined
}

/**
 * Parse schema.org Recipe into our ScrapedRecipe format
 */
export function parseSchemaOrgRecipe(schema: any, sourceUrl: string): ScrapedRecipe | null {
  if (!schema || !schema.name) {
    return null
  }

  const prepTime = parseDuration(schema.prepTime)
  const cookTime = parseDuration(schema.cookTime)
  const totalTime = parseDuration(schema.totalTime) || (prepTime && cookTime ? prepTime + cookTime : undefined)

  const recipe: ScrapedRecipe = {
    name: schema.name.trim(),
    description: schema.description?.trim(),
    image_url: extractImageUrl(schema.image),
    prep_time_minutes: prepTime,
    cook_time_minutes: cookTime,
    total_time_minutes: totalTime,
    servings: extractServings(schema.recipeYield),
    cuisine: schema.recipeCuisine,
    category: schema.recipeCategory,
    ingredients: normalizeIngredients(schema.recipeIngredient),
    instructions: normalizeInstructions(schema.recipeInstructions),
    tags: schema.keywords ? (Array.isArray(schema.keywords) ? schema.keywords : schema.keywords.split(',').map((k: string) => k.trim())) : undefined,
    source_url: sourceUrl,
    source_name: schema.publisher?.name || schema.author?.name,
    author: schema.author?.name,
  }

  // Extract rating if available
  if (schema.aggregateRating) {
    recipe.rating = {
      value: parseFloat(schema.aggregateRating.ratingValue),
      count: parseInt(schema.aggregateRating.ratingCount || schema.aggregateRating.reviewCount)
    }
  }

  // Extract nutrition if available
  if (schema.nutrition) {
    recipe.nutrition = {
      calories: parseInt(schema.nutrition.calories),
      protein: schema.nutrition.proteinContent,
      carbohydrates: schema.nutrition.carbohydrateContent,
      fat: schema.nutrition.fatContent,
      fiber: schema.nutrition.fiberContent,
      sugar: schema.nutrition.sugarContent,
    }
  }

  return recipe
}

/**
 * Main function to extract recipe from HTML using schema.org
 */
export function scrapeRecipeFromSchemaOrg(html: string, url: string): ScrapedRecipe | null {
  const schemas = extractSchemaOrg(html)
  const recipeSchema = findRecipeSchema(schemas)

  if (!recipeSchema) {
    return null
  }

  return parseSchemaOrgRecipe(recipeSchema, url)
}
