"use client";
import { useEffect, useState } from "react";

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      console.log("beforeinstallprompt event fired");
      e.preventDefault();
      setDeferredPrompt(e);
      setShowButton(true);
    };
    console.log("Event listener added");
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // @ts-ignore
    deferredPrompt.prompt();
    // @ts-ignore
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowButton(false);
    }
  };

  if (!showButton) return null;

  return (
    <button
      onClick={handleInstallClick}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1000,
        padding: "1em 2em",
        background: "#50E3C1",
        color: "#18181b",
        border: "none",
        borderRadius: 8,
        fontWeight: "bold",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      Install Earthie App
    </button>
  );
}
