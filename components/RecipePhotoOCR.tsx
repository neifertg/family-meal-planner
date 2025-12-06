'use client'

import { useState } from 'react'
import { createWorker, Worker } from 'tesseract.js'

type RecipePhotoOCRProps = {
  onTextExtracted: (text: string) => void
}

export default function RecipePhotoOCR({ onTextExtracted }: RecipePhotoOCRProps) {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Initialize Tesseract worker
      const worker: Worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      // Perform OCR
      const { data: { text } } = await worker.recognize(file)

      // Clean up worker
      await worker.terminate()

      // Pass extracted text to parent component
      onTextExtracted(text)

      setProcessing(false)
    } catch (err: any) {
      console.error('OCR error:', err)
      setError('Failed to process image. Please try again.')
      setProcessing(false)
    }
  }

  const handleClear = () => {
    setPreviewUrl(null)
    setProgress(0)
    setError(null)
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      {!previewUrl && (
        <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
          <input
            type="file"
            id="recipe-photo"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={processing}
          />
          <label
            htmlFor="recipe-photo"
            className="cursor-pointer flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">
                Upload Recipe Photo
              </p>
              <p className="text-sm text-gray-600 mt-1">
                We'll use OCR to extract the recipe text
              </p>
              <p className="text-xs text-gray-500 mt-2">
                PNG, JPG up to 10MB
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Preview and Progress */}
      {previewUrl && (
        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            <img
              src={previewUrl}
              alt="Recipe preview"
              className="w-full max-h-96 object-contain bg-gray-50"
            />
            {!processing && (
              <button
                onClick={handleClear}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                title="Remove image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {processing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Processing image...</span>
                <span className="text-purple-600 font-semibold">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 text-center">
                Using optical character recognition to read recipe text...
              </p>
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
              <li>Use good lighting and avoid shadows</li>
              <li>Keep the camera steady for clear text</li>
              <li>Make sure text is horizontal and not skewed</li>
              <li>Higher resolution images work better</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
