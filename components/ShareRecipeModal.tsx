'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UmbrellaGroupWithMembership } from '@/types/umbrella-groups'

type ShareRecipeModalProps = {
  recipeId: string
  recipeName: string
  isOpen: boolean
  onClose: () => void
}

type ShareStatus = {
  umbrella_group_id: string
  shared_at: string
}

export default function ShareRecipeModal({ recipeId, recipeName, isOpen, onClose }: ShareRecipeModalProps) {
  const [groups, setGroups] = useState<UmbrellaGroupWithMembership[]>([])
  const [sharedGroups, setSharedGroups] = useState<ShareStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())

  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadGroupsAndShares()
    }
  }, [isOpen, recipeId])

  const loadGroupsAndShares = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Load user's groups
      const { data: memberships, error: groupsError } = await supabase
        .from('umbrella_group_memberships')
        .select(`
          *,
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
        .eq('user_id', user.id)

      if (groupsError) throw groupsError

      const groupsWithMembership: UmbrellaGroupWithMembership[] = memberships
        .map((m: any) => ({
          ...m.umbrella_groups,
          membership: {
            id: m.id,
            umbrella_group_id: m.umbrella_group_id,
            user_id: m.user_id,
            role: m.role,
            joined_at: m.joined_at
          }
        }))
        .filter((g: any) => g.id)

      setGroups(groupsWithMembership)

      // Load current shares
      const { data: shares, error: sharesError } = await supabase
        .from('recipe_umbrella_group_shares')
        .select('umbrella_group_id, shared_at')
        .eq('recipe_id', recipeId)

      if (sharesError) throw sharesError

      setSharedGroups(shares || [])
      setSelectedGroupIds(new Set(shares?.map(s => s.umbrella_group_id) || []))
    } catch (err: any) {
      console.error('Error loading groups:', err)
      setError(err.message || 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleGroup = (groupId: string) => {
    const newSelected = new Set(selectedGroupIds)
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId)
    } else {
      newSelected.add(groupId)
    }
    setSelectedGroupIds(newSelected)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Determine which groups to add and remove
      const currentGroupIds = new Set(sharedGroups.map(s => s.umbrella_group_id))
      const toAdd = Array.from(selectedGroupIds).filter(id => !currentGroupIds.has(id))
      const toRemove = Array.from(currentGroupIds).filter(id => !selectedGroupIds.has(id))

      // Remove unshared groups
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('recipe_umbrella_group_shares')
          .delete()
          .eq('recipe_id', recipeId)
          .in('umbrella_group_id', toRemove)

        if (deleteError) throw deleteError
      }

      // Add new shares
      if (toAdd.length > 0) {
        const sharesToInsert = toAdd.map(groupId => ({
          recipe_id: recipeId,
          umbrella_group_id: groupId,
          shared_by_user_id: user.id
        }))

        const { error: insertError } = await supabase
          .from('recipe_umbrella_group_shares')
          .insert(sharesToInsert)

        if (insertError) throw insertError
      }

      // Update the recipe to mark it as shared if any groups selected
      if (selectedGroupIds.size > 0) {
        await supabase
          .from('recipes')
          .update({ created_by_user_id: user.id })
          .eq('id', recipeId)
      }

      onClose()
    } catch (err: any) {
      console.error('Error saving shares:', err)
      setError(err.message || 'Failed to save sharing settings')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Share Recipe</h3>
              <p className="text-sm text-gray-600 mt-1">{recipeName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-3 text-gray-600">Loading your groups...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">No Groups Yet</h4>
                <p className="text-gray-600 mb-4">
                  Create an umbrella group to start sharing recipes with your extended family.
                </p>
                <a
                  href="/dashboard/groups/new"
                  className="inline-block px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium"
                >
                  Create a Group
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-4">
                  Select the groups you want to share this recipe with:
                </p>

                {groups.map((group) => {
                  const isShared = selectedGroupIds.has(group.id)
                  return (
                    <label
                      key={group.id}
                      className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isShared
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isShared}
                        onChange={() => handleToggleGroup(group.id)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />

                      {group.logo_url ? (
                        <img
                          src={group.logo_url}
                          alt={group.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {group.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{group.name}</div>
                        {group.description && (
                          <div className="text-xs text-gray-500 line-clamp-1">{group.description}</div>
                        )}
                      </div>

                      {isShared && (
                        <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && groups.length > 0 && (
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
