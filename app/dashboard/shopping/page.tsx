'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ReceiptScanner from '@/components/ReceiptScanner'
import { ExtractedReceipt } from '@/lib/receiptScanner/types'

type GroceryItem = {
  id: string
  name: string
  quantity: string | null
  category: string | null
  is_checked: boolean
  recipe_id: string | null
}

type InventoryItem = {
  id: string
  name: string
  category: string
  quantity_level: 'low' | 'medium' | 'full'
  expiration_date: string | null
}

type GroceryItemWithInventory = GroceryItem & {
  inventoryStatus?: {
    inStock: boolean
    quantityLevel: 'low' | 'medium' | 'full'
    expirationDate: string | null
  }
}

export default function ShoppingListPage() {
  const [items, setItems] = useState<GroceryItem[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState('')
  const [newQuantity, setNewQuantity] = useState('')
  const [generating, setGenerating] = useState(false)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [showReceiptScanner, setShowReceiptScanner] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadFamilyId()
  }, [])

  useEffect(() => {
    if (familyId) {
      loadShoppingList()
      loadInventory()
    }
  }, [familyId])

  const loadFamilyId = async () => {
    const { data: families, error } = await supabase
      .from('families')
      .select('id')
      .single()

    console.log('Family data loaded:', families, 'Error:', error)

    if (families) {
      setFamilyId(families.id)
      console.log('Family ID set to:', families.id)
    } else {
      console.error('No family found')
    }
  }

  const loadShoppingList = async () => {
    setLoading(true)

    if (!familyId) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('grocery_list_items')
      .select('*')
      .eq('family_id', familyId)
      .order('is_checked')
      .order('category')
      .order('name')

    if (error) {
      console.error('Error loading shopping list:', error)
    }

    if (data) setItems(data)
    setLoading(false)
  }

  const loadInventory = async () => {
    if (!familyId) return

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('family_id', familyId)

    if (error) {
      console.error('Error loading inventory:', error)
    } else if (data) {
      setInventoryItems(data)
    }
  }

  const generateFromMealPlan = async () => {
    console.log('Generate clicked, familyId:', familyId)

    if (!familyId) {
      alert('Family not found. Please refresh the page.')
      return
    }

    setGenerating(true)
    try {
      // Get upcoming meal plans (next 7 days)
      const today = new Date().toISOString().split('T')[0]
      const weekLater = new Date()
      weekLater.setDate(weekLater.getDate() + 7)
      const weekLaterStr = weekLater.toISOString().split('T')[0]

      console.log('Fetching meal plans from', today, 'to', weekLaterStr)

      const { data: mealPlans, error: mealPlansError } = await supabase
        .from('meal_plans')
        .select(`
          *,
          recipes (
            id,
            name,
            ingredients
          )
        `)
        .gte('planned_date', today)
        .lte('planned_date', weekLaterStr)
        .eq('is_completed', false)

      console.log('Meal plans fetched:', mealPlans, 'Error:', mealPlansError)

      if (mealPlansError) {
        console.error('Error fetching meal plans:', mealPlansError)
        alert(`Failed to fetch meal plans: ${mealPlansError.message}`)
        setGenerating(false)
        return
      }

      if (!mealPlans || mealPlans.length === 0) {
        alert('No upcoming meals planned. Add meals to your calendar first!')
        setGenerating(false)
        return
      }

      // Clear existing auto-generated items (those linked to recipes)
      await supabase
        .from('grocery_list_items')
        .delete()
        .eq('family_id', familyId)
        .not('recipe_id', 'is', null)

      // Aggregate ingredients from all recipes with smart consolidation
      const ingredientMap = new Map<string, { quantities: string[]; recipeIds: Set<string> }>()

      mealPlans.forEach((plan: any) => {
        const recipe = plan.recipes
        if (!recipe || !recipe.ingredients) return

        const ingredients = Array.isArray(recipe.ingredients)
          ? recipe.ingredients
          : recipe.ingredients.ingredients || []

        ingredients.forEach((ingredient: string) => {
          const parsed = parseIngredient(ingredient)
          const existingKeys = Array.from(ingredientMap.keys())

          // Use fuzzy matching to find similar ingredients
          const itemKey = findOrCreateIngredientKey(parsed.item, existingKeys)

          if (ingredientMap.has(itemKey)) {
            const existing = ingredientMap.get(itemKey)!
            existing.quantities.push(parsed.fullText)
            existing.recipeIds.add(recipe.id)
          } else {
            ingredientMap.set(itemKey, {
              quantities: [parsed.fullText],
              recipeIds: new Set([recipe.id])
            })
          }
        })
      })

      console.log('Aggregated ingredients:', ingredientMap)

      // Insert all aggregated ingredients with combined quantities
      const itemsToInsert = Array.from(ingredientMap.entries()).map(([itemName, value]) => {
        const combinedQty = combineQuantities(value.quantities)
        const firstRecipeId = Array.from(value.recipeIds)[0]

        return {
          family_id: familyId,
          name: itemName,
          quantity: combinedQty,
          category: categorizeIngredient(itemName),
          is_checked: false,
          recipe_id: firstRecipeId
        }
      })

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('grocery_list_items')
          .insert(itemsToInsert)

        if (insertError) {
          console.error('Error inserting items:', insertError)
          alert(`Failed to insert items: ${insertError.message}`)
          setGenerating(false)
          return
        }
      }

      loadShoppingList()
    } catch (error) {
      console.error('Error generating shopping list:', error)
      alert('Failed to generate shopping list')
    } finally {
      setGenerating(false)
    }
  }

  const addManualItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.trim()) return

    if (!familyId) {
      alert('Family not found. Please refresh the page.')
      return
    }

    const { error } = await supabase
      .from('grocery_list_items')
      .insert({
        family_id: familyId,
        name: newItem,
        quantity: newQuantity || null,
        category: categorizeIngredient(newItem),
        is_checked: false,
        recipe_id: null
      })

    if (error) {
      console.error('Error adding item:', error)
      alert(`Failed to add item: ${error.message}`)
    } else {
      setNewItem('')
      setNewQuantity('')
      loadShoppingList()
    }
  }

  const toggleItem = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('grocery_list_items')
      .update({ is_checked: !currentStatus })
      .eq('id', id)

    if (!error) loadShoppingList()
  }

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from('grocery_list_items')
      .delete()
      .eq('id', id)

    if (!error) loadShoppingList()
  }

  const clearCompleted = async () => {
    if (!familyId) return

    const { error } = await supabase
      .from('grocery_list_items')
      .delete()
      .eq('family_id', familyId)
      .eq('is_checked', true)

    if (!error) loadShoppingList()
  }

  const clearAll = async () => {
    if (!confirm('Are you sure you want to clear all items?')) return
    if (!familyId) return

    const { error } = await supabase
      .from('grocery_list_items')
      .delete()
      .eq('family_id', familyId)

    if (!error) loadShoppingList()
  }

  // Handle receipt processing
  const handleReceiptProcessed = async (receipt: ExtractedReceipt) => {
    if (!familyId) return

    try {
      // Process each receipt item
      for (const receiptItem of receipt.items) {
        // Try to match with existing inventory
        const normalizedName = extractCoreIngredient(receiptItem.name)
        let matchedInventoryItem: InventoryItem | null = null

        for (const invItem of inventoryItems) {
          const invNormalizedName = extractCoreIngredient(invItem.name)
          const similarity = stringSimilarity(normalizedName, invNormalizedName)

          if (similarity >= 0.75) {
            matchedInventoryItem = invItem
            break
          }
        }

        if (matchedInventoryItem) {
          // Update existing inventory item
          await supabase
            .from('inventory_items')
            .update({ quantity_level: 'full' })
            .eq('id', matchedInventoryItem.id)
        } else {
          // Add new inventory item
          await supabase
            .from('inventory_items')
            .insert({
              family_id: familyId,
              name: receiptItem.name,
              category: receiptItem.category || 'other',
              quantity_level: 'full'
            })
        }

        // Record price if available
        if (receiptItem.price && receiptItem.price > 0) {
          await supabase
            .from('ingredient_prices')
            .insert({
              family_id: familyId,
              ingredient_name: receiptItem.name,
              price_usd: receiptItem.price,
              quantity: receiptItem.quantity,
              store_name: receipt.store_name,
              purchase_date: receipt.purchase_date
            })
        }
      }

      // Reload inventory
      await loadInventory()

      // Show success message
      alert(`✅ Receipt processed! Updated ${receipt.items.length} items in inventory.`)
      setShowReceiptScanner(false)
    } catch (error) {
      console.error('Error processing receipt:', error)
      alert('Failed to process receipt. Please try again.')
    }
  }

  // Check if an item is in inventory
  const checkInventoryStatus = (itemName: string) => {
    const normalizedName = extractCoreIngredient(itemName)

    for (const invItem of inventoryItems) {
      const invNormalizedName = extractCoreIngredient(invItem.name)
      const similarity = stringSimilarity(normalizedName, invNormalizedName)

      if (similarity >= 0.75) {
        return {
          inStock: true,
          quantityLevel: invItem.quantity_level,
          expirationDate: invItem.expiration_date
        }
      }
    }

    return null
  }

  // Enhance items with inventory status
  const itemsWithInventory: GroceryItemWithInventory[] = items.map(item => ({
    ...item,
    inventoryStatus: checkInventoryStatus(item.name) || undefined
  }))

  const groupedItems = groupByCategory(itemsWithInventory)
  const completedCount = items.filter(i => i.is_checked).length
  const inStockCount = itemsWithInventory.filter(i => i.inventoryStatus?.inStock).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Shopping List</h1>
            <p className="text-emerald-100">
              {completedCount} of {items.length} items checked off
              {inStockCount > 0 && ` • ${inStockCount} already in inventory`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/inventory"
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              View Inventory
            </Link>
            <Link
              href="/dashboard/calendar"
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              View Calendar
            </Link>
            <button
              onClick={() => setShowReceiptScanner(true)}
              className="bg-white hover:bg-white/90 text-emerald-700 font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 inline-flex items-center gap-2 shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Scan Receipt
            </button>
            <button
              onClick={generateFromMealPlan}
              disabled={generating}
              className="bg-white hover:bg-white/90 disabled:bg-white/50 text-emerald-700 font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 inline-flex items-center gap-2 shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {generating ? 'Generating...' : 'Generate from Meal Plan'}
            </button>
          </div>
        </div>
      </div>

      {/* Add Item Form */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Add Item</h2>
        <form onSubmit={addManualItem} className="flex gap-3">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Item name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <input
            type="text"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            placeholder="Quantity (optional)"
            className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200"
          >
            Add
          </button>
        </form>
      </div>

      {/* Shopping List */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No items yet</h2>
          <p className="text-gray-600 mb-6">
            Generate a shopping list from your meal plan or add items manually
          </p>
          <button
            onClick={generateFromMealPlan}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Generate from Meal Plan
          </button>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 capitalize flex items-center gap-2">
                  {getCategoryIcon(category)}
                  {category || 'Other'}
                </h3>
                <div className="space-y-2">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        item.is_checked ? 'bg-gray-50' : 'bg-emerald-50'
                      }`}
                    >
                      <button
                        onClick={() => toggleItem(item.id, item.is_checked)}
                        className="mt-0.5"
                      >
                        {item.is_checked ? (
                          <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-300 hover:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`text-sm font-medium ${item.is_checked ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {item.name}
                          </div>
                          {item.inventoryStatus?.inStock && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              item.inventoryStatus.quantityLevel === 'full'
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : item.inventoryStatus.quantityLevel === 'medium'
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                : 'bg-orange-100 text-orange-700 border border-orange-200'
                            }`}>
                              ✓ In Stock{item.inventoryStatus.quantityLevel === 'low' ? ' (Low)' : ''}
                            </span>
                          )}
                        </div>
                        {item.quantity && (
                          <div className="text-xs text-gray-500 mt-0.5">{item.quantity}</div>
                        )}
                      </div>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4">
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Clear Completed ({completedCount})
              </button>
            )}
            <button
              onClick={clearAll}
              className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Clear All
            </button>
          </div>
        </>
      )}

      {/* Receipt Scanner Modal */}
      {showReceiptScanner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-900">Scan Receipt</h2>
              <button
                onClick={() => setShowReceiptScanner(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <ReceiptScanner onReceiptProcessed={handleReceiptProcessed} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Extract core ingredient by removing all descriptors and modifiers
function extractCoreIngredient(name: string): string {
  let core = name.toLowerCase().trim()

  // Remove parentheses and their contents
  core = core.replace(/\([^)]*\)/g, '').trim()
  core = core.replace(/\[[^\]]*\]/g, '').trim()

  // Remove all measurement-related words that might have been missed
  core = core.replace(/\b(about|approximately|roughly|around)\b/gi, '').trim()

  // Comprehensive list of descriptors to remove - anything that's optional shopping preference
  const allDescriptors = [
    // Preparation methods
    'fresh', 'frozen', 'canned', 'dried', 'chopped', 'diced', 'sliced',
    'minced', 'crushed', 'ground', 'shredded', 'grated', 'crumbled',
    'peeled', 'deveined', 'trimmed', 'cut', 'halved', 'quartered',
    'julienned', 'cubed', 'chunked', 'mashed', 'pureed', 'blended',

    // Cooking states
    'raw', 'cooked', 'pre-cooked', 'uncooked', 'blanched', 'roasted',
    'grilled', 'baked', 'fried', 'sauteed', 'steamed', 'boiled',
    'rotisserie', 'smoked', 'cured', 'marinated',

    // Quality/source descriptors (user decides at store)
    'organic', 'natural', 'fresh', 'premium', 'artisan', 'local',
    'imported', 'domestic', 'homemade', 'store-bought',
    'free-range', 'cage-free', 'grass-fed', 'pasture-raised',
    'wild-caught', 'farm-raised', 'sustainable',

    // Health/diet descriptors (user decides at store)
    'low-fat', 'reduced-fat', 'fat-free', 'nonfat', 'whole', 'skim',
    'low-sodium', 'reduced-sodium', 'sodium-free', 'no-salt', 'unsalted', 'salted',
    'low-sugar', 'sugar-free', 'unsweetened', 'sweetened', 'no-sugar-added',
    'gluten-free', 'dairy-free', 'vegan', 'vegetarian',
    'light', 'lite', 'diet', 'reduced-calorie',

    // Quality/grade descriptors
    'extra-virgin', 'virgin', 'pure', 'refined', 'unrefined',
    'grade-a', 'grade-b', 'choice', 'select', 'prime',

    // Physical descriptors
    'large', 'medium', 'small', 'extra-large', 'jumbo', 'baby', 'mini',
    'thick', 'thin', 'fine', 'coarse', 'whole', 'half', 'pieces',
    'boneless', 'bone-in', 'skinless', 'skin-on',

    // Color descriptors (usually optional)
    'white', 'red', 'green', 'yellow', 'black', 'brown', 'golden'
  ]

  // Remove descriptors
  allDescriptors.forEach(descriptor => {
    const regex = new RegExp(`\\b${descriptor}\\b`, 'gi')
    core = core.replace(regex, '').trim()
  })

  // Normalize plurals to singular for better matching
  const pluralToSingular: Record<string, string> = {
    'tomatoes': 'tomato',
    'potatoes': 'potato',
    'onions': 'onion',
    'carrots': 'carrot',
    'peppers': 'pepper',
    'mushrooms': 'mushroom',
    'chickens': 'chicken',
    'eggs': 'egg',
    'beans': 'bean',
    'peas': 'pea',
    'berries': 'berry'
  }

  // Apply plural to singular
  Object.entries(pluralToSingular).forEach(([plural, singular]) => {
    const regex = new RegExp(`\\b${plural}\\b`, 'gi')
    core = core.replace(regex, singular)
  })

  // Normalize specific ingredient variations to canonical form
  const canonicalForms: Record<string, string> = {
    // Chicken parts all become "chicken"
    'chicken breast': 'chicken',
    'chicken thigh': 'chicken',
    'chicken leg': 'chicken',
    'chicken wing': 'chicken',
    'chicken drumstick': 'chicken',
    'chicken tender': 'chicken',

    // Stock = broth
    'chicken stock': 'chicken broth',
    'beef stock': 'beef broth',
    'vegetable stock': 'vegetable broth',

    // All oils become "cooking oil" unless specific type is in the name
    'olive oil': 'olive oil',
    'vegetable oil': 'cooking oil',
    'canola oil': 'cooking oil',
    'sunflower oil': 'cooking oil',
    'corn oil': 'cooking oil',

    // Garlic variations
    'garlic clove': 'garlic',
    'clove garlic': 'garlic',

    // Dairy
    'heavy cream': 'cream',
    'whipping cream': 'cream',
    'half-and-half': 'cream',

    // Rice types (keep main variety but remove sub-types)
    'jasmine rice': 'rice',
    'basmati rice': 'rice',
    'arborio rice': 'rice',
    'long-grain rice': 'rice',
    'short-grain rice': 'rice'
  }

  // Apply canonical forms
  for (const [variant, canonical] of Object.entries(canonicalForms)) {
    if (core.includes(variant)) {
      core = canonical
      break
    }
  }

  // Remove extra whitespace and articles
  core = core.replace(/\s+/g, ' ').trim()
  core = core.replace(/^(a|an|the)\s+/gi, '').trim()

  return core || name
}

// Calculate similarity between two strings (for fuzzy matching)
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  // Exact match
  if (s1 === s2) return 1.0

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.85
  }

  // Levenshtein-like similarity (simplified)
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1

  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++
    }
  }

  return matches / longer.length
}

// Find best matching ingredient key or create new one
function findOrCreateIngredientKey(
  newIngredient: string,
  existingKeys: string[],
  threshold: number = 0.75
): string {
  const newCore = extractCoreIngredient(newIngredient)

  // Look for existing similar ingredient
  for (const existingKey of existingKeys) {
    const similarity = stringSimilarity(newCore, existingKey)
    if (similarity >= threshold) {
      return existingKey
    }
  }

  // No match found, return the new core ingredient
  return newCore
}

// Parse ingredient string to extract item name and quantity
function parseIngredient(ingredient: string): { item: string; quantity: string; fullText: string } {
  const text = ingredient.trim()

  // Common patterns: "2 cups chicken broth", "1 lb ground beef", "3 eggs"
  // Extract the main item by removing quantities and measurements from the beginning only
  // Note: size descriptors (large/medium/small) are handled in extractCoreIngredient
  const measurementPattern = /^(\d+\/?\d*|\d*\.?\d+)?\s*(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|pound|pounds|lb|lbs|ounce|ounces|oz|gram|grams|g|kilogram|kilograms|kg|liter|liters|l|milliliter|milliliters|ml|pinch|dash|can|cans|package|packages|pkg|clove|cloves|whole)s?\s+/i

  let itemName = text.replace(measurementPattern, '').trim()

  // Clean up and get the core ingredient name
  itemName = itemName.split(',')[0].trim() // Remove anything after comma (like ", chopped")
  itemName = itemName.split('(')[0].trim() // Remove anything in parentheses

  // Extract core ingredient (removes all optional descriptors)
  const coreIngredient = extractCoreIngredient(itemName)

  return {
    item: coreIngredient || text,
    quantity: text,
    fullText: text
  }
}

// Combine multiple quantity strings intelligently
function combineQuantities(quantities: string[]): string {
  if (quantities.length === 1) {
    return quantities[0]
  }

  // Try to parse and add numeric quantities
  const parsedQuantities: { value: number; unit: string; original: string }[] = []
  const itemCounts = new Map<string, number>() // For counting items like "3 cans"

  quantities.forEach(qty => {
    // Try to match quantity + unit pattern
    const match = qty.match(/^(\d+\.?\d*|\d*\.?\d+|(\d+\s+)?\d+\/\d+)\s*([a-zA-Z]+)/)
    if (match) {
      let value: number
      const numStr = match[1].trim()

      // Handle fractions like "1/2" or "1 1/2"
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

      const unit = match[3] || ''
      parsedQuantities.push({ value, unit: unit.toLowerCase(), original: qty })
    } else {
      // Try to extract just a count (e.g., "3 cans", "2 packages")
      const countMatch = qty.match(/^(\d+)/)
      if (countMatch) {
        const count = parseInt(countMatch[1])
        const key = 'items'
        itemCounts.set(key, (itemCounts.get(key) || 0) + count)
      }
    }
  })

  // Group by unit and sum
  const unitGroups = new Map<string, number>()
  parsedQuantities.forEach(({ value, unit }) => {
    unitGroups.set(unit, (unitGroups.get(unit) || 0) + value)
  })

  // Format combined quantities
  const combined: string[] = []

  unitGroups.forEach((total, unit) => {
    // Format nicely (e.g., 2.5 cups, 3 lbs)
    const formatted = total % 1 === 0 ? total.toString() : total.toFixed(1)
    combined.push(`${formatted} ${unit}${total > 1 && !unit.endsWith('s') ? 's' : ''}`)
  })

  // Add item counts
  itemCounts.forEach((count, key) => {
    if (count > 0) {
      combined.push(`${count} needed`)
    }
  })

  // If nothing was parseable, just show the count
  if (combined.length === 0) {
    return `${quantities.length} needed`
  }

  return combined.join(', ')
}

function categorizeIngredient(ingredient: string): string {
  const lower = ingredient.toLowerCase()

  if (/(apple|banana|orange|lettuce|tomato|carrot|onion|garlic|pepper|fruit|vegetable|spinach|kale|broccoli|cauliflower|potato|celery|cucumber|zucchini|mushroom)/i.test(lower)) {
    return 'produce'
  }
  if (/(milk|cheese|yogurt|butter|cream|dairy|egg|eggs)/i.test(lower)) {
    return 'dairy'
  }
  if (/(chicken|beef|pork|fish|salmon|meat|turkey|lamb|shrimp|bacon|sausage)/i.test(lower)) {
    return 'meat'
  }
  if (/(frozen|ice cream)/i.test(lower)) {
    return 'frozen'
  }
  if (/(flour|sugar|rice|pasta|oil|spice|salt|pepper|bread|broth|stock|sauce|vinegar|soy sauce|honey|syrup)/i.test(lower)) {
    return 'pantry'
  }

  return 'other'
}

function groupByCategory(items: GroceryItemWithInventory[]): Record<string, GroceryItemWithInventory[]> {
  return items.reduce((acc, item) => {
    const category = item.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, GroceryItemWithInventory[]>)
}

function getCategoryIcon(category: string) {
  const icons: Record<string, JSX.Element> = {
    produce: (
      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    dairy: (
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    meat: (
      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    frozen: (
      <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
      </svg>
    ),
    pantry: (
      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  }

  return icons[category] || icons.pantry
}
