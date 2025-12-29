'use client'

import { useState, useEffect } from 'react'
import { ExtractedReceipt, ReceiptItem } from '@/lib/receiptScanner/types'
import { saveReceiptCorrections } from '@/lib/receiptScanner/learningSystem'
import { createClient } from '@/lib/supabase/client'
import { estimateExpirationDate } from '@/lib/receiptScanner/expirationEstimator'
import ImageEnhancer from '@/components/ImageEnhancer'
import { FormErrorBanner, FieldError } from '@/components/FormError'
import { validateRequired, validatePurchaseDate, validateArrayLength, combineValidations, ValidationError } from '@/lib/validation'

type ReceiptScannerProps = {
  onReceiptProcessed: (receipt: ExtractedReceipt, applyToBudget: boolean) => void
}

export default function ReceiptScanner({ onReceiptProcessed }: ReceiptScannerProps) {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string | null>(null)
  const [showEnhancer, setShowEnhancer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractedReceipt, setExtractedReceipt] = useState<ExtractedReceipt | null>(null)
  const [originalItems, setOriginalItems] = useState<ReceiptItem[]>([]) // Store original for comparison
  const [editableItems, setEditableItems] = useState<ReceiptItem[]>([])
  const [editablePurchaseDate, setEditablePurchaseDate] = useState<string>('')
  const [editableStoreName, setEditableStoreName] = useState<string>('')
  const [showReview, setShowReview] = useState(false)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [tokensUsed, setTokensUsed] = useState<number | null>(null)
  const [costUsd, setCostUsd] = useState<number | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [familyIdLoading, setFamilyIdLoading] = useState(true)
  const [hoveredItemIndex, setHoveredItemIndex] = useState<number | null>(null)
  const [applyToBudget, setApplyToBudget] = useState(true) // Default to true - most users want to track receipts in budget
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

  const supabase = createClient()

  useEffect(() => {
    loadFamilyId()
  }, [])

  const loadFamilyId = async () => {
    setFamilyIdLoading(true)
    const { data, error } = await supabase
      .from('family_members')
      .select('family_id')
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[ReceiptScanner] Error loading family_id:', error)
      setFamilyIdLoading(false)
      return
    }

    if (data?.family_id) {
      console.log('[ReceiptScanner] Family ID loaded:', data.family_id)
      setFamilyId(data.family_id)
    } else {
      console.warn('[ReceiptScanner] No family_id found - user may not be a family member')
    }
    setFamilyIdLoading(false)
  }

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // Calculate new dimensions to keep image under Vercel's 4.5MB payload limit
          // Reduced from 2000px to 1200px - Claude Vision is robust enough for lower res
          const maxDimension = 1200
          let width = img.width
          let height = img.height

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension
              width = maxDimension
            } else {
              width = (width / height) * maxDimension
              height = maxDimension
            }
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          // Convert to JPEG with 0.75 quality to stay under Vercel's 4.5MB limit
          // Claude Vision is robust enough to handle lower quality receipt images
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75)
          resolve(compressedDataUrl)
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setError(null)
    setExtractedReceipt(null)
    setShowReview(false)
    setConfidence(null)
    setTokensUsed(null)
    setCostUsd(null)

    try {
      console.log('[ReceiptScanner] Starting image compression...', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })

      // Compress/resize image automatically (especially important for mobile photos)
      const compressedDataUrl = await compressImage(file)

      console.log('[ReceiptScanner] Image compressed successfully', {
        originalSize: file.size,
        compressedSize: compressedDataUrl.length,
        compressionRatio: ((1 - compressedDataUrl.length / file.size) * 100).toFixed(1) + '%'
      })

      setPreviewUrl(compressedDataUrl)
      setEnhancedImageUrl(compressedDataUrl) // Initialize with compressed version
      setShowEnhancer(true) // Show enhancement UI
    } catch (err: any) {
      console.error('[ReceiptScanner] File reading/compression error:', {
        error: err,
        message: err.message,
        stack: err.stack,
        fileName: file.name,
        fileSize: file.size
      })
      setError('Failed to process image. Please try again.')
    }
  }

  const handleEnhancedImageUpdate = (enhancedImage: string) => {
    setEnhancedImageUrl(enhancedImage)
  }

  const handleProceedWithScan = async () => {
    if (!enhancedImageUrl) return

    setProcessing(true)
    setProgress(0)
    setShowEnhancer(false)

    try {
      console.log('[ReceiptScanner] Starting receipt scan...', {
        imageDataLength: enhancedImageUrl.length,
        familyId,
        timestamp: new Date().toISOString()
      })

      setProgress(30)

      // Call Claude API with enhanced image data and family context
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: enhancedImageUrl,
          familyId,
          storeName: null // Will be populated from extracted receipt
        }),
      })

      console.log('[ReceiptScanner] API response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      // Check if response is OK before parsing JSON
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[ReceiptScanner] API error response', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500)
        })

        // Provide user-friendly error messages based on status code
        let errorMessage = 'Failed to scan receipt. '
        if (response.status === 400) {
          errorMessage += 'The image data or request was invalid. Please try a different image.'
        } else if (response.status === 413) {
          errorMessage += 'The image file is too large. Please try a smaller image or crop the receipt.'
        } else if (response.status === 429) {
          errorMessage += 'Too many requests. Please wait a moment and try again.'
        } else if (response.status === 500) {
          errorMessage += 'Server error occurred. Please try again later or contact support if the issue persists.'
        } else if (response.status === 503) {
          errorMessage += 'Service temporarily unavailable. Please try again in a moment.'
        } else {
          errorMessage += `Error ${response.status}: ${response.statusText}`
        }

        throw new Error(errorMessage)
      }

      const claudeResult = await response.json()

      console.log('[ReceiptScanner] API result parsed', {
        success: claudeResult.success,
        hasReceipt: !!claudeResult.receipt,
        error: claudeResult.error,
        itemCount: claudeResult.receipt?.items?.length
      })

      setProgress(90)

      if (claudeResult.success && claudeResult.receipt) {
        setExtractedReceipt(claudeResult.receipt)
        setOriginalItems([...claudeResult.receipt.items]) // Store original for learning
        setEditableItems([...claudeResult.receipt.items])
        setEditablePurchaseDate(claudeResult.receipt.purchase_date || '')
        setEditableStoreName(claudeResult.receipt.store_name || '')
        setConfidence(claudeResult.confidence)
        setTokensUsed(claudeResult.tokens_used)
        setCostUsd(claudeResult.cost_usd)
        setShowReview(true)

        console.log('[ReceiptScanner] Receipt extraction successful', {
          storeName: claudeResult.receipt.store_name,
          itemCount: claudeResult.receipt.items.length,
          confidence: claudeResult.confidence
        })
      } else {
        console.error('[ReceiptScanner] Receipt extraction failed', {
          error: claudeResult.error,
          fullResult: claudeResult
        })
        const userFriendlyError = claudeResult.error
          ? `Receipt scanning failed: ${claudeResult.error}. Please ensure the image is clear and shows a complete receipt.`
          : 'Failed to extract receipt data from the image. Please ensure the receipt is clearly visible and try again.'
        setError(userFriendlyError)
      }

      setProgress(100)
      setProcessing(false)
    } catch (err: any) {
      console.error('[ReceiptScanner] Receipt scanning exception:', {
        error: err,
        message: err.message,
        stack: err.stack,
        name: err.name
      })
      setError(`Failed to process receipt: ${err.message || 'Unknown error'}. Please try again.`)
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
    console.log('Approve button clicked', { extractedReceipt, familyId, editableItems })

    // Clear previous validation errors
    setValidationErrors([])

    if (!extractedReceipt) {
      console.error('No extracted receipt')
      return
    }

    if (!familyId) {
      setValidationErrors([{
        field: 'family',
        message: 'You must be part of a family to save receipts. Please create or join a family first from your profile settings.'
      }])
      return
    }

    // Validate required fields
    const validation = combineValidations(
      validateRequired(editablePurchaseDate, 'Purchase date'),
      validatePurchaseDate(editablePurchaseDate),
      validateArrayLength(editableItems, 'Receipt items', 1)
    )

    if (!validation.isValid) {
      setValidationErrors(validation.errors)
      // Scroll to top to show error banner
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const approvedReceipt: ExtractedReceipt = {
      ...extractedReceipt,
      items: editableItems,
      purchase_date: editablePurchaseDate,
      store_name: editableStoreName
    }

    // Save corrections for learning if familyId is available (async, don't block user)
    if (familyId) {
      console.log('[ReceiptScanner] Saving receipt to database...', {
        familyId,
        storeName: editableStoreName,
        purchaseDate: editablePurchaseDate,
        itemCount: editableItems.length,
        total: editableItems.reduce((sum, item) => sum + item.price, 0),
        appliedToBudget: applyToBudget
      })

      saveReceiptCorrections(
        {
          family_id: familyId,
          store_name: editableStoreName || null,
          purchase_date: editablePurchaseDate,
          confidence_score: confidence,
          tokens_used: tokensUsed,
          cost_usd: costUsd,
          applied_to_budget: applyToBudget
        },
        originalItems,
        editableItems
      ).then(() => {
        console.log('[ReceiptScanner] Receipt saved successfully to database')
      }).catch(err => {
        console.error('[ReceiptScanner] Failed to save receipt to database:', err)
        // Don't fail the user's workflow if learning save fails
      })
    } else {
      console.warn('[ReceiptScanner] No familyId available - skipping database save')
    }

    console.log('[ReceiptScanner] Calling onReceiptProcessed with:', {
      receipt: approvedReceipt,
      applyToBudget
    })
    onReceiptProcessed(approvedReceipt, applyToBudget)
  }

  const handleReject = () => {
    setShowReview(false)
    setExtractedReceipt(null)
    setEditableItems([])
    setEditablePurchaseDate('')
    setEditableStoreName('')
    handleClear()
  }

  const handleClear = () => {
    setPreviewUrl(null)
    setEnhancedImageUrl(null)
    setShowEnhancer(false)
    setProgress(0)
    setError(null)
    setExtractedReceipt(null)
    setEditableItems([])
    setEditablePurchaseDate('')
    setEditableStoreName('')
    setShowReview(false)
    setConfidence(null)
    setTokensUsed(null)
    setCostUsd(null)
  }

  return (
    <div className="space-y-4">
      {/* No Family Warning - Only show after loading completes */}
      {!familyIdLoading && !familyId && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-red-900">Cannot Save Receipts</p>
              <p className="text-sm text-red-800 mt-1">
                You must be part of a family to save receipts. Please create or join a family first from your profile settings.
              </p>
            </div>
          </div>
        </div>
      )}

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
                disabled={processing || !familyId}
              />
              <label
                htmlFor="receipt-photo"
                className={`block w-full px-4 py-2.5 ${
                  familyId
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 cursor-pointer'
                    : 'bg-gray-400 cursor-not-allowed'
                } text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-center`}
              >
                {familyId ? 'Choose Receipt Image' : 'Family Required to Scan'}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Image Enhancement Step */}
      {showEnhancer && previewUrl && !showReview && !processing && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Enhance Image Quality</h3>
            <button
              onClick={handleClear}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ✕ Cancel
            </button>
          </div>

          <ImageEnhancer
            originalImage={previewUrl}
            onEnhancedImage={handleEnhancedImageUpdate}
            autoEnhance={true}
          />

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleProceedWithScan}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Scan Receipt
            </button>
          </div>
        </div>
      )}

      {/* Processing Progress */}
      {processing && previewUrl && (
        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            <img
              src={enhancedImageUrl || previewUrl}
              alt="Receipt preview"
              className="w-full h-auto max-h-96 object-contain bg-gray-50"
            />
          </div>

          {/* Progress Bar */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Processing receipt with Claude Vision...</span>
              <span className="text-sm font-semibold text-green-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-green-600 to-emerald-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <FormErrorBanner error={error} />
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <FormErrorBanner error={validationErrors.map(e => e.message)} />
      )}

      {/* Review Step */}
      {showReview && extractedReceipt && (
        <div className="space-y-4">
          {/* Header Summary - Editable Store and Date */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-blue-800">Review Receipt Details</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Edit store name and purchase date if needed
                  </p>
                </div>
              </div>

              {/* Editable Store Name and Purchase Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="store_name" className="block text-xs font-medium text-blue-800 mb-1">
                    Store Name
                  </label>
                  <input
                    type="text"
                    id="store_name"
                    value={editableStoreName}
                    onChange={(e) => setEditableStoreName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder="Enter store name"
                  />
                </div>
                <div>
                  <label htmlFor="purchase_date" className="block text-xs font-medium text-blue-800 mb-1">
                    Purchase Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    id="purchase_date"
                    value={editablePurchaseDate}
                    onChange={(e) => {
                      setEditablePurchaseDate(e.target.value)
                      // Clear validation errors when user starts editing
                      if (validationErrors.some(e => e.field === 'Purchase date')) {
                        setValidationErrors(validationErrors.filter(e => e.field !== 'Purchase date'))
                      }
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${
                      validationErrors.some(e => e.field === 'Purchase date')
                        ? 'border-red-500'
                        : 'border-blue-300'
                    }`}
                    required
                  />
                  <FieldError error={validationErrors.find(e => e.field === 'Purchase date')?.message} />
                </div>
              </div>

              {/* Summary info */}
              <div className="flex items-center gap-2 text-sm text-blue-700 pt-2 border-t border-blue-200">
                <span>{editableItems.length} items</span>
                <span>•</span>
                <span>${editableItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)} total</span>
                {confidence && (
                  <>
                    <span>•</span>
                    <span className="text-xs">Confidence: {confidence}%</span>
                  </>
                )}
              </div>

              <p className="text-xs text-gray-600">
                💡 Each item below shows the actual text from the receipt it was extracted from
              </p>
            </div>
          </div>

          {/* Quality Warnings */}
          {extractedReceipt.quality_warnings && extractedReceipt.quality_warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900">⚠️ Receipt Quality Issues Detected</p>
                  <ul className="text-xs text-yellow-800 mt-2 space-y-1 list-disc list-inside">
                    {extractedReceipt.quality_warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-yellow-700 mt-2">
                    Please review the extracted data carefully to ensure accuracy.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Side-by-side layout: Receipt image + Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Receipt Image Preview */}
            {previewUrl && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Receipt Image</h3>
                <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-3">
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">💡 Tip:</span> Hover over items on the right to see their line numbers highlighted on the receipt.
                    The numbers help you verify which line Claude read from.
                  </p>
                </div>
                <div className="relative inline-block w-full">
                  <img
                    src={previewUrl}
                    alt="Receipt"
                    className="w-full h-auto max-h-[400px] md:max-h-[600px] object-contain border border-gray-300 rounded"
                  />
                  {/* Overlay line number markers - only show on hover */}
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    {editableItems.map((item, index) => {
                      if (!item.line_number) return null

                      // Use calibrated position_percent directly from backend
                      // Position is now calibrated using anchor items and line numbers
                      // for accurate alignment across all receipt types
                      const positionPercent = item.position_percent !== undefined
                        ? item.position_percent
                        : 10 + (index / Math.max(editableItems.length - 1, 1)) * 80

                      const topPercent = `${positionPercent}%`
                      const isHovered = hoveredItemIndex === index

                      // Only render if this item is currently hovered
                      if (!isHovered) return null

                      return (
                        <div
                          key={index}
                          className="absolute left-2 transition-all duration-200 z-10 animate-in fade-in zoom-in"
                          style={{ top: topPercent }}
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs shadow-md bg-yellow-400 text-gray-900 ring-2 ring-yellow-300 border border-gray-900">
                            {item.line_number}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Extracted Items List */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Extracted Items</h3>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {editableItems.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 transition-all ${
                      item.is_food === false
                        ? 'bg-orange-50 border-l-4 border-orange-500'
                        : hoveredItemIndex === index
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHoveredItemIndex(index)}
                    onMouseLeave={() => setHoveredItemIndex(null)}
                  >
                    {/* Non-food warning */}
                    {item.is_food === false && (
                      <div className="mb-3 bg-orange-100 border border-orange-300 rounded px-3 py-2">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-orange-900">⚠️ Non-Food Item Detected</p>
                            <p className="text-xs text-orange-800 mt-1">
                              This appears to be a non-grocery item (bags, gift wrap, etc.). Please verify the category or remove it if it's not part of your grocery budget.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Consolidation notice */}
                    {item.consolidated_count && item.consolidated_count > 1 && (
                      <div className="mb-3 bg-purple-100 border border-purple-300 rounded px-3 py-2">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-purple-900">🔗 Duplicate Items Consolidated</p>
                            <p className="text-xs text-purple-800 mt-1">
                              {item.consolidated_details || `Combined ${item.consolidated_count} duplicate entries into one item`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Line number and source text - prominently displayed */}
                    <div className="mb-3 space-y-1">
                      {item.line_number && (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-8 h-8 text-white text-sm font-bold rounded-full ${
                            item.is_food === false ? 'bg-orange-600' : 'bg-blue-600'
                          }`}>
                            {item.line_number}
                          </span>
                          <span className={`text-xs font-semibold uppercase tracking-wide ${
                            item.is_food === false ? 'text-orange-700' : 'text-blue-700'
                          }`}>
                            Receipt Line {item.line_number}
                            {item.is_food === false && ' (Non-Food)'}
                          </span>
                        </div>
                      )}
                      {item.source_text && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                          <div className="text-xs font-medium text-yellow-800 mb-1">
                            Claude read from receipt:
                          </div>
                          <div className="font-mono text-sm text-gray-900 font-semibold">
                            "{item.source_text}"
                          </div>
                        </div>
                      )}
                    </div>

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
            </div>
          </div>

          {/* Apply to Budget Checkbox */}
          <div className={`rounded-lg p-4 border-2 transition-all ${
            applyToBudget
              ? 'bg-green-50 border-green-400'
              : 'bg-gray-50 border-gray-300'
          }`}>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={applyToBudget}
                onChange={(e) => {
                  console.log('[ReceiptScanner] Apply to budget toggled:', e.target.checked)
                  setApplyToBudget(e.target.checked)
                }}
                className="w-6 h-6 mt-0.5 text-green-600 border-gray-400 rounded focus:ring-2 focus:ring-green-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className={`font-bold text-lg transition-colors ${
                  applyToBudget ? 'text-green-900' : 'text-gray-700'
                }`}>
                  {applyToBudget ? '✓ ' : ''}Apply ${editableItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)} to Monthly Budget
                </div>
                <p className={`text-sm mt-1 ${
                  applyToBudget ? 'text-green-700' : 'text-gray-600'
                }`}>
                  {applyToBudget
                    ? 'This receipt will be tracked in your budget and appear in your receipts list'
                    : 'Check this to track this receipt in your monthly budget'
                  }
                </p>
              </div>
            </label>
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
