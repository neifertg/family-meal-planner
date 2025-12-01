'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type GroceryItem = {
  id: string
  name: string
  quantity: string | null
  category: string | null
  is_checked: boolean
  recipe_id: string | null
}

export default function ShoppingListPage() {
  const [items, setItems] = useState<GroceryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState('')
  const [newQuantity, setNewQuantity] = useState('')
  const [generating, setGenerating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadShoppingList()
  }, [])

  const loadShoppingList = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('grocery_list_items')
      .select('*')
      .order('is_checked')
      .order('category')
      .order('name')

    if (data) setItems(data)
    setLoading(false)
  }

  const generateFromMealPlan = async () => {
    setGenerating(true)
    try {
      // Get upcoming meal plans (next 7 days)
      const today = new Date().toISOString().split('T')[0]
      const weekLater = new Date()
      weekLater.setDate(weekLater.getDate() + 7)
      const weekLaterStr = weekLater.toISOString().split('T')[0]

      const { data: mealPlans } = await supabase
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

      if (!mealPlans || mealPlans.length === 0) {
        alert('No upcoming meals planned. Add meals to your calendar first!')
        setGenerating(false)
        return
      }

      // Clear existing auto-generated items (those linked to recipes)
      await supabase
        .from('grocery_list_items')
        .delete()
        .not('recipe_id', 'is', null)

      // Aggregate ingredients from all recipes
      const ingredientMap = new Map<string, { quantity: string; recipeId: string }>()

      mealPlans.forEach((plan: any) => {
        const recipe = plan.recipes
        if (!recipe || !recipe.ingredients) return

        const ingredients = Array.isArray(recipe.ingredients)
          ? recipe.ingredients
          : recipe.ingredients.ingredients || []

        ingredients.forEach((ingredient: string) => {
          const normalized = ingredient.toLowerCase().trim()
          if (ingredientMap.has(normalized)) {
            // For now, just keep track of one recipe (could aggregate quantities later)
            ingredientMap.set(normalized, {
              quantity: ingredientMap.get(normalized)!.quantity,
              recipeId: recipe.id
            })
          } else {
            ingredientMap.set(normalized, {
              quantity: ingredient,
              recipeId: recipe.id
            })
          }
        })
      })

      // Insert all aggregated ingredients
      const itemsToInsert = Array.from(ingredientMap.entries()).map(([key, value]) => ({
        name: value.quantity,
        quantity: null,
        category: categorizeIngredient(value.quantity),
        is_checked: false,
        recipe_id: value.recipeId
      }))

      if (itemsToInsert.length > 0) {
        await supabase
          .from('grocery_list_items')
          .insert(itemsToInsert)
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

    const { error } = await supabase
      .from('grocery_list_items')
      .insert({
        name: newItem,
        quantity: newQuantity || null,
        category: categorizeIngredient(newItem),
        is_checked: false,
        recipe_id: null
      })

    if (!error) {
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
    const { error } = await supabase
      .from('grocery_list_items')
      .delete()
      .eq('is_checked', true)

    if (!error) loadShoppingList()
  }

  const clearAll = async () => {
    if (!confirm('Are you sure you want to clear all items?')) return

    const { error } = await supabase
      .from('grocery_list_items')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000')

    if (!error) loadShoppingList()
  }

  const groupedItems = groupByCategory(items)
  const completedCount = items.filter(i => i.is_checked).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Shopping List</h1>
            <p className="text-emerald-100">
              {completedCount} of {items.length} items checked off
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
                        <div className={`text-sm font-medium ${item.is_checked ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.name}
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
    </div>
  )
}

function categorizeIngredient(ingredient: string): string {
  const lower = ingredient.toLowerCase()

  if (/(apple|banana|orange|lettuce|tomato|carrot|onion|garlic|pepper|fruit|vegetable)/i.test(lower)) {
    return 'produce'
  }
  if (/(milk|cheese|yogurt|butter|cream|dairy)/i.test(lower)) {
    return 'dairy'
  }
  if (/(chicken|beef|pork|fish|salmon|meat|turkey)/i.test(lower)) {
    return 'meat'
  }
  if (/(frozen|ice cream)/i.test(lower)) {
    return 'frozen'
  }
  if (/(flour|sugar|rice|pasta|oil|spice|salt|pepper|bread)/i.test(lower)) {
    return 'pantry'
  }

  return 'other'
}

function groupByCategory(items: GroceryItem[]): Record<string, GroceryItem[]> {
  return items.reduce((acc, item) => {
    const category = item.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, GroceryItem[]>)
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
