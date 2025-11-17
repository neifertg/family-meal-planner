import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

export function createClient() {
  // Temporarily hardcode values to test
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://topkyhwzcvclhwwxsolq.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcGt5aHd6Y3ZjbGh3d3hzb2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMTk5OTYsImV4cCI6MjA3ODg5NTk5Nn0.B-UIoMbKT4IvggNzcp8hrMvF0TPFgk4ulXCdvPD0MhU'

  console.log('Supabase config:', {
    url,
    keyLength: key?.length,
    hasUrl: !!url,
    hasKey: !!key,
    fromEnv: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  })

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  // Custom fetch wrapper to log requests
  const customFetch: typeof fetch = (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString()
    console.log('Fetch request:', {
      url: requestUrl,
      headers: init?.headers,
      method: init?.method,
    })
    return fetch(input, init)
  }

  return createBrowserClient<Database>(url, key, {
    global: {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      fetch: customFetch,
    },
  })
}
