import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// List of routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/settings',
  '/hub' // Protect all routes under /hub
]

export default async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove: (name, options) => {
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const currentPath = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route))

  // User is not signed in and trying to access a protected route
  if (!session && isProtectedRoute) {
    const loginUrl = new URL('/auth/login', req.nextUrl.origin)
    loginUrl.searchParams.set('redirectTo', currentPath)
    return NextResponse.redirect(loginUrl)
  }

  // User IS signed in
  if (session) {
    // And trying to access an auth page (like login, signup) that isn't verify-email
    if (currentPath.startsWith('/auth/') && currentPath !== '/auth/verify-email') {
      // Check if the original attempt to access login had a redirectTo
      const redirectTo = req.nextUrl.searchParams.get('redirectTo')
      const targetPath = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard'
      const redirectUrl = new URL(targetPath, req.nextUrl.origin)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)'], // Added images to exclusion
}