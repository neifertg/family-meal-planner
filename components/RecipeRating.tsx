'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type FamilyMember = {
  id: string
  name: string
  photo_url: string | null
}

type RecipeRating = {
  id: string
  recipe_id: string
  family_member_id: string
  rating: number
  comment: string | null
  created_at: string
  family_members: FamilyMember
}

type RecipeRatingProps = {
  recipeId: string
  recipeName: string
}

export default function RecipeRating({ recipeId, recipeName }: RecipeRatingProps) {
  const supabase = createClient()
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [ratings, setRatings] = useState<RecipeRating[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null)
  const [hoveredStars, setHoveredStars] = useState<number>(0)
  const [editingComments, setEditingComments] = useState<Record<string, string>>({})

  useEffect(() => {
    loadData()
  }, [recipeId])

  const loadData = async () => {
    setLoading(true)

    // Get the family (RLS ensures we only get the user's family)
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (familyError) {
      console.error('Error loading family:', familyError)
      setLoading(false)
      return
    }

    if (!family?.id) {
      console.error('No family found')
      setLoading(false)
      return
    }

    // Load family members
    const { data: membersData } = await supabase
      .from('family_members')
      .select('id, name, photo_url')
      .eq('family_id', family.id)

    if (membersData) {
      setFamilyMembers(membersData)
    }

    // Load existing ratings for this recipe
    const { data: ratingsData } = await supabase
      .from('recipe_ratings')
      .select(`
        id,
        recipe_id,
        family_member_id,
        rating,
        comment,
        created_at,
        family_members (
          id,
          name,
          photo_url
        )
      `)
      .eq('recipe_id', recipeId)

    if (ratingsData) {
      setRatings(ratingsData as any)
    }

    setLoading(false)
  }

  const handleRating = async (memberId: string, rating: number) => {
    // Upsert rating (insert or update)
    const { error } = await supabase
      .from('recipe_ratings')
      .upsert({
        recipe_id: recipeId,
        family_member_id: memberId,
        rating: rating
      }, {
        onConflict: 'recipe_id,family_member_id'
      })

    if (!error) {
      loadData()
    }
  }

  const handleCommentUpdate = useCallback(async (memberId: string, comment: string) => {
    const { error } = await supabase
      .from('recipe_ratings')
      .upsert({
        recipe_id: recipeId,
        family_member_id: memberId,
        comment: comment
      }, {
        onConflict: 'recipe_id,family_member_id'
      })

    if (!error) {
      // Clear the local editing state for this member
      setEditingComments(prev => {
        const updated = { ...prev }
        delete updated[memberId]
        return updated
      })
      loadData()
    }
  }, [recipeId, supabase])

  const getRatingForMember = (memberId: string) => {
    return ratings.find(r => r.family_member_id === memberId)
  }

  const getAverageRating = () => {
    if (ratings.length === 0) return 0
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0)
    return sum / ratings.length
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading ratings...</div>
  }

  if (familyMembers.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600">Add family members to start rating recipes!</p>
      </div>
    )
  }

  const averageRating = getAverageRating()

  return (
    <div className="space-y-4">
      {/* Average Rating */}
      {ratings.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">{averageRating.toFixed(1)}</div>
              <div className="text-xs text-amber-700">Average</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-5 h-5 ${star <= Math.round(averageRating) ? 'text-amber-400' : 'text-gray-300'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <div className="text-xs text-amber-700">
                Based on {ratings.length} {ratings.length === 1 ? 'review' : 'reviews'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Ratings */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Family Ratings</h3>
        {familyMembers.map((member) => {
          const memberRating = getRatingForMember(member.id)
          const currentRating = memberRating?.rating || 0
          const isHovered = hoveredMemberId === member.id

          return (
            <div key={member.id} className="bg-white border border-gray-200 rounded-lg p-4">
              {/* Member Info and Stars */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  {member.photo_url ? (
                    <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-400">
                      <span className="text-white text-lg font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{member.name}</div>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = isHovered ? star <= hoveredStars : star <= currentRating
                      return (
                        <button
                          key={star}
                          onMouseEnter={() => {
                            setHoveredMemberId(member.id)
                            setHoveredStars(star)
                          }}
                          onMouseLeave={() => {
                            setHoveredMemberId(null)
                            setHoveredStars(0)
                          }}
                          onClick={() => handleRating(member.id, star)}
                          className="transition-transform hover:scale-110"
                        >
                          <svg
                            className={`w-5 h-5 ${isFilled ? 'text-amber-400' : 'text-gray-300'} transition-colors`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Comment */}
              {memberRating && (
                <div className="mt-3">
                  <textarea
                    placeholder="Add a comment (optional)..."
                    value={editingComments[member.id] ?? memberRating.comment ?? ''}
                    onChange={(e) => {
                      setEditingComments(prev => ({ ...prev, [member.id]: e.target.value }))
                    }}
                    onBlur={(e) => {
                      const currentValue = e.target.value
                      const savedValue = memberRating.comment || ''
                      if (currentValue !== savedValue) {
                        handleCommentUpdate(member.id, currentValue)
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={2}
                  />
                  {memberRating.comment && (
                    <div className="text-xs text-gray-500 mt-1">
                      Rated on {new Date(memberRating.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
