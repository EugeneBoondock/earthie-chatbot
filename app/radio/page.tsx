"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, Volume2, Rewind, FastForward } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Earth2 Radio | Exclusive News, Interviews & Updates",
  description: "Tune in to Earth2 Radio for the latest news, developer interviews, and community discussions about the Earth 2 metaverse. Stay informed with our exclusive podcast episodes.",
};

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
  },
  {
    id: "14",
    title: "Chapter 2: Teleportation",
    description: "Fourteenth episode of the Earth2 Radio show.",
    duration: "17:38",
    image: "/images/radio_thumbnail.jpeg",
    audioUrl: "/radio/may82025ep14.mp3"
  }
]

export default function RadioPage() {
  const [currentPodcastIndex, setCurrentPodcastIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(80)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressBarRef = useRef<HTMLDivElement | null>(null) // Ref for progress bar

  const currentPodcast = currentPodcastIndex !== null ? podcasts[currentPodcastIndex] : null

  const handlePlayPodcast = useCallback((index: number) => {
    const podcast = podcasts[index]
    setCurrentPodcastIndex(index)
    setIsPlaying(true)
    if (audioRef.current) {
      audioRef.current.src = podcast.audioUrl
      audioRef.current.playbackRate = playbackRate // Ensure playback rate is set
      audioRef.current.play()
    }
  }, [playbackRate]) // Add playbackRate dependency

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

  const handleNext = () => {
    if (currentPodcastIndex !== null) {
      const nextIndex = (currentPodcastIndex + 1) % podcasts.length
      handlePlayPodcast(nextIndex)
    }
  }

  const handlePrevious = () => {
    if (currentPodcastIndex !== null) {
      const prevIndex = (currentPodcastIndex - 1 + podcasts.length) % podcasts.length
      handlePlayPodcast(prevIndex)
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
    if (isNaN(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handlePlaybackRateChange = () => {
    const rates = [1, 1.5, 2]
    const currentIndex = rates.indexOf(playbackRate)
    const nextRate = rates[(currentIndex + 1) % rates.length]
    setPlaybackRate(nextRate)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate
    }
  }

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && progressBarRef.current && duration > 0) {
      const progressBar = progressBarRef.current
      const rect = progressBar.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const width = progressBar.clientWidth
      const percentage = clickX / width
      const newTime = duration * percentage
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime) // Update state immediately for responsiveness
    }
  }

  return (
    <TooltipProvider>
      <div className="container py-8 bg-earthie-dark">
        <h1 className="text-3xl font-bold mb-8 text-center text-white">Earth2 Radio</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {podcasts.map((podcast, index) => (
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
                  onClick={() => handlePlayPodcast(index)} // Pass index
                  className="text-earthie-mint border-earthie-mint hover:bg-earthie-mint/10"
                >
                  {currentPodcastIndex === index && isPlaying ? "Now Playing" : "Play"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {currentPodcast && (
          <Card className="sticky bottom-4 border-2 border-earthie-mint/20 shadow-lg bg-earthie-dark-light text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <img
                  src={currentPodcast.image || "/placeholder.svg"}
                  alt={currentPodcast.title}
                  className="rounded-md object-cover w-16 h-16 flex-shrink-0"
                />
                {/* Player Controls Section */}
                <div className="flex flex-col flex-1 gap-2 min-w-0">
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0 mr-4">
                      <h3 className="font-bold truncate">{currentPodcast.title}</h3>
                      <p className="text-sm text-gray-300 truncate">{currentPodcast.description}</p>
                    </div>
                    {/* Playback Speed & Volume */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                       <Tooltip>
                         <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handlePlaybackRateChange}
                              className="rounded-full w-8 h-8 text-xs hover:text-earthie-mint hover:bg-earthie-dark"
                            >
                              {playbackRate}x
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Playback Speed</p>
                          </TooltipContent>
                        </Tooltip>
                       <Volume2 className="h-4 w-4 text-gray-400 ml-2" />
                       <Slider
                         value={[volume]}
                         max={100}
                         step={1}
                         className="w-20"
                         onValueChange={handleVolumeChange}
                         aria-label="Volume"
                       />
                    </div>
                  </div>

                   {/* Progress Bar & Time */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-10 text-right">{formatTime(currentTime)}</span>
                    <div
                      ref={progressBarRef}
                      className="flex-1 h-2 bg-earthie-dark rounded-full overflow-hidden cursor-pointer"
                      onClick={handleSeek}
                    >
                      <div
                        className="h-full bg-earthie-mint transition-all duration-100 ease-linear"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-left">{formatTime(duration)}</span>
                  </div>

                  {/* Main Controls: Prev, Play/Pause, Next */}
                   <div className="flex justify-center items-center gap-3">
                     <Tooltip>
                       <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handlePrevious}
                          className="rounded-full text-white hover:text-earthie-mint hover:bg-earthie-dark"
                          disabled={currentPodcastIndex === null}
                        >
                          <SkipBack className="h-5 w-5" />
                        </Button>
                        </TooltipTrigger>
                       <TooltipContent>
                         <p>Previous</p>
                       </TooltipContent>
                     </Tooltip>

                     <Button
                      onClick={togglePlayPause}
                      className="rounded-full bg-earthie-mint text-earthie-dark hover:bg-earthie-mint/90 w-10 h-10"
                      disabled={currentPodcastIndex === null}
                     >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                     </Button>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleNext}
                          className="rounded-full text-white hover:text-earthie-mint hover:bg-earthie-dark"
                          disabled={currentPodcastIndex === null}
                        >
                          <SkipForward className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Next</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleNext} // Play next track when current one ends
          className="hidden"
        />
      </div>
    </TooltipProvider>
  )
}

