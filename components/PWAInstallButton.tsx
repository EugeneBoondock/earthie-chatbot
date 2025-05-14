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
      const hasVisited = localStorage.getItem("hasVisited");
      if (hasVisited) {
        setShowButton(true);
      }
      localStorage.setItem("hasVisited", "true");
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
    <div 
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <button
        onClick={handleInstallClick}
        style={{
          padding: "0.75em 1.5em",
          background: "linear-gradient(120deg, rgba(80, 227, 193, 0.9), rgba(80, 227, 193, 0.8))",
          color: "#18181b",
          border: "none",
          borderRadius: 8,
          fontWeight: "bold",
          boxShadow: "0 4px 12px rgba(80, 227, 193, 0.3)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.5em",
          fontSize: "0.9rem",
          transition: "all 0.2s ease",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(80, 227, 193, 0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(80, 227, 193, 0.3)";
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "4px" }}>
          <path d="M12 2L19 9H15V19H9V9H5L12 2Z" fill="currentColor" />
        </svg>
        Install Earthie App
        <div className="light-ray"></div>
      </button>
      <style jsx>{`
        .light-ray {
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            90deg, 
            transparent, 
            rgba(255, 255, 255, 0.4), 
            transparent
          );
          transform: skewX(-25deg);
          animation: ray-animation 2.5s infinite;
        }
        
        @keyframes ray-animation {
          0% { left: -100%; }
          50% { left: 150%; }
          100% { left: 150%; }
        }
        
        button {
          backdrop-filter: blur(8px);
          border-top: 1px solid rgba(255, 255, 255, 0.3);
          border-left: 1px solid rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
