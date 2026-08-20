import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (pathname.startsWith('/dashboard')) {
      const loginUrl = new URL('/auth/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    return supabaseResponse
  }

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
    const { data: profile } = await supabase
      .from('users')
      .select('approval_status')
      .eq('id', user.id)
      .single()

    if (profile && profile.approval_status !== 'approved') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
      }

      const pendingUrl = new URL('/auth/pending-approval', request.url)
      return NextResponse.redirect(pendingUrl)
    }
  }

  return supabaseResponse
}
