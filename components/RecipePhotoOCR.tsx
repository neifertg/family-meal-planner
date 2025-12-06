'use client'

import { useState } from 'react'
import { createWorker, Worker } from 'tesseract.js'
import { ExtractedRecipe } from '@/lib/llmRecipeExtractor/types'

type RecipePhotoOCRProps = {
  onTextExtracted: (text: string) => void
  onRecipeExtracted?: (recipe: ExtractedRecipe) => void
}

type ExtractionMethod = 'tesseract' | 'claude-vision'

export default function RecipePhotoOCR({ onTextExtracted, onRecipeExtracted }: RecipePhotoOCRProps) {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extractionMethod, setExtractionMethod] = useState<ExtractionMethod>('claude-vision')
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [tokensUsed, setTokensUsed] = useState<number | null>(null)

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
    setExtractedRecipe(null)
    setConfidence(null)
    setTokensUsed(null)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      if (extractionMethod === 'claude-vision') {
        // Use Claude Vision for direct recipe extraction
        setProgress(50)

        // Convert image to base64
        const imageReader = new FileReader()
        const imageDataPromise = new Promise<string>((resolve) => {
          imageReader.onload = (e) => resolve(e.target?.result as string)
        })
        imageReader.readAsDataURL(file)
        const imageData = await imageDataPromise

        // Call API with image data
        const response = await fetch('/api/scrape-recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData }),
        })

        const result = await response.json()

        if (result.success && result.recipe) {
          setExtractedRecipe(result.recipe)
          setConfidence(result.confidence)
          setTokensUsed(result.tokens_used)

          // If onRecipeExtracted callback exists, use it directly
          if (onRecipeExtracted) {
            onRecipeExtracted(result.recipe)
          } else {
            // Otherwise, pass formatted text to parent
            const formattedText = formatRecipeAsText(result.recipe)
            onTextExtracted(formattedText)
          }
        } else {
          setError(result.error || 'Failed to extract recipe from image')
        }

        setProgress(100)
      } else {
        // Use Tesseract OCR
        const worker: Worker = await createWorker('eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100))
            }
          },
        })

        const { data: { text } } = await worker.recognize(file)
        await worker.terminate()

        onTextExtracted(text)
      }

      setProcessing(false)
    } catch (err: any) {
      console.error('Extraction error:', err)
      setError('Failed to process image. Please try again.')
      setProcessing(false)
    }
  }

  const formatRecipeAsText = (recipe: ExtractedRecipe): string => {
    let text = `${recipe.title}\n\n`
    if (recipe.description) text += `${recipe.description}\n\n`

    text += 'Ingredients:\n'
    recipe.ingredients.forEach((ing) => {
      const quantity = ing.quantity ? `${ing.quantity} ` : ''
      const unit = ing.unit ? `${ing.unit} ` : ''
      const prep = ing.preparation ? ` (${ing.preparation})` : ''
      text += `- ${quantity}${unit}${ing.item}${prep}\n`
    })

    text += '\nInstructions:\n'
    recipe.instructions.forEach((inst) => {
      text += `${inst.step_number}. ${inst.instruction}\n`
    })

    return text
  }

  const handleClear = () => {
    setPreviewUrl(null)
    setProgress(0)
    setError(null)
    setExtractedRecipe(null)
    setConfidence(null)
    setTokensUsed(null)
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      {!previewUrl && (
        <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 hover:border-purple-400 transition-colors">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-purple-600"
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
              <div className="flex-1">
                <p className="text-lg font-semibold text-gray-900">
                  Upload Recipe Photo
                </p>
                <p className="text-sm text-gray-600">
                  Extract recipes from photos, cookbook pages, or handwritten cards
                </p>
              </div>
            </div>

            <div className="space-y-3">
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
                className="block w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer text-center"
              >
                Choose Image
              </label>

              {/* Extraction Method Toggle */}
              <div className="flex items-center justify-between px-1">
                <label htmlFor="extraction-method" className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      id="extraction-method"
                      checked={extractionMethod === 'claude-vision'}
                      onChange={(e) => setExtractionMethod(e.target.checked ? 'claude-vision' : 'tesseract')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-pink-600"></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    Use Claude Vision AI
                  </span>
                </label>
                <div className="text-xs text-gray-500">
                  {extractionMethod === 'claude-vision' ? '🤖 AI mode' : '⚡ OCR mode'}
                </div>
              </div>
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

      {/* Success Message - Claude Vision */}
      {extractedRecipe && !processing && extractionMethod === 'claude-vision' && (
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
                Successfully extracted: {extractedRecipe.title}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {extractedRecipe.ingredients.length} ingredients • {extractedRecipe.instructions.length} steps
              </p>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                  🤖 Claude Vision
                </span>
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
            <p className="font-semibold mb-1">
              {extractionMethod === 'claude-vision' ? '🤖 AI-Powered Vision:' : 'Tips for best results:'}
            </p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              {extractionMethod === 'claude-vision' ? (
                <>
                  <li>Works with handwritten recipes and cookbook pages</li>
                  <li>Understands recipe structure and formatting automatically</li>
                  <li>Extracts quantities, units, and instructions intelligently</li>
                  <li>Best accuracy for complex or poorly formatted recipes</li>
                </>
              ) : (
                <>
                  <li>Use good lighting and avoid shadows</li>
                  <li>Keep the camera steady for clear text</li>
                  <li>Make sure text is horizontal and not skewed</li>
                  <li>Higher resolution images work better</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
