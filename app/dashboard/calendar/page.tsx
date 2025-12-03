'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Recipe = {
  id: string
  name: string
  image_url: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  ingredients?: any
}

type RecipeWithScore = Recipe & {
  inventoryScore?: number
  matchedIngredients?: string[]
  expiringIngredients?: string[]
}

type MealPlan = {
  id: string
  recipe_id: string
  planned_date: string
  meal_type: string
  is_completed: boolean
  recipes: Recipe
}

type DayMeals = {
  date: string
  breakfast: MealPlan | null
  lunch: MealPlan | null
  dinner: MealPlan | null
}

type InventoryItem = {
  id: string
  name: string
  category: string
  quantity_level: 'low' | 'medium' | 'full'
  expiration_date: string | null
}

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()))
  const [weekDays, setWeekDays] = useState<DayMeals[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; mealType: string } | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadFamilyId()
  }, [])

  useEffect(() => {
    if (familyId) {
      loadWeekData()
      loadRecipes()
      loadInventory()
    }
  }, [weekStart, familyId])

  const loadFamilyId = async () => {
    // Get the user's family_id
    const { data: families } = await supabase
      .from('families')
      .select('id')
      .single()

    if (families) {
      setFamilyId(families.id)
    }
  }

  const loadWeekData = async () => {
    setLoading(true)
    const days: DayMeals[] = []

    // Generate 7 days starting from weekStart
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      days.push({
        date: dateStr,
        breakfast: null,
        lunch: null,
        dinner: null
      })
    }

    // Load meal plans for the week
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const { data: mealPlans } = await supabase
      .from('meal_plans')
      .select(`
        *,
        recipes (
          id,
          name,
          image_url,
          prep_time_minutes,
          cook_time_minutes
        )
      `)
      .gte('planned_date', weekStart.toISOString().split('T')[0])
      .lte('planned_date', weekEnd.toISOString().split('T')[0])
      .order('planned_date')

    // Organize meal plans by date and meal type
    if (mealPlans) {
      mealPlans.forEach((plan: any) => {
        const dayIndex = days.findIndex(d => d.date === plan.planned_date)
        if (dayIndex >= 0) {
          const mealType = plan.meal_type as 'breakfast' | 'lunch' | 'dinner'
          days[dayIndex][mealType] = plan
        }
      })
    }

    setWeekDays(days)
    setLoading(false)
  }

  const loadRecipes = async () => {
    const { data } = await supabase
      .from('recipes')
      .select('id, name, image_url, prep_time_minutes, cook_time_minutes, ingredients')
      .order('name')

    if (data) setRecipes(data)
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

  const assignRecipe = async (recipeId: string, date: string, mealType: string) => {
    if (!familyId) {
      alert('Family not found. Please refresh the page.')
      return
    }

    const { error } = await supabase
      .from('meal_plans')
      .upsert({
        family_id: familyId,
        recipe_id: recipeId,
        planned_date: date,
        meal_type: mealType
      }, {
        onConflict: 'family_id,planned_date,meal_type'
      })

    if (error) {
      console.error('Error assigning recipe:', error)
      alert(`Failed to add meal: ${error.message}`)
    } else {
      loadWeekData()
      setSelectedSlot(null)
    }
  }

  const removeMeal = async (mealPlanId: string) => {
    const { error } = await supabase
      .from('meal_plans')
      .delete()
      .eq('id', mealPlanId)

    if (!error) {
      loadWeekData()
    }
  }

  const toggleCompleted = async (mealPlanId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('meal_plans')
      .update({ is_completed: !currentStatus })
      .eq('id', mealPlanId)

    if (!error) {
      loadWeekData()
    }
  }

  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() - 7)
    setWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() + 7)
    setWeekStart(newStart)
  }

  const goToToday = () => {
    setWeekStart(getMonday(new Date()))
  }

  // Score recipes based on inventory
  const scoreRecipeByInventory = (recipe: Recipe): RecipeWithScore => {
    if (!recipe.ingredients || inventoryItems.length === 0) {
      return { ...recipe, inventoryScore: 0, matchedIngredients: [], expiringIngredients: [] }
    }

    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : recipe.ingredients.ingredients || []

    const matched: string[] = []
    const expiring: string[] = []
    let score = 0

    ingredients.forEach((ingredient: string) => {
      const coreIngredient = extractCoreIngredient(ingredient)

      for (const invItem of inventoryItems) {
        const invCore = extractCoreIngredient(invItem.name)
        const similarity = stringSimilarity(coreIngredient, invCore)

        if (similarity >= 0.75) {
          matched.push(invItem.name)

          // Higher score for expiring items (use them up!)
          if (isExpiringSoon(invItem.expiration_date)) {
            score += 5
            expiring.push(invItem.name)
          } else {
            score += 2
          }

          // Bonus for items that are full (plentiful)
          if (invItem.quantity_level === 'full') {
            score += 1
          }

          break
        }
      }
    })

    // Bonus for recipes that use many inventory items
    const matchPercentage = ingredients.length > 0 ? matched.length / ingredients.length : 0
    score += matchPercentage * 10

    return {
      ...recipe,
      inventoryScore: score,
      matchedIngredients: matched,
      expiringIngredients: expiring
    }
  }

  const isExpiringSoon = (expirationDate: string | null) => {
    if (!expirationDate) return false
    const today = new Date()
    const expiration = new Date(expirationDate)
    const diffDays = Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 7 && diffDays >= 0
  }

  // Get smart recipe suggestions
  const suggestedRecipes = recipes
    .map(r => scoreRecipeByInventory(r))
    .filter(r => (r.inventoryScore || 0) > 0)
    .sort((a, b) => (b.inventoryScore || 0) - (a.inventoryScore || 0))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Meal Calendar</h1>
            <p className="text-indigo-100">Plan your week and never wonder "what's for dinner?"</p>
          </div>
          <Link
            href="/dashboard/shopping"
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Generate Shopping List
          </Link>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {formatWeekRange(weekStart)}
            </h2>
            <button
              onClick={goToToday}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mt-1"
            >
              Today
            </button>
          </div>

          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading calendar...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayDate = new Date(day.date + 'T12:00:00')
            const isToday = day.date === new Date().toISOString().split('T')[0]

            return (
              <div
                key={day.date}
                className={`bg-white rounded-2xl shadow-md border-2 overflow-hidden ${
                  isToday ? 'border-indigo-500' : 'border-gray-100'
                }`}
              >
                {/* Day Header */}
                <div className={`p-4 ${isToday ? 'bg-indigo-500 text-white' : 'bg-gray-50'}`}>
                  <div className="text-sm font-medium">
                    {dayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-2xl font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                    {dayDate.getDate()}
                  </div>
                </div>

                {/* Meals */}
                <div className="p-3 space-y-3">
                  {['breakfast', 'lunch', 'dinner'].map((mealType) => (
                    <MealSlot
                      key={mealType}
                      mealType={mealType}
                      meal={day[mealType as keyof Omit<DayMeals, 'date'>] as MealPlan | null}
                      onAdd={() => setSelectedSlot({ date: day.date, mealType })}
                      onRemove={removeMeal}
                      onToggleComplete={toggleCompleted}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recipe Selection Modal */}
      {selectedSlot && (
        <RecipeSelectionModal
          recipes={recipes}
          suggestedRecipes={suggestedRecipes}
          onSelect={(recipeId) => assignRecipe(recipeId, selectedSlot.date, selectedSlot.mealType)}
          onClose={() => setSelectedSlot(null)}
          mealType={selectedSlot.mealType}
        />
      )}
    </div>
  )
}

function MealSlot({
  mealType,
  meal,
  onAdd,
  onRemove,
  onToggleComplete
}: {
  mealType: string
  meal: MealPlan | null
  onAdd: () => void
  onRemove: (id: string) => void
  onToggleComplete: (id: string, status: boolean) => void
}) {
  const mealIcons = {
    breakfast: '🌅',
    lunch: '🌞',
    dinner: '🌙'
  }

  if (!meal) {
    return (
      <button
        onClick={onAdd}
        className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
      >
        <div className="text-xs font-medium text-gray-500 group-hover:text-indigo-600 capitalize flex items-center gap-1">
          <span>{mealIcons[mealType as keyof typeof mealIcons]}</span>
          {mealType}
        </div>
        <div className="text-xs text-gray-400 group-hover:text-indigo-500 mt-1">+ Add</div>
      </button>
    )
  }

  return (
    <div className={`p-3 rounded-lg border-2 ${meal.is_completed ? 'bg-green-50 border-green-300' : 'bg-purple-50 border-purple-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-600 capitalize flex items-center gap-1 mb-1">
            <span>{mealIcons[mealType as keyof typeof mealIcons]}</span>
            {mealType}
          </div>
          <div className="text-sm font-semibold text-gray-900 line-clamp-2">
            {meal.recipes.name}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onToggleComplete(meal.id, meal.is_completed)}
            className="p-1 hover:bg-white rounded transition-colors"
            title={meal.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {meal.is_completed ? (
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onRemove(meal.id)}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            title="Remove"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function RecipeSelectionModal({
  recipes,
  suggestedRecipes,
  onSelect,
  onClose,
  mealType
}: {
  recipes: Recipe[]
  suggestedRecipes: RecipeWithScore[]
  onSelect: (recipeId: string) => void
  onClose: () => void
  mealType: string
}) {
  const [search, setSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(true)

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 capitalize">Add {mealType}</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
          </div>
        </div>

        {/* Recipe List */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Smart Suggestions */}
          {suggestedRecipes.length > 0 && !search && showSuggestions && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Smart Suggestions</h3>
                  <span className="text-sm text-gray-500">(Based on your inventory)</span>
                </div>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Hide
                </button>
              </div>
              <div className="grid gap-2">
                {suggestedRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => onSelect(recipe.id)}
                    className="flex items-center gap-4 p-3 bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 rounded-lg transition-all text-left group border-2 border-emerald-200"
                  >
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt={recipe.name}
                        className="w-14 h-14 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-emerald-200 rounded-lg flex items-center justify-center">
                        <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {recipe.name}
                      </div>
                      <div className="text-xs text-emerald-700 mt-1 flex flex-wrap gap-2">
                        {recipe.expiringIngredients && recipe.expiringIngredients.length > 0 && (
                          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                            ⏰ Uses expiring items
                          </span>
                        )}
                        {recipe.matchedIngredients && recipe.matchedIngredients.length > 0 && (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            ✓ {recipe.matchedIngredients.length} items in stock
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">All Recipes</h3>
              </div>
            </div>
          )}

          {filteredRecipes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No recipes found</p>
              <Link
                href="/dashboard/recipes/new"
                className="text-indigo-600 hover:text-indigo-700 font-medium mt-2 inline-block"
              >
                Create a recipe →
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => onSelect(recipe.id)}
                  className="flex items-center gap-4 p-4 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-all text-left group border-2 border-transparent hover:border-indigo-200"
                >
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 group-hover:text-indigo-700">
                      {recipe.name}
                    </div>
                    {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
                      <div className="text-sm text-gray-600 mt-1">
                        {recipe.prep_time_minutes && `${recipe.prep_time_minutes}m prep`}
                        {recipe.prep_time_minutes && recipe.cook_time_minutes && ' • '}
                        {recipe.cook_time_minutes && `${recipe.cook_time_minutes}m cook`}
                      </div>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
  } else {
    return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
  }
}

// Helper functions for ingredient matching (copied from shopping page)
function extractCoreIngredient(name: string): string {
  let core = name.toLowerCase().trim()
  core = core.replace(/\([^)]*\)/g, '').trim()
  core = core.replace(/\[[^\]]*\]/g, '').trim()
  core = core.replace(/\b(about|approximately|roughly|around)\b/gi, '').trim()

  const allDescriptors = [
    'fresh', 'frozen', 'canned', 'dried', 'chopped', 'diced', 'sliced',
    'minced', 'crushed', 'ground', 'shredded', 'grated', 'crumbled',
    'peeled', 'deveined', 'trimmed', 'cut', 'halved', 'quartered',
    'raw', 'cooked', 'pre-cooked', 'uncooked', 'blanched', 'roasted',
    'grilled', 'baked', 'fried', 'sauteed', 'steamed', 'boiled',
    'rotisserie', 'smoked', 'cured', 'marinated',
    'organic', 'natural', 'fresh', 'premium', 'artisan', 'local',
    'low-fat', 'reduced-fat', 'fat-free', 'nonfat', 'whole', 'skim',
    'low-sodium', 'reduced-sodium', 'sodium-free', 'no-salt', 'unsalted', 'salted',
    'extra-virgin', 'virgin', 'pure', 'refined', 'unrefined',
    'large', 'medium', 'small', 'extra-large', 'jumbo', 'baby', 'mini',
    'boneless', 'bone-in', 'skinless', 'skin-on'
  ]

  allDescriptors.forEach(descriptor => {
    const regex = new RegExp(`\\b${descriptor}\\b`, 'gi')
    core = core.replace(regex, '').trim()
  })

  core = core.replace(/\s+/g, ' ').trim()
  core = core.replace(/^(a|an|the)\s+/gi, '').trim()

  return core || name
}

function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) return 0.85

  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1

  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++
  }

  return matches / longer.length
}
