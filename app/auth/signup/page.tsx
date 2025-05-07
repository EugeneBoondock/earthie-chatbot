import SignUpForm from '@/components/auth/SignUpForm'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-transparent relative z-10">
      <div className="w-full max-w-md flex flex-col items-center justify-center">


        <SignUpForm />
      </div>
    </div>
  )
}