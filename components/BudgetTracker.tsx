'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type BudgetTrackerProps = {
  familyId: string | null
}

export default function BudgetTracker({ familyId }: BudgetTrackerProps) {
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null)
  const [totalSpent, setTotalSpent] = useState<number>(0)
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    if (familyId) {
      loadBudgetData()
    }
  }, [familyId])

  const loadBudgetData = async () => {
    if (!familyId) return

    setLoading(true)

    // Load monthly budget from families table
    const { data: familyData } = await supabase
      .from('families')
      .select('monthly_budget')
      .eq('id', familyId)
      .single()

    if (familyData) {
      setMonthlyBudget(familyData.monthly_budget)
      setBudgetInput(familyData.monthly_budget?.toString() || '')
    }

    // Calculate total spent this month from actual receipts
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // Get all receipt scans for this month that have been applied to budget
    const { data: receiptScans } = await supabase
      .from('receipt_scans')
      .select('id')
      .eq('family_id', familyId)
      .eq('applied_to_budget', true)  // Only count receipts applied to budget
      .gte('purchase_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('purchase_date', lastDayOfMonth.toISOString().split('T')[0])

    if (receiptScans && receiptScans.length > 0) {
      const receiptIds = receiptScans.map(r => r.id)

      // Get all items from these receipts and sum their prices
      const { data: items } = await supabase
        .from('receipt_item_corrections')
        .select('corrected_price')
        .in('receipt_scan_id', receiptIds)
        .eq('was_removed', false)

      if (items) {
        const total = items.reduce((sum, item) => sum + (item.corrected_price || 0), 0)
        setTotalSpent(total)
      }
    }

    setLoading(false)
  }

  const handleUpdateBudget = async () => {
    if (!familyId) return

    const newBudget = parseFloat(budgetInput)
    if (isNaN(newBudget) || newBudget < 0) {
      alert('Please enter a valid budget amount')
      return
    }

    const { error } = await supabase
      .from('families')
      .update({ monthly_budget: newBudget })
      .eq('id', familyId)

    if (!error) {
      setMonthlyBudget(newBudget)
      setIsEditingBudget(false)
    }
  }

  if (loading || !familyId) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    )
  }

  const percentUsed = monthlyBudget ? (totalSpent / monthlyBudget) * 100 : 0
  const remaining = (monthlyBudget || 0) - totalSpent
  const isOverBudget = remaining < 0

  // Calculate days remaining in month
  const now = new Date()
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysRemaining = Math.ceil((lastDayOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-bold text-gray-900">Monthly Budget</h3>
        </div>
        {!isEditingBudget && (
          <button
            onClick={() => setIsEditingBudget(true)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Edit Budget
          </button>
        )}
      </div>

      {isEditingBudget ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Budget
            </label>
            <input
              type="number"
              step="0.01"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter budget amount"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleUpdateBudget}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditingBudget(false)
                setBudgetInput(monthlyBudget?.toString() || '')
              }}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {monthlyBudget ? (
            <>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Spent this month:</span>
                  <span className="font-semibold text-gray-900">${totalSpent.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Budget:</span>
                  <span className="font-semibold text-gray-900">${monthlyBudget.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining:</span>
                  <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(remaining).toFixed(2)} {isOverBudget && 'over'}
                  </span>
                </div>
              </div>

              {/* Progress Bar with Gradient */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 font-medium">{percentUsed.toFixed(0)}% used</span>
                  <span className="text-gray-500">{daysRemaining} days left</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                  <div
                    className={`h-4 rounded-full transition-all duration-500 ${
                      isOverBudget
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : percentUsed > 80
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                        : percentUsed > 50
                        ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                        : 'bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500'
                    } ${!isOverBudget && percentUsed < 50 ? 'shadow-lg shadow-green-200' : ''}`}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  ></div>
                </div>
              </div>

              {isOverBudget && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    ⚠️ You're ${Math.abs(remaining).toFixed(2)} over budget this month
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-600 mb-3">No monthly budget set</p>
              <button
                onClick={() => setIsEditingBudget(true)}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Set Budget
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
