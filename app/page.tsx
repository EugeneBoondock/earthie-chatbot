import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Headphones, Code, MessageSquare } from "lucide-react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/auth.config.js"

export default async function Home() {
  const session = await getServerSession(authOptions)

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] bg-earthie-dark">
      {/* Hero Section */}
      <section className="py-12 md:py-24 lg:py-32 bg-gradient-to-b from-earthie-dark-light to-earthie-dark">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-white">
                  {session ? `Welcome back, ${session.user?.name || "Friend"}!` : "Meet Earthie, Your Earth2 Companion"}
                </h1>
                <p className="max-w-[600px] text-gray-300 md:text-xl">
                  The AI chatbot that knows everything about Earth2. Get answers, discover tips, and enhance your
                  virtual world experience.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link href="/chat">
                  <Button size="lg" className="bg-earthie-mint hover:bg-earthie-mint/90 text-earthie-dark rounded-xl">
                    Chat with Earthie <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/radio">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-earthie-mint text-earthie-mint hover:bg-earthie-mint/10 rounded-xl"
                  >
                    Listen to Radio
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px]">
                <Image
                  src="/images/earthie_cover.png"
                  alt="Earthie Character"
                  width={400}
                  height={400}
                  className="object-contain rounded-3xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rest of the component remains the same */}
      {/* Features Section */}
      <section className="py-12 md:py-24 lg:py-32 bg-earthie-dark">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white">
                Everything You Need for Earth2
              </h2>
              <p className="max-w-[900px] text-gray-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Earthie provides comprehensive tools and resources for Earth2 enthusiasts
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="flex flex-col items-center space-y-4 p-6 border border-earthie-dark-light rounded-xl bg-earthie-dark-light/50">
              <div className="p-3 rounded-full bg-earthie-mint/20">
                <MessageSquare className="w-8 h-8 text-earthie-mint" />
              </div>
              <h3 className="text-xl font-bold text-white">AI Chat Assistant</h3>
              <p className="text-center text-gray-300">
                Get instant answers to all your Earth2 questions from property management to gameplay strategies.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 p-6 border border-earthie-dark-light rounded-xl bg-earthie-dark-light/50">
              <div className="p-3 rounded-full bg-earthie-mint/20">
                <Headphones className="w-8 h-8 text-earthie-mint" />
              </div>
              <h3 className="text-xl font-bold text-white">Earth2 Radio</h3>
              <p className="text-center text-gray-300">
                Listen to podcasts and updates about the latest developments in the Earth2 universe.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 p-6 border border-earthie-dark-light rounded-xl bg-earthie-dark-light/50">
              <div className="p-3 rounded-full bg-earthie-mint/20">
                <Code className="w-8 h-8 text-earthie-mint" />
              </div>
              <h3 className="text-xl font-bold text-white">Developer Tools</h3>
              <p className="text-center text-gray-300">
                Submit and share your Earth2 scripts to enhance the community experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-24 lg:py-32 bg-gradient-to-b from-earthie-dark to-earthie-dark-light">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white">
                Ready to Explore Earth2?
              </h2>
              <p className="max-w-[600px] text-gray-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Start chatting with Earthie today and unlock the full potential of your virtual world experience.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Link href="/chat">
                <Button size="lg" className="bg-earthie-mint hover:bg-earthie-mint/90 text-earthie-dark rounded-xl">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

