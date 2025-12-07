/**
 * Expiration Date Estimation
 *
 * Estimates expiration dates for grocery items based on their category
 */

/**
 * Estimate expiration date for a grocery item based on its category
 * @param category - The food category (produce, dairy, meat, pantry, frozen, other)
 * @param purchaseDate - The date the item was purchased
 * @returns ISO date string for estimated expiration
 */
export function estimateExpirationDate(
  category: string | undefined,
  purchaseDate: string
): string {
  const purchase = new Date(purchaseDate)

  // Default shelf life in days based on category
  const shelfLifeDays: Record<string, number> = {
    produce: 7,      // Fresh produce: 7 days
    dairy: 10,       // Dairy products: 10 days
    meat: 4,         // Fresh meat: 4 days (refrigerated)
    pantry: 180,     // Pantry items: 6 months
    frozen: 90,      // Frozen items: 3 months
    other: 14        // Default: 2 weeks
  }

  const daysToAdd = shelfLifeDays[category || 'other'] || 14

  const expirationDate = new Date(purchase)
  expirationDate.setDate(expirationDate.getDate() + daysToAdd)

  return expirationDate.toISOString().split('T')[0]
}

/**
 * Get estimated shelf life description for a category
 */
export function getShelfLifeDescription(category: string | undefined): string {
  const descriptions: Record<string, string> = {
    produce: '~1 week',
    dairy: '~10 days',
    meat: '~4 days (refrigerated)',
    pantry: '~6 months',
    frozen: '~3 months',
    other: '~2 weeks'
  }

  return descriptions[category || 'other'] || '~2 weeks'
}
