'use client'

import Link from 'next/link'

// Verify Email Page Component
export default function VerifyEmailPage() {
  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full bg-gray-900/70 border border-sky-400/30 shadow-2xl shadow-sky-400/10 rounded-2xl p-8 backdrop-blur-lg text-center">
        <div className="flex flex-col items-center mb-6">
          <img src="/images/earthie_logo.png" alt="Earthie Logo" className="w-16 h-16 mb-3" />
          <h1 className="text-3xl font-bold tracking-tight text-sky-300">Check Your Email</h1>
        </div>
        <p className="text-cyan-100/90 mb-6">
          A verification link has been sent to your email address. Please click the link to complete your registration.
        </p>
        <p className="text-sm text-cyan-300/70 mb-2">
          Didn&apos;t receive an email? Check your spam folder or try again.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/auth/login"
            className="w-full flex justify-center py-2.5 px-4 rounded-lg font-semibold text-base bg-sky-500 hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg shadow-sky-400/20 transition">
            Back to Login
          </Link>
          {/* Optionally, add a resend email button here later */}
        </div>
      </div>
    </div>
  )
} 