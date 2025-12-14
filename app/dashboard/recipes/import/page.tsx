'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Recipe = {
  id: string
  name: string
  description: string | null
  source_url: string
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  servings: number | null
  ingredients: string[]
  instructions: string[]
  image_url: string | null
  cuisine: string | null
  category: string | null
}

export default function RecipeImportPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const router = useRouter()

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setRecipe(null)

    try {
      const response = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import recipe')
      }

      setRecipe(data.recipe)
      setUrl('')
    } catch (err: any) {
      console.error('Import error:', err)
      setError(err.message || 'Failed to import recipe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Import Recipe</h1>
          <p className="text-gray-600 mt-2">
            Paste a URL from your favorite recipe website to automatically import it
          </p>
        </div>

        {/* Import Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                Recipe URL
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.example.com/recipe"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                required
                disabled={loading}
              />
              <p className="mt-2 text-sm text-gray-500">
                Supported sites: AllRecipes, Food Network, NYT Cooking, Bon Appetit, and many more
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              {loading ? 'Importing...' : 'Import Recipe'}
            </button>
          </form>
        </div>

        {/* Success Message */}
        {recipe && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-start gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
              <svg className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold text-emerald-900">Recipe imported successfully!</h3>
                <p className="text-emerald-700 text-sm mt-1">
                  Your recipe has been saved to your collection.
                </p>
              </div>
            </div>

            {/* Recipe Preview */}
            <div className="space-y-4">
              <div className="flex items-start gap-6">
                {recipe.image_url && (
                  <img
                    src={recipe.image_url}
                    alt={recipe.name}
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{recipe.name}</h2>
                  {recipe.description && (
                    <p className="text-gray-600 mb-3">{recipe.description}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    {recipe.prep_time_minutes && (
                      <span>Prep: {recipe.prep_time_minutes} min</span>
                    )}
                    {recipe.cook_time_minutes && (
                      <span>Cook: {recipe.cook_time_minutes} min</span>
                    )}
                    {recipe.servings && (
                      <span>Servings: {recipe.servings}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/dashboard/recipes/${recipe.id}`}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-rose-500 hover:from-purple-600 hover:to-rose-600 text-white font-semibold py-3 px-6 rounded-lg text-center transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  View Recipe
                </Link>
                <button
                  onClick={() => setRecipe(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Import Another
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tips */}
        {!recipe && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">Tips for importing recipes:</h3>
            <ul className="text-blue-800 text-sm space-y-1 list-disc list-inside">
              <li>Make sure the URL points to a recipe page, not a blog homepage</li>
              <li>Most major recipe websites are supported</li>
              <li>You can edit the recipe details after importing</li>
              <li>If import fails, you can manually add the recipe instead</li>
            </ul>
            <Link
              href="/dashboard/recipes/new"
              className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Manually add a recipe →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
