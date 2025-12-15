'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InvitationBadge() {
  const [count, setCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    loadPendingCount()

    // Set up real-time subscription for changes
    const channel = supabase
      .channel('invitation-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'umbrella_group_invitations'
        },
        () => {
          loadPendingCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadPendingCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user's email
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', user.id)
        .single()

      if (!userData?.email) return

      // Count pending invitations for this email
      const { count: pendingCount } = await supabase
        .from('umbrella_group_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('email', userData.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())

      setCount(pendingCount || 0)
    } catch (error) {
      console.error('Error loading pending invitation count:', error)
    }
  }

  if (count === 0) return null

  return (
    <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
      {count}
    </span>
  )
}
