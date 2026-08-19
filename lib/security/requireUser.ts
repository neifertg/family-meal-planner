import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns the authenticated user for a request, or null if there isn't one.
 * Callers should respond 401 when this returns null.
 */
export async function requireUser(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}
