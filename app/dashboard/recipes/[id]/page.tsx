'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Recipe = {
  id: string
  name: string
  description: string | null
  source_url: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  servings: number | null
  ingredients: string[]
  instructions: string[]
  image_url: string | null
  cuisine: string | null
  category: string | null
  created_at: string
}

export default function RecipeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    loadRecipe()
  }, [params.id])

  const loadRecipe = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setRecipe(data)
    } catch (err: any) {
      console.error('Error loading recipe:', err)
      setError(err.message || 'Failed to load recipe')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recipe?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', params.id)

      if (error) throw error
      router.push('/dashboard/recipes')
    } catch (err: any) {
      console.error('Error deleting recipe:', err)
      setError(err.message || 'Failed to delete recipe')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-gray-600">Loading recipe...</div>
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-red-600 mb-4">{error || 'Recipe not found'}</div>
          <Link
            href="/dashboard/recipes"
            className="text-green-600 hover:text-green-700 font-medium"
          >
            ← Back to Recipes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/recipes"
            className="text-green-600 hover:text-green-700 font-medium mb-4 inline-block"
          >
            ← Back to Recipes
          </Link>
        </div>

        {/* Recipe Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Image */}
          {recipe.image_url && (
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="w-full h-64 object-cover"
            />
          )}

          {/* Content */}
          <div className="p-8">
            {/* Title and Meta */}
            <div className="mb-6">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{recipe.name}</h1>
              {recipe.description && (
                <p className="text-lg text-gray-600 mb-4">{recipe.description}</p>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {recipe.cuisine && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {recipe.cuisine}
                  </span>
                )}
                {recipe.category && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {recipe.category}
                  </span>
                )}
              </div>

              {/* Time Info */}
              <div className="flex flex-wrap gap-6 text-gray-600">
                {recipe.prep_time_minutes && (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Prep: {recipe.prep_time_minutes} min</span>
                  </div>
                )}
                {recipe.cook_time_minutes && (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                    <span>Cook: {recipe.cook_time_minutes} min</span>
                  </div>
                )}
                {recipe.total_time_minutes && (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Total: {recipe.total_time_minutes} min</span>
                  </div>
                )}
                {recipe.servings && (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Serves: {recipe.servings}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Ingredients */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Ingredients</h2>
                <ul className="space-y-2">
                  {recipe.ingredients.map((ingredient, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">•</span>
                      <span className="text-gray-700">{ingredient}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Instructions */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Instructions</h2>
                <ol className="space-y-4">
                  {recipe.instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </span>
                      <span className="text-gray-700 flex-1">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Source */}
            {recipe.source_url && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-2"
                >
                  View Original Recipe
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setEditing(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Edit Recipe
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
