'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import RecipePhotoOCR from '@/components/RecipePhotoOCR'
import RecipeURLScraper from '@/components/RecipeURLScraper'
import { parseRecipeText } from '@/lib/parseRecipeText'
import { ExtractedRecipe } from '@/lib/llmRecipeExtractor/types'
import ErrorBanner from '@/components/ErrorBanner'
import { InputField, TextAreaField } from '@/components/FormField'

export default function NewRecipePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploadMode, setImageUploadMode] = useState<'url' | 'upload'>('url')
  const [owner, setOwner] = useState('')
  const [uploadedBy, setUploadedBy] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
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
    setName(String(recipe.title || ''))
    setDescription(String(recipe.description || ''))
    setPrepTime(recipe.prep_time_minutes ? String(recipe.prep_time_minutes) : '')
    setCookTime(recipe.cook_time_minutes ? String(recipe.cook_time_minutes) : '')
    setServings(recipe.servings ? String(recipe.servings) : '')
    setCuisine(String(recipe.cuisine || ''))
    setCategory(String(recipe.category || ''))
    setImageUrl(String(recipe.image_url || ''))

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
    setFieldErrors({})

    // Validate required fields
    const errors: Record<string, string> = {}

    if (!name.trim()) {
      errors.name = 'Recipe name is required'
    }

    if (!ingredientsText.trim()) {
      errors.ingredients = 'Please add at least one ingredient'
    }

    if (!instructionsText.trim()) {
      errors.instructions = 'Please add at least one instruction'
    }

    // If there are validation errors, show them
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setError('Please fill in all required fields')
      return
    }

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

      // Calculate cost per serving if cost and servings are provided
      const totalCost = estimatedCost ? parseFloat(estimatedCost) : null
      const servingCount = servings ? parseInt(servings) : null
      const costPerServing = (totalCost && servingCount) ? totalCost / servingCount : null

      // Upload image if file is provided
      let uploadedImageUrl = imageUrl
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
        const filePath = `recipe-images/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('recipe-images')
          .upload(filePath, imageFile)

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('recipe-images')
          .getPublicUrl(filePath)

        uploadedImageUrl = publicUrl
      }

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
        servings: servingCount,
        cuisine: (cuisine || '').trim() || null,
        category: (category || '').trim() || null,
        image_url: uploadedImageUrl || null,
        owner: (owner || '').trim() || null,
        uploaded_by: (uploadedBy || '').trim() || null,
        estimated_cost_usd: totalCost,
        cost_per_serving_usd: costPerServing,
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
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

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
            <InputField
              label="Recipe Name"
              required
              error={fieldErrors.name}
              type="text"
              id="name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="e.g., Homemade Pizza"
            />

            <TextAreaField
              label="Description"
              error={fieldErrors.description}
              id="description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="A brief description of your recipe..."
              rows={2}
            />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Recipe Image
              </label>

              {/* Tab buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setImageUploadMode('url')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    imageUploadMode === 'url'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Image URL
                </button>
                <button
                  type="button"
                  onClick={() => setImageUploadMode('upload')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    imageUploadMode === 'upload'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Upload Image
                </button>
              </div>

              {/* URL input */}
              {imageUploadMode === 'url' && (
                <input
                  type="url"
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value)
                    setImageFile(null)
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow text-gray-900 placeholder:text-gray-400"
                />
              )}

              {/* File upload */}
              {imageUploadMode === 'upload' && (
                <div className="space-y-2">
                  <input
                    type="file"
                    id="imageFile"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setImageFile(file)
                        setImageUrl('')
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 text-gray-900 placeholder:text-gray-400"
                  />
                  {imageFile && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{imageFile.name}</span>
                      <span className="text-gray-400">({(imageFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow text-gray-900 placeholder:text-gray-400"
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
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow text-gray-900 placeholder:text-gray-400"
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
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow text-gray-900 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label htmlFor="estimatedCost" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Cost ($)
                </label>
                <input
                  type="number"
                  id="estimatedCost"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="12.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow text-gray-900 placeholder:text-gray-400"
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
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow text-gray-900 placeholder:text-gray-400"
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow text-gray-900 placeholder:text-gray-400"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="owner" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Recipe Owner
                </label>
                <input
                  type="text"
                  id="owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g., Grandma, Mom"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow text-gray-900 placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">Who owns or created this recipe (optional)</p>
              </div>

              <div>
                <label htmlFor="uploadedBy" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Uploaded By
                </label>
                <input
                  type="text"
                  id="uploadedBy"
                  value={uploadedBy}
                  onChange={(e) => setUploadedBy(e.target.value)}
                  placeholder="e.g., Your name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow text-gray-900 placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">Who added this recipe to the app (optional)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="text-2xl">🥘</span>
            Ingredients
          </h2>
          <p className="text-sm text-gray-500 mb-3">Enter one ingredient per line</p>
          <TextAreaField
            label=""
            required
            error={fieldErrors.ingredients}
            scrollToError={true}
            value={ingredientsText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIngredientsText(e.target.value)}
            placeholder="1 cup flour&#10;2 eggs&#10;1/2 cup sugar&#10;1 tsp vanilla extract"
            rows={7}
            className="font-mono text-sm"
          />
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="text-2xl">👨‍🍳</span>
            Instructions
          </h2>
          <p className="text-sm text-gray-500 mb-3">Enter one step per line</p>
          <TextAreaField
            label=""
            required
            error={fieldErrors.instructions}
            scrollToError={true}
            value={instructionsText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInstructionsText(e.target.value)}
            placeholder="Preheat oven to 350°F&#10;Mix dry ingredients in a bowl&#10;Add wet ingredients and stir until combined&#10;Pour into baking pan&#10;Bake for 25-30 minutes"
            rows={8}
            className="font-mono text-sm"
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
