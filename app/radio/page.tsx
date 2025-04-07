"use client"

import { useState, useRef } from "react"
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
  audioUrl: string
}

const podcasts: Podcast[] = [
  {
    id: "1",
    title: "The Whitepaper",
    description: "First episode of the Earth2 Radio show.",
    duration: "23:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/Sept132024ep1.mp3"
  },
  {
    id: "2",
    title: "Earth2 Deepdive",
    description: "Second episode of the Earth2 Radio show.",
    duration: "21:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/Sept142024ep2.mp3"
  },
  {
    id: "3",
    title: "Fiat Withdrawals",
    description: "Third episode of the Earth2 Radio show.",
    duration: "14:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/Sept152024ep3.mp3"
  },
  {
    id: "4",
    title: "Future of Earth2",
    description: "Fourth episode of the Earth2 Radio show.",
    duration: "18:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/sept182024ep4.mp3"
  },
  {
    id: "5",
    title: "Wildlife in Earth2",
    description: "Fifth episode of the Earth2 Radio show.",
    duration: "28:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/sept192024ep5.mp3"
  },
  {
    id: "6",
    title: "Earth2 Buildings",
    description: "Sixth episode of the Earth2 Radio show.",
    duration: "31:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/oct82024ep6.mp3"
  },
  {
    id: "7",
    title: "Land Essence Upgrade",
    description: "Seventh episode of the Earth2 Radio show.",
    duration: "29:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/oct92024ep7.mp3"
  },
  {
    id: "8",
    title: "Shane addresses rumours",
    description: "Eighth episode of the Earth2 Radio show.",
    duration: "18:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/oct112024ep8.mp3"
  },
  {
    id: "9",
    title: "Earth2 Launcher",
    description: "Ninth episode of the Earth2 Radio show.",
    duration: "21:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/oct182024ep9.mp3"
  },
  {
    id: "10",
    title: "Resource Mining  [Ecosim]",
    description: "Tenth episode of the Earth2 Radio show.",
    duration: "43:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/nov152024ep10.mp3"
  },
  {
    id: "11",
    title: "Creation Process [Avatar]",
    description: "Eleventh episode of the Earth2 Radio show.",
    duration: "34:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/nov202024ep11.mp3"
  },
  {
    id: "12",
    title: "E2v1 Status Update",
    description: "Twelfth episode of the Earth2 Radio show.",
    duration: "41:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/jan302025ep12.mp3"
  },
  {
    id: "13",
    title: "E2V1 release for testers",
    description: "Thirteenth episode of the Earth2 Radio show.",
    duration: "48:00",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/feb92025ep13.mp3"
  }
]

export default function RadioPage() {
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(80)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlayPodcast = (podcast: Podcast) => {
    setCurrentPodcast(podcast)
    setIsPlaying(true)
    if (audioRef.current) {
      audioRef.current.src = podcast.audioUrl
      audioRef.current.play()
    }
  }

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0])
    if (audioRef.current) {
      audioRef.current.volume = value[0] / 100
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
                  <span className="text-xs text-gray-400">{formatTime(currentTime)}</span>
                  <div className="flex-1 h-1 bg-earthie-dark rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-earthie-mint" 
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(duration)}</span>
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
                  onValueChange={handleVolumeChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  )
}

