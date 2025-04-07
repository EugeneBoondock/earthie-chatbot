"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react"
import { Slider } from "@/components/ui/slider"

type Podcast = {
  id: string
  title: string
  description: string
  duration: string
  image: string
}

const podcasts: Podcast[] = [
  {
    id: "1",
    title: "Earth2 Market Updates",
    description: "Weekly updates on the Earth2 marketplace, property values, and trading tips.",
    duration: "32:45",
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: "2",
    title: "Resource Farming Guide",
    description: "Learn the best strategies for resource farming and maximizing your yields in Earth2.",
    duration: "45:12",
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: "3",
    title: "Earth2 Developer Interview",
    description: "Exclusive interview with Earth2 developers about upcoming features and roadmap.",
    duration: "58:30",
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: "4",
    title: "Community Spotlight",
    description: "Highlighting amazing creations and achievements from the Earth2 community.",
    duration: "26:18",
    image: "/placeholder.svg?height=80&width=80",
  },
  {
    id: "5",
    title: "Beginner's Guide to Earth2",
    description: "Everything new players need to know to get started in the world of Earth2.",
    duration: "41:05",
    image: "/placeholder.svg?height=80&width=80",
  },
]

export default function RadioPage() {
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(80)

  const handlePlayPodcast = (podcast: Podcast) => {
    setCurrentPodcast(podcast)
    setIsPlaying(true)
  }

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="container py-8 bg-earthie-dark">
      <h1 className="text-3xl font-bold mb-8 text-center text-white">Earth2 Radio</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {podcasts.map((podcast) => (
          <Card key={podcast.id} className="overflow-hidden bg-earthie-dark-light border-earthie-dark-light">
            <CardHeader className="flex flex-row items-start gap-4 p-4">
              <img
                src={podcast.image || "/placeholder.svg"}
                alt={podcast.title}
                className="rounded-md object-cover w-20 h-20"
              />
              <div className="flex-1">
                <CardTitle className="text-white">{podcast.title}</CardTitle>
                <CardDescription className="line-clamp-2 mt-2 text-gray-300">{podcast.description}</CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="flex justify-between p-4 pt-0">
              <span className="text-sm text-gray-400">{podcast.duration}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePlayPodcast(podcast)}
                className="text-earthie-mint border-earthie-mint hover:bg-earthie-mint/10"
              >
                {currentPodcast?.id === podcast.id && isPlaying ? "Now Playing" : "Play"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {currentPodcast && (
        <Card className="sticky bottom-4 border-2 border-earthie-mint/20 shadow-lg bg-earthie-dark-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <img
                src={currentPodcast.image || "/placeholder.svg"}
                alt={currentPodcast.title}
                className="rounded-md object-cover w-16 h-16"
              />
              <div className="flex-1">
                <h3 className="font-bold text-white">{currentPodcast.title}</h3>
                <p className="text-sm text-gray-300 line-clamp-1">{currentPodcast.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400">00:00</span>
                  <div className="flex-1 h-1 bg-earthie-dark rounded-full overflow-hidden">
                    <div className="h-full bg-earthie-mint" style={{ width: "30%" }}></div>
                  </div>
                  <span className="text-xs text-gray-400">{currentPodcast.duration}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-white hover:text-earthie-mint hover:bg-earthie-dark"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  onClick={togglePlayPause}
                  className="rounded-full bg-earthie-mint text-earthie-dark hover:bg-earthie-mint/90"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-white hover:text-earthie-mint hover:bg-earthie-dark"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Volume2 className="h-4 w-4 text-gray-400" />
                <Slider
                  value={[volume]}
                  max={100}
                  step={1}
                  className="w-24"
                  onValueChange={(value) => setVolume(value[0])}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

