'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import RecipeRating from '@/components/RecipeRating'
import ShareRecipeModal from '@/components/ShareRecipeModal'
import UmbrellaGroupRecipeRating from '@/components/UmbrellaGroupRecipeRating'
import TagInput, { COMMON_RECIPE_TAGS } from '@/components/TagInput'

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
  tags: string[] | null
  owner?: string | null
  uploaded_by?: string | null
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
  const [showShareModal, setShowShareModal] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPrepTime, setEditPrepTime] = useState('')
  const [editCookTime, setEditCookTime] = useState('')
  const [editServings, setEditServings] = useState('')
  const [editCuisine, setEditCuisine] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImageUploadMode, setEditImageUploadMode] = useState<'url' | 'upload'>('url')
  const [editOwner, setEditOwner] = useState('')
  const [editUploadedBy, setEditUploadedBy] = useState('')
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
    setEditTags(recipe.tags || [])
    setEditImageUrl(recipe.image_url || '')
    setEditOwner(recipe.owner || '')
    setEditUploadedBy(recipe.uploaded_by || '')
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

      // Upload image if file is provided
      let uploadedImageUrl = editImageUrl
      if (editImageFile) {
        const fileExt = editImageFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
        const filePath = `recipe-images/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('recipe-images')
          .upload(filePath, editImageFile)

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('recipe-images')
          .getPublicUrl(filePath)

        uploadedImageUrl = publicUrl
      }

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
        tags: editTags.length > 0 ? editTags : null,
        image_url: uploadedImageUrl || null,
        owner: (editOwner || '').trim() || null,
        uploaded_by: (editUploadedBy || '').trim() || null,
        ingredients,
        instructions,
      }

      const { data, error: updateError } = await supabase
        .from('recipes')
        .update(updateData as any)
        .eq('id', recipe.id)
        .select()
        .single()

      if (updateError) throw updateError

      setRecipe(data as Recipe)
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
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading recipe...</div>
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-red-600 mb-4">{error || 'Recipe not found'}</div>
          <Link
            href="/dashboard/recipes"
            className="text-rose-600 hover:text-rose-700 font-medium"
          >
            ← Back to Recipes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto">

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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipe Image
                </label>

                {/* Tab buttons */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setEditImageUploadMode('url')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      editImageUploadMode === 'url'
                        ? 'bg-rose-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Image URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditImageUploadMode('upload')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      editImageUploadMode === 'upload'
                        ? 'bg-rose-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Upload Image
                  </button>
                </div>

                {/* URL input */}
                {editImageUploadMode === 'url' && (
                  <input
                    type="url"
                    id="imageUrl"
                    value={editImageUrl}
                    onChange={(e) => {
                      setEditImageUrl(e.target.value)
                      setEditImageFile(null)
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  />
                )}

                {/* File upload */}
                {editImageUploadMode === 'upload' && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      id="imageFile"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setEditImageFile(file)
                          setEditImageUrl('')
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 text-gray-900 placeholder:text-gray-400"
                    />
                    {editImageFile && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{editImageFile.name}</span>
                        <span className="text-gray-400">({(editImageFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    )}
                  </div>
                )}
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
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

              {/* Tags */}
              <div>
                <TagInput
                  tags={editTags}
                  onChange={setEditTags}
                  suggestions={COMMON_RECIPE_TAGS}
                  label="Tags"
                  placeholder="Add tags like 'mexican', 'soup', 'dinner'..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Add tags to help categorize and search for this recipe (e.g., dinner, soup, mexican, quick, healthy)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="editOwner" className="block text-sm font-medium text-gray-700 mb-1">
                    Recipe Owner
                  </label>
                  <input
                    type="text"
                    id="editOwner"
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    placeholder="e.g., Grandma, Mom"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">Who owns or created this recipe (optional)</p>
                </div>

                <div>
                  <label htmlFor="editUploadedBy" className="block text-sm font-medium text-gray-700 mb-1">
                    Uploaded By
                  </label>
                  <input
                    type="text"
                    id="editUploadedBy"
                    value={editUploadedBy}
                    onChange={(e) => setEditUploadedBy(e.target.value)}
                    placeholder="e.g., Your name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">Who added this recipe to the app (optional)</p>
                </div>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent font-mono text-sm text-gray-900 placeholder:text-gray-400"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent font-mono text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving || !editName.trim()}
                className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
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
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                      {recipe.cuisine}
                    </span>
                  )}
                  {recipe.category && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                      {recipe.category}
                    </span>
                  )}
                  {recipe.tags && recipe.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
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
                        <span className="text-rose-500 mt-1">•</span>
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
                        <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-rose-500 to-pink-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
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
                    className="text-rose-600 hover:text-rose-700 font-medium inline-flex items-center gap-2"
                  >
                    View Original Recipe
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}

              {/* Umbrella Group Ratings */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Group Ratings</h2>
                <UmbrellaGroupRecipeRating
                  recipeId={recipe.id}
                  recipeName={recipe.name}
                />
              </div>

              {/* Family Ratings */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Household Ratings</h2>
                <RecipeRating
                  recipeId={recipe.id}
                  recipeName={recipe.name}
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex-1 min-w-[200px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share with Groups
                </button>
                <button
                  onClick={startEditing}
                  className="flex-1 min-w-[200px] bg-gradient-to-r from-purple-500 to-rose-500 hover:from-purple-600 hover:to-rose-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
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

        {/* Share Modal */}
        {recipe && (
          <ShareRecipeModal
            recipeId={recipe.id}
            recipeName={recipe.name}
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </div>
    </div>
  )
}
