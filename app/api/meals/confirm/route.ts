import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type MealPlan = {
  id: string
  recipe_id: string | null
  adhoc_meal_name: string | null
  adhoc_ingredients: string[] | null
  recipes: {
    id: string
    name: string
    ingredients: string[] | any
  } | null
}

type InventoryItem = {
  id: string
  family_id: string
  name: string
  category: string
  quantity_level: string
  expiration_date: string | null
  created_at: string
  updated_at: string
}

/**
 * Parse an ingredient string to extract quantity, unit, and item name
 * Examples:
 *   "2 cups flour" -> { quantity: 2, unit: "cups", item: "flour" }
 *   "1 lb chicken breast, diced" -> { quantity: 1, unit: "lb", item: "chicken breast" }
 *   "salt to taste" -> { quantity: null, unit: null, item: "salt" }
 */
function parseIngredient(ingredientString: string): { quantity: number | null; unit: string | null; item: string } {
  // Remove extra whitespace
  const cleaned = ingredientString.trim()

  // Try to match: [quantity] [unit] [item]
  const match = cleaned.match(/^(\d+\.?\d*)\s*([a-zA-Z]+)?\s*(.+)$/)

  if (match) {
    const [, quantityStr, unit, item] = match
    return {
      quantity: parseFloat(quantityStr),
      unit: unit || null,
      item: item.split(',')[0].trim() // Remove any notes after comma
    }
  }

  // No quantity found - return just the item name
  return {
    quantity: null,
    unit: null,
    item: cleaned.split(',')[0].trim()
  }
}

/**
 * Extract core ingredient name for fuzzy matching
 * Examples:
 *   "chicken breast" -> "chicken"
 *   "red onion" -> "onion"
 *   "fresh spinach" -> "spinach"
 */
function extractCoreIngredient(ingredientName: string): string {
  const lower = ingredientName.toLowerCase()

  // Remove common modifiers
  const modifiers = [
    'fresh', 'frozen', 'dried', 'canned', 'organic',
    'raw', 'cooked', 'diced', 'chopped', 'sliced',
    'whole', 'ground', 'shredded', 'grated',
    'red', 'green', 'yellow', 'white', 'black',
    'large', 'small', 'medium',
    'boneless', 'skinless'
  ]

  let core = lower
  modifiers.forEach(modifier => {
    core = core.replace(new RegExp(`\\b${modifier}\\b`, 'g'), '')
  })

  return core.trim().split(/\s+/)[0] || lower
}

/**
 * Find matching inventory item using fuzzy matching
 */
function findInventoryMatch(ingredientItem: string, inventoryItems: InventoryItem[]): InventoryItem | null {
  const coreIngredient = extractCoreIngredient(ingredientItem)

  // Try exact match first
  let match = inventoryItems.find(item =>
    item.name.toLowerCase() === ingredientItem.toLowerCase()
  )

  if (match) return match

  // Try core ingredient match
  match = inventoryItems.find(item =>
    item.name.toLowerCase().includes(coreIngredient) ||
    coreIngredient.includes(item.name.toLowerCase())
  )

  return match || null
}

/**
 * Reduce inventory quantity level based on usage
 */
function reduceQuantityLevel(currentLevel: string): string {
  if (currentLevel === 'full') return 'medium'
  if (currentLevel === 'medium') return 'low'
  return 'low' // Already low, keep it low
}

export async function POST(request: NextRequest) {
  try {
    const { mealIds, familyId } = await request.json()

    if (!mealIds || !Array.isArray(mealIds) || mealIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No meal IDs provided' },
        { status: 400 }
      )
    }

    if (!familyId) {
      return NextResponse.json(
        { success: false, error: 'Family ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get all meals with their recipes
    const { data: meals, error: mealsError } = await supabase
      .from('meal_plans')
      .select(`
        id,
        recipe_id,
        adhoc_meal_name,
        adhoc_ingredients,
        recipes (
          id,
          name,
          ingredients
        )
      `)
      .in('id', mealIds)
      .eq('family_id', familyId) as { data: MealPlan[] | null; error: any }

    if (mealsError) {
      console.error('Error fetching meals:', mealsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch meal plans' },
        { status: 500 }
      )
    }

    if (!meals || meals.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No meals found' },
        { status: 404 }
      )
    }

    // Get current inventory
    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('family_id', familyId) as { data: InventoryItem[] | null; error: any }

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch inventory' },
        { status: 500 }
      )
    }

    // Track inventory updates
    const inventoryUpdates: { id: string; quantity_level: string }[] = []
    const itemsUsed: string[] = []

    // Process each meal
    for (const meal of meals) {
      let ingredients: string[] = []

      // Get ingredients from either recipe or adhoc meal
      if (meal.adhoc_ingredients) {
        ingredients = meal.adhoc_ingredients
      } else if (meal.recipes?.ingredients) {
        // Handle both string array and structured object formats
        ingredients = Array.isArray(meal.recipes.ingredients)
          ? meal.recipes.ingredients
          : (meal.recipes.ingredients as any).ingredients || []
      }

      // Process each ingredient
      for (const ingredientStr of ingredients) {
        const { item } = parseIngredient(ingredientStr)

        // Try to find matching inventory item
        const inventoryMatch = findInventoryMatch(item, inventoryItems || [])

        if (inventoryMatch) {
          // Check if we already reduced this item
          const alreadyUpdated = inventoryUpdates.find(u => u.id === inventoryMatch.id)

          if (!alreadyUpdated) {
            const newLevel = reduceQuantityLevel(inventoryMatch.quantity_level)
            inventoryUpdates.push({
              id: inventoryMatch.id,
              quantity_level: newLevel
            })
            itemsUsed.push(inventoryMatch.name)
          }
        }
      }
    }

    // Apply inventory updates
    if (inventoryUpdates.length > 0) {
      for (const update of inventoryUpdates) {
        await supabase
          .from('inventory_items')
          .update({ quantity_level: update.quantity_level } as any)
          .eq('id', update.id)
      }
    }

    // Mark meals as completed
    await supabase
      .from('meal_plans')
      .update({ is_completed: true } as any)
      .in('id', mealIds)

    return NextResponse.json({
      success: true,
      itemsUpdated: inventoryUpdates.length,
      itemsUsed
    })

  } catch (error: any) {
    console.error('Error confirming meals:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to confirm meals'
      },
      { status: 500 }
    )
  }
}
