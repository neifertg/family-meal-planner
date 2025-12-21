'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MealPlanRecipe {
  id: string
  recipe_id: string
  display_order: number
  recipes: {
    id: string
    name: string
  }
}

interface YesterdayMeal {
  id: string
  recipe_id: string | null
  meal_type: string
  planned_date: string
  adhoc_meal_name: string | null
  recipes: {
    id: string
    name: string
  } | null
  meal_plan_recipes: MealPlanRecipe[]
}

interface MealConfirmationNotificationProps {
  yesterdayMeals: YesterdayMeal[]
  familyId: string
}

export default function MealConfirmationNotification({
  yesterdayMeals,
  familyId
}: MealConfirmationNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [selectedMealIds, setSelectedMealIds] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    // Check if we should show the notification
    const checkShouldShow = async () => {
      if (!yesterdayMeals || yesterdayMeals.length === 0) {
        return
      }

      // Get yesterday's date
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDate = yesterday.toISOString().split('T')[0]

      // Check if already confirmed today
      const storageKey = `meal_confirmation_${yesterdayDate}`
      const alreadyConfirmed = localStorage.getItem(storageKey)

      if (!alreadyConfirmed) {
        setIsVisible(true)
      }
    }

    checkShouldShow()
  }, [yesterdayMeals])

  const toggleMeal = (mealId: string) => {
    const newSelected = new Set(selectedMealIds)
    if (newSelected.has(mealId)) {
      newSelected.delete(mealId)
    } else {
      newSelected.add(mealId)
    }
    setSelectedMealIds(newSelected)
  }

  const handleConfirmation = async () => {
    setIsConfirming(true)

    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDate = yesterday.toISOString().split('T')[0]

      // Store confirmation in localStorage to avoid re-asking
      const storageKey = `meal_confirmation_${yesterdayDate}`
      localStorage.setItem(storageKey, 'confirmed')

      // If any meals were made, update inventory levels and mark those meals as completed
      if (selectedMealIds.size > 0) {
        const mealIds = Array.from(selectedMealIds)

        const response = await fetch('/api/meals/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mealIds,
            familyId
          })
        })

        const result = await response.json()

        if (result.success) {
          console.log(`Inventory updated: ${result.itemsUpdated} items reduced`)
          if (result.itemsUsed && result.itemsUsed.length > 0) {
            console.log('Items used:', result.itemsUsed.join(', '))
          }
        } else {
          console.error('Failed to update inventory:', result.error)
        }
      }

      // Hide the notification
      setIsVisible(false)
    } catch (error) {
      console.error('Error confirming meals:', error)
    } finally {
      setIsConfirming(false)
    }
  }

  if (!isVisible) {
    return null
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayFormatted = yesterday.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Did you make your planned meals yesterday?
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            You had {yesterdayMeals.length} meal{yesterdayMeals.length !== 1 ? 's' : ''} planned for {yesterdayFormatted}:
          </p>

          <div className="mb-4 space-y-3">
            {yesterdayMeals.map((meal) => {
              // Determine meal display based on type
              const isAdhoc = meal.adhoc_meal_name !== null
              const hasMultipleRecipes = meal.meal_plan_recipes && meal.meal_plan_recipes.length > 1
              const hasRecipes = meal.meal_plan_recipes && meal.meal_plan_recipes.length > 0

              // Sort recipes by display_order
              const sortedRecipes = hasRecipes
                ? [...meal.meal_plan_recipes].sort((a, b) => a.display_order - b.display_order)
                : []

              const isSelected = selectedMealIds.has(meal.id)

              return (
                <div
                  key={meal.id}
                  className={`p-4 rounded-lg transition-all border-2 ${
                    isSelected === undefined
                      ? 'bg-white border-gray-200'
                      : isSelected
                      ? 'bg-green-50 border-green-400'
                      : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <span className="font-semibold capitalize text-gray-900">{meal.meal_type}:</span>
                      {isAdhoc ? (
                        <span className="ml-1 text-gray-700">{meal.adhoc_meal_name}</span>
                      ) : hasRecipes ? (
                        hasMultipleRecipes ? (
                          <div className="ml-1 text-gray-700">
                            {sortedRecipes.map((mpr, index) => (
                              <div key={mpr.id}>
                                {index + 1}. {mpr.recipes.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="ml-1 text-gray-700">{sortedRecipes[0].recipes.name}</span>
                        )
                      ) : (
                        <span className="ml-1 text-gray-700">{meal.recipes?.name || 'Unknown Meal'}</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const newSelected = new Set(selectedMealIds)
                          newSelected.add(meal.id)
                          setSelectedMealIds(newSelected)
                        }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          isSelected
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-green-500 hover:bg-green-50'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => {
                          const newSelected = new Set(selectedMealIds)
                          newSelected.delete(meal.id)
                          setSelectedMealIds(newSelected)
                        }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          isSelected === false || (!selectedMealIds.has(meal.id))
                            ? 'bg-gray-500 text-white shadow-md'
                            : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {selectedMealIds.size > 0
              ? `Selected ${selectedMealIds.size} meal${selectedMealIds.size !== 1 ? 's' : ''}. This will update your inventory levels.`
              : 'Select the meals you made to update your inventory levels.'
            }
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleConfirmation}
              disabled={isConfirming}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConfirming ? 'Confirming...' : selectedMealIds.size > 0 ? 'Confirm' : 'Skip'}
            </button>
            <button
              onClick={() => setIsVisible(false)}
              disabled={isConfirming}
              className="px-6 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-lg hover:from-gray-500 hover:to-gray-600 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss notification"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
