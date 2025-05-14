"use client";
import { useState, useEffect, ReactNode } from "react";
import SplashScreen from "./SplashScreen";

interface SplashScreenProviderProps {
  children: ReactNode;
}

export default function SplashScreenProvider({ children }: SplashScreenProviderProps) {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Check if this is a PWA (standalone mode) or first visit
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const lastVisit = localStorage.getItem('lastVisit');
    const now = new Date().getTime();
    
    // Show splash if:
    // 1. App is running in standalone mode (PWA)
    // 2. First visit or visited more than 1 hour ago
    if (isStandalone || !lastVisit || (now - parseInt(lastVisit, 10) > 60 * 60 * 1000)) {
      setShowSplash(true);
    }
    
    // Update last visit time
    localStorage.setItem('lastVisit', now.toString());
  }, []);
  
  return (
    <>
      {showSplash && <SplashScreen />}
      {children}
    </>
  );
} 