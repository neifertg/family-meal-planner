'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UmbrellaGroupWithMembership, UmbrellaGroupMembership, User } from '@/types/umbrella-groups'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type MemberWithUser = UmbrellaGroupMembership & {
  user: User
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [group, setGroup] = useState<UmbrellaGroupWithMembership | null>(null)
  const [members, setMembers] = useState<MemberWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    params.then(({ id }) => {
      setGroupId(id)
    })
  }, [params])

  useEffect(() => {
    if (groupId) {
      loadGroupDetails()
    }
  }, [groupId])

  const loadGroupDetails = async () => {
    if (!groupId) return

    setLoading(true)
    setError(null)

    try {
      console.log('Loading group with ID:', groupId)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in')
        setLoading(false)
        return
      }
      setCurrentUserId(user.id)

      // Load group details
      console.log('Querying umbrella_groups with id:', groupId)
      const { data: groupData, error: groupError } = await supabase
        .from('umbrella_groups')
        .select('*')
        .eq('id', groupId)
        .single()

      console.log('Group query result:', { groupData, groupError })

      if (groupError) {
        console.error('Error loading group:', groupError)
        setError('Group not found')
        setLoading(false)
        return
      }

      // Load user's membership
      const { data: membership } = await supabase
        .from('umbrella_group_memberships')
        .select('*')
        .eq('umbrella_group_id', groupId)
        .eq('user_id', user.id)
        .single()

      // Get member count
      const { count: memberCount } = await supabase
        .from('umbrella_group_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('umbrella_group_id', groupId)

      // Get recipe count
      const { count: recipeCount } = await supabase
        .from('recipe_umbrella_group_shares')
        .select('*', { count: 'exact', head: true })
        .eq('umbrella_group_id', groupId)

      setGroup({
        ...groupData,
        membership,
        member_count: memberCount || 0,
        recipe_count: recipeCount || 0
      })

      // Load members
      const { data: membersData, error: membersError } = await supabase
        .from('umbrella_group_memberships')
        .select(`
          *,
          users!umbrella_group_memberships_user_id_fkey (
            id,
            email,
            display_name,
            avatar_url,
            created_at,
            updated_at
          )
        `)
        .eq('umbrella_group_id', groupId)
        .order('joined_at', { ascending: true })

      if (membersError) {
        console.error('Error loading members:', membersError)
      } else if (membersData) {
        // Map the foreign key result to the expected structure
        const transformedMembers = membersData.map((m: any) => ({
          ...m,
          user: m.users
        }))
        setMembers(transformedMembers as MemberWithUser[])
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to load group details')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (membershipId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this group?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('umbrella_group_memberships')
        .delete()
        .eq('id', membershipId)

      if (error) throw error

      // Reload members
      loadGroupDetails()
    } catch (err) {
      console.error('Error removing member:', err)
      alert('Failed to remove member. You must be an admin to remove members.')
    }
  }

  const handleToggleRole = async (membershipId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin'

    try {
      const { error } = await supabase
        .from('umbrella_group_memberships')
        .update({ role: newRole })
        .eq('id', membershipId)

      if (error) throw error

      // Reload members
      loadGroupDetails()
    } catch (err) {
      console.error('Error updating role:', err)
      alert('Failed to update member role. You must be an admin to change roles.')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviteLoading(true)

    try {
      // Validate email
      if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
        setInviteError('Please enter a valid email address')
        setInviteLoading(false)
        return
      }

      // Create invitation
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiration

      const { error } = await supabase
        .from('umbrella_group_invitations')
        .insert({
          umbrella_group_id: groupId,
          invited_by_user_id: currentUserId,
          email: inviteEmail.trim().toLowerCase(),
          status: 'pending',
          expires_at: expiresAt.toISOString()
        })

      if (error) throw error

      // Success
      setInviteEmail('')
      setShowInviteModal(false)
      alert(`Invitation sent to ${inviteEmail}`)
    } catch (err) {
      console.error('Error sending invitation:', err)
      setInviteError('Failed to send invitation. The user may already be a member or invited.')
    } finally {
      setInviteLoading(false)
    }
  }

  const isAdmin = group?.membership?.role === 'admin'

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading group details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-12 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Group Not Found</h2>
            <p className="text-gray-600 mb-6">{error || 'This group does not exist or you do not have access to it.'}</p>
            <Link
              href="/dashboard/groups"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium"
            >
              Back to Groups
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/groups"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Groups
          </Link>
        </div>

        {/* Group Header Card */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mb-6">
          <div className="relative h-48 bg-gradient-to-br from-indigo-500 to-purple-600">
            {group.logo_url && (
              <img
                src={group.logo_url}
                alt={group.name}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{group.name}</h1>
                  {group.description && (
                    <p className="text-white/90 text-sm">{group.description}</p>
                  )}
                </div>
                {isAdmin && (
                  <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-sm font-bold rounded-full">
                    👑 Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="font-medium">{group.member_count} members</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="font-medium">{group.recipe_count} recipes</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-medium capitalize">{group.privacy_level}</span>
              </div>
            </div>

            {isAdmin && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium text-sm"
                >
                  + Invite Members
                </button>
                <Link
                  href={`/dashboard/groups/${groupId}/edit`}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium text-sm"
                >
                  Edit Group
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Members List */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Members</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {members.map((member) => (
              <div key={member.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  {member.user.avatar_url ? (
                    <img
                      src={member.user.avatar_url}
                      alt={member.user.display_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-lg font-bold">
                        {member.user.display_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-900">{member.user.display_name}</div>
                    <div className="text-sm text-gray-500">{member.user.email}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {member.role === 'admin' ? (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
                      Admin
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                      Member
                    </span>
                  )}

                  {isAdmin && member.user_id !== currentUserId && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleRole(member.id, member.role)}
                        className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                        title={member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                      >
                        {member.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id, member.user.display_name)}
                        className="px-3 py-1 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors font-medium"
                        title="Remove from Group"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowInviteModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Invite Member</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleInvite}>
                {inviteError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    {inviteError}
                  </div>
                )}

                <div className="mb-6">
                  <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="inviteEmail"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={inviteLoading}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    An invitation link will be sent to this email address
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50"
                  >
                    {inviteLoading ? 'Sending...' : 'Send Invitation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
