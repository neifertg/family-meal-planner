import type { SupabaseClient } from '@supabase/supabase-js'

export const RATE_LIMIT_WINDOW_SECONDS = 600 // 10 minutes
export const RATE_LIMIT_MAX_REQUESTS = 10

/**
 * Atomically checks and increments the caller's request count for `route`
 * in the current time window (via the check_rate_limit Postgres function,
 * which reads auth.uid() itself). Fails closed on any RPC error so a DB
 * hiccup can't be used to bypass the limit.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  route: string,
  options: { limit?: number; windowSeconds?: number } = {}
): Promise<boolean> {
  const { limit = RATE_LIMIT_MAX_REQUESTS, windowSeconds = RATE_LIMIT_WINDOW_SECONDS } = options

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_route: route,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error(`[rateLimit] check failed for route "${route}":`, error)
    return false
  }

  return data === true
}
