/**
 * Tag Normalization Utilities
 *
 * Cleans and standardizes recipe tags to maintain consistency
 */

/**
 * Normalize a tag by removing special characters and standardizing format
 */
export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    // Remove special characters except spaces and hyphens
    .replace(/[^\w\s-]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    .trim()
}

/**
 * Common tag mappings for standardization
 */
const TAG_MAPPINGS: Record<string, string> = {
  // Meal types
  'main course': 'main',
  'main dish': 'main',
  'entree': 'main',
  'entrée': 'main',
  'side dish': 'side',
  'sides': 'side',

  // Cuisines (already lowercase from normalization)
  'asian': 'asian',
  'chinese': 'chinese',
  'mexican': 'mexican',
  'italian': 'italian',
  'american': 'american',
  'indian': 'indian',
  'japanese': 'japanese',
  'thai': 'thai',
  'mediterranean': 'mediterranean',
  'french': 'french',

  // Dietary
  'veg': 'vegetarian',
  'veggie': 'vegetarian',
  'plant based': 'plant-based',
  'plant-based': 'plant-based',
  'gluten free': 'gluten-free',
  'dairy free': 'dairy-free',
  'sugar free': 'sugar-free',

  // Time-based
  'quick': 'quick',
  'fast': 'quick',
  'easy': 'easy',
  'simple': 'easy',
  '30 min': 'quick',
  '30 minutes': 'quick',
  'slow cooker': 'slow-cooker',
  'crockpot': 'slow-cooker',
  'instant pot': 'instant-pot',
  'pressure cooker': 'instant-pot',

  // Methods
  'baked': 'baked',
  'grilled': 'grilled',
  'fried': 'fried',
  'roasted': 'roasted',
  'steamed': 'steamed',
  'sauteed': 'sautéed',
  'sautéed': 'sautéed',

  // Meals
  'breakfast': 'breakfast',
  'lunch': 'lunch',
  'dinner': 'dinner',
  'snack': 'snack',
  'dessert': 'dessert',
  'appetizer': 'appetizer',
  'apps': 'appetizer',

  // Seasons
  'summer': 'summer',
  'winter': 'winter',
  'fall': 'fall',
  'autumn': 'fall',
  'spring': 'spring',

  // Special
  'kid friendly': 'kid-friendly',
  'kids': 'kid-friendly',
  'family': 'family-friendly',
  'crowd pleaser': 'crowd-pleaser',
  'healthy': 'healthy',
  'comfort food': 'comfort-food',
  'comfort': 'comfort-food',
}

/**
 * Get standardized version of a tag if a mapping exists
 */
export function standardizeTag(tag: string): string {
  const normalized = normalizeTag(tag)
  return TAG_MAPPINGS[normalized] || normalized
}

/**
 * Clean and standardize a tag, returning the best version
 * Also returns whether it was changed
 */
export function cleanTag(tag: string): { cleaned: string; wasChanged: boolean } {
  const normalized = normalizeTag(tag)
  const standardized = standardizeTag(normalized)

  return {
    cleaned: standardized,
    wasChanged: standardized !== tag.trim().toLowerCase()
  }
}

/**
 * Find suggested clean versions of a messy tag
 */
export function suggestCleanTags(messyTag: string, existingTags: string[]): string[] {
  const { cleaned, wasChanged } = cleanTag(messyTag)
  const suggestions: string[] = []

  // Always suggest the standardized version
  if (wasChanged) {
    suggestions.push(cleaned)
  }

  // Check if cleaned version exists in existing tags
  const exactMatch = existingTags.find(t => t === cleaned)
  if (exactMatch && exactMatch !== messyTag) {
    // Don't add again, it's already first
  }

  // Find similar existing tags
  const normalized = normalizeTag(messyTag)
  const similarExisting = existingTags.filter(t => {
    const similarity = calculateSimilarity(normalized, normalizeTag(t))
    return similarity < 3 && t !== messyTag // Levenshtein distance < 3
  })

  suggestions.push(...similarExisting.slice(0, 2)) // Max 2 similar suggestions

  // Remove duplicates while preserving order
  return [...new Set(suggestions)]
}

/**
 * Simple Levenshtein distance for finding similar tags
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Bulk clean tags - useful for cleaning existing recipe tags
 */
export function bulkCleanTags(tags: string[]): string[] {
  const cleaned = tags.map(tag => standardizeTag(tag))
  // Remove duplicates that result from standardization
  return [...new Set(cleaned)]
}
