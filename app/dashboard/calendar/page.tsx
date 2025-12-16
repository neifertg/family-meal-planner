'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import RecipeRating from '@/components/RecipeRating'
import SeasonalProduceDialog from '@/components/SeasonalProduceDialog'

type Recipe = {
  id: string
  name: string
  image_url: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  ingredients?: any
  estimated_cost_usd: number | null
  cost_per_serving_usd: number | null
}

type RecipeWithScore = Recipe & {
  inventoryScore?: number
  matchedIngredients?: string[]
  expiringIngredients?: string[]
}

type MealPlanRecipe = {
  id: string
  recipe_id: string
  display_order: number
  recipes: Recipe
}

type MealPlan = {
  id: string
  recipe_id: string | null
  planned_date: string
  meal_type: string
  is_completed: boolean
  guest_count: number
  recipes: Recipe | null // Deprecated: kept for backward compatibility
  meal_plan_recipes: MealPlanRecipe[]
  adhoc_meal_name: string | null
  adhoc_ingredients: string[] | null
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
  const [familyMemberCount, setFamilyMemberCount] = useState<number>(0)
  const [guestCount, setGuestCount] = useState<number>(0)
  const [selectedMealForRating, setSelectedMealForRating] = useState<MealPlan | null>(null)
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
      .limit(1)
      .maybeSingle()

    if (families) {
      setFamilyId(families.id)

      // Load family member count
      const { data: members } = await supabase
        .from('family_members')
        .select('id')
        .eq('family_id', families.id)

      if (members) {
        setFamilyMemberCount(members.length)
      }
    }
  }

  const loadWeekData = async () => {
    setLoading(true)
    const days: DayMeals[] = []

    // Generate 7 days starting from weekStart
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      // Use local date string to avoid timezone issues
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

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

    // Format dates as local date strings to avoid timezone issues
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

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
        ),
        meal_plan_recipes (
          id,
          recipe_id,
          display_order,
          recipes (
            id,
            name,
            image_url,
            prep_time_minutes,
            cook_time_minutes,
            estimated_cost_usd,
            cost_per_serving_usd
          )
        )
      `)
      .gte('planned_date', formatLocalDate(weekStart))
      .lte('planned_date', formatLocalDate(weekEnd))
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
      .select('id, name, image_url, prep_time_minutes, cook_time_minutes, ingredients, estimated_cost_usd, cost_per_serving_usd')
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

  const assignRecipes = async (recipeIds: string[], date: string, mealType: string) => {
    if (!familyId) {
      alert('Family not found. Please refresh the page.')
      return
    }

    if (recipeIds.length === 0) {
      alert('Please select at least one recipe')
      return
    }

    // First, create or update the meal plan
    // Set recipe_id to the first recipe to satisfy the constraint
    const { data: mealPlan, error: mealError } = await supabase
      .from('meal_plans')
      .upsert({
        family_id: familyId,
        recipe_id: recipeIds[0], // Set to first recipe to satisfy constraint
        planned_date: date,
        meal_type: mealType,
        guest_count: guestCount,
        adhoc_meal_name: null, // Clear any adhoc meal
        adhoc_ingredients: null
      }, {
        onConflict: 'family_id,planned_date,meal_type'
      })
      .select()
      .single()

    if (mealError) {
      console.error('Error creating meal plan:', mealError)
      alert(`Failed to add meal: ${mealError.message}`)
      return
    }

    // Delete existing recipe associations for this meal plan
    const { error: deleteError } = await supabase
      .from('meal_plan_recipes')
      .delete()
      .eq('meal_plan_id', mealPlan.id)

    if (deleteError) {
      console.error('Error clearing old recipes:', deleteError)
    }

    // Insert new recipe associations
    const mealPlanRecipes = recipeIds.map((recipeId, index) => ({
      meal_plan_id: mealPlan.id,
      recipe_id: recipeId,
      display_order: index
    }))

    const { error: insertError } = await supabase
      .from('meal_plan_recipes')
      .insert(mealPlanRecipes)

    if (insertError) {
      console.error('Error assigning recipes:', insertError)
      alert(`Failed to add recipes: ${insertError.message}`)
    } else {
      loadWeekData()
      setSelectedSlot(null)
    }
  }

  // Legacy function for single recipe (kept for backward compatibility)
  const assignRecipe = async (recipeId: string, date: string, mealType: string) => {
    await assignRecipes([recipeId], date, mealType)
  }

  const assignAdhocMeal = async (mealName: string, ingredients: string[], date: string, mealType: string) => {
    if (!familyId) {
      alert('Family not found. Please refresh the page.')
      return
    }

    const { error } = await supabase
      .from('meal_plans')
      .upsert({
        family_id: familyId,
        adhoc_meal_name: mealName,
        adhoc_ingredients: ingredients.length > 0 ? ingredients : null,
        planned_date: date,
        meal_type: mealType,
        guest_count: guestCount
      }, {
        onConflict: 'family_id,planned_date,meal_type'
      })

    if (error) {
      console.error('Error assigning adhoc meal:', error)
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

  // Calculate weekly budget based on planned meals
  const weeklyBudget = weekDays.reduce((total, day) => {
    let dayTotal = 0

    // Add cost for each meal (only recipe-based meals have cost estimates)
    const meals = [day.breakfast, day.lunch, day.dinner]
    meals.forEach(meal => {
      if (meal && meal.recipes?.estimated_cost_usd) {
        dayTotal += meal.recipes.estimated_cost_usd
      }
    })

    return total + dayTotal
  }, 0)

  // Count total meals planned
  const totalMealsPlanned = weekDays.reduce((count, day) => {
    return count + [day.breakfast, day.lunch, day.dinner].filter(m => m !== null).length
  }, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Meal Calendar</h1>
            <p className="text-indigo-100">Plan your week and never wonder "what's for dinner?"</p>
            {totalMealsPlanned > 0 && weeklyBudget > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">
                  Weekly Budget: ${weeklyBudget.toFixed(2)}
                </span>
                <span className="text-indigo-200">•</span>
                <span className="text-indigo-100">
                  {totalMealsPlanned} meal{totalMealsPlanned !== 1 ? 's' : ''}
                </span>
              </div>
            )}
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

      {/* Seasonal Produce */}
      <SeasonalProduceDialog />

      {/* Calendar Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading calendar...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {weekDays.map((day) => {
            // Parse the date string to create a local date
            const [year, month, dayNum] = day.date.split('-').map(Number)
            const dayDate = new Date(year, month - 1, dayNum)

            // Get today's date in local format
            const today = new Date()
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            const isToday = day.date === todayStr

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
                      onViewDetails={setSelectedMealForRating}
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
          onSelectMultiple={(recipeIds) => assignRecipes(recipeIds, selectedSlot.date, selectedSlot.mealType)}
          onSelectAdhoc={(mealName, ingredients) => assignAdhocMeal(mealName, ingredients, selectedSlot.date, selectedSlot.mealType)}
          onClose={() => setSelectedSlot(null)}
          mealType={selectedSlot.mealType}
          selectedDate={selectedSlot.date}
          familyMemberCount={familyMemberCount}
          guestCount={guestCount}
          setGuestCount={setGuestCount}
        />
      )}

      {/* Recipe Details & Rating Modal */}
      {selectedMealForRating && (
        <RecipeDetailsModal
          meal={selectedMealForRating}
          onClose={() => setSelectedMealForRating(null)}
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
  onToggleComplete,
  onViewDetails
}: {
  mealType: string
  meal: MealPlan | null
  onAdd: () => void
  onRemove: (id: string) => void
  onToggleComplete: (id: string, status: boolean) => void
  onViewDetails?: (meal: MealPlan) => void
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

  const isAdhoc = meal.adhoc_meal_name !== null
  const hasMultipleRecipes = meal.meal_plan_recipes && meal.meal_plan_recipes.length > 1
  const hasRecipes = meal.meal_plan_recipes && meal.meal_plan_recipes.length > 0

  // Sort recipes by display_order
  const sortedRecipes = hasRecipes
    ? [...meal.meal_plan_recipes].sort((a, b) => a.display_order - b.display_order)
    : []

  // Calculate total cost for all recipes
  const totalCost = sortedRecipes.reduce((sum, mpr) => {
    return sum + (mpr.recipes.estimated_cost_usd || 0)
  }, 0)

  return (
    <div className={`p-3 rounded-lg border-2 ${meal.is_completed ? 'bg-green-50 border-green-300' : isAdhoc ? 'bg-amber-50 border-amber-200' : 'bg-purple-50 border-purple-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-600 capitalize flex items-center gap-1 mb-1">
            <span>{mealIcons[mealType as keyof typeof mealIcons]}</span>
            {mealType}
            {isAdhoc && <span className="text-xs text-amber-600 font-normal ml-1">(Quick Meal)</span>}
            {hasMultipleRecipes && <span className="text-xs text-purple-600 font-normal ml-1">({sortedRecipes.length} recipes)</span>}
          </div>

          {/* Display multiple recipes */}
          {hasRecipes ? (
            <div className="space-y-1">
              {sortedRecipes.map((mpr, index) => (
                <Link
                  key={mpr.id}
                  href={`/dashboard/recipes/${mpr.recipe_id}`}
                  className="text-sm font-semibold text-gray-900 line-clamp-1 transition-colors text-left hover:text-indigo-600 block"
                >
                  {hasMultipleRecipes && <span className="text-gray-500 mr-1">{index + 1}.</span>}
                  {mpr.recipes.name}
                </Link>
              ))}
            </div>
          ) : isAdhoc ? (
            <div className="text-sm font-semibold text-gray-900 line-clamp-2">
              {meal.adhoc_meal_name}
            </div>
          ) : null}

          <div className="flex items-center gap-2 mt-1">
            {totalCost > 0 && (
              <div className="text-xs text-green-700 font-medium">
                ${totalCost.toFixed(2)}
              </div>
            )}
            {meal.guest_count > 0 && (
              <div className="text-xs text-indigo-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                +{meal.guest_count} guest{meal.guest_count !== 1 ? 's' : ''}
              </div>
            )}
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
  onSelectMultiple,
  onSelectAdhoc,
  onClose,
  mealType,
  selectedDate,
  familyMemberCount,
  guestCount,
  setGuestCount
}: {
  recipes: Recipe[]
  suggestedRecipes: RecipeWithScore[]
  onSelect: (recipeId: string) => void
  onSelectMultiple: (recipeIds: string[]) => void
  onSelectAdhoc: (mealName: string, ingredients: string[]) => void
  onClose: () => void
  mealType: string
  selectedDate: string
  familyMemberCount: number
  guestCount: number
  setGuestCount: (count: number) => void
}) {
  const [search, setSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [viewMode, setViewMode] = useState<'recipe' | 'adhoc'>('recipe')
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([])

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleRecipeSelection = (recipeId: string) => {
    if (selectedRecipeIds.includes(recipeId)) {
      setSelectedRecipeIds(selectedRecipeIds.filter(id => id !== recipeId))
    } else {
      setSelectedRecipeIds([...selectedRecipeIds, recipeId])
    }
  }

  const handleRecipeClick = (recipeId: string) => {
    if (multiSelectMode) {
      toggleRecipeSelection(recipeId)
    } else {
      onSelect(recipeId)
    }
  }

  const handleAddSelectedRecipes = () => {
    if (selectedRecipeIds.length > 0) {
      onSelectMultiple(selectedRecipeIds)
    }
  }

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

          {/* Tab Switcher */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setViewMode('recipe')
                setMultiSelectMode(false)
                setSelectedRecipeIds([])
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                viewMode === 'recipe'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              From Recipe
            </button>
            <button
              onClick={() => {
                setViewMode('adhoc')
                setMultiSelectMode(false)
                setSelectedRecipeIds([])
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                viewMode === 'adhoc'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Quick Meal
            </button>
          </div>

          {/* Multi-select toggle - Only show in recipe mode */}
          {viewMode === 'recipe' && (
            <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiSelectMode}
                  onChange={(e) => {
                    setMultiSelectMode(e.target.checked)
                    if (!e.target.checked) {
                      setSelectedRecipeIds([])
                    }
                  }}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    Select Multiple Recipes
                    {multiSelectMode && selectedRecipeIds.length > 0 && (
                      <span className="text-sm bg-purple-600 text-white px-2 py-0.5 rounded-full">
                        {selectedRecipeIds.length} selected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">For big meals that require multiple recipes</div>
                </div>
              </label>
            </div>
          )}

          {/* Search - Only show in recipe mode */}
          {viewMode === 'recipe' && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search recipes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                autoFocus
              />
            </div>
          )}

          {/* Guest Count */}
          <div className="mt-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 rounded-full p-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Total People: {familyMemberCount + guestCount}
                  </div>
                  <div className="text-xs text-gray-600">
                    {familyMemberCount} family member{familyMemberCount !== 1 ? 's' : ''} + {guestCount} guest{guestCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGuestCount(Math.max(0, guestCount - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={guestCount === 0}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="w-12 text-center font-semibold text-gray-900">{guestCount}</span>
                <button
                  onClick={() => setGuestCount(guestCount + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'recipe' ? (
            <>
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
                    onClick={() => handleRecipeClick(recipe.id)}
                    className={`flex items-center gap-4 p-3 bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 rounded-lg transition-all text-left group border-2 ${
                      multiSelectMode && selectedRecipeIds.includes(recipe.id)
                        ? 'border-purple-500 ring-2 ring-purple-200'
                        : 'border-emerald-200'
                    }`}
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
            <>
            <div className="grid gap-3">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => handleRecipeClick(recipe.id)}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all text-left group border-2 ${
                    multiSelectMode && selectedRecipeIds.includes(recipe.id)
                      ? 'bg-purple-100 border-purple-500 ring-2 ring-purple-200'
                      : 'bg-gray-50 hover:bg-indigo-50 border-transparent hover:border-indigo-200'
                  }`}
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
            </>
          )}

          {/* Add Selected Recipes Button - Only show in multi-select mode */}
          {multiSelectMode && selectedRecipeIds.length > 0 && (
            <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 mt-4">
              <button
                onClick={handleAddSelectedRecipes}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add {selectedRecipeIds.length} Recipe{selectedRecipeIds.length !== 1 ? 's' : ''} to Meal
              </button>
            </div>
          )}
            </>
          ) : (
            <AdhocMealForm
              mealType={mealType}
              familyMemberCount={familyMemberCount}
              guestCount={guestCount}
              onSave={onSelectAdhoc}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function AdhocMealForm({
  mealType,
  familyMemberCount,
  guestCount,
  onSave,
  onClose
}: {
  mealType: string
  familyMemberCount: number
  guestCount: number
  onSave: (mealName: string, ingredients: string[]) => void
  onClose: () => void
}) {
  const [mealName, setMealName] = useState('')
  const [ingredientInput, setIngredientInput] = useState('')
  const [ingredients, setIngredients] = useState<string[]>([])

  const addIngredient = () => {
    const trimmed = ingredientInput.trim()
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients([...ingredients, trimmed])
      setIngredientInput('')
    }
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    if (!mealName.trim()) {
      alert('Please enter a meal name')
      return
    }

    onSave(mealName.trim(), ingredients)
  }

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Quick Meal</h3>
            <p className="text-sm text-amber-800">
              Perfect for simple meals like leftovers, eggs and toast, or cereal. Add ingredients to include them in your shopping list.
            </p>
          </div>
        </div>
      </div>

      {/* Meal Name */}
      <div>
        <label htmlFor="mealName" className="block text-sm font-semibold text-gray-700 mb-2">
          Meal Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="mealName"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          placeholder="e.g., Leftovers, Eggs and Toast, Cereal"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-lg text-gray-900 placeholder:text-gray-400"
          autoFocus
        />
      </div>

      {/* Ingredients */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Ingredients (Optional)
        </label>
        <p className="text-sm text-gray-600 mb-3">
          Add ingredients that will be included in your shopping list
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={ingredientInput}
            onChange={(e) => setIngredientInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
            placeholder="Type an ingredient and press Enter"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
          />
          <button
            onClick={addIngredient}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
          >
            Add
          </button>
        </div>

        {/* Ingredient List */}
        {ingredients.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Ingredients ({ingredients.length})</h4>
            <div className="flex flex-wrap gap-2">
              {ingredients.map((ingredient, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg"
                >
                  <span>{ingredient}</span>
                  <button
                    onClick={() => removeIngredient(index)}
                    className="hover:text-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* People Count Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>
            Serving {familyMemberCount} family member{familyMemberCount !== 1 ? 's' : ''}
            {guestCount > 0 && ` + ${guestCount} guest${guestCount !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onClose}
          className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!mealName.trim()}
          className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Meal
        </button>
      </div>
    </div>
  )
}

function RecipeDetailsModal({
  meal,
  onClose
}: {
  meal: MealPlan
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{meal.recipes?.name}</h2>
            {meal.guest_count > 0 && (
              <p className="text-sm text-indigo-600 mt-1">
                Serving {meal.guest_count} guest{meal.guest_count !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Recipe Image */}
          {meal.recipes.image_url && (
            <div className="mb-6 rounded-lg overflow-hidden">
              <img
                src={meal.recipes.image_url}
                alt={meal.recipes.name}
                className="w-full h-64 object-cover"
              />
            </div>
          )}

          {/* Recipe Info */}
          {(meal.recipes.prep_time_minutes || meal.recipes.cook_time_minutes) && (
            <div className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              {meal.recipes.prep_time_minutes && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold">{meal.recipes.prep_time_minutes}m</span> prep
                  </span>
                </div>
              )}
              {meal.recipes.cook_time_minutes && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold">{meal.recipes.cook_time_minutes}m</span> cook
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Ratings Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Family Ratings</h3>
            <RecipeRating
              recipeId={meal.recipe_id}
              recipeName={meal.recipes.name}
            />
          </div>
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
