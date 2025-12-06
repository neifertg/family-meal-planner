'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import RecipePhotoOCR from '@/components/RecipePhotoOCR'
import RecipeURLScraper from '@/components/RecipeURLScraper'
import { parseRecipeText } from '@/lib/parseRecipeText'
import { ExtractedRecipe } from '@/lib/llmRecipeExtractor/types'

export default function NewRecipePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOCR, setShowOCR] = useState(false)
  const [showURLScraper, setShowURLScraper] = useState(false)

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

  const handleTextExtracted = (text: string) => {
    const parsed = parseRecipeText(text)

    // Fill in form fields with parsed data
    if (parsed.name) setName(parsed.name)
    if (parsed.description) setDescription(parsed.description)
    if (parsed.prepTime) setPrepTime(parsed.prepTime)
    if (parsed.cookTime) setCookTime(parsed.cookTime)
    if (parsed.servings) setServings(parsed.servings)
    if (parsed.ingredients) setIngredientsText(parsed.ingredients)
    if (parsed.instructions) setInstructionsText(parsed.instructions)

    setShowOCR(false)
  }

  const handleRecipeScraped = (recipe: ExtractedRecipe) => {
    // Fill in form fields with extracted data - ensure all values are strings
    setName(recipe.title || '')
    setDescription(recipe.description || '')
    setPrepTime(recipe.prep_time_minutes ? recipe.prep_time_minutes.toString() : '')
    setCookTime(recipe.cook_time_minutes ? recipe.cook_time_minutes.toString() : '')
    setServings(recipe.servings ? recipe.servings.toString() : '')
    setCuisine(recipe.cuisine || '')
    setCategory(recipe.category || '')
    setImageUrl(recipe.image_url || '')

    // Convert structured ingredients to text
    if (recipe.ingredients) {
      const ingredientsText = recipe.ingredients.map(ing => {
        let text = ''
        if (ing.quantity) text += `${ing.quantity} `
        if (ing.unit) text += `${ing.unit} `
        text += ing.item
        if (ing.preparation) text += `, ${ing.preparation}`
        return text
      }).join('\n')
      setIngredientsText(ingredientsText)
    }

    // Convert structured instructions to text
    if (recipe.instructions) {
      const instructionsText = recipe.instructions.map(inst => inst.instruction).join('\n')
      setInstructionsText(instructionsText)
    }

    setShowURLScraper(false)
  }

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

      // Create recipe - ensure all string fields are safely trimmed
      const recipeData = {
        family_id: familyId,
        name: (name || '').trim(),
        description: (description || '').trim() || null,
        prep_time_minutes: prepTime ? parseInt(prepTime) : null,
        cook_time_minutes: cookTime ? parseInt(cookTime) : null,
        total_time_minutes: (prepTime || cookTime)
          ? (parseInt(prepTime || '0') + parseInt(cookTime || '0'))
          : null,
        servings: servings ? parseInt(servings) : null,
        cuisine: (cuisine || '').trim() || null,
        category: (category || '').trim() || null,
        image_url: (imageUrl || '').trim() || null,
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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 rounded-2xl p-6 md:p-8 mb-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">Add Recipe</h1>
            <p className="text-purple-100">
              Import from a URL, upload a photo, or create manually
            </p>
          </div>
          <Link
            href="/dashboard/recipes"
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm font-medium text-center"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* URL Scraper Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">🔗</span>
              Import from URL
            </h2>
            <button
              type="button"
              onClick={() => setShowURLScraper(!showURLScraper)}
              className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
            >
              {showURLScraper ? 'Hide' : 'Show'}
            </button>
          </div>

          {showURLScraper && (
            <RecipeURLScraper onRecipeScraped={handleRecipeScraped} />
          )}

          {!showURLScraper && (
            <p className="text-sm text-gray-600">
              Have a recipe URL? Click "Show" to import recipe data from websites automatically.
            </p>
          )}
        </div>

        {/* OCR Photo Upload Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">📸</span>
              Upload Recipe Photo
            </h2>
            <button
              type="button"
              onClick={() => setShowOCR(!showOCR)}
              className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
            >
              {showOCR ? 'Hide' : 'Show'}
            </button>
          </div>

          {showOCR && (
            <RecipePhotoOCR
              onTextExtracted={handleTextExtracted}
              onRecipeExtracted={handleRecipeScraped}
            />
          )}

          {!showOCR && (
            <p className="text-sm text-gray-600">
              Have a recipe photo? Click "Show" to upload an image and we'll automatically extract the recipe using AI-powered vision.
            </p>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📝</span>
            Basic Information
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Recipe Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Homemade Pizza"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your recipe..."
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
              />
            </div>

            <div>
              <label htmlFor="imageUrl" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Image URL
              </label>
              <input
                type="url"
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label htmlFor="prepTime" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Prep (min)
                </label>
                <input
                  type="number"
                  id="prepTime"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  placeholder="15"
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="cookTime" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Cook (min)
                </label>
                <input
                  type="number"
                  id="cookTime"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  placeholder="30"
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="servings" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Servings
                </label>
                <input
                  type="number"
                  id="servings"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="4"
                  min="1"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="cuisine" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Cuisine
                </label>
                <input
                  type="text"
                  id="cuisine"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  placeholder="Italian"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
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
        </div>

        {/* Ingredients */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🥘</span>
            Ingredients
          </h2>
          <p className="text-sm text-gray-500 mb-3">Enter one ingredient per line</p>
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            placeholder="1 cup flour&#10;2 eggs&#10;1/2 cup sugar&#10;1 tsp vanilla extract"
            rows={7}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm transition-shadow"
          />
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">👨‍🍳</span>
            Instructions
          </h2>
          <p className="text-sm text-gray-500 mb-3">Enter one step per line</p>
          <textarea
            value={instructionsText}
            onChange={(e) => setInstructionsText(e.target.value)}
            placeholder="Preheat oven to 350°F&#10;Mix dry ingredients in a bowl&#10;Add wet ingredients and stir until combined&#10;Pour into baking pan&#10;Bake for 25-30 minutes"
            rows={8}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm transition-shadow"
          />
        </div>

        {/* Submit */}
        <div className="sticky bottom-4 bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex gap-3">
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
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
  )
}
