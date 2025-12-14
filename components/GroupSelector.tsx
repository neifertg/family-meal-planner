'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UmbrellaGroupWithMembership } from '@/types/umbrella-groups'
import Link from 'next/link'

type GroupSelectorProps = {
  onGroupChange?: (groupId: string | null) => void
  currentGroupId?: string | null
}

export default function GroupSelector({ onGroupChange, currentGroupId }: GroupSelectorProps) {
  const [groups, setGroups] = useState<UmbrellaGroupWithMembership[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(currentGroupId || null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    loadUserGroups()
  }, [])

  useEffect(() => {
    // Update parent component when selection changes
    if (onGroupChange) {
      onGroupChange(selectedGroupId)
    }
    // Store selection in localStorage for persistence
    if (selectedGroupId) {
      localStorage.setItem('selectedGroupId', selectedGroupId)
    } else {
      localStorage.removeItem('selectedGroupId')
    }
  }, [selectedGroupId, onGroupChange])

  const loadUserGroups = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user's umbrella groups
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

      if (error) {
        console.error('Error loading groups:', error)
        return
      }

      if (memberships) {
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
          .filter((g: any) => g.id) // Filter out any null groups

        setGroups(groupsWithMembership)

        // Restore previous selection from localStorage
        const savedGroupId = localStorage.getItem('selectedGroupId')
        if (savedGroupId && groupsWithMembership.some(g => g.id === savedGroupId)) {
          setSelectedGroupId(savedGroupId)
        }
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGroupSelect = (groupId: string | null) => {
    setSelectedGroupId(groupId)
    setIsOpen(false)
  }

  const selectedGroup = selectedGroupId
    ? groups.find(g => g.id === selectedGroupId)
    : null

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
        <span className="text-sm text-gray-600">Loading groups...</span>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <Link
        href="/dashboard/groups/new"
        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create Your First Group
      </Link>
    )
  }

  return (
    <div className="relative">
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all min-w-[200px]"
      >
        {/* Group Logo/Icon */}
        <div className="flex-shrink-0">
          {selectedGroup?.logo_url ? (
            <img
              src={selectedGroup.logo_url}
              alt={selectedGroup.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
              {selectedGroupId ? (
                <span className="text-white text-sm font-bold">
                  {selectedGroup?.name?.charAt(0).toUpperCase()}
                </span>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Group Name */}
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-gray-900">
            {selectedGroup ? selectedGroup.name : 'All Groups'}
          </div>
          <div className="text-xs text-gray-500">
            {selectedGroup
              ? (selectedGroup.membership?.role === 'admin' ? 'Admin' : 'Member')
              : `${groups.length} group${groups.length !== 1 ? 's' : ''}`
            }
          </div>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-96 overflow-y-auto">
            {/* All Groups Option */}
            <button
              onClick={() => handleGroupSelect(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                !selectedGroupId ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-gray-900">All Groups</div>
                <div className="text-xs text-gray-500">View recipes from all groups</div>
              </div>
              {!selectedGroupId && (
                <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            <div className="border-t border-gray-100 my-1" />

            {/* Individual Groups */}
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => handleGroupSelect(group.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selectedGroupId === group.id ? 'bg-indigo-50' : ''
                }`}
              >
                {/* Group Logo */}
                {group.logo_url ? (
                  <img
                    src={group.logo_url}
                    alt={group.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg font-bold">
                      {group.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Group Info */}
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-gray-900">{group.name}</div>
                  <div className="text-xs text-gray-500">
                    {group.membership?.role === 'admin' ? '👑 Admin' : 'Member'}
                    {group.privacy_level === 'public' && ' • Public'}
                  </div>
                </div>

                {/* Selected Indicator */}
                {selectedGroupId === group.id && (
                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}

            <div className="border-t border-gray-100 my-1" />

            {/* Manage Groups Link */}
            <Link
              href="/dashboard/groups"
              className="flex items-center gap-3 px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Manage Groups
            </Link>

            {/* Create New Group Link */}
            <Link
              href="/dashboard/groups/new"
              className="flex items-center gap-3 px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium border-t border-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Group
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
