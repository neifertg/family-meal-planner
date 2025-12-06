'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReceiptScanner from '@/components/ReceiptScanner'
import { ExtractedReceipt } from '@/lib/receiptScanner/types'
import { estimateExpirationDate } from '@/lib/expirationEstimator'

type InventoryItem = {
  id: string
  name: string
  category: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen'
  quantity_level: 'low' | 'medium' | 'full'
  expiration_date: string | null
  purchase_date: string | null
  created_at: string
  updated_at: string
}

type CategoryType = 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen'
type QuantityLevel = 'low' | 'medium' | 'full'

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showReceiptScanner, setShowReceiptScanner] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'pantry' as CategoryType,
    quantity_level: 'medium' as QuantityLevel,
    expiration_date: ''
  })

  const supabase = createClient()

  useEffect(() => {
    loadFamilyId()
  }, [])

  useEffect(() => {
    if (familyId) {
      loadInventory()
    }
  }, [familyId])

  const loadFamilyId = async () => {
    const { data: families } = await supabase
      .from('families')
      .select('id')
      .single()

    if (families) {
      setFamilyId(families.id)
    }
  }

  const loadInventory = async () => {
    if (!familyId) return

    setLoading(true)
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('family_id', familyId)
      .order('category')
      .order('name')

    if (error) {
      console.error('Error loading inventory:', error)
    } else if (data) {
      setItems(data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!familyId) return

    if (editingItem) {
      // Update existing item
      const { error } = await supabase
        .from('inventory_items')
        .update({
          name: formData.name,
          category: formData.category,
          quantity_level: formData.quantity_level,
          expiration_date: formData.expiration_date || null
        })
        .eq('id', editingItem.id)

      if (error) {
        console.error('Error updating item:', error)
        alert(`Failed to update item: ${error.message}`)
      }
    } else {
      // Add new item
      const { error } = await supabase
        .from('inventory_items')
        .insert({
          family_id: familyId,
          name: formData.name,
          category: formData.category,
          quantity_level: formData.quantity_level,
          expiration_date: formData.expiration_date || null
        })

      if (error) {
        console.error('Error adding item:', error)
        alert(`Failed to add item: ${error.message}`)
      }
    }

    // Reset form and close modal
    setFormData({
      name: '',
      category: 'pantry',
      quantity_level: 'medium',
      expiration_date: ''
    })
    setShowAddModal(false)
    setEditingItem(null)
    loadInventory()
  }

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      category: item.category,
      quantity_level: item.quantity_level,
      expiration_date: item.expiration_date || ''
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting item:', error)
      alert(`Failed to delete item: ${error.message}`)
    } else {
      loadInventory()
    }
  }

  const handleQuickQuantityUpdate = async (id: string, newLevel: QuantityLevel) => {
    const { error } = await supabase
      .from('inventory_items')
      .update({ quantity_level: newLevel })
      .eq('id', id)

    if (!error) loadInventory()
  }

  // Handle receipt processing
  const handleReceiptProcessed = async (receipt: ExtractedReceipt) => {
    if (!familyId) return

    try {
      // Process each receipt item
      for (const receiptItem of receipt.items) {
        // Check if item already exists in inventory
        const existingItem = items.find(item =>
          item.name.toLowerCase() === receiptItem.name.toLowerCase()
        )

        // Estimate expiration date
        const expirationDate = await estimateExpirationDate(
          receiptItem.name,
          receipt.purchase_date
        )

        if (existingItem) {
          // Update existing item
          await supabase
            .from('inventory_items')
            .update({
              quantity_level: 'full',
              purchase_date: receipt.purchase_date,
              expiration_date: expirationDate
            })
            .eq('id', existingItem.id)
        } else {
          // Add new item
          await supabase
            .from('inventory_items')
            .insert({
              family_id: familyId,
              name: receiptItem.name,
              category: receiptItem.category || 'pantry',
              quantity_level: 'full',
              purchase_date: receipt.purchase_date,
              expiration_date: expirationDate
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

      alert(`✅ Receipt processed! Updated ${receipt.items.length} items in inventory.`)
      setShowReceiptScanner(false)
    } catch (error) {
      console.error('Error processing receipt:', error)
      alert('Failed to process receipt. Please try again.')
    }
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingItem(null)
    setFormData({
      name: '',
      category: 'pantry',
      quantity_level: 'medium',
      expiration_date: ''
    })
  }

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, InventoryItem[]>)

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, JSX.Element> = {
      produce: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      dairy: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      meat: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      frozen: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
        </svg>
      ),
      pantry: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    }
    return icons[category] || icons.pantry
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      produce: 'green',
      dairy: 'blue',
      meat: 'red',
      frozen: 'cyan',
      pantry: 'amber'
    }
    return colors[category] || 'gray'
  }

  const getQuantityBadge = (level: QuantityLevel) => {
    const badges = {
      low: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      full: 'bg-green-100 text-green-800 border-green-200'
    }
    return badges[level]
  }

  const isExpiringSoon = (expirationDate: string | null) => {
    if (!expirationDate) return false
    const today = new Date()
    const expiration = new Date(expirationDate)
    const diffDays = Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 7 && diffDays >= 0
  }

  const isExpired = (expirationDate: string | null) => {
    if (!expirationDate) return false
    const today = new Date()
    const expiration = new Date(expirationDate)
    return expiration < today
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No expiration date'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const lowStockCount = items.filter(i => i.quantity_level === 'low').length
  const expiringSoonCount = items.filter(i => isExpiringSoon(i.expiration_date)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Kitchen Inventory</h1>
            <p className="text-purple-100">
              Track your ingredients and reduce food waste
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowReceiptScanner(true)}
              className="bg-white hover:bg-purple-50 text-purple-700 font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Scan Receipt
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-white hover:bg-purple-50 text-purple-700 font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 rounded-lg p-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{items.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 rounded-lg p-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">{lowStockCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 rounded-lg p-3">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900">{expiringSoonCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Items */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No items yet</h2>
          <p className="text-gray-600 mb-6">
            Start tracking your kitchen inventory to reduce waste and stay organized
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Add Your First Item
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(groupedItems).map(([category, categoryItems]) => {
            const color = getCategoryColor(category)
            return (
              <div key={category} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h3 className={`text-lg font-bold text-${color}-700 mb-4 capitalize flex items-center gap-2`}>
                  <span className={`text-${color}-600`}>{getCategoryIcon(category)}</span>
                  {category}
                </h3>
                <div className="space-y-3">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border-2 ${
                        isExpired(item.expiration_date)
                          ? 'bg-red-50 border-red-200'
                          : isExpiringSoon(item.expiration_date)
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{item.name}</h4>
                          <div className="space-y-0.5">
                            {item.purchase_date && (
                              <p className="text-xs text-gray-500">
                                📅 Purchased: {formatDate(item.purchase_date)}
                              </p>
                            )}
                            {item.expiration_date && (
                              <p className={`text-sm ${
                                isExpired(item.expiration_date)
                                  ? 'text-red-600 font-semibold'
                                  : isExpiringSoon(item.expiration_date)
                                  ? 'text-orange-600 font-medium'
                                  : 'text-gray-500'
                              }`}>
                                {isExpired(item.expiration_date) ? '⚠️ Expired: ' : ''}
                                {isExpiringSoon(item.expiration_date) && !isExpired(item.expiration_date) ? '⏰ Expires: ' : ''}
                                {!isExpired(item.expiration_date) && !isExpiringSoon(item.expiration_date) ? 'Expires: ' : ''}
                                {formatDate(item.expiration_date)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 hover:bg-white rounded transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 hover:bg-white rounded transition-colors"
                          >
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Quick Quantity Controls */}
                      <div className="flex gap-2 mt-3">
                        {(['low', 'medium', 'full'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => handleQuickQuantityUpdate(item.id, level)}
                            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium border-2 transition-all ${
                              item.quantity_level === level
                                ? getQuantityBadge(level) + ' border-current'
                                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Milk, Eggs, Chicken"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as CategoryType })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="produce">Produce</option>
                  <option value="dairy">Dairy</option>
                  <option value="meat">Meat</option>
                  <option value="pantry">Pantry</option>
                  <option value="frozen">Frozen</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'full'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({ ...formData, quantity_level: level })}
                      className={`py-2 px-4 rounded-lg font-medium border-2 transition-all ${
                        formData.quantity_level === level
                          ? getQuantityBadge(level) + ' border-current'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200"
                >
                  {editingItem ? 'Update' : 'Add'} Item
                </button>
              </div>
            </form>
          </div>
        </div>
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
