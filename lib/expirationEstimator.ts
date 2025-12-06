/**
 * Expiration Date Estimator
 *
 * Estimates expiration dates for grocery items based on purchase date
 * and typical shelf life data
 */

import { createClient } from '@/lib/supabase/client'

type ShelfLifeData = {
  ingredient_pattern: string
  shelf_life_days: number
  storage_type: string
  notes: string
}

// Cache shelf life data to avoid repeated database calls
let shelfLifeCache: ShelfLifeData[] | null = null

/**
 * Load shelf life data from database
 */
async function loadShelfLifeData(): Promise<ShelfLifeData[]> {
  if (shelfLifeCache) {
    return shelfLifeCache
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('ingredient_shelf_life')
    .select('ingredient_pattern, shelf_life_days, storage_type, notes')
    .order('ingredient_pattern')

  if (error) {
    console.error('Error loading shelf life data:', error)
    return []
  }

  shelfLifeCache = data || []
  return shelfLifeCache
}

/**
 * Estimate expiration date for an ingredient
 *
 * @param ingredientName - Name of the ingredient (e.g., "Whole Milk", "Chicken Breast")
 * @param purchaseDate - Date the item was purchased (ISO string or Date)
 * @returns Estimated expiration date as ISO string, or null if can't estimate
 */
export async function estimateExpirationDate(
  ingredientName: string,
  purchaseDate: string | Date
): Promise<string | null> {
  try {
    const shelfLifeData = await loadShelfLifeData()
    const normalizedName = ingredientName.toLowerCase()

    // Try to find matching shelf life pattern
    let matchedShelfLife: ShelfLifeData | null = null

    for (const item of shelfLifeData) {
      if (normalizedName.includes(item.ingredient_pattern)) {
        matchedShelfLife = item
        break
      }
    }

    // If no match found, use conservative default (7 days for perishables)
    const shelfLifeDays = matchedShelfLife?.shelf_life_days || 7

    // Calculate expiration date
    const purchase = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate
    const expiration = new Date(purchase)
    expiration.setDate(expiration.getDate() + shelfLifeDays)

    return expiration.toISOString().split('T')[0] // Return YYYY-MM-DD format
  } catch (error) {
    console.error('Error estimating expiration date:', error)
    return null
  }
}

/**
 * Get shelf life info for an ingredient (for display purposes)
 *
 * @param ingredientName - Name of the ingredient
 * @returns Shelf life info or null
 */
export async function getShelfLifeInfo(
  ingredientName: string
): Promise<{ days: number; storage: string; notes: string } | null> {
  try {
    const shelfLifeData = await loadShelfLifeData()
    const normalizedName = ingredientName.toLowerCase()

    for (const item of shelfLifeData) {
      if (normalizedName.includes(item.ingredient_pattern)) {
        return {
          days: item.shelf_life_days,
          storage: item.storage_type,
          notes: item.notes
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error getting shelf life info:', error)
    return null
  }
}

/**
 * Calculate days until expiration
 *
 * @param expirationDate - Expiration date (ISO string or Date)
 * @returns Number of days until expiration (negative if expired)
 */
export function daysUntilExpiration(expirationDate: string | Date): number {
  const expiration = typeof expirationDate === 'string' ? new Date(expirationDate) : expirationDate
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expiration.setHours(0, 0, 0, 0)

  const diffMs = expiration.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Check if an item is expiring soon (within 7 days)
 */
export function isExpiringSoon(expirationDate: string | Date): boolean {
  const days = daysUntilExpiration(expirationDate)
  return days >= 0 && days <= 7
}

/**
 * Check if an item is expired
 */
export function isExpired(expirationDate: string | Date): boolean {
  return daysUntilExpiration(expirationDate) < 0
}
