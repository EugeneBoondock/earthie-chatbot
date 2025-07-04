'use client'

import { useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      if (data) {
        router.push('/auth/verify-email')
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center">
      <div className="w-96 bg-gray-900/60 border border-emerald-400/40 shadow-2xl shadow-emerald-400/20 rounded-2xl px-8 py-8 backdrop-blur-lg flex flex-col items-center justify-start">
        <div className="flex flex-col items-center mb-6 mt-2">
          <picture>
            <source srcSet="/images/optimized/earthie_logo.webp" type="image/webp" />
            <Image 
              src="/images/optimized/earthie_logo_optimized.png" 
              alt="Earthie Logo" 
              width={56} 
              height={56} 
              className="mb-2" 
            />
          </picture>
          <span className="text-cyan-200 text-xl font-semibold tracking-wide">Earthie</span>
        </div>
        <form onSubmit={handleSignUp} className="space-y-5 w-full mt-2">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-cyan-200">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-600 text-cyan-100 placeholder-gray-500 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 shadow-sm font-mono px-3 py-2 transition"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-cyan-200">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-600 text-cyan-100 placeholder-gray-500 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 shadow-sm font-mono px-3 py-2 transition"
              autoComplete="new-password"
            />
          </div>
          {error && (
            <div className="text-red-400 text-sm font-semibold text-center mt-2">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 rounded-lg font-bold text-base bg-emerald-500 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 shadow-lg shadow-emerald-400/20 transition disabled:opacity-60"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <a href="/auth/login" className="text-cyan-300 text-sm hover:underline">Or sign in to your account</a>
        </div>
      </div>
    </div>
  )
}