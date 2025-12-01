'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ImportResult = {
  url: string
  success: boolean
  recipeName?: string
  error?: string
}

export default function BulkImportPage() {
  const router = useRouter()
  const [urls, setUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const handleBulkImport = async () => {
    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)

    if (urlList.length === 0) {
      alert('Please enter at least one URL')
      return
    }

    setLoading(true)
    setResults([])
    setProgress({ current: 0, total: urlList.length })

    const importResults: ImportResult[] = []

    for (let i = 0; i < urlList.length; i++) {
      const url = urlList[i]
      setProgress({ current: i + 1, total: urlList.length })

      try {
        const response = await fetch('/api/recipes/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        })

        const data = await response.json()

        if (response.ok) {
          importResults.push({
            url,
            success: true,
            recipeName: data.recipe?.name || 'Recipe imported'
          })
        } else {
          importResults.push({
            url,
            success: false,
            error: data.error || 'Failed to import'
          })
        }
      } catch (err: any) {
        importResults.push({
          url,
          success: false,
          error: err.message || 'Network error'
        })
      }

      setResults([...importResults])
    }

    setLoading(false)
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-6 md:p-8 mb-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">Bulk Recipe Import</h1>
            <p className="text-emerald-100">
              Import multiple recipes at once from URLs
            </p>
          </div>
          <Link
            href="/dashboard/recipes"
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm font-medium text-center"
          >
            ← Back to Recipes
          </Link>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-5 mb-6">
        <h3 className="font-bold text-blue-900 mb-2">How to use:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Enter one recipe URL per line</li>
          <li>Recipes will be imported one at a time</li>
          <li>Supported sites: Most recipe sites with schema.org data</li>
          <li>You can import 1-50 recipes at once</li>
        </ul>
      </div>

      {/* URL Input */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-2xl">📋</span>
          Recipe URLs
        </h2>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="https://example.com/recipe1&#10;https://example.com/recipe2&#10;https://example.com/recipe3"
          rows={12}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm transition-shadow"
          disabled={loading}
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {urls.split('\n').filter(u => u.trim()).length} URLs entered
          </p>
          <button
            onClick={handleBulkImport}
            disabled={loading || !urls.trim()}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            {loading ? 'Importing...' : 'Start Import'}
          </button>
        </div>
      </div>

      {/* Progress */}
      {loading && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Import Progress</h3>
            <span className="text-sm text-gray-600">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">Import Results</h2>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-semibold">
                ✓ {successCount} Success
              </span>
              <span className="text-red-600 font-semibold">
                ✗ {failureCount} Failed
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  result.success
                    ? 'bg-green-50 border-green-500'
                    : 'bg-red-50 border-red-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {result.success ? (
                      <>
                        <p className="font-semibold text-green-900 mb-1">
                          ✓ {result.recipeName}
                        </p>
                        <p className="text-sm text-green-700 truncate">
                          {result.url}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-red-900 mb-1">
                          ✗ Failed to import
                        </p>
                        <p className="text-sm text-red-700 mb-1 truncate">
                          {result.url}
                        </p>
                        <p className="text-xs text-red-600">
                          {result.error}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!loading && (
            <div className="mt-5 pt-5 border-t border-gray-200 flex gap-3">
              <Link
                href="/dashboard/recipes"
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 text-center"
              >
                View All Recipes
              </Link>
              <button
                onClick={() => {
                  setResults([])
                  setUrls('')
                  setProgress({ current: 0, total: 0 })
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Import More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
