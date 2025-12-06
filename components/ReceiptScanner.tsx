'use client'

import { useState } from 'react'
import { ExtractedReceipt, ReceiptItem } from '@/lib/receiptScanner/types'

type ReceiptScannerProps = {
  onReceiptProcessed: (receipt: ExtractedReceipt) => void
}

export default function ReceiptScanner({ onReceiptProcessed }: ReceiptScannerProps) {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extractedReceipt, setExtractedReceipt] = useState<ExtractedReceipt | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [tokensUsed, setTokensUsed] = useState<number | null>(null)
  const [costUsd, setCostUsd] = useState<number | null>(null)

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

      // Call API with image data
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData }),
      })

      const result = await response.json()

      if (result.success && result.receipt) {
        setExtractedReceipt(result.receipt)
        setConfidence(result.confidence)
        setTokensUsed(result.tokens_used)
        setCostUsd(result.cost_usd)

        // Pass to parent component
        onReceiptProcessed(result.receipt)
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

  const handleClear = () => {
    setPreviewUrl(null)
    setProgress(0)
    setError(null)
    setExtractedReceipt(null)
    setConfidence(null)
    setTokensUsed(null)
    setCostUsd(null)
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      {!previewUrl && (
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
      {previewUrl && (
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

      {/* Success Message */}
      {extractedReceipt && !processing && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-green-800">
                Successfully extracted receipt!
              </p>
              <p className="text-sm text-green-700 mt-1">
                {extractedReceipt.store_name && `${extractedReceipt.store_name} • `}
                {extractedReceipt.items.length} items • ${extractedReceipt.total.toFixed(2)} total
              </p>
              <div className="flex gap-2 mt-2 text-xs">
                {confidence && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {confidence}% confidence
                  </span>
                )}
                {tokensUsed && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                    {tokensUsed} tokens
                  </span>
                )}
                {costUsd && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                    ${costUsd.toFixed(4)} cost
                  </span>
                )}
              </div>

              {/* Preview Items */}
              <div className="mt-3 bg-white border border-green-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-700 mb-2">Extracted Items:</p>
                <div className="space-y-1">
                  {extractedReceipt.items.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-900 font-medium">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                  {extractedReceipt.items.length > 5 && (
                    <p className="text-xs text-gray-500 italic">
                      +{extractedReceipt.items.length - 5} more items
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
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
    </div>
  )
}
