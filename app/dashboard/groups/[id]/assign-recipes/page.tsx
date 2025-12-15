'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Recipe = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  cuisine: string | null
  category: string | null
  created_by_user_id: string | null
  created_at: string
  creator?: {
    display_name: string
    email: string
  }
  is_assigned?: boolean
}

export default function AssignRecipesPage({ params }: { params: Promise<{ id: string }> }) {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState<string>('')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCuisine, setSelectedCuisine] = useState<string>('')
  const [selectedCreator, setSelectedCreator] = useState<string>('')
  const [showAssignedOnly, setShowAssignedOnly] = useState(false)
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    params.then(({ id }) => {
      setGroupId(id)
    })
  }, [params])

  useEffect(() => {
    if (groupId) {
      loadGroupAndRecipes()
    }
  }, [groupId])

  const loadGroupAndRecipes = async () => {
    if (!groupId) return

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in')
        return
      }

      // Load group details
      const { data: groupData, error: groupError } = await supabase
        .from('umbrella_groups')
        .select('name')
        .eq('id', groupId)
        .single()

      if (groupError) throw groupError
      setGroupName(groupData.name)

      // Load all recipes with creator info and assignment status
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select(`
          *,
          creator:users!recipes_created_by_user_id_fkey (
            display_name,
            email
          ),
          shares:recipe_umbrella_group_shares!left(
            umbrella_group_id
          )
        `)
        .order('created_at', { ascending: false })

      if (recipesError) throw recipesError

      // Process recipes to determine assignment status
      const processedRecipes = recipesData.map((recipe: any) => ({
        ...recipe,
        creator: recipe.creator,
        is_assigned: recipe.shares?.some((s: any) => s.umbrella_group_id === groupId) || false
      }))

      setRecipes(processedRecipes)

      // Pre-select already assigned recipes
      const assignedIds = new Set(
        processedRecipes
          .filter((r: Recipe) => r.is_assigned)
          .map((r: Recipe) => r.id)
      )
      setSelectedRecipes(assignedIds)
    } catch (err: any) {
      console.error('Error loading data:', err)
      setError(err.message || 'Failed to load recipes')
    } finally {
      setLoading(false)
    }
  }

  // Get unique cuisines and creators for filters
  const cuisines = useMemo(() => {
    const unique = [...new Set(recipes.map(r => r.cuisine).filter(Boolean))]
    return unique.sort()
  }, [recipes])

  const creators = useMemo(() => {
    const unique = [...new Set(recipes.map(r => r.creator?.display_name || r.creator?.email).filter(Boolean))]
    return unique.sort()
  }, [recipes])

  // Filter recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      const matchesSearch = searchQuery === '' ||
        recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipe.description?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCuisine = selectedCuisine === '' || recipe.cuisine === selectedCuisine

      const creatorName = recipe.creator?.display_name || recipe.creator?.email || ''
      const matchesCreator = selectedCreator === '' || creatorName === selectedCreator

      const matchesAssignedFilter =
        (!showAssignedOnly && !showUnassignedOnly) ||
        (showAssignedOnly && recipe.is_assigned) ||
        (showUnassignedOnly && !recipe.is_assigned)

      return matchesSearch && matchesCuisine && matchesCreator && matchesAssignedFilter
    })
  }, [recipes, searchQuery, selectedCuisine, selectedCreator, showAssignedOnly, showUnassignedOnly])

  const handleToggleRecipe = (recipeId: string) => {
    const newSelected = new Set(selectedRecipes)
    if (newSelected.has(recipeId)) {
      newSelected.delete(recipeId)
    } else {
      newSelected.add(recipeId)
    }
    setSelectedRecipes(newSelected)
  }

  const handleSelectAll = () => {
    const allFilteredIds = new Set(filteredRecipes.map(r => r.id))
    setSelectedRecipes(allFilteredIds)
  }

  const handleDeselectAll = () => {
    setSelectedRecipes(new Set())
  }

  const handleSave = async () => {
    if (!groupId) return

    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get currently assigned recipe IDs
      const currentlyAssigned = new Set(recipes.filter(r => r.is_assigned).map(r => r.id))

      // Determine what to add and remove
      const toAdd = Array.from(selectedRecipes).filter(id => !currentlyAssigned.has(id))
      const toRemove = Array.from(currentlyAssigned).filter(id => !selectedRecipes.has(id))

      // Remove unassigned recipes
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('recipe_umbrella_group_shares')
          .delete()
          .eq('umbrella_group_id', groupId)
          .in('recipe_id', toRemove)

        if (deleteError) throw deleteError
      }

      // Add newly assigned recipes
      if (toAdd.length > 0) {
        const sharesToInsert = toAdd.map(recipeId => ({
          recipe_id: recipeId,
          umbrella_group_id: groupId,
          shared_by_user_id: user.id
        }))

        const { error: insertError } = await supabase
          .from('recipe_umbrella_group_shares')
          .insert(sharesToInsert)

        if (insertError) throw insertError
      }

      // Navigate back to group page
      router.push(`/dashboard/groups/${groupId}`)
    } catch (err: any) {
      console.error('Error saving assignments:', err)
      setError(err.message || 'Failed to save recipe assignments')
    } finally {
      setSaving(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCuisine('')
    setSelectedCreator('')
    setShowAssignedOnly(false)
    setShowUnassignedOnly(false)
  }

  const hasActiveFilters = searchQuery || selectedCuisine || selectedCreator || showAssignedOnly || showUnassignedOnly

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading recipes...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 mb-8 text-white shadow-xl">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <Link
                href={`/dashboard/groups/${groupId}`}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-4xl font-bold">Assign Recipes</h1>
                <p className="text-indigo-100 text-lg mt-1">{groupName}</p>
              </div>
            </div>
            <p className="text-indigo-100">
              {selectedRecipes.size} of {recipes.length} recipes selected
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Filters and Actions */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-6">
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Cuisine Filter */}
            {cuisines.length > 0 && (
              <select
                value={selectedCuisine}
                onChange={(e) => setSelectedCuisine(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              >
                <option value="">All Cuisines</option>
                {cuisines.map(cuisine => (
                  <option key={cuisine} value={cuisine!}>{cuisine}</option>
                ))}
              </select>
            )}

            {/* Creator Filter */}
            {creators.length > 0 && (
              <select
                value={selectedCreator}
                onChange={(e) => setSelectedCreator(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              >
                <option value="">All Creators</option>
                {creators.map(creator => (
                  <option key={creator} value={creator!}>{creator}</option>
                ))}
              </select>
            )}

            {/* Assignment Filter */}
            <select
              value={showAssignedOnly ? 'assigned' : showUnassignedOnly ? 'unassigned' : 'all'}
              onChange={(e) => {
                setShowAssignedOnly(e.target.value === 'assigned')
                setShowUnassignedOnly(e.target.value === 'unassigned')
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            >
              <option value="all">All Recipes</option>
              <option value="assigned">Already Assigned</option>
              <option value="unassigned">Not Assigned</option>
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Bulk Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium text-sm"
            >
              Select All Filtered ({filteredRecipes.length})
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Recipe Grid */}
        {filteredRecipes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No recipes found</h2>
            <p className="text-gray-600">
              {hasActiveFilters ? 'Try adjusting your filters' : 'No recipes available'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {filteredRecipes.map((recipe) => {
              const isSelected = selectedRecipes.has(recipe.id)
              return (
                <div
                  key={recipe.id}
                  onClick={() => handleToggleRecipe(recipe.id)}
                  className={`cursor-pointer bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 border-2 ${
                    isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-100 hover:border-indigo-300'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="absolute top-4 right-4 z-10">
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Image */}
                  <div className="h-48 bg-gray-200 overflow-hidden relative">
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
                      {recipe.is_assigned && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                          Currently Assigned
                        </span>
                      )}
                    </div>

                    {/* Creator */}
                    {recipe.creator && (
                      <div className="text-xs text-gray-500">
                        By {recipe.creator.display_name || recipe.creator.email}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Sticky Footer */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 p-4 shadow-lg z-30">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{selectedRecipes.size}</span> recipes selected
            </div>
            <div className="flex gap-3">
              <Link
                href={`/dashboard/groups/${groupId}`}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>

        {/* Spacer for sticky footer */}
        <div className="h-20"></div>
      </div>
    </div>
  )
}
