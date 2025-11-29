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
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPrepTime, setEditPrepTime] = useState('')
  const [editCookTime, setEditCookTime] = useState('')
  const [editServings, setEditServings] = useState('')
  const [editCuisine, setEditCuisine] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editIngredientsText, setEditIngredientsText] = useState('')
  const [editInstructionsText, setEditInstructionsText] = useState('')

  useEffect(() => {
    loadRecipe()
  }, [params.id])

  const loadRecipe = async () => {
    try {
      if (!params.id) {
        throw new Error('Recipe ID not found')
      }

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
    if (!params.id) return

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

  const startEditing = () => {
    if (!recipe) return
    setEditName(recipe.name)
    setEditDescription(recipe.description || '')
    setEditPrepTime(recipe.prep_time_minutes?.toString() || '')
    setEditCookTime(recipe.cook_time_minutes?.toString() || '')
    setEditServings(recipe.servings?.toString() || '')
    setEditCuisine(recipe.cuisine || '')
    setEditCategory(recipe.category || '')
    setEditImageUrl(recipe.image_url || '')
    setEditIngredientsText(recipe.ingredients.join('\n'))
    setEditInstructionsText(recipe.instructions.join('\n'))
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipe) return

    setError(null)
    setSaving(true)

    try {
      const supabase = createClient()

      // Parse ingredients (one per line)
      const ingredients = editIngredientsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      // Parse instructions (one per line)
      const instructions = editInstructionsText
        .split('\n')
        .map(line => line.trim().replace(/^\d+\.\s*/, ''))
        .filter(line => line.length > 0)

      const updateData = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        prep_time_minutes: editPrepTime ? parseInt(editPrepTime) : null,
        cook_time_minutes: editCookTime ? parseInt(editCookTime) : null,
        total_time_minutes: (editPrepTime || editCookTime)
          ? (parseInt(editPrepTime || '0') + parseInt(editCookTime || '0'))
          : null,
        servings: editServings ? parseInt(editServings) : null,
        cuisine: editCuisine.trim() || null,
        category: editCategory.trim() || null,
        image_url: editImageUrl.trim() || null,
        ingredients,
        instructions,
      }

      const { data, error: updateError } = await supabase
        .from('recipes')
        .update(updateData)
        .eq('id', recipe.id)
        .select()
        .single()

      if (updateError) throw updateError

      setRecipe(data)
      setEditing(false)
    } catch (err: any) {
      console.error('Error updating recipe:', err)
      setError(err.message || 'Failed to update recipe')
    } finally {
      setSaving(false)
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

        {/* Edit Form */}
        {editing ? (
          <form onSubmit={handleSave} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Recipe</h2>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Recipe Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  id="imageUrl"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="prepTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    id="prepTime"
                    value={editPrepTime}
                    onChange={(e) => setEditPrepTime(e.target.value)}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="cookTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Cook Time (min)
                  </label>
                  <input
                    type="number"
                    id="cookTime"
                    value={editCookTime}
                    onChange={(e) => setEditCookTime(e.target.value)}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="servings" className="block text-sm font-medium text-gray-700 mb-1">
                    Servings
                  </label>
                  <input
                    type="number"
                    id="servings"
                    value={editServings}
                    onChange={(e) => setEditServings(e.target.value)}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="cuisine" className="block text-sm font-medium text-gray-700 mb-1">
                    Cuisine
                  </label>
                  <input
                    type="text"
                    id="cuisine"
                    value={editCuisine}
                    onChange={(e) => setEditCuisine(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Appetizer">Appetizer</option>
                  <option value="Dessert">Dessert</option>
                  <option value="Snack">Snack</option>
                  <option value="Side Dish">Side Dish</option>
                  <option value="Beverage">Beverage</option>
                </select>
              </div>
            </div>

            {/* Ingredients */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Ingredients</h2>
              <p className="text-sm text-gray-500 mb-2">One ingredient per line</p>
              <textarea
                value={editIngredientsText}
                onChange={(e) => setEditIngredientsText(e.target.value)}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Instructions</h2>
              <p className="text-sm text-gray-500 mb-2">One step per line</p>
              <textarea
                value={editInstructionsText}
                onChange={(e) => setEditInstructionsText(e.target.value)}
                rows={10}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving || !editName.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* Recipe Card */
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
                  onClick={startEditing}
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
        )}
      </div>
    </div>
  )
}
