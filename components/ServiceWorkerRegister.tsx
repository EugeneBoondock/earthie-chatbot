"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Register service worker as soon as possible
      window.addEventListener("load", async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            // This ensures the service worker takes control immediately
            // which is important for our splash screen strategy
            updateViaCache: "none"
          });
          
          console.log("Service Worker registered with scope:", registration.scope);
          
          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("New service worker installed and ready to activate on next load");
                }
              });
            }
          });
        } catch (error) {
          console.error("Service Worker registration failed:", error);
        }
      });
      
      // Handle service worker updates
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("Service Worker controller changed");
      });
    }
  }, []);
  
  return null;
}
