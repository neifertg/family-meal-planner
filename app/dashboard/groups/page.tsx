'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UmbrellaGroupWithMembership } from '@/types/umbrella-groups'
import Link from 'next/link'

export default function GroupsPage() {
  const [groups, setGroups] = useState<UmbrellaGroupWithMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<UmbrellaGroupWithMembership | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: memberships, error } = await supabase
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
        .order('joined_at', { ascending: false })

      if (error) {
        console.error('Error loading groups:', error)
        return
      }

      if (memberships) {
        // Get member counts for each group
        const groupsWithData = await Promise.all(
          memberships.map(async (m: any) => {
            const { count: memberCount } = await supabase
              .from('umbrella_group_memberships')
              .select('*', { count: 'exact', head: true })
              .eq('umbrella_group_id', m.umbrella_group_id)

            const { count: recipeCount } = await supabase
              .from('recipe_umbrella_group_shares')
              .select('*', { count: 'exact', head: true })
              .eq('umbrella_group_id', m.umbrella_group_id)

            return {
              ...m.umbrella_groups,
              membership: {
                id: m.id,
                umbrella_group_id: m.umbrella_group_id,
                user_id: m.user_id,
                role: m.role,
                joined_at: m.joined_at
              },
              member_count: memberCount || 0,
              recipe_count: recipeCount || 0
            }
          })
        )

        setGroups(groupsWithData.filter((g: any) => g.id))
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('umbrella_groups')
        .delete()
        .eq('id', groupId)

      if (error) throw error

      // Reload groups
      loadGroups()
      setSelectedGroup(null)
    } catch (error) {
      console.error('Error deleting group:', error)
      alert('Failed to delete group. You must be an admin to delete a group.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              My Groups
            </h1>
            <p className="text-gray-600 mt-2">Manage your extended family recipe groups</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              ← Back to Dashboard
            </Link>
            <Link
              href="/dashboard/groups/new"
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg"
            >
              + Create New Group
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your groups...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && groups.length === 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No Groups Yet</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first extended family group to start sharing recipes with relatives!
            </p>
            <Link
              href="/dashboard/groups/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Group
            </Link>
          </div>
        )}

        {/* Groups Grid */}
        {!loading && groups.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div
                key={group.id}
                className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Group Header */}
                <div className="relative h-32 bg-gradient-to-br from-indigo-500 to-purple-600">
                  {group.logo_url && (
                    <img
                      src={group.logo_url}
                      alt={group.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white truncate">{group.name}</h3>
                  </div>

                  {/* Role Badge */}
                  <div className="absolute top-3 right-3">
                    {group.membership?.role === 'admin' ? (
                      <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                        👑 Admin
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                        Member
                      </span>
                    )}
                  </div>
                </div>

                {/* Group Info */}
                <div className="p-6">
                  {group.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{group.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>{group.member_count} members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span>{group.recipe_count} recipes</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Joined {new Date(group.membership?.joined_at || '').toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/groups/${group.id}`}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white text-center rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                      View Details
                    </Link>
                    {group.membership?.role === 'admin' && (
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        title="Delete Group"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
