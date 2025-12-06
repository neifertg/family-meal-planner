'use client'

import { useState } from 'react'
import { ExtractedRecipe } from '@/lib/llmRecipeExtractor/types'

type RecipeURLScraperProps = {
  onRecipeScraped: (recipe: ExtractedRecipe) => void
}

type ExtractionInfo = {
  method: string
  confidence?: number
  tokensUsed?: number
}

export default function RecipeURLScraper({ onRecipeScraped }: RecipeURLScraperProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrapedRecipe, setScrapedRecipe] = useState<ExtractedRecipe | null>(null)
  const [extractionInfo, setExtractionInfo] = useState<ExtractionInfo | null>(null)

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setError(null)
    setLoading(true)
    setScrapedRecipe(null)
    setExtractionInfo(null)

    try {
      const response = await fetch('/api/scrape-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const result = await response.json()

      if (result.success && result.recipe) {
        setScrapedRecipe(result.recipe)
        setExtractionInfo({
          method: result.extraction_method,
          confidence: result.confidence,
          tokensUsed: result.tokens_used,
        })
        onRecipeScraped(result.recipe)
      } else {
        setError(result.error || 'Failed to extract recipe')
      }
    } catch (err: any) {
      console.error('Extraction error:', err)
      setError('Failed to extract recipe. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setUrl('')
    setScrapedRecipe(null)
    setExtractionInfo(null)
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleScrape()
    }
  }

  return (
    <div className="space-y-4">
      {/* URL Input */}
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
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold text-gray-900">
                Import from URL
              </p>
              <p className="text-sm text-gray-600">
                Paste a recipe URL and we'll extract the recipe data
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://www.example.com/recipe"
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow disabled:bg-gray-100"
            />
            <button
              onClick={handleScrape}
              disabled={loading || !url.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:cursor-not-allowed"
            >
              {loading ? 'Scraping...' : 'Import'}
            </button>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
            <div className="text-sm text-purple-800">
              <p className="font-semibold">🤖 AI is extracting recipe data...</p>
              <p className="text-xs text-purple-700 mt-0.5">
                Using smart extraction - works with any recipe format
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Success Preview */}
      {scrapedRecipe && !loading && extractionInfo && (
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
                ✨ Successfully extracted: {scrapedRecipe.title}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {scrapedRecipe.ingredients.length} ingredients • {scrapedRecipe.instructions.length} steps
              </p>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                  {extractionInfo.method === 'schema.org' ? '⚡ Schema.org' : '🤖 AI-Powered'}
                </span>
                {extractionInfo.confidence && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {extractionInfo.confidence}% confidence
                  </span>
                )}
                {extractionInfo.tokensUsed && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                    {extractionInfo.tokensUsed} tokens
                  </span>
                )}
              </div>
              <button
                onClick={handleClear}
                className="mt-3 text-sm font-medium text-green-700 hover:text-green-800 underline"
              >
                Import another recipe
              </button>
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
            <p className="font-semibold mb-1">🤖 AI-Powered Extraction:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Works with ANY recipe website - no special formatting needed</li>
              <li>Intelligently extracts ingredients, quantities, and instructions</li>
              <li>Automatically categorizes recipes and identifies dietary info</li>
              <li>Fast schema.org extraction when available, AI fallback otherwise</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
