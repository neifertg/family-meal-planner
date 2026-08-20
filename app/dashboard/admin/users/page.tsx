'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type UserRow = {
  id: string
  email: string
  display_name: string | null
  role: string
  approval_status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export default function AdminUsersPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actingOn, setActingOn] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const admin = profile?.role === 'admin'
    setIsAdmin(admin)

    if (admin) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, display_name, role, approval_status, created_at')
        .order('created_at', { ascending: false })

      if (error) setError(error.message)
      else setUsers(data as UserRow[])
    }

    setLoading(false)
  }

  const setApproval = async (id: string, approval_status: 'approved' | 'rejected') => {
    setActingOn(id)
    setError(null)
    try {
      const { error } = await supabase
        .from('users')
        .update({ approval_status } as any)
        .eq('id', id)

      if (error) throw error
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, approval_status } : u)))
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
    } finally {
      setActingOn(null)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-600">Loading...</div>
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-gray-600">You don't have access to this page.</div>
      </div>
    )
  }

  const pending = users.filter((u) => u.approval_status === 'pending')
  const others = users.filter((u) => u.approval_status !== 'pending')

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Manage Users</h1>
        <p className="text-gray-600">Approve or reject signups and review existing accounts.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Pending Approval {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <p className="text-gray-500 text-sm">No signups waiting for approval.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pending.map((u) => (
              <li key={u.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900">{u.display_name || u.email}</div>
                  <div className="text-sm text-gray-500">{u.email}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={actingOn === u.id}
                    onClick={() => setApproval(u.id, 'approved')}
                    className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={actingOn === u.id}
                    onClick={() => setApproval(u.id, 'rejected')}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">All Other Users</h2>
        <ul className="divide-y divide-gray-100">
          {others.map((u) => (
            <li key={u.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-gray-900">{u.display_name || u.email}</div>
                <div className="text-sm text-gray-500">{u.email} · {u.role}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    u.approval_status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {u.approval_status}
                </span>
                {u.approval_status === 'rejected' && (
                  <button
                    disabled={actingOn === u.id}
                    onClick={() => setApproval(u.id, 'approved')}
                    className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
