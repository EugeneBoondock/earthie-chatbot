import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-transparent relative z-10">
      <div className="w-full max-w-md flex flex-col items-center justify-center">
        <Suspense fallback={<div>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}