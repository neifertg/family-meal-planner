/**
 * Recipe Scaling Utilities
 *
 * Handles automatic scaling of recipe ingredient quantities based on:
 * - Recipe's base servings
 * - Number of people to serve (family members + guests)
 */

export type ParsedQuantity = {
  value: number
  unit: string
  ingredient: string
  originalText: string
}

/**
 * Parse an ingredient string to extract quantity, unit, and ingredient name
 * Examples:
 * - "2 cups flour" -> { value: 2, unit: "cups", ingredient: "flour" }
 * - "1/2 lb ground beef" -> { value: 0.5, unit: "lb", ingredient: "ground beef" }
 * - "3 eggs" -> { value: 3, unit: "whole", ingredient: "eggs" }
 * - "3-4 carrots" -> { value: 3.5, unit: "whole", ingredient: "carrots" } (takes average)
 * - "2-3 cups flour" -> { value: 2.5, unit: "cups", ingredient: "flour" }
 */
export function parseIngredientQuantity(ingredient: string): ParsedQuantity | null {
  const text = ingredient.trim()

  // Pattern to match ranges: "3-4", "2-3", etc.
  // Also handles: "2-3 cups flour" or "3-4 carrots"
  const rangePattern = /^(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|pound|pounds|lb|lbs|ounce|ounces|oz|gram|grams|g|kilogram|kilograms|kg|liter|liters|l|milliliter|milliliters|ml|pinch|dash|can|cans|package|packages|pkg|clove|cloves|whole|piece|pieces)?\s*(.+)?/i

  const rangeMatch = text.match(rangePattern)
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1])
    const max = parseFloat(rangeMatch[2])
    const average = (min + max) / 2
    const unit = rangeMatch[3]?.toLowerCase() || 'whole'
    const ingredientName = rangeMatch[4]?.trim() || text

    return {
      value: average,
      unit,
      ingredient: ingredientName,
      originalText: text
    }
  }

  // Pattern to match: [number/fraction] [unit] [ingredient]
  const pattern = /^(\d+\.?\d*|\d*\.?\d+|(\d+\s+)?\d+\/\d+)\s*(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|pound|pounds|lb|lbs|ounce|ounces|oz|gram|grams|g|kilogram|kilograms|kg|liter|liters|l|milliliter|milliliters|ml|pinch|dash|can|cans|package|packages|pkg|clove|cloves|whole|piece|pieces)?s?\s+(.+)/i

  const match = text.match(pattern)

  if (!match) {
    // Try matching just a number at the start (like "3 eggs")
    const simpleMatch = text.match(/^(\d+\.?\d*|\d+\/\d+)\s+(.+)/)
    if (simpleMatch) {
      const numStr = simpleMatch[1]
      let value: number

      if (numStr.includes('/')) {
        const [num, den] = numStr.split('/').map(Number)
        value = num / den
      } else {
        value = parseFloat(numStr)
      }

      return {
        value,
        unit: 'whole',
        ingredient: simpleMatch[2].trim(),
        originalText: text
      }
    }

    return null
  }

  // Parse the numeric value (handle fractions like "1/2" or "1 1/2")
  const numStr = match[1].trim()
  let value: number

  if (numStr.includes('/')) {
    const parts = numStr.split(/\s+/)
    if (parts.length === 2) {
      // "1 1/2" format
      const whole = parseInt(parts[0])
      const [num, den] = parts[1].split('/').map(Number)
      value = whole + (num / den)
    } else {
      // "1/2" format
      const [num, den] = numStr.split('/').map(Number)
      value = num / den
    }
  } else {
    value = parseFloat(numStr)
  }

  const unit = match[3]?.toLowerCase() || 'whole'
  const ingredientName = match[4].trim()

  return {
    value,
    unit,
    ingredient: ingredientName,
    originalText: text
  }
}

/**
 * Scale an ingredient quantity based on servings ratio
 *
 * @param ingredient - Original ingredient string (e.g., "2 cups flour", "3-4 carrots")
 * @param baseServings - Recipe's base servings (from recipe.servings)
 * @param targetServings - Number of people to serve (familyMemberCount + guestCount)
 * @returns Scaled ingredient string (e.g., "4 cups flour", "6-8 carrots")
 */
export function scaleIngredient(
  ingredient: string,
  baseServings: number,
  targetServings: number
): string {
  // No scaling needed if servings match
  if (baseServings === targetServings || baseServings === 0) {
    return ingredient
  }

  const text = ingredient.trim()

  // Don't scale descriptive/imprecise amounts
  const nonScalablePatterns = [
    /^(a |an |some |to taste|salt and pepper|garnish|as needed|optional)/i,
    /^(pinch|dash|handful|sprinkle|generous)/i,
  ]

  for (const pattern of nonScalablePatterns) {
    if (pattern.test(text)) {
      return ingredient // Return as-is
    }
  }

  const scaleFactor = targetServings / baseServings

  // Check if this is a range (e.g., "3-4 carrots" or "2-3 cups flour")
  const rangePattern = /^(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|pound|pounds|lb|lbs|ounce|ounces|oz|gram|grams|g|kilogram|kilograms|kg|liter|liters|l|milliliter|milliliters|ml|pinch|dash|can|cans|package|packages|pkg|clove|cloves|whole|piece|pieces)?\s*(.+)?/i
  const rangeMatch = text.match(rangePattern)

  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1])
    const max = parseFloat(rangeMatch[2])
    const scaledMin = min * scaleFactor
    const scaledMax = max * scaleFactor
    const unit = rangeMatch[3] || ''
    const ingredientName = rangeMatch[4]?.trim() || ''

    // Format the scaled range
    const formattedMin = formatQuantity(scaledMin)
    const formattedMax = formatQuantity(scaledMax)

    // Reconstruct with range
    if (unit) {
      const pluralUnit = scaledMax > 1 && !unit.endsWith('s') ? `${unit}s` : unit
      return `${formattedMin}-${formattedMax} ${pluralUnit} ${ingredientName}`.trim()
    } else {
      return `${formattedMin}-${formattedMax} ${ingredientName}`.trim()
    }
  }

  // Not a range, parse normally
  const parsed = parseIngredientQuantity(ingredient)

  // If we couldn't parse it, return original
  if (!parsed) {
    return ingredient
  }

  // Calculate scaled quantity
  const scaledValue = parsed.value * scaleFactor

  // Format the scaled value nicely
  const formattedValue = formatQuantity(scaledValue)

  // Reconstruct the ingredient string
  const pluralUnit = scaledValue > 1 && !parsed.unit.endsWith('s') ? `${parsed.unit}s` : parsed.unit

  // Handle "whole" unit specially (e.g., "3 eggs" not "3 wholes eggs")
  if (parsed.unit === 'whole') {
    return `${formattedValue} ${parsed.ingredient}`
  }

  return `${formattedValue} ${pluralUnit} ${parsed.ingredient}`
}

/**
 * Format a quantity value nicely
 * - Whole numbers: "2"
 * - Common fractions: "1/2", "1/4", "3/4", "1/3", "2/3"
 * - Decimals: "1.5", "2.25"
 */
function formatQuantity(value: number): string {
  // Check if it's a whole number
  if (value % 1 === 0) {
    return value.toString()
  }

  // Try to convert to common fractions
  const commonFractions: { [key: string]: string } = {
    '0.25': '1/4',
    '0.33': '1/3',
    '0.5': '1/2',
    '0.66': '2/3',
    '0.67': '2/3',
    '0.75': '3/4',
  }

  // Check for whole number + fraction (e.g., 1.5 -> "1 1/2")
  const whole = Math.floor(value)
  const decimal = value - whole
  const decimalStr = decimal.toFixed(2)

  if (whole > 0 && commonFractions[decimalStr]) {
    return `${whole} ${commonFractions[decimalStr]}`
  }

  // Check for just fraction (e.g., 0.5 -> "1/2")
  if (commonFractions[decimalStr]) {
    return commonFractions[decimalStr]
  }

  // Round to 1 decimal place for other values
  return value.toFixed(1).replace(/\.0$/, '')
}

/**
 * Calculate the total number of people to serve for a meal plan
 *
 * @param familyMemberCount - Number of family members
 * @param guestCount - Number of additional guests
 * @returns Total people to serve
 */
export function calculateTargetServings(
  familyMemberCount: number,
  guestCount: number
): number {
  return familyMemberCount + guestCount
}
