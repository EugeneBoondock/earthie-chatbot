'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase' // Ensure this uses createClientComponentClient or createBrowserClient
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // If Supabase returns an error, throw it to be caught by the catch block
        throw signInError
      }
      
      // Login successful, determine where to redirect
      const redirectTo = searchParams.get('redirectTo');
      const targetPath = redirectTo || '/hub/profile'; // Default to /hub/profile if no redirectTo

      console.log(`[LoginForm] Login successful. Attempting to redirect to: ${targetPath}`);
      
      // Navigate to the target path
      router.push(targetPath); 

      // setLoading(false) will be effectively handled by the component unmounting on navigation,
      // or you could set it here if you want to be explicit, though often unnecessary.
      // If the navigation is very fast, this might not even visually register.
      // setLoading(false); // Optional: if you want to ensure it's reset before navigation completes

    } catch (error: any) {
      console.error("[LoginForm] Login error:", error.message);
      setError(error.message); // Display the error to the user
      setLoading(false); // Ensure loading is set to false on error
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center">
      <div className="w-96 bg-gray-900/60 border border-emerald-400/40 shadow-2xl shadow-emerald-400/20 rounded-2xl px-8 py-8 backdrop-blur-lg flex flex-col items-center justify-start">
        <div className="flex flex-col items-center mb-6 mt-2">
          <img src="/images/earthie_logo.png" alt="Earthie Logo" className="w-14 h-14 mb-2" />
          <span className="text-cyan-200 text-xl font-semibold tracking-wide">Earthie</span>
        </div>
        <form onSubmit={handleLogin} className="space-y-5 w-full mt-2">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-cyan-200">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg bg-gray-800/60 border border-cyan-400/20 text-cyan-100 placeholder-gray-500 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 shadow-sm font-mono px-3 py-2 transition"
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
              className="mt-1 block w-full rounded-lg bg-gray-800/60 border border-cyan-400/20 text-cyan-100 placeholder-gray-500 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 shadow-sm font-mono px-3 py-2 transition"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-red-400 text-sm font-semibold text-center mt-2">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 rounded-lg font-bold text-base bg-gradient-to-r from-emerald-400 to-emerald-600 text-cyan-100 hover:from-emerald-500 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 shadow-lg shadow-emerald-400/20 transition disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <a href="/auth/signup" className="text-emerald-400 hover:text-emerald-300 text-sm underline transition">Or create an account</a>
        </div>
      </div>
    </div>
  )
}