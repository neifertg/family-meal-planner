'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewGroupPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState<'private' | 'public'>('private')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in to create a group')
        setLoading(false)
        return
      }

      // Validate required fields
      if (!name.trim()) {
        setError('Group name is required')
        setLoading(false)
        return
      }

      // Create the umbrella group
      const { data: newGroup, error: createError } = await supabase
        .from('umbrella_groups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
          privacy_level: privacyLevel,
          created_by_user_id: user.id
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating group:', createError)
        setError('Failed to create group. Please try again.')
        setLoading(false)
        return
      }

      // Success! Redirect to the groups page
      router.push('/dashboard/groups')
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/groups"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Groups
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Create New Group
          </h1>
          <p className="text-gray-600 mt-2">Set up an extended family group for recipe sharing</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Group Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Smith Family, Johnson Extended Family"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your family group (optional)"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                disabled={loading}
              />
            </div>

            {/* Logo URL */}
            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Logo URL
              </label>
              <input
                type="url"
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png (optional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter a URL to an image for your group's logo
              </p>
            </div>

            {/* Privacy Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Privacy Level <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="privacy"
                    value="private"
                    checked={privacyLevel === 'private'}
                    onChange={(e) => setPrivacyLevel(e.target.value as 'private' | 'public')}
                    className="mt-1"
                    disabled={loading}
                  />
                  <div>
                    <div className="font-medium text-gray-900">Private (Recommended)</div>
                    <div className="text-sm text-gray-600">
                      Only invited members can join this group
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="privacy"
                    value="public"
                    checked={privacyLevel === 'public'}
                    onChange={(e) => setPrivacyLevel(e.target.value as 'private' | 'public')}
                    className="mt-1"
                    disabled={loading}
                  />
                  <div>
                    <div className="font-medium text-gray-900">Public</div>
                    <div className="text-sm text-gray-600">
                      Anyone can discover and join this group
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Creating Group...
                  </span>
                ) : (
                  'Create Group'
                )}
              </button>
              <Link
                href="/dashboard/groups"
                className="px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-indigo-800">
                <p className="font-medium mb-1">You will be the group admin</p>
                <p>As the creator, you'll automatically become an admin and can invite members, manage permissions, and delete the group if needed.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
