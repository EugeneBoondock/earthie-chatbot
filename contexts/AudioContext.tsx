'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

interface RadioStation {
  id: string;
  name: string;
  streamUrl?: string;
  url: string; // Fallback or homepage URL
  image?: string;
  // Add other relevant fields if needed from your existing RadioStation type
}

interface AudioState {
  currentStation: RadioStation | null;
  isPlaying: boolean;
  audioElement: HTMLAudioElement | null;
}

interface AudioContextType extends AudioState {
  playStation: (station: RadioStation) => void;
  togglePlayPause: () => void;
  stopRadio: () => void;
  isLoading: boolean;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio element on client-side
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.oncanplay = () => {
        setIsLoading(false);
        if (audioRef.current) { // Ensure audioRef.current is not null
            audioRef.current.play().catch(e => console.error("Error auto-playing:", e));
            setIsPlaying(true);
        }
      };
      audioRef.current.onplaying = () => {
        setIsLoading(false);
        setIsPlaying(true);
      };
      audioRef.current.onpause = () => setIsPlaying(false);
      audioRef.current.onended = () => { // Optionally handle track ending (e.g., play next, stop)
        setIsPlaying(false);
        setCurrentStation(null); // Or play next logic
      };
      audioRef.current.onerror = (e) => {
        console.error('Audio Element Error:', e);
        setIsLoading(false);
        setIsPlaying(false);
        // Optionally notify user
      };
      audioRef.current.onstalled = () => {
        console.warn('Audio stalled, possibly due to network issues.');
        setIsLoading(true); // Show loading as it might be buffering
      };
      audioRef.current.onwaiting = () => {
        setIsLoading(true);
      };
    }
    // Cleanup
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ''; // Release the audio source
        // Remove event listeners if added directly
      }
    };
  }, []);

  const playStation = useCallback((station: RadioStation) => {
    if (!audioRef.current) return;
    if (currentStation?.id === station.id && isPlaying) {
      // If same station is playing, treat as toggle to pause
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (currentStation?.id === station.id && !isPlaying) {
      // If same station is paused, resume
      audioRef.current.play().catch(e => console.error("Error resuming playback:", e));
      setIsPlaying(true);
    } else {
      // New station or different station
      setCurrentStation(station);
      setIsLoading(true);
      audioRef.current.src = station.streamUrl || station.url; // Prefer streamUrl
      audioRef.current.load(); // Important: call load() after setting new src
      // Play will be triggered by 'oncanplay' or 'onplaying'
    }
  }, [currentStation, isPlaying]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !currentStation) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // If audioRef source is currentStation's source, just play. Otherwise, set source and play.
      if (audioRef.current.src !== (currentStation.streamUrl || currentStation.url)) {
        setIsLoading(true);
        audioRef.current.src = currentStation.streamUrl || currentStation.url;
        audioRef.current.load(); 
        // Playback will be handled by oncanplay
      } else {
        audioRef.current.play().catch(e => console.error("Error in togglePlayPause:", e));
      }
    }
    setIsPlaying(!isPlaying); // Optimistic update, might be refined by event handlers
  }, [isPlaying, currentStation]);
  
  const stopRadio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = ''; // Clear source
    }
    setCurrentStation(null);
    setIsPlaying(false);
    setIsLoading(false);
  }, []);


  return (
    <AudioContext.Provider value={{ 
        currentStation, 
        isPlaying, 
        audioElement: audioRef.current, 
        playStation, 
        togglePlayPause,
        stopRadio,
        isLoading
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioProvider');
  }
  return context;
}; 