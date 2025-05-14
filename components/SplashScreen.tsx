"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";

interface Point {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
  branch?: boolean;
  branchChance?: number;
}

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation state
  const animationFrameRef = useRef<number | null>(null);
  const pointsRef = useRef<Point[]>([]);
  
  // Colors from the website's theme
  const colors = ['#50E3C1', '#38bdf8', '#818cf8', '#3b82f6'];

  useEffect(() => {
    // Start fade out after 2.2 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2200);
    
    // Hide splash screen after 2.5 seconds
    const hideTimer = setTimeout(() => {
      setShow(false);
    }, 2500);

    // Set up canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: true });
      
      if (!ctx) return;

      // Set canvas to full screen
      const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };

      handleResize();
      window.addEventListener('resize', handleResize);

      // Animation function
      const animate = () => {
        if (!ctx || !canvas) return;

        // Create new points
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 65; // Approximate radius of the logo

        if (Math.random() < 0.4) {
          const angle = Math.random() * Math.PI * 2;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          const speed = 0.8 + Math.random() * 2;
          const dx = Math.cos(angle) * speed;
          const dy = Math.sin(angle) * speed;
          
          const color = colors[Math.floor(Math.random() * colors.length)];
          const maxLife = 60 + Math.random() * 100;
          
          pointsRef.current.push({
            x, y, dx, dy, 
            life: 0,
            maxLife,
            color,
            width: 0.5 + Math.random() * 2.5,
            branch: true,
            branchChance: 0.03
          });
        }

        // Clear canvas with slight fade effect for trail
        ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw and update points
        pointsRef.current.forEach((point, index) => {
          // Update position
          point.x += point.dx;
          point.y += point.dy;
          point.life += 1;

          // Calculate opacity based on life
          const opacity = 1 - (point.life / point.maxLife);
          
          // Draw line with glow effect
          ctx.beginPath();
          ctx.moveTo(point.x - point.dx * 3, point.y - point.dy * 3);
          ctx.lineTo(point.x, point.y);
          
          // Add glow effect
          ctx.shadowBlur = 5;
          ctx.shadowColor = point.color;
          
          ctx.strokeStyle = point.color + Math.floor(opacity * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = point.width * opacity;
          ctx.stroke();
          
          // Reset shadow for performance
          ctx.shadowBlur = 0;
          
          // Create branches
          if (point.branch && point.branchChance && Math.random() < point.branchChance && point.life > 10) {
            const branchAngle = Math.PI / 2 * (Math.random() - 0.5);
            const speed = 0.5 + Math.random() * 1;
            
            const newDx = Math.cos(Math.atan2(point.dy, point.dx) + branchAngle) * speed;
            const newDy = Math.sin(Math.atan2(point.dy, point.dx) + branchAngle) * speed;
            
            pointsRef.current.push({
              x: point.x,
              y: point.y,
              dx: newDx,
              dy: newDy,
              life: 0,
              maxLife: point.maxLife * 0.7,
              color: point.color,
              width: point.width * 0.7,
              branch: Math.random() < 0.3,
              branchChance: 0.01
            });
          }

          // Remove dead points
          if (point.life >= point.maxLife) {
            pointsRef.current.splice(index, 1);
          }
        });

        // Continue animation
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      // Start animation
      animationFrameRef.current = requestAnimationFrame(animate);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f172a] transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative w-32 h-32 mb-4 logo-container">
          <div className="absolute inset-0 rounded-full blur-sm bg-earthie-mint/30"></div>
          <div className="relative w-full h-full rounded-full overflow-hidden glow">
            <Image
              src="/images/earthie_logo.png"
              alt="Earthie"
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              priority
              className="object-contain scale-90"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold mt-4 tracking-wider text-gradient">
          EARTHIE
        </h1>
        <p className="text-gradient-subtle mt-2 text-sm font-medium">Your Earth2 AI Companion</p>
      </div>

      <style jsx>{`
        .glow {
          box-shadow: 0 0 30px 8px rgba(80, 227, 193, 0.5);
        }
        .logo-container {
          animation: pulse 2s infinite alternate;
        }
        .text-gradient {
          background: linear-gradient(to right, #50E3C1, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 10px rgba(80, 227, 193, 0.3);
          letter-spacing: 0.2em;
        }
        .text-gradient-subtle {
          background: linear-gradient(to right, #50E3C1, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: 0.15em;
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
} 