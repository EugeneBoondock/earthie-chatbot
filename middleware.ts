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

// List of authentication pages
const authPages = ['/auth/login', '/auth/signup']

export default async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const currentPath = req.nextUrl.pathname
  const fullUrl = req.nextUrl.href
  
  console.log(`[Middleware] START Processing: ${fullUrl}`)

  // Log all cookies seen by the server at the very beginning of the middleware
  const allCookies = req.cookies.getAll();
  console.log(`[Middleware] All cookies received by server (${allCookies.length} total):`);
  allCookies.forEach(cookie => {
    const valuePreview = cookie.value.length > 30 ? cookie.value.substring(0, 30) + '...' : cookie.value;
    console.log(`[Middleware]   - Name: '${cookie.name}', Value (preview): '${valuePreview}'`);
  });
  if (allCookies.length === 0) {
    console.log('[Middleware] No cookies received by server.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Middleware] CRITICAL: Supabase URL or Anon Key is missing. Authentication will fail.')
    return res; // Allow request to proceed but log critical error
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get: (name) => {
          const cookie = req.cookies.get(name)?.value
          if (name.includes('auth')) { // Log only auth-related cookies
            console.log(`[Middleware] Cookie GET: ${name} = ${cookie ? 'found' : 'not found'}`);
          }
          return cookie
        },
        set: (name, value, options) => {
          console.log(`[Middleware] Cookie SET: ${name}`);
          res.cookies.set({ name, value, ...options })
        },
        remove: (name, options) => {
          console.log(`[Middleware] Cookie REMOVE: ${name}`);
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession()

  if (sessionError) {
    console.error('[Middleware] Error getting session:', sessionError.message)
  }
  
  console.log(`[Middleware] Session state: ${session ? `Authenticated (User ID: ${session.user.id})` : 'Not Authenticated'}`)
  console.log(`[Middleware] Current path: ${currentPath}`)

  const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route))
  const isAuthPage = authPages.includes(currentPath)

  console.log(`[Middleware] Is protected route: ${isProtectedRoute}`)
  console.log(`[Middleware] Is auth page: ${isAuthPage}`)

  // Scenario 1: User is NOT signed in and trying to access a protected route
  if (!session && isProtectedRoute) {
    const loginUrl = new URL('/auth/login', req.nextUrl.origin)
    loginUrl.searchParams.set('redirectTo', currentPath)
    console.log(`[Middleware] SCENARIO 1: Unauthenticated user on protected route. Redirecting to: ${loginUrl.href}`)
    
    const redirectResponse = NextResponse.redirect(loginUrl);
    res.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  // Scenario 2: User IS signed in
  if (session) {
    console.log('[Middleware] SCENARIO 2 active: User is authenticated.')
    if (isAuthPage) {
      const targetPath = '/hub/profile'
      const redirectUrl = new URL(targetPath, req.nextUrl.origin)
      console.log(`[Middleware] Authenticated user on auth page ('${currentPath}'). Redirecting to default profile: ${redirectUrl.href}`)
      
      const redirectResponse = NextResponse.redirect(redirectUrl);
      res.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }

  console.log('[Middleware] END: No redirection conditions met, passing through.')
  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)'],
};