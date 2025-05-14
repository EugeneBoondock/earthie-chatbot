"use client";
import { useState, useEffect, ReactNode } from "react";
import SplashScreen from "./SplashScreen";
import Head from "next/head";

interface SplashScreenProviderProps {
  children: ReactNode;
}

export default function SplashScreenProvider({ children }: SplashScreenProviderProps) {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Check if this is a PWA (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const lastVisit = localStorage.getItem('lastVisit');
    const now = new Date().getTime();
    
    // Always show splash if in standalone mode
    // For regular browser, show if first visit or visited more than 1 hour ago
    if (!isStandalone && lastVisit && (now - parseInt(lastVisit, 10) <= 60 * 60 * 1000)) {
      setShowSplash(false);
    }
    
    // If showing splash, hide it after animation
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 2600); // Slightly longer than the animation in SplashScreen
      
      return () => clearTimeout(timer);
    }
    
    // Update last visit time
    localStorage.setItem('lastVisit', now.toString());
  }, [showSplash]);
  
  // Preload the logo image to ensure it's ready before the splash screen
  useEffect(() => {
    const img = new Image();
    img.src = "/images/earthie_logo.png";
  }, []);
  
  return (
    <>
      {showSplash && <SplashScreen />}
      {children}
    </>
  );
} 