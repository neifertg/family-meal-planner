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

type ErrorType =
  | 'network'
  | 'invalid-url'
  | 'no-recipe'
  | 'extraction-failed'
  | 'server-error'
  | 'paywalled'
  | 'unknown'

type DetailedError = {
  type: ErrorType
  message: string
  technicalDetails?: string
  suggestions: string[]
}

function categorizeError(errorMessage: string, statusCode?: number): DetailedError {
  const lowerError = errorMessage.toLowerCase()

  // Network errors
  if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('failed to fetch')) {
    return {
      type: 'network',
      message: 'Unable to connect to the website',
      technicalDetails: errorMessage,
      suggestions: [
        'Check your internet connection',
        'The website might be temporarily down',
        'Try again in a few moments',
        'Check if the URL is accessible in your browser'
      ]
    }
  }

  // Invalid URL
  if (lowerError.includes('invalid url') || lowerError.includes('malformed') || statusCode === 400) {
    return {
      type: 'invalid-url',
      message: 'The URL appears to be invalid',
      technicalDetails: errorMessage,
      suggestions: [
        'Make sure the URL starts with http:// or https://',
        'Check for typos in the URL',
        'Copy the URL directly from your browser\'s address bar',
        'Example format: https://www.example.com/recipe'
      ]
    }
  }

  // No recipe found
  if (lowerError.includes('no recipe') || lowerError.includes('not found') || lowerError.includes('could not find')) {
    return {
      type: 'no-recipe',
      message: 'No recipe data found on this page',
      technicalDetails: errorMessage,
      suggestions: [
        'Make sure the URL points directly to a recipe page',
        'Try enabling "Always use Claude AI" for better extraction',
        'Some websites don\'t support automated extraction',
        'Consider manually copying the recipe instead'
      ]
    }
  }

  // Paywalled/restricted content
  if (lowerError.includes('paywall') || lowerError.includes('subscription') || lowerError.includes('login required') || statusCode === 401 || statusCode === 403) {
    return {
      type: 'paywalled',
      message: 'This recipe requires a subscription or login',
      technicalDetails: errorMessage,
      suggestions: [
        'Log in to the website in your browser first',
        'Check if you have access to this content',
        'Some premium content cannot be extracted',
        'Try copying the recipe manually if you have access'
      ]
    }
  }

  // Server errors
  if (statusCode && statusCode >= 500) {
    return {
      type: 'server-error',
      message: 'The recipe website is experiencing issues',
      technicalDetails: errorMessage,
      suggestions: [
        'The website\'s server is currently down',
        'Try again in a few minutes',
        'Check if the website is working in your browser',
        'Consider trying a different recipe source'
      ]
    }
  }

  // Extraction failed
  if (lowerError.includes('extraction') || lowerError.includes('parsing') || lowerError.includes('failed to extract')) {
    return {
      type: 'extraction-failed',
      message: 'Unable to extract recipe data from this page',
      technicalDetails: errorMessage,
      suggestions: [
        'Try enabling "Always use Claude AI" for smarter extraction',
        'The page format might not be supported',
        'Ensure the URL points to a recipe page (not a blog post or article)',
        'Consider copying the recipe manually'
      ]
    }
  }

  // Unknown error
  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    technicalDetails: errorMessage,
    suggestions: [
      'Try again in a moment',
      'Check if the URL is accessible in your browser',
      'Try enabling "Always use Claude AI" mode',
      'If the problem persists, try a different recipe URL'
    ]
  }
}

export default function RecipeURLScraper({ onRecipeScraped }: RecipeURLScraperProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<DetailedError | null>(null)
  const [scrapedRecipe, setScrapedRecipe] = useState<ExtractedRecipe | null>(null)
  const [extractionInfo, setExtractionInfo] = useState<ExtractionInfo | null>(null)
  const [forceAI, setForceAI] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  const handleScrape = async () => {
    if (!url.trim()) {
      setError({
        type: 'invalid-url',
        message: 'Please enter a URL',
        suggestions: ['Paste a recipe URL from any website', 'Example: https://www.example.com/recipe']
      })
      return
    }

    setError(null)
    setLoading(true)
    setScrapedRecipe(null)
    setExtractionInfo(null)
    setShowTechnicalDetails(false)

    try {
      const response = await fetch('/api/scrape-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          preferLLM: forceAI
        }),
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
        const errorMsg = result.error || 'Failed to extract recipe'
        setError(categorizeError(errorMsg, response.status))
      }
    } catch (err: any) {
      console.error('Extraction error:', err)
      const errorMsg = err.message || 'Failed to extract recipe. Please try again.'
      setError(categorizeError(errorMsg))
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

          <div className="space-y-3">
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

            {/* AI Toggle */}
            <div className="flex items-center justify-between px-1">
              <label htmlFor="force-ai" className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    id="force-ai"
                    checked={forceAI}
                    onChange={(e) => setForceAI(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-pink-600"></div>
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Always use Claude AI
                </span>
              </label>
              <div className="text-xs text-gray-500">
                {forceAI ? '🤖 AI mode' : '⚡ Auto mode'}
              </div>
            </div>
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

      {/* Enhanced Error Message */}
      {error && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 shadow-lg animate-slide-down">
          <div className="flex items-start gap-3">
            {/* Error Icon - varies by type */}
            <div className="flex-shrink-0">
              {error.type === 'network' && (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                </svg>
              )}
              {error.type === 'invalid-url' && (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
              {error.type === 'no-recipe' && (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {error.type === 'paywalled' && (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
              {error.type === 'server-error' && (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              )}
              {(error.type === 'extraction-failed' || error.type === 'unknown') && (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>

            {/* Error Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-red-900 mb-1">
                {error.message}
              </h3>

              {/* Suggestions */}
              {error.suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-red-800 mb-1">What to try:</p>
                  <ul className="space-y-1">
                    {error.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Technical Details (collapsible) */}
              {error.technicalDetails && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="text-xs text-red-700 hover:text-red-800 font-medium flex items-center gap-1 underline"
                  >
                    <svg className={`w-3 h-3 transition-transform ${showTechnicalDetails ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {showTechnicalDetails ? 'Hide' : 'Show'} technical details
                  </button>
                  {showTechnicalDetails && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-900 font-mono break-all">
                      {error.technicalDetails}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2 mt-4">
                {!forceAI && error.type !== 'invalid-url' && (
                  <button
                    onClick={() => {
                      setForceAI(true)
                      setTimeout(() => handleScrape(), 100)
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    🤖 Retry with AI Mode
                  </button>
                )}
                <button
                  onClick={() => setError(null)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
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
