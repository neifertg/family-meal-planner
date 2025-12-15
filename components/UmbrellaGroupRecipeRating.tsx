'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UmbrellaGroupWithMembership } from '@/types/umbrella-groups'

type User = {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
}

type GroupRating = {
  id: string
  recipe_id: string
  umbrella_group_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  user: User
}

type GroupRatingStats = {
  umbrella_group_id: string
  umbrella_group_name: string
  avg_rating: number
  rating_count: number
}

type UmbrellaGroupRecipeRatingProps = {
  recipeId: string
  recipeName: string
}

export default function UmbrellaGroupRecipeRating({ recipeId, recipeName }: UmbrellaGroupRecipeRatingProps) {
  const supabase = createClient()
  const [groups, setGroups] = useState<UmbrellaGroupWithMembership[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groupRatings, setGroupRatings] = useState<GroupRating[]>([])
  const [groupStats, setGroupStats] = useState<GroupRatingStats[]>([])
  const [globalAvg, setGlobalAvg] = useState<number>(0)
  const [globalCount, setGlobalCount] = useState<number>(0)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredStars, setHoveredStars] = useState<number>(0)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    loadData()
  }, [recipeId])

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupRatings(selectedGroupId)
    }
  }, [selectedGroupId])

  const loadData = async () => {
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Load user info
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (userData) {
        setCurrentUser(userData)
      }

      // Load groups that this recipe is shared with
      const { data: shares } = await supabase
        .from('recipe_umbrella_group_shares')
        .select(`
          umbrella_group_id,
          umbrella_groups (
            id,
            name,
            description,
            logo_url,
            privacy_level,
            created_by_user_id,
            created_at,
            updated_at
          )
        `)
        .eq('recipe_id', recipeId)

      if (shares) {
        const groupsList: UmbrellaGroupWithMembership[] = shares
          .map((s: any) => s.umbrella_groups)
          .filter((g: any) => g?.id)

        setGroups(groupsList)

        // Set first group as selected by default
        if (groupsList.length > 0) {
          setSelectedGroupId(groupsList[0].id)
        }
      }

      // Load rating statistics for all groups
      const { data: ratingsData } = await supabase
        .from('umbrella_group_recipe_ratings')
        .select(`
          umbrella_group_id,
          rating,
          umbrella_groups (
            name
          )
        `)
        .eq('recipe_id', recipeId)

      if (ratingsData) {
        // Calculate stats per group
        const statsMap = new Map<string, { name: string; ratings: number[] }>()

        ratingsData.forEach((r: any) => {
          const groupId = r.umbrella_group_id
          const groupName = r.umbrella_groups?.name || 'Unknown Group'

          if (!statsMap.has(groupId)) {
            statsMap.set(groupId, { name: groupName, ratings: [] })
          }
          statsMap.get(groupId)!.ratings.push(r.rating)
        })

        const stats: GroupRatingStats[] = Array.from(statsMap.entries()).map(([groupId, data]) => ({
          umbrella_group_id: groupId,
          umbrella_group_name: data.name,
          avg_rating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
          rating_count: data.ratings.length
        }))

        setGroupStats(stats)

        // Calculate global average
        const allRatings = Array.from(statsMap.values()).flatMap(d => d.ratings)
        if (allRatings.length > 0) {
          setGlobalAvg(allRatings.reduce((a, b) => a + b, 0) / allRatings.length)
          setGlobalCount(allRatings.length)
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadGroupRatings = async (groupId: string) => {
    const { data } = await supabase
      .from('umbrella_group_recipe_ratings')
      .select(`
        id,
        recipe_id,
        umbrella_group_id,
        user_id,
        rating,
        comment,
        created_at,
        user:users (
          id,
          email,
          display_name,
          avatar_url
        )
      `)
      .eq('recipe_id', recipeId)
      .eq('umbrella_group_id', groupId)

    if (data) {
      setGroupRatings(data as any)
    }
  }

  const handleRating = async (rating: number) => {
    if (!currentUser || !selectedGroupId) return

    const { error } = await supabase
      .from('umbrella_group_recipe_ratings')
      .upsert({
        recipe_id: recipeId,
        umbrella_group_id: selectedGroupId,
        user_id: currentUser.id,
        rating: rating
      }, {
        onConflict: 'recipe_id,umbrella_group_id,user_id'
      })

    if (!error) {
      loadData()
      loadGroupRatings(selectedGroupId)
    }
  }

  const handleCommentUpdate = async (comment: string) => {
    if (!currentUser || !selectedGroupId) return

    const { error } = await supabase
      .from('umbrella_group_recipe_ratings')
      .upsert({
        recipe_id: recipeId,
        umbrella_group_id: selectedGroupId,
        user_id: currentUser.id,
        comment: comment
      }, {
        onConflict: 'recipe_id,umbrella_group_id,user_id'
      })

    if (!error) {
      loadGroupRatings(selectedGroupId)
    }
  }

  const getUserRating = () => {
    if (!currentUser) return null
    return groupRatings.find(r => r.user_id === currentUser.id)
  }

  const getGroupAverage = () => {
    if (!selectedGroupId) return 0
    const stat = groupStats.find(s => s.umbrella_group_id === selectedGroupId)
    return stat?.avg_rating || 0
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading ratings...</div>
  }

  if (groups.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600 mb-2">This recipe hasn't been shared with any groups yet.</p>
        <p className="text-xs text-gray-500">Share it with an umbrella group to start collecting ratings!</p>
      </div>
    )
  }

  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  const userRating = getUserRating()
  const currentRating = userRating?.rating || 0
  const groupAverage = getGroupAverage()

  return (
    <div className="space-y-6">
      {/* Global Stats Banner */}
      {globalCount > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-purple-900 mb-1">Overall Rating Across All Groups</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-purple-700">{globalAvg.toFixed(1)}</div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-4 h-4 ${star <= Math.round(globalAvg) ? 'text-amber-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-purple-600">({globalCount} ratings)</span>
              </div>
            </div>

            {/* Group Breakdown */}
            {groupStats.length > 1 && (
              <div className="text-xs text-purple-700 space-y-1">
                {groupStats.map(stat => (
                  <div key={stat.umbrella_group_id} className="flex items-center gap-2">
                    <span className="font-medium">{stat.umbrella_group_name}:</span>
                    <span>{stat.avg_rating.toFixed(1)}★ ({stat.rating_count})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Selector */}
      {groups.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Group</label>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedGroupId === group.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300'
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedGroup && (
        <>
          {/* Group Average */}
          {groupRatings.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-600">{groupAverage.toFixed(1)}</div>
                  <div className="text-xs text-amber-700">Average</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-5 h-5 ${star <= Math.round(groupAverage) ? 'text-amber-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <div className="text-xs text-amber-700">
                    {groupRatings.length} {groupRatings.length === 1 ? 'rating' : 'ratings'} in {selectedGroup.name}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Your Rating */}
          {currentUser && (
            <div className="bg-white border-2 border-indigo-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Your Rating in {selectedGroup.name}</h4>

              <div className="flex items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = isHovered ? star <= hoveredStars : star <= currentRating
                  return (
                    <button
                      key={star}
                      onMouseEnter={() => {
                        setIsHovered(true)
                        setHoveredStars(star)
                      }}
                      onMouseLeave={() => {
                        setIsHovered(false)
                        setHoveredStars(0)
                      }}
                      onClick={() => handleRating(star)}
                      className="transition-transform hover:scale-125"
                    >
                      <svg
                        className={`w-8 h-8 ${isFilled ? 'text-amber-400' : 'text-gray-300'} transition-colors`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  )
                })}
              </div>

              {userRating && (
                <div>
                  <textarea
                    placeholder="Add a comment (optional)..."
                    value={userRating.comment || ''}
                    onChange={(e) => handleCommentUpdate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={2}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Rated on {new Date(userRating.created_at).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Other Ratings */}
          {groupRatings.filter(r => r.user_id !== currentUser?.id).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Other Ratings in {selectedGroup.name}</h4>
              <div className="space-y-3">
                {groupRatings
                  .filter(r => r.user_id !== currentUser?.id)
                  .map((rating) => (
                    <div key={rating.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          {rating.user.avatar_url ? (
                            <img src={rating.user.avatar_url} alt={rating.user.display_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-400">
                              <span className="text-white text-lg font-bold">
                                {rating.user.display_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-medium text-gray-900">{rating.user.display_name}</div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`w-4 h-4 ${star <= rating.rating ? 'text-amber-400' : 'text-gray-300'}`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                          {rating.comment && (
                            <p className="text-sm text-gray-600 mt-1">{rating.comment}</p>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(rating.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
