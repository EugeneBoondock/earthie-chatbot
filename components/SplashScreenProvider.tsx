"use client";
import { useState, useEffect, ReactNode } from "react";
import SplashScreen from "./SplashScreen";
import Head from "next/head";

interface SplashScreenProviderProps {
  children: ReactNode;
}

export default function SplashScreenProvider({ children }: SplashScreenProviderProps) {
  const [showSplash, setShowSplash] = useState(true);
  const [renderBlankScreen, setRenderBlankScreen] = useState(true);

  useEffect(() => {
    // Check if this is a PWA (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const lastVisit = localStorage.getItem('lastVisit');
    const now = new Date().getTime();
    
    // Always show splash if in standalone mode
    // For regular browser, show if first visit or visited more than 1 hour ago
    if (!isStandalone && lastVisit && (now - parseInt(lastVisit, 10) <= 60 * 60 * 1000)) {
      setShowSplash(false);
      setRenderBlankScreen(false);
    } else {
      // Show blank screen for 200ms before showing the splash screen
      const blankTimer = setTimeout(() => {
        setRenderBlankScreen(false);
      }, 200);
      
      // If showing splash, hide it after animation
      const splashTimer = setTimeout(() => {
        setShowSplash(false);
      }, 2600); // Slightly longer than the animation in SplashScreen
      
      return () => {
        clearTimeout(blankTimer);
        clearTimeout(splashTimer);
      };
    }
    
    // Update last visit time
    localStorage.setItem('lastVisit', now.toString());
  }, []);
  
  // Preload the logo image to ensure it's ready before the splash screen
  useEffect(() => {
    const img = new Image();
    img.src = "/images/earthie_logo.png";
    img.decoding = "async";
    img.fetchPriority = "high";
  }, []);
  
  return (
    <>
      {renderBlankScreen && (
        <div className="fixed inset-0 z-[9999] bg-[#0f172a]"></div>
      )}
      {showSplash && !renderBlankScreen && <SplashScreen />}
      {children}
    </>
  );
} 