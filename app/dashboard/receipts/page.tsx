'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ReceiptScanner from '@/components/ReceiptScanner'
import { ExtractedReceipt } from '@/lib/receiptScanner/types'

export default function ReceiptsPage() {
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null)
  const [totalSpent, setTotalSpent] = useState<number>(0)
  const [receipts, setReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [showReceiptScanner, setShowReceiptScanner] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null)
  const [editingItems, setEditingItems] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadFamily()

    // Check if we should open the scanner automatically (from dashboard button)
    const params = new URLSearchParams(window.location.search)
    if (params.get('openScanner') === 'true') {
      // Wait a bit for familyId to load
      setTimeout(() => {
        setShowReceiptScanner(true)
        // Remove query param from URL
        window.history.replaceState({}, '', '/dashboard/receipts')
      }, 500)
    }
  }, [])

  useEffect(() => {
    if (familyId) {
      loadBudgetData()
    }
  }, [familyId, selectedMonth])

  const loadFamily = async () => {
    console.log('[ReceiptsPage] Loading family data...')
    // Get family_id from family_members (take first one)
    const { data: memberData, error: memberError } = await supabase
      .from('family_members')
      .select('family_id')
      .limit(1)

    console.log('[ReceiptsPage] Member data loaded:', { memberData, error: memberError })

    if (memberData && memberData.length > 0 && memberData[0]?.family_id) {
      console.log('[ReceiptsPage] Setting familyId:', memberData[0].family_id)
      setFamilyId(memberData[0].family_id)

      // Get family budget
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .select('monthly_budget')
        .eq('id', memberData[0].family_id)
        .single()

      console.log('[ReceiptsPage] Family budget loaded:', { familyData, error: familyError })

      if (familyData) {
        setMonthlyBudget(familyData.monthly_budget || null)
      }
    } else {
      console.error('[ReceiptsPage] No family member data found')
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

  const handleReceiptProcessed = async (receipt: ExtractedReceipt, applyToBudget: boolean) => {
    if (!familyId) return

    try {
      // The receipt scanner already handles saving to the database
      // Just reload the budget data to show the new receipt
      if (applyToBudget) {
        await loadBudgetData()
      }
      setShowReceiptScanner(false)
    } catch (error) {
      console.error('Error processing receipt:', error)
    }
  }

  const handleViewReceipt = (receipt: any) => {
    console.log('[ReceiptsPage] Opening receipt for viewing/editing', receipt)
    setSelectedReceipt(receipt)
    setEditingItems([...receipt.items])
  }

  const handleCloseReceiptModal = () => {
    setSelectedReceipt(null)
    setEditingItems([])
  }

  const handleItemEdit = (index: number, field: string, value: any) => {
    const updated = [...editingItems]
    updated[index] = { ...updated[index], [field]: value }
    setEditingItems(updated)
  }

  const handleItemRemove = (index: number) => {
    setEditingItems(editingItems.filter((_, i) => i !== index))
  }

  const handleSaveReceipt = async () => {
    if (!selectedReceipt) return

    setIsSaving(true)
    console.log('[ReceiptsPage] Saving receipt changes...', {
      receiptId: selectedReceipt.id,
      originalItemCount: selectedReceipt.items.length,
      newItemCount: editingItems.length
    })

    try {
      // Delete all existing items for this receipt
      const { error: deleteError } = await supabase
        .from('receipt_item_corrections')
        .delete()
        .eq('receipt_scan_id', selectedReceipt.id)

      if (deleteError) {
        console.error('[ReceiptsPage] Error deleting old items:', deleteError)
        alert('Failed to save changes. Please try again.')
        setIsSaving(false)
        return
      }

      // Insert updated items
      const itemsToInsert = editingItems.map(item => ({
        receipt_scan_id: selectedReceipt.id,
        family_id: familyId,
        ai_extracted_name: item.corrected_name, // Keep original as "AI extracted"
        ai_extracted_quantity: item.corrected_quantity,
        ai_extracted_price: item.corrected_price,
        ai_extracted_category: item.corrected_category,
        corrected_name: item.corrected_name,
        corrected_quantity: item.corrected_quantity,
        corrected_price: item.corrected_price,
        corrected_category: item.corrected_category,
        was_corrected: false,
        was_removed: false
      }))

      const { error: insertError } = await supabase
        .from('receipt_item_corrections')
        .insert(itemsToInsert)

      if (insertError) {
        console.error('[ReceiptsPage] Error inserting updated items:', insertError)
        alert('Failed to save changes. Please try again.')
        setIsSaving(false)
        return
      }

      console.log('[ReceiptsPage] Receipt saved successfully')

      // Reload receipts to show updated data
      await loadBudgetData()

      // Close modal
      handleCloseReceiptModal()
    } catch (error) {
      console.error('[ReceiptsPage] Error saving receipt:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteReceipt = async () => {
    if (!selectedReceipt) return

    const confirmed = confirm(`Are you sure you want to delete this receipt from ${selectedReceipt.store_name}? This cannot be undone.`)
    if (!confirmed) return

    setIsSaving(true)
    console.log('[ReceiptsPage] Deleting receipt...', selectedReceipt.id)

    try {
      // Delete items first (foreign key constraint)
      await supabase
        .from('receipt_item_corrections')
        .delete()
        .eq('receipt_scan_id', selectedReceipt.id)

      // Delete receipt
      const { error } = await supabase
        .from('receipt_scans')
        .delete()
        .eq('id', selectedReceipt.id)

      if (error) {
        console.error('[ReceiptsPage] Error deleting receipt:', error)
        alert('Failed to delete receipt. Please try again.')
        setIsSaving(false)
        return
      }

      console.log('[ReceiptsPage] Receipt deleted successfully')

      // Reload receipts
      await loadBudgetData()

      // Close modal
      handleCloseReceiptModal()
    } catch (error) {
      console.error('[ReceiptsPage] Error deleting receipt:', error)
      alert('Failed to delete receipt. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Budget & Receipts
            </h1>
            <p className="text-gray-600 mt-2">Track your monthly grocery spending</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                console.log('[ReceiptsPage] Scan Receipt clicked', { familyId, showReceiptScanner })
                if (!familyId) {
                  console.warn('[ReceiptsPage] Cannot open scanner - familyId not loaded')
                  alert('Loading family data... Please try again in a moment.')
                  return
                }
                setShowReceiptScanner(true)
              }}
              disabled={!familyId}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {familyId ? 'Scan Receipt' : 'Scan Receipt'}
            </button>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 flex items-center justify-center"
            >
              ← Back to Dashboard
            </Link>
          </div>
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
                  onClick={() => handleViewReceipt(receipt)}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer"
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

        {/* Receipt Scanner Modal */}
        {showReceiptScanner && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
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
                {familyId ? (
                  <ReceiptScanner
                    familyId={familyId}
                    onReceiptProcessed={handleReceiptProcessed}
                  />
                ) : (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading family data...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Receipt Edit Modal */}
        {selectedReceipt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedReceipt.store_name || 'Unknown Store'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(selectedReceipt.purchase_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={handleCloseReceiptModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Items */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
                <div className="space-y-3">
                  {editingItems.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-5">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Item Name</label>
                          <input
                            type="text"
                            value={item.corrected_name}
                            onChange={(e) => handleItemEdit(index, 'corrected_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                          <input
                            type="text"
                            value={item.corrected_quantity || ''}
                            onChange={(e) => handleItemEdit(index, 'corrected_quantity', e.target.value)}
                            placeholder="e.g., 2 lb"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Price</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.corrected_price}
                            onChange={(e) => handleItemEdit(index, 'corrected_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="col-span-1 flex items-end">
                          <button
                            onClick={() => handleItemRemove(index)}
                            className="w-full px-2 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            title="Remove item"
                          >
                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-indigo-600">
                      ${editingItems.reduce((sum, item) => sum + item.corrected_price, 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3 justify-between">
                  <button
                    onClick={handleDeleteReceipt}
                    disabled={isSaving}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Receipt
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseReceiptModal}
                      disabled={isSaving}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveReceipt}
                      disabled={isSaving}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
