"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { AlertCircle, CheckCircle, Github } from "lucide-react"
import { signIn } from "next-auth/react"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsLoading(true)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Registration failed")
      }

      setSuccess("Registration successful! Logging you in...")

      // Auto login after successful registration
      setTimeout(async () => {
        await signIn("credentials", {
          redirect: false,
          email,
          password,
        })
        router.push("/")
        router.refresh()
      }, 1500)
    } catch (error) {
      setError((error as Error).message || "Something went wrong. Please try again.")
      setIsLoading(false)
    }
  }

  const handleGitHubSignUp = () => {
    signIn("github", { callbackUrl: "/" })
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-16rem)] py-8">
      <Card className="w-full max-w-md bg-earthie-dark-light border-earthie-dark-light">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-white">Create an account</CardTitle>
          <CardDescription className="text-center text-gray-300">
            Enter your details to create a new account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full border-gray-500 text-white hover:bg-earthie-dark-light rounded-xl flex items-center justify-center gap-2"
              onClick={handleGitHubSignUp}
            >
              <Github className="h-5 w-5" />
              Sign up with GitHub
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-500"></span>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-earthie-dark-light px-2 text-gray-400">OR CONTINUE WITH</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-900/20 text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg bg-earthie-mint/20 text-earthie-mint flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <p className="text-sm">{success}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">
                  Name
                </Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-earthie-dark border-earthie-dark-light text-white rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-earthie-dark border-earthie-dark-light text-white rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-earthie-dark border-earthie-dark-light text-white rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-earthie-dark border-earthie-dark-light text-white rounded-lg"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-earthie-mint text-earthie-dark hover:bg-earthie-mint/90 rounded-xl"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Sign Up"}
              </Button>
            </form>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-gray-300">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-earthie-mint hover:underline">
              Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

