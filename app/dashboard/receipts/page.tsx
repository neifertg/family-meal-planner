'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ReceiptsPage() {
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null)
  const [totalSpent, setTotalSpent] = useState<number>(0)
  const [receipts, setReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadFamily()
  }, [])

  useEffect(() => {
    if (familyId) {
      loadBudgetData()
    }
  }, [familyId, selectedMonth])

  const loadFamily = async () => {
    // Get family_id from family_members (take first one)
    const { data: memberData, error: memberError } = await supabase
      .from('family_members')
      .select('family_id')
      .limit(1)

    console.log('Member data:', memberData, 'Error:', memberError)

    if (memberData && memberData.length > 0 && memberData[0]?.family_id) {
      setFamilyId(memberData[0].family_id)

      // Get family budget
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .select('monthly_budget')
        .eq('id', memberData[0].family_id)
        .single()

      console.log('Family data:', familyData, 'Error:', familyError)

      if (familyData) {
        setMonthlyBudget(familyData.monthly_budget || null)
      }
    }
  }

  const loadBudgetData = async () => {
    if (!familyId) {
      console.log('No familyId, skipping loadBudgetData')
      return
    }

    console.log('Loading budget data for familyId:', familyId)
    setLoading(true)

    const firstDayOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
    const lastDayOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

    console.log('Date range:', firstDayOfMonth.toISOString().split('T')[0], 'to', lastDayOfMonth.toISOString().split('T')[0])

    // Get all receipt scans for this month that have been applied to budget
    const { data: receiptScans, error: scansError } = await supabase
      .from('receipt_scans')
      .select(`
        id,
        store_name,
        purchase_date,
        confidence_score,
        applied_to_budget,
        created_at
      `)
      .eq('family_id', familyId)
      .eq('applied_to_budget', true)
      .gte('purchase_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('purchase_date', lastDayOfMonth.toISOString().split('T')[0])
      .order('purchase_date', { ascending: false })

    console.log('Receipt scans:', receiptScans, 'Error:', scansError)

    if (receiptScans) {
      // For each receipt, get the items and calculate total
      const receiptsWithTotals = await Promise.all(
        receiptScans.map(async (receipt) => {
          const { data: items, error: itemsError } = await supabase
            .from('receipt_item_corrections')
            .select('corrected_name, corrected_price, corrected_quantity')
            .eq('receipt_scan_id', receipt.id)
            .eq('was_removed', false)

          console.log(`Items for receipt ${receipt.id}:`, items, 'Error:', itemsError)

          const total = items?.reduce((sum, item) => sum + (item.corrected_price || 0), 0) || 0

          return {
            ...receipt,
            items: items || [],
            total
          }
        })
      )

      console.log('Receipts with totals:', receiptsWithTotals)

      setReceipts(receiptsWithTotals)
      const monthTotal = receiptsWithTotals.reduce((sum, r) => sum + r.total, 0)
      setTotalSpent(monthTotal)
    }

    setLoading(false)
  }

  const percentageSpent = monthlyBudget ? (totalSpent / monthlyBudget) * 100 : 0
  const remaining = monthlyBudget ? monthlyBudget - totalSpent : 0

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))
  }

  const prevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))
  }

  const isCurrentMonth = () => {
    const now = new Date()
    return selectedMonth.getMonth() === now.getMonth() &&
           selectedMonth.getFullYear() === now.getFullYear()
  }

  const handleEditBudget = () => {
    setBudgetInput(monthlyBudget?.toString() || '')
    setIsEditingBudget(true)
  }

  const handleSaveBudget = async () => {
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

    if (error) {
      console.error('Error updating budget:', error)
      alert('Failed to update budget')
    } else {
      setMonthlyBudget(newBudget)
      setIsEditingBudget(false)
    }
  }

  const handleCancelBudget = () => {
    setIsEditingBudget(false)
    setBudgetInput('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Budget & Receipts
            </h1>
            <p className="text-gray-600 mt-2">Track your monthly grocery spending</p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Month Selector */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              {isCurrentMonth() && (
                <span className="ml-2 text-sm font-normal text-indigo-600">(Current Month)</span>
              )}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Budget Overview */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Budget Overview</h2>
            {!isEditingBudget && (
              <button
                onClick={handleEditBudget}
                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {monthlyBudget ? 'Edit Budget' : 'Set Budget'}
              </button>
            )}
          </div>

          {isEditingBudget ? (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="text-sm text-blue-700 font-medium mb-2">Set Monthly Budget</div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">$</span>
                  <input
                    type="number"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                    step="0.01"
                    min="0"
                  />
                </div>
                <button
                  onClick={handleSaveBudget}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelBudget}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-700 font-medium mb-1">Monthly Budget</div>
                <div className="text-2xl font-bold text-blue-900">
                  {monthlyBudget ? `$${monthlyBudget.toFixed(2)}` : 'Not set'}
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-700 font-medium mb-1">Total Spent</div>
                <div className="text-2xl font-bold text-purple-900">${totalSpent.toFixed(2)}</div>
              </div>

              <div className={`rounded-lg p-4 ${remaining >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className={`text-sm font-medium mb-1 ${remaining >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  Remaining
                </div>
                <div className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  ${Math.abs(remaining).toFixed(2)}
                  {remaining < 0 && ' over'}
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {monthlyBudget && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Budget Progress</span>
                <span className="text-sm font-medium text-gray-900">{percentageSpent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all duration-500 ${
                    percentageSpent > 100
                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                      : percentageSpent > 80
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500'
                  }`}
                  style={{ width: `${Math.min(percentageSpent, 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Receipts List */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Receipts ({receipts.length})</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading receipts...</p>
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 text-lg">No receipts for this month</p>
              <p className="text-gray-400 text-sm mt-2">
                Scan receipts from the inventory page and apply them to your budget
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-gray-900 text-lg">
                        {receipt.store_name || 'Unknown Store'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(receipt.purchase_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-600">
                        ${receipt.total.toFixed(2)}
                      </div>
                      {receipt.confidence_score && (
                        <div className="text-xs text-gray-500 mt-1">
                          {receipt.confidence_score}% confidence
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Items ({receipt.items.length})
                    </div>
                    <div className="space-y-1">
                      {receipt.items.slice(0, 5).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {item.corrected_quantity && `${item.corrected_quantity} `}
                            {item.corrected_name}
                          </span>
                          <span className="text-gray-900 font-medium">
                            ${item.corrected_price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {receipt.items.length > 5 && (
                        <div className="text-sm text-gray-500 italic">
                          + {receipt.items.length - 5} more items
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
