'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, VolumeX, PhoneOff } from 'lucide-react';
import Image from 'next/image';

interface VoiceModeProps {
  isActive: boolean;
  onToggle: () => void;
  onVoiceInput: (text: string) => void;
  textToSpeak: string;
  onSpeechEnd: () => void;
}

const VoiceMode: React.FC<VoiceModeProps> = ({
  isActive,
  onToggle,
  onVoiceInput,
  textToSpeak,
  onSpeechEnd,
}) => {
  const [recognition, setRecognition] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const handleSpeechEnd = useCallback(() => {
    setIsSpeaking(false);
    onSpeechEnd();
  }, [onSpeechEnd]);

  const speakText = useCallback(async (text: string) => {
    if (!text || isSpeaking) return;

    setIsSpeaking(true);
    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play().catch(e => {
            console.error("Audio play failed:", e);
            handleSpeechEnd();
          });
        }
      } else {
        // Fallback to browser speech synthesis
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.onend = handleSpeechEnd;
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      handleSpeechEnd();
    }
  }, [isSpeaking, handleSpeechEnd]);

  useEffect(() => {
    if (textToSpeak && isActive) {
      speakText(textToSpeak);
    }
  }, [textToSpeak, isActive, speakText]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onstart = () => setIsListening(true);
      recognitionInstance.onend = () => setIsListening(false);
      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onVoiceInput(transcript);
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, [onVoiceInput]);

  const toggleListening = () => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
      <Button variant="ghost" size="sm" onClick={onToggle} className="absolute top-4 right-4 text-white hover:bg-white/10">
        ✕
      </Button>

      <div className="flex flex-col items-center space-y-8">
        <div className="relative">
          {(isListening || isSpeaking) && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-[#50E3C1]/30 animate-ping scale-110"></div>
              <div className="absolute inset-0 rounded-full border-2 border-[#50E3C1]/20 animate-ping scale-125 animation-delay-75"></div>
              <div className="absolute inset-0 rounded-full border-2 border-[#50E3C1]/10 animate-ping scale-150 animation-delay-150"></div>
            </>
          )}
          
          <div className={`relative w-48 h-48 rounded-full overflow-hidden border-4 transition-all duration-300 ${
            isListening ? 'border-blue-400 shadow-lg shadow-blue-400/50' :
            isSpeaking ? 'border-[#50E3C1] shadow-lg shadow-[#50E3C1]/50' :
            'border-gray-600'
          }`}>
            <picture>
              <source srcSet="/images/optimized/earthie_logo.webp" type="image/webp" />
              <Image 
                src="/images/optimized/earthie_logo_optimized.png" 
                alt="Earthie" 
                fill 
                className="object-cover" 
                priority 
              />
            </picture>
            {isSpeaking && <div className="absolute inset-0 bg-[#50E3C1]/20 animate-pulse"></div>}
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">
            {isSpeaking ? 'Earthie is speaking...' : isListening ? 'Listening...' : 'Voice Mode'}
          </h2>
          <p className="text-gray-300">
            {isSpeaking ? ' ' : isListening ? 'Speak now...' : 'Tap the microphone to talk'}
          </p>
        </div>

        <div className="flex items-center space-x-6">
          <Button
            size="lg"
            onClick={toggleListening}
            disabled={isSpeaking}
            className={`w-16 h-16 rounded-full p-0 transition-colors ${
              isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
          </Button>

          <Button
            variant="destructive"
            size="lg"
            onClick={onToggle}
            className="w-16 h-16 rounded-full p-0 bg-red-600 hover:bg-red-700"
          >
            <PhoneOff size={24} />
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              window.speechSynthesis.cancel();
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
              }
              handleSpeechEnd();
            }}
            disabled={!isSpeaking}
            className="w-16 h-16 rounded-full p-0"
          >
            <VolumeX size={24} />
          </Button>
        </div>
      </div>

      <audio ref={audioRef} onEnded={handleSpeechEnd} className="hidden" />
    </div>
  );
};

export default VoiceMode; 