// TypeScript types for Umbrella Groups feature

export type UmbrellaGroup = {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  privacy_level: 'private' | 'public'
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export type UmbrellaGroupMembership = {
  id: string
  umbrella_group_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
}

export type UmbrellaGroupWithMembership = UmbrellaGroup & {
  membership?: UmbrellaGroupMembership
  member_count?: number
  recipe_count?: number
}

export type User = {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type UmbrellaGroupInvitation = {
  id: string
  umbrella_group_id: string
  invited_by_user_id: string
  email: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  invited_at: string
  expires_at: string
  responded_at: string | null
}

export type RecipeShare = {
  id: string
  recipe_id: string
  umbrella_group_id: string
  shared_by_user_id: string
  shared_at: string
}

export type UmbrellaGroupRecipeRating = {
  id: string
  recipe_id: string
  umbrella_group_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  updated_at: string
}

export type RecipeWithGroupRatings = {
  id: string
  name: string
  // ... other recipe fields
  group_ratings?: {
    umbrella_group_id: string
    umbrella_group_name: string
    avg_rating: number
    rating_count: number
  }[]
  global_avg_rating?: number
}
