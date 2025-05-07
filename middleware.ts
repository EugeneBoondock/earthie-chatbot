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
  
  // Ensure these environment variables are set in your Vercel project settings
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing in environment variables.')
    // Optionally, you could return a different response or allow access
    // depending on how critical Supabase is for non-protected routes immediately.
    // For now, we'll proceed, but client creation will fail if these are missing.
    // Returning res might be problematic if Supabase client is needed universally.
    // Consider throwing an error or specific handling if these are truly undefined in prod.
  }

  const supabase = createServerClient(
    supabaseUrl!, // Added non-null assertion, ensure they are set in Vercel
    supabaseAnonKey!, // Added non-null assertion, ensure they are set in Vercel
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