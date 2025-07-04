'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleLogout = async () => {
      try {
        console.log('[LogoutPage] Performing logout')
        
        // Don't check for errors here - just try to clear everything
        try {
          await supabase.auth.signOut({
            scope: 'global' // Clear all sessions, not just current browser
          })
        } catch (e) {
          console.log('[LogoutPage] Expected signOut error:', e)
          // Continue with logout process even if this fails
        }
        
        // Clear any auth cookies manually
        document.cookie.split(';').forEach(cookie => {
          const [name] = cookie.trim().split('=')
          if (name && (name.includes('supabase') || name.includes('auth'))) {
            console.log(`[LogoutPage] Clearing cookie: ${name}`)
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
          }
        })
        
        // Clear localStorage items related to auth
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth')) {
            console.log(`[LogoutPage] Clearing localStorage item: ${key}`)
            localStorage.removeItem(key)
          }
        })
        
        console.log('[LogoutPage] Logout cleanup completed')
        
        // Small delay to ensure everything is cleared
        setTimeout(() => {
          // Force a full navigation to root
          window.location.href = '/'
        }, 500)
      } catch (error: any) {
        console.error('[LogoutPage] Unexpected error during logout:', error)
        
        // Try to clear cookies anyway
        document.cookie.split(';').forEach(cookie => {
          const [name] = cookie.trim().split('=')
          if (name && (name.includes('supabase') || name.includes('auth'))) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
          }
        })
        
        // Fallback redirect after short delay
        setTimeout(() => {
          window.location.href = '/'
        }, 1000)
      }
    }
    
    handleLogout()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="mb-8 flex justify-center">
          <picture>
            <source srcSet="/images/optimized/earthie_logo.webp" type="image/webp" />
            <Image 
              src="/images/optimized/earthie_logo_optimized.png" 
              alt="Earthie Logo" 
              width={64} 
              height={64} 
            />
          </picture>
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">Logging Out...</h1>
        <p className="text-gray-400">Please wait while we log you out safely.</p>
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-md text-red-200">
            Error: {error}
          </div>
        )}
      </div>
    </div>
  )
} 