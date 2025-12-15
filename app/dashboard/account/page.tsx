'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Invitation = {
  id: string
  umbrella_group_id: string
  invited_by_user_id: string
  email: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  invited_at: string
  expires_at: string
  responded_at: string | null
  umbrella_groups: {
    id: string
    name: string
    description: string | null
    logo_url: string | null
    privacy_level: string
  }
  invited_by: {
    id: string
    display_name: string
    email: string
  }
}

export default function AccountPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadInvitations()
  }, [])

  const loadInvitations = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in')
        setLoading(false)
        return
      }

      // Get user's email
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', user.id)
        .single()

      if (userData) {
        setUserEmail(userData.email)

        // Load invitations for this email
        const { data: invitationsData, error: invError } = await supabase
          .from('umbrella_group_invitations')
          .select(`
            id,
            umbrella_group_id,
            invited_by_user_id,
            email,
            status,
            invited_at,
            expires_at,
            responded_at,
            umbrella_groups (
              id,
              name,
              description,
              logo_url,
              privacy_level
            ),
            invited_by:users!umbrella_group_invitations_invited_by_user_id_fkey (
              id,
              display_name,
              email
            )
          `)
          .eq('email', userData.email)
          .order('invited_at', { ascending: false })

        if (invError) throw invError

        setInvitations(invitationsData as any || [])
      }
    } catch (err: any) {
      console.error('Error loading invitations:', err)
      setError(err.message || 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (invitation: Invitation) => {
    setProcessing(invitation.id)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Check if invitation is still valid
      if (new Date(invitation.expires_at) < new Date()) {
        // Mark as expired
        await supabase
          .from('umbrella_group_invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id)

        throw new Error('This invitation has expired')
      }

      // Add user to the group
      const { error: memberError } = await supabase
        .from('umbrella_group_memberships')
        .insert({
          umbrella_group_id: invitation.umbrella_group_id,
          user_id: user.id,
          role: 'member'
        })

      if (memberError) {
        // Check if already a member
        if (memberError.code === '23505') {
          throw new Error('You are already a member of this group')
        }
        throw memberError
      }

      // Update invitation status
      const { error: updateError } = await supabase
        .from('umbrella_group_invitations')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', invitation.id)

      if (updateError) throw updateError

      // Reload invitations
      await loadInvitations()

      // Show success message
      alert(`Successfully joined ${invitation.umbrella_groups.name}!`)
    } catch (err: any) {
      console.error('Error accepting invitation:', err)
      setError(err.message || 'Failed to accept invitation')
    } finally {
      setProcessing(null)
    }
  }

  const handleDecline = async (invitation: Invitation) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return

    setProcessing(invitation.id)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('umbrella_group_invitations')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString()
        })
        .eq('id', invitation.id)

      if (updateError) throw updateError

      // Reload invitations
      await loadInvitations()
    } catch (err: any) {
      console.error('Error declining invitation:', err)
      setError(err.message || 'Failed to decline invitation')
    } finally {
      setProcessing(null)
    }
  }

  const pendingInvitations = invitations.filter(i => i.status === 'pending')
  const respondedInvitations = invitations.filter(i => i.status !== 'pending')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Account
            </h1>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              ← Back to Dashboard
            </Link>
          </div>
          {userEmail && (
            <p className="text-gray-600">Logged in as: {userEmail}</p>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Pending Invitations */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Pending Invitations</h2>
                <p className="text-sm text-gray-600 mt-1">Group invitations waiting for your response</p>
              </div>
              {pendingInvitations.length > 0 && (
                <span className="px-3 py-1 bg-indigo-600 text-white text-sm font-bold rounded-full">
                  {pendingInvitations.length}
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-3 text-gray-600">Loading invitations...</p>
              </div>
            ) : pendingInvitations.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Invitations</h3>
                <p className="text-gray-600">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingInvitations.map((invitation) => {
                  const isExpired = new Date(invitation.expires_at) < new Date()
                  const isProcessing = processing === invitation.id

                  return (
                    <div key={invitation.id} className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50/50">
                      <div className="flex items-start gap-4">
                        {/* Group Logo */}
                        {invitation.umbrella_groups.logo_url ? (
                          <img
                            src={invitation.umbrella_groups.logo_url}
                            alt={invitation.umbrella_groups.name}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <span className="text-white text-2xl font-bold">
                              {invitation.umbrella_groups.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Invitation Details */}
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {invitation.umbrella_groups.name}
                          </h3>
                          {invitation.umbrella_groups.description && (
                            <p className="text-sm text-gray-600 mb-2">{invitation.umbrella_groups.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                            <span>Invited by {invitation.invited_by.display_name}</span>
                            <span>•</span>
                            <span>{new Date(invitation.invited_at).toLocaleDateString()}</span>
                            {isExpired && (
                              <>
                                <span>•</span>
                                <span className="text-red-600 font-semibold">Expired</span>
                              </>
                            )}
                          </div>

                          {/* Actions */}
                          {!isExpired && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAccept(invitation)}
                                disabled={isProcessing}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isProcessing ? 'Processing...' : 'Accept'}
                              </button>
                              <button
                                onClick={() => handleDecline(invitation)}
                                disabled={isProcessing}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Invitation History */}
        {respondedInvitations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Invitation History</h2>
              <p className="text-sm text-gray-600 mt-1">Past invitations you've responded to</p>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {respondedInvitations.map((invitation) => (
                  <div key={invitation.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {invitation.umbrella_groups.logo_url ? (
                          <img
                            src={invitation.umbrella_groups.logo_url}
                            alt={invitation.umbrella_groups.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {invitation.umbrella_groups.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}

                        <div>
                          <div className="font-semibold text-gray-900">{invitation.umbrella_groups.name}</div>
                          <div className="text-xs text-gray-500">
                            Responded {invitation.responded_at ? new Date(invitation.responded_at).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        invitation.status === 'accepted'
                          ? 'bg-green-100 text-green-800'
                          : invitation.status === 'declined'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-6 bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              href="/dashboard/groups"
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all"
            >
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <div className="font-semibold text-gray-900">My Groups</div>
                <div className="text-xs text-gray-500">Manage your groups</div>
              </div>
            </Link>
            <Link
              href="/dashboard/groups/new"
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all"
            >
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <div>
                <div className="font-semibold text-gray-900">Create Group</div>
                <div className="text-xs text-gray-500">Start a new group</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
