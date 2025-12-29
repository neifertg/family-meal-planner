'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GroupSelector from '@/components/GroupSelector'

type Recipe = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number | null
  cuisine: string | null
  category: string | null
  tags: string[] | null
  estimated_cost_usd: number | null
  cost_per_serving_usd: number | null
  created_at: string
  average_rating?: number
  rating_count?: number
  shared_groups?: Array<{
    umbrella_group_id: string
    umbrella_groups: {
      name: string
    }
  }>
}

// Star rating display component
function StarRating({ rating, count }: { rating?: number; count?: number }) {
  if (!rating || !count) return null

  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            className={`w-4 h-4 ${
              i < fullStars
                ? 'text-yellow-400 fill-current'
                : i === fullStars && hasHalfStar
                ? 'text-yellow-400'
                : 'text-gray-300'
            }`}
            fill={i < fullStars ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
            {i === fullStars && hasHalfStar && (
              <defs>
                <linearGradient id={`half-${i}`}>
                  <stop offset="50%" stopColor="currentColor" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
            )}
          </svg>
        ))}
      </div>
      <span className="text-sm font-medium text-gray-700">
        {rating.toFixed(1)}
      </span>
      <span className="text-xs text-gray-500">({count})</span>
    </div>
  )
}

export default function RecipesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCuisine, setSelectedCuisine] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'name'>('recent')
  const [showAddToMenuModal, setShowAddToMenuModal] = useState(false)
  const [selectedRecipeForMenu, setSelectedRecipeForMenu] = useState<Recipe | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner')
  const [addingToMenu, setAddingToMenu] = useState(false)

  useEffect(() => {
    loadRecipes()
  }, [selectedGroupId])

  const loadRecipes = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be logged in to view recipes')
        setLoading(false)
        return
      }

      // Get family ID for ratings lookup
      const { data: family } = await supabase
        .from('families')
        .select('id')
        .limit(1)
        .maybeSingle()

      let recipesData: any[] = []

      if (selectedGroupId) {
        // Filter recipes by selected umbrella group
        const { data, error } = await supabase
          .from('recipes')
          .select(`
            *,
            shared_groups:recipe_umbrella_group_shares!inner(
              umbrella_group_id,
              umbrella_groups(name)
            ),
            recipe_ratings(rating)
          `)
          .eq('recipe_umbrella_group_shares.umbrella_group_id', selectedGroupId)
          .order('created_at', { ascending: false })

        if (error) throw error
        recipesData = data || []
      } else {
        // Show all recipes
        const { data, error } = await supabase
          .from('recipes')
          .select(`
            *,
            shared_groups:recipe_umbrella_group_shares(
              umbrella_group_id,
              umbrella_groups(name)
            ),
            recipe_ratings(rating)
          `)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Aggregate shared_groups for each recipe (remove duplicates if recipe is in multiple groups)
        const recipeMap = new Map()
        data?.forEach((recipe: any) => {
          if (!recipeMap.has(recipe.id)) {
            recipeMap.set(recipe.id, { ...recipe, shared_groups: recipe.shared_groups || [] })
          }
        })

        recipesData = Array.from(recipeMap.values())
      }

      // Calculate average ratings for each recipe
      const recipesWithRatings = recipesData.map((recipe: any) => {
        const ratings = recipe.recipe_ratings || []
        const average_rating = ratings.length > 0
          ? ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length
          : undefined
        const rating_count = ratings.length

        // Debug: Log tags for first recipe
        if (recipesData.indexOf(recipe) === 0) {
          console.log('First recipe tags:', recipe.tags, 'Recipe name:', recipe.name)
        }

        return {
          ...recipe,
          average_rating,
          rating_count,
          recipe_ratings: undefined // Remove the raw ratings array from the final object
        }
      })

      setRecipes(recipesWithRatings)
    } catch (err: any) {
      console.error('Error loading recipes:', err)
      setError(err.message || 'Failed to load recipes')
    } finally {
      setLoading(false)
    }
  }

  const handleGroupChange = (groupId: string | null) => {
    setSelectedGroupId(groupId)
  }

  // Get unique cuisines and categories for filters
  const cuisines = useMemo(() => {
    const unique = [...new Set(recipes.map(r => r.cuisine).filter(Boolean))]
    return unique.sort()
  }, [recipes])

  const categories = useMemo(() => {
    const unique = [...new Set(recipes.map(r => r.category).filter(Boolean))]
    return unique.sort()
  }, [recipes])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    recipes.forEach(recipe => {
      recipe.tags?.forEach(tag => tagSet.add(tag))
    })
    const tags = Array.from(tagSet).sort()
    console.log('All tags found across recipes:', tags.length, tags)
    return tags
  }, [recipes])

  // Filter and sort recipes
  const filteredRecipes = useMemo(() => {
    const filtered = recipes.filter(recipe => {
      const matchesSearch = searchQuery === '' ||
        recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipe.description?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCuisine = selectedCuisine === '' || recipe.cuisine === selectedCuisine
      const matchesCategory = selectedCategory === '' || recipe.category === selectedCategory

      // Match if recipe has ALL selected tags
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.every(tag => recipe.tags?.includes(tag))

      return matchesSearch && matchesCuisine && matchesCategory && matchesTags
    })

    // Sort recipes
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          // Sort by rating (highest first), then by rating count, then by name
          const ratingA = a.average_rating || 0
          const ratingB = b.average_rating || 0
          if (ratingB !== ratingA) return ratingB - ratingA
          const countA = a.rating_count || 0
          const countB = b.rating_count || 0
          if (countB !== countA) return countB - countA
          return a.name.localeCompare(b.name)
        case 'name':
          return a.name.localeCompare(b.name)
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
  }, [recipes, searchQuery, selectedCuisine, selectedCategory, selectedTags, sortBy])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCuisine('')
    setSelectedCategory('')
    setSelectedTags([])
  }

  const hasActiveFilters = searchQuery || selectedCuisine || selectedCategory || selectedTags.length > 0

  const handleAddToMenu = (recipe: Recipe, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedRecipeForMenu(recipe)
    // Set default date to today
    const today = new Date().toISOString().split('T')[0]
    setSelectedDate(today)
    setShowAddToMenuModal(true)
  }

  const handleSaveToMenu = async () => {
    if (!selectedRecipeForMenu || !selectedDate) return

    setAddingToMenu(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get family ID
      const { data: family } = await supabase
        .from('families')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (!family?.id) throw new Error('No family found')

      // Add meal plan
      const { error } = await supabase
        .from('meal_plans')
        .insert({
          family_id: family.id,
          recipe_id: selectedRecipeForMenu.id,
          planned_date: selectedDate,
          meal_type: selectedMealType
        })

      if (error) throw error

      setShowAddToMenuModal(false)
      setSelectedRecipeForMenu(null)
      // Show success message
      alert(`Added "${selectedRecipeForMenu.name}" to ${selectedMealType} on ${new Date(selectedDate).toLocaleDateString()}`)
    } catch (error: any) {
      console.error('Error adding to menu:', error)
      alert(error.message || 'Failed to add to menu')
    } finally {
      setAddingToMenu(false)
    }
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 via-pink-500 to-rose-500 rounded-2xl p-8 mb-8 text-white shadow-xl">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold mb-2">My Recipes</h1>
                <p className="text-orange-100 text-lg">
                  {filteredRecipes.length} of {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/recipes/new"
                  className="bg-white hover:bg-white/90 text-rose-600 font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 inline-flex items-center gap-2 shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Recipe
                </Link>
              </div>
            </div>

            {/* Group Selector */}
            <div className="flex items-center gap-3">
              <span className="text-orange-100 font-medium">Filter by group:</span>
              <GroupSelector
                onGroupChange={handleGroupChange}
                currentGroupId={selectedGroupId}
              />
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        {recipes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search recipes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Cuisine Filter */}
              {cuisines.length > 0 && (
                <div className="md:w-48">
                  <select
                    value={selectedCuisine}
                    onChange={(e) => setSelectedCuisine(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  >
                    <option value="">All Cuisines</option>
                    {cuisines.map(cuisine => (
                      <option key={cuisine} value={cuisine!}>{cuisine}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category Filter */}
              {categories.length > 0 && (
                <div className="md:w-48">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  >
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category!}>{category}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tag Filter */}
              {allTags.length > 0 && (
                <div className="md:w-64">
                  <details className="relative group">
                    <summary className="cursor-pointer list-none px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 bg-white flex items-center justify-between">
                      <span>
                        {selectedTags.length === 0 ? 'Filter by Tags' : `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected`}
                      </span>
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {allTags.map(tag => (
                        <label
                          key={tag}
                          className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTags([...selectedTags, tag])
                              } else {
                                setSelectedTags(selectedTags.filter(t => t !== tag))
                              }
                            }}
                            className="w-4 h-4 text-rose-600 border-gray-300 rounded focus:ring-rose-500"
                          />
                          <span className="ml-2 text-sm text-gray-900">{tag}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {/* Sort By */}
              <div className="md:w-48">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'rating' | 'name')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 bg-gradient-to-r from-orange-50 to-rose-50 font-medium"
                >
                  <option value="recent">Most Recent</option>
                  <option value="rating">⭐ Highest Rated</option>
                  <option value="name">A-Z</option>
                </select>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 text-gray-600">
            Loading recipes...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && recipes.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No recipes yet</h2>
            <p className="text-gray-600 mb-6">
              {selectedGroupId
                ? "This group doesn't have any recipes assigned yet."
                : "No recipes available yet. Create your first recipe to get started!"}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard/groups/new"
                className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Create a Group
              </Link>
              <Link
                href="/dashboard/recipes/new"
                className="inline-block bg-gradient-to-r from-orange-500 via-pink-500 to-rose-500 hover:from-orange-600 hover:via-pink-600 hover:to-rose-600 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Add a Recipe
              </Link>
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && recipes.length > 0 && filteredRecipes.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No recipes found</h2>
            <p className="text-gray-600 mb-6">
              Try adjusting your search or filters
            </p>
            <button
              onClick={clearFilters}
              className="inline-block bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Recipe Grid */}
        {!loading && !error && filteredRecipes.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="group bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100 relative"
              >
                {/* Image */}
                <div className="h-48 bg-gray-200 overflow-hidden">
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                    {recipe.name}
                  </h3>
                  {recipe.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {recipe.description}
                    </p>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {recipe.cuisine && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        {recipe.cuisine}
                      </span>
                    )}
                    {recipe.category && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {recipe.category}
                      </span>
                    )}
                    {recipe.tags && recipe.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                    {recipe.tags && recipe.tags.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        +{recipe.tags.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Group Badges */}
                  {recipe.shared_groups && recipe.shared_groups.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {recipe.shared_groups.slice(0, 2).map((share, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-200"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {share.umbrella_groups.name}
                        </span>
                      ))}
                      {recipe.shared_groups.length > 2 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                          +{recipe.shared_groups.length - 2} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Cost Badge */}
                  {recipe.estimated_cost_usd && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-semibold border border-green-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ${recipe.estimated_cost_usd.toFixed(2)}
                        {recipe.cost_per_serving_usd && (
                          <span className="text-green-600">
                            (${recipe.cost_per_serving_usd.toFixed(2)}/serving)
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    {recipe.prep_time_minutes && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {recipe.prep_time_minutes}m
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {recipe.servings}
                      </span>
                    )}
                  </div>

                  {/* Family Rating */}
                  {recipe.average_rating && recipe.rating_count && (
                    <div className="mb-3 pb-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">Family Rating:</span>
                        <StarRating rating={recipe.average_rating} count={recipe.rating_count} />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3">
                    <Link
                      href={`/dashboard/recipes/${recipe.id}`}
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg hover:from-orange-600 hover:to-pink-600 transition-all text-sm font-medium text-center"
                    >
                      View Recipe
                    </Link>
                    <button
                      onClick={(e) => handleAddToMenu(recipe, e)}
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all text-sm font-medium inline-flex items-center justify-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add to Menu
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add to Menu Modal */}
        {showAddToMenuModal && selectedRecipeForMenu && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Add to Weekly Menu</h3>
                  <button
                    onClick={() => setShowAddToMenuModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">{selectedRecipeForMenu.name}</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Date Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    required
                  />
                </div>

                {/* Meal Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meal Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => (
                      <button
                        key={mealType}
                        onClick={() => setSelectedMealType(mealType)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          selectedMealType === mealType
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowAddToMenuModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveToMenu}
                  disabled={!selectedDate || addingToMenu}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingToMenu ? 'Adding...' : 'Add to Menu'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
