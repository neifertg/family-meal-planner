'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InvitationDialog() {
  const [invitations, setInvitations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadInvitations()
  }, [])

  const loadInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Load pending invitations for this user's email
      const { data, error } = await supabase
        .from('umbrella_group_invitations')
        .select(`
          *,
          umbrella_groups (
            id,
            name,
            description,
            logo_url
          ),
          invited_by:users!umbrella_group_invitations_invited_by_user_id_fkey (
            display_name
          )
        `)
        .eq('email', user.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('invited_at', { ascending: false })

      if (error) {
        console.error('Error loading invitations:', error)
      } else if (data) {
        setInvitations(data)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (invitation: any) => {
    setProcessing(invitation.id)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Add user to group with the specified role
      const { error: memberError } = await supabase
        .from('umbrella_group_memberships')
        .insert({
          umbrella_group_id: invitation.umbrella_group_id,
          user_id: user.id,
          role: invitation.role || 'member'
        })

      if (memberError) {
        console.error('Error adding to group:', memberError)
        alert('Failed to accept invitation. You may already be a member of this group.')
        setProcessing(null)
        return
      }

      // Update invitation status
      const { error: updateError } = await supabase
        .from('umbrella_group_invitations')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', invitation.id)

      if (updateError) {
        console.error('Error updating invitation:', updateError)
      }

      // Remove from list
      setInvitations(prev => prev.filter(inv => inv.id !== invitation.id))
    } catch (err) {
      console.error('Error accepting invitation:', err)
      alert('An error occurred while accepting the invitation')
    } finally {
      setProcessing(null)
    }
  }

  const handleDecline = async (invitation: any) => {
    setProcessing(invitation.id)

    try {
      // Update invitation status
      const { error } = await supabase
        .from('umbrella_group_invitations')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString()
        })
        .eq('id', invitation.id)

      if (error) {
        console.error('Error declining invitation:', error)
      }

      // Remove from list
      setInvitations(prev => prev.filter(inv => inv.id !== invitation.id))
    } catch (err) {
      console.error('Error declining invitation:', err)
    } finally {
      setProcessing(null)
    }
  }

  if (loading || invitations.length === 0) {
    return null
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
            <h2 className="text-2xl font-bold text-gray-900">Group Invitations</h2>
            <p className="text-sm text-gray-600 mt-1">You have {invitations.length} pending invitation{invitations.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="p-6 space-y-4">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start gap-4 mb-4">
                  {invitation.umbrella_groups?.logo_url ? (
                    <img
                      src={invitation.umbrella_groups.logo_url}
                      alt={invitation.umbrella_groups?.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {invitation.umbrella_groups?.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                  )}

                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">{invitation.umbrella_groups?.name}</h3>
                    {invitation.umbrella_groups?.description && (
                      <p className="text-sm text-gray-600 mt-1">{invitation.umbrella_groups.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">
                        Invited by {invitation.invited_by?.display_name || 'someone'}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        invitation.role === 'admin'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {invitation.role === 'admin' ? 'Admin' : 'Member'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(invitation)}
                    disabled={processing === invitation.id}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing === invitation.id ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleDecline(invitation)}
                    disabled={processing === invitation.id}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing === invitation.id ? 'Declining...' : 'Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-gray-50 text-center">
            <p className="text-xs text-gray-500">
              These invitations will expire in 7 days
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
