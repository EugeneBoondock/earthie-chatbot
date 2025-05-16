'use client';

import React from 'react';
import { useAudioPlayer } from '@/contexts/AudioContext';
import { Button } from '@/components/ui/button';
import { Play, Pause, StopCircle, Loader2, Radio, XCircle } from 'lucide-react';
import Image from 'next/image';

export default function GlobalRadioPlayer() {
  const { currentStation, isPlaying, isLoading, togglePlayPause, stopRadio } = useAudioPlayer();
  const [isMinimized, setIsMinimized] = React.useState(true);

  if (!currentStation) {
    return null; // Don't render anything if no station has been selected yet
  }

  const handleToggleMinimize = (e: React.MouseEvent) => {
    // Prevent click on the player content from triggering if it's part of the button area
    e.stopPropagation(); 
    setIsMinimized(!isMinimized);
  };

  return (
    <div 
        className={`fixed bottom-20 right-4 z-[1000] transition-all duration-300 ease-in-out shadow-xl rounded-lg border border-earthie-mint/30 ${isMinimized ? 'w-14 h-14' : 'w-72 md:w-80 bg-earthie-dark/90 backdrop-blur-md p-3'}`}
        onClick={isMinimized ? handleToggleMinimize : undefined} // Expand if minimized and clicked
    >
      {isMinimized ? (
        <Button 
            variant="ghost" 
            size="icon" 
            className="w-full h-full bg-earthie-dark/90 backdrop-blur-md hover:bg-earthie-dark-light rounded-lg flex items-center justify-center"
            aria-label="Open Radio Player"
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-earthie-mint" />
          ) : isPlaying ? (
            <Radio className="h-6 w-6 text-earthie-mint animate-pulse" />
          ) : (
            <Radio className="h-6 w-6 text-gray-400" />
          )}
        </Button>
      ) : (
        // Expanded Player View
        <div className="flex flex-col h-full text-white">
          <div className="flex items-center mb-2">
            {currentStation.image ? (
                <Image src={currentStation.image} alt={currentStation.name} width={40} height={40} className="rounded-md mr-2" />
            ) : (
                <div className="w-10 h-10 bg-gray-700 rounded-md mr-2 flex items-center justify-center">
                    <Radio className="h-5 w-5 text-gray-400" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" title={currentStation.name}>{currentStation.name}</p>
                {isLoading && <p className="text-xs text-earthie-mint">Loading...</p>}
                {!isLoading && isPlaying && <p className="text-xs text-earthie-mint">Playing</p>}
                {!isLoading && !isPlaying && <p className="text-xs text-gray-400">Paused</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={handleToggleMinimize} className="ml-2 text-gray-400 hover:text-white h-7 w-7">
                <XCircle className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center justify-around mt-auto">
            <Button variant="ghost" size="icon" onClick={togglePlayPause} disabled={isLoading} className="text-earthie-mint hover:text-earthie-mint/80 disabled:text-gray-500 h-9 w-9">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={stopRadio} className="text-gray-400 hover:text-red-500 h-9 w-9">
              <StopCircle className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
