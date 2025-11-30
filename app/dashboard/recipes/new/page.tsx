'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewRecipePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [servings, setServings] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [category, setCategory] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [ingredientsText, setIngredientsText] = useState('')
  const [instructionsText, setInstructionsText] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Not authenticated')

      // Get user's family
      const { data: family, error: familyError } = await supabase
        .from('families')
        .select('id')
        .eq('created_by', user.id)
        .single()

      if (familyError || !family) throw new Error('Family not found')

      const familyId = (family as { id: string }).id

      // Parse ingredients (one per line)
      const ingredients = ingredientsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      // Parse instructions (one per line or numbered)
      const instructions = instructionsText
        .split('\n')
        .map(line => line.trim().replace(/^\d+\.\s*/, '')) // Remove leading numbers
        .filter(line => line.length > 0)

      // Create recipe
      const recipeData = {
        family_id: familyId,
        name: name.trim(),
        description: description.trim() || null,
        prep_time_minutes: prepTime ? parseInt(prepTime) : null,
        cook_time_minutes: cookTime ? parseInt(cookTime) : null,
        total_time_minutes: (prepTime || cookTime)
          ? (parseInt(prepTime || '0') + parseInt(cookTime || '0'))
          : null,
        servings: servings ? parseInt(servings) : null,
        cuisine: cuisine.trim() || null,
        category: category.trim() || null,
        image_url: imageUrl.trim() || null,
        ingredients,
        instructions,
        created_by: user.id,
      } as any

      const { data: recipe, error: insertError } = await supabase
        .from('recipes')
        .insert(recipeData)
        .select()
        .single()

      if (insertError) throw insertError

      router.push(`/dashboard/recipes/${recipe.id}`)
    } catch (err: any) {
      console.error('Error creating recipe:', err)
      setError(err.message || 'Failed to create recipe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Create New Recipe</h1>
          <p className="text-gray-600 mt-2">
            Add your own recipe to your collection
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Recipe Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Homemade Pizza"
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your recipe..."
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
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
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
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  placeholder="15"
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
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  placeholder="30"
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
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="4"
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
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  placeholder="Italian"
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
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
            <p className="text-sm text-gray-500 mb-2">Enter one ingredient per line</p>
            <textarea
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder="1 cup flour
2 eggs
1/2 cup sugar
1 tsp vanilla extract"
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          {/* Instructions */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Instructions</h2>
            <p className="text-sm text-gray-500 mb-2">Enter one step per line</p>
            <textarea
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder="Preheat oven to 350°F
Mix dry ingredients in a bowl
Add wet ingredients and stir until combined
Pour into baking pan
Bake for 25-30 minutes"
              rows={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Recipe'}
            </button>
            <Link
              href="/dashboard/recipes"
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
