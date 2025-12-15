import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type ActivityItem = {
  id: string
  type: 'recipe_shared' | 'member_joined' | 'new_rating' | 'invitation_sent'
  title: string
  description: string
  timestamp: string
  icon: JSX.Element
  link?: string
}

export default async function RecentActivity() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get user's umbrella groups
  const { data: memberships } = await supabase
    .from('umbrella_group_memberships')
    .select('umbrella_group_id')
    .eq('user_id', user.id)

  if (!memberships || memberships.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-2">No recent activity</p>
          <p className="text-sm text-gray-500">Join a group to see activity from your extended family!</p>
        </div>
      </div>
    )
  }

  const groupIds = memberships.map(m => m.umbrella_group_id)
  const activities: ActivityItem[] = []

  // Get recent recipe shares
  const { data: recentShares } = await supabase
    .from('recipe_umbrella_group_shares')
    .select(`
      id,
      shared_at,
      recipe_id,
      recipes (name),
      umbrella_groups (name),
      shared_by:users!recipe_umbrella_group_shares_shared_by_user_id_fkey (display_name)
    `)
    .in('umbrella_group_id', groupIds)
    .order('shared_at', { ascending: false })
    .limit(5)

  if (recentShares) {
    recentShares.forEach((share: any) => {
      if (share.recipes && share.umbrella_groups && share.shared_by) {
        activities.push({
          id: `share-${share.id}`,
          type: 'recipe_shared',
          title: 'Recipe Shared',
          description: `${share.shared_by.display_name} shared "${share.recipes.name}" with ${share.umbrella_groups.name}`,
          timestamp: share.shared_at,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          ),
          link: `/dashboard/recipes/${share.recipe_id}`
        })
      }
    })
  }

  // Get recent group memberships
  const { data: recentMembers } = await supabase
    .from('umbrella_group_memberships')
    .select(`
      id,
      joined_at,
      user:users (display_name),
      umbrella_groups (name)
    `)
    .in('umbrella_group_id', groupIds)
    .order('joined_at', { ascending: false })
    .limit(5)

  if (recentMembers) {
    recentMembers.forEach((member: any) => {
      if (member.user && member.umbrella_groups && member.user_id !== user.id) {
        activities.push({
          id: `member-${member.id}`,
          type: 'member_joined',
          title: 'New Member',
          description: `${member.user.display_name} joined ${member.umbrella_groups.name}`,
          timestamp: member.joined_at,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          )
        })
      }
    })
  }

  // Get recent ratings
  const { data: recentRatings } = await supabase
    .from('umbrella_group_recipe_ratings')
    .select(`
      id,
      created_at,
      rating,
      recipe:recipes (name),
      user:users (display_name),
      umbrella_groups (name)
    `)
    .in('umbrella_group_id', groupIds)
    .order('created_at', { ascending: false })
    .limit(5)

  if (recentRatings) {
    recentRatings.forEach((rating: any) => {
      if (rating.recipe && rating.user && rating.umbrella_groups) {
        activities.push({
          id: `rating-${rating.id}`,
          type: 'new_rating',
          title: 'New Rating',
          description: `${rating.user.display_name} rated "${rating.recipe.name}" ${rating.rating}★ in ${rating.umbrella_groups.name}`,
          timestamp: rating.created_at,
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          )
        })
      }
    })
  }

  // Sort all activities by timestamp
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Take top 10
  const recentActivities = activities.slice(0, 10)

  if (recentActivities.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-gray-600">No recent activity</p>
        </div>
      </div>
    )
  }

  const getRelativeTime = (timestamp: string) => {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return then.toLocaleDateString()
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'recipe_shared':
        return 'bg-indigo-50 text-indigo-600 border-indigo-200'
      case 'member_joined':
        return 'bg-green-50 text-green-600 border-green-200'
      case 'new_rating':
        return 'bg-amber-50 text-amber-600 border-amber-200'
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200'
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
          <span className="text-xs text-gray-500">Last 7 days</span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {recentActivities.map((activity) => {
          const ActivityContent = (
            <div className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-3">
              <div className={`p-2 rounded-lg border ${getActivityColor(activity.type)}`}>
                {activity.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{activity.description}</p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {getRelativeTime(activity.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          )

          return activity.link ? (
            <Link key={activity.id} href={activity.link}>
              {ActivityContent}
            </Link>
          ) : (
            <div key={activity.id}>{ActivityContent}</div>
          )
        })}
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-100">
        <Link
          href="/dashboard/groups"
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center justify-center gap-2"
        >
          View All Groups
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
