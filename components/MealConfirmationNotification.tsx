'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface YesterdayMeal {
  id: string
  recipe_id: string
  meal_type: string
  planned_date: string
  recipes: {
    id: string
    name: string
  }
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

  const handleConfirmation = async (madeMeals: boolean) => {
    setIsConfirming(true)

    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDate = yesterday.toISOString().split('T')[0]

      // Store confirmation in localStorage to avoid re-asking
      const storageKey = `meal_confirmation_${yesterdayDate}`
      localStorage.setItem(storageKey, madeMeals ? 'yes' : 'no')

      // If meals were made, update inventory levels and mark meals as completed
      if (madeMeals) {
        const mealIds = yesterdayMeals.map(meal => meal.id)

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

          <div className="mb-4 space-y-2">
            {yesterdayMeals.map((meal) => (
              <div
                key={meal.id}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                <span className="font-medium capitalize">{meal.meal_type}:</span>
                <span>{meal.recipes?.name || 'Unknown Recipe'}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-600 mb-4">
            This helps us track when to update your inventory levels.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => handleConfirmation(true)}
              disabled={isConfirming}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConfirming ? 'Confirming...' : 'Yes, I made them'}
            </button>
            <button
              onClick={() => handleConfirmation(false)}
              disabled={isConfirming}
              className="px-6 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-lg hover:from-gray-500 hover:to-gray-600 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConfirming ? 'Confirming...' : 'No, I didn\'t'}
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
