'use client'

import { useState, useEffect } from 'react'
import { ExtractedReceipt, ReceiptItem } from '@/lib/receiptScanner/types'
import { saveReceiptCorrections } from '@/lib/receiptScanner/learningSystem'
import { createClient } from '@/lib/supabase/client'

type ReceiptScannerProps = {
  onReceiptProcessed: (receipt: ExtractedReceipt) => void
}

export default function ReceiptScanner({ onReceiptProcessed }: ReceiptScannerProps) {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extractedReceipt, setExtractedReceipt] = useState<ExtractedReceipt | null>(null)
  const [originalItems, setOriginalItems] = useState<ReceiptItem[]>([]) // Store original for comparison
  const [editableItems, setEditableItems] = useState<ReceiptItem[]>([])
  const [showReview, setShowReview] = useState(false)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [tokensUsed, setTokensUsed] = useState<number | null>(null)
  const [costUsd, setCostUsd] = useState<number | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadFamilyId()
  }, [])

  const loadFamilyId = async () => {
    const { data } = await supabase
      .from('family_members')
      .select('family_id')
      .single()

    if (data) setFamilyId(data.family_id)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB')
      return
    }

    setError(null)
    setProcessing(true)
    setProgress(0)
    setExtractedReceipt(null)
    setShowReview(false)
    setConfidence(null)
    setTokensUsed(null)
    setCostUsd(null)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      setProgress(50)

      // Convert image to base64
      const imageReader = new FileReader()
      const imageDataPromise = new Promise<string>((resolve) => {
        imageReader.onload = (e) => resolve(e.target?.result as string)
      })
      imageReader.readAsDataURL(file)
      const imageData = await imageDataPromise

      // Call API with image data and family context
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          familyId,
          storeName: null // Will be populated from extracted receipt
        }),
      })

      const result = await response.json()

      if (result.success && result.receipt) {
        setExtractedReceipt(result.receipt)
        setOriginalItems([...result.receipt.items]) // Store original for learning
        setEditableItems([...result.receipt.items])
        setConfidence(result.confidence)
        setTokensUsed(result.tokens_used)
        setCostUsd(result.cost_usd)
        setShowReview(true)
      } else {
        setError(result.error || 'Failed to extract receipt from image')
      }

      setProgress(100)
      setProcessing(false)
    } catch (err: any) {
      console.error('Receipt scanning error:', err)
      setError('Failed to process receipt. Please try again.')
      setProcessing(false)
    }
  }

  const handleItemEdit = (index: number, field: keyof ReceiptItem, value: any) => {
    const updated = [...editableItems]
    updated[index] = { ...updated[index], [field]: value }
    setEditableItems(updated)
  }

  const handleItemRemove = (index: number) => {
    setEditableItems(editableItems.filter((_, i) => i !== index))
  }

  const handleApproveAll = async () => {
    if (!extractedReceipt || !familyId) return

    const approvedReceipt: ExtractedReceipt = {
      ...extractedReceipt,
      items: editableItems
    }

    // Save corrections for learning (async, don't block user)
    saveReceiptCorrections(
      {
        family_id: familyId,
        store_name: extractedReceipt.store_name || null,
        purchase_date: extractedReceipt.purchase_date,
        confidence_score: confidence,
        tokens_used: tokensUsed,
        cost_usd: costUsd
      },
      originalItems,
      editableItems
    ).catch(err => {
      console.error('Failed to save corrections for learning:', err)
      // Don't fail the user's workflow if learning save fails
    })

    onReceiptProcessed(approvedReceipt)
  }

  const handleReject = () => {
    setShowReview(false)
    setExtractedReceipt(null)
    setEditableItems([])
    handleClear()
  }

  const handleClear = () => {
    setPreviewUrl(null)
    setProgress(0)
    setError(null)
    setExtractedReceipt(null)
    setEditableItems([])
    setShowReview(false)
    setConfidence(null)
    setTokensUsed(null)
    setCostUsd(null)
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      {!previewUrl && !showReview && (
        <div className="border-2 border-dashed border-green-300 rounded-lg p-6 hover:border-green-400 transition-colors">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-gray-900">
                  Upload Receipt Photo
                </p>
                <p className="text-sm text-gray-600">
                  Scan receipts to update inventory and track spending
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="file"
                id="receipt-photo"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={processing}
              />
              <label
                htmlFor="receipt-photo"
                className="block w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer text-center"
              >
                Choose Receipt Image
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Preview and Progress */}
      {previewUrl && !showReview && (
        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="w-full h-auto max-h-96 object-contain bg-gray-50"
            />
            {!processing && (
              <button
                onClick={handleClear}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {processing && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Processing receipt...</span>
                <span className="text-sm font-semibold text-green-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-green-600 to-emerald-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Review Step */}
      {showReview && extractedReceipt && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold text-blue-800">Review Receipt Items</p>
                <p className="text-sm text-blue-700 mt-1">
                  {extractedReceipt.store_name && `${extractedReceipt.store_name} • `}
                  {extractedReceipt.purchase_date} • {editableItems.length} items • ${editableItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)} total
                </p>
                {confidence && (
                  <p className="text-xs text-blue-600 mt-1">
                    Confidence: {confidence}%
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {editableItems.map((item, index) => (
              <div key={index} className="p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemEdit(index, 'name', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Item name"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.quantity || ''}
                        onChange={(e) => handleItemEdit(index, 'quantity', e.target.value)}
                        className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Qty"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => handleItemEdit(index, 'price', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Price"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleItemRemove(index)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReject}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveAll}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Approve All ({editableItems.length} items)
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      {!showReview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Tips for best results:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Ensure the entire receipt is visible and in focus</li>
                <li>Good lighting helps - avoid shadows and glare</li>
                <li>Flatten the receipt if it's crumpled</li>
                <li>Works with printed or thermal receipts</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
